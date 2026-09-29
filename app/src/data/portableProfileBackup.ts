import { z } from 'zod';
import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  activeTaskSchema, behaviourEventSchema, legacyTaskHistorySchema, profileAwareSettingsSchema,
  rhythmTemplateSchema, settingsSchema,
  softPlacementSchema, strictIsoDateTimeSchema, taskPoolItemSchema,
} from './schemas';
import { rhythmInstanceSchema, rhythmPlanSchema, rhythmRecurrenceRevisionSchema, type RhythmInstance } from './rhythmAuthoritySchemas';
import { validateRhythmAuthorityRelationships } from './rhythmAuthorityRepository';
import { explicitPreferenceStoreRecordSchema, EXPLICIT_PREFERENCES_RECORD_ID } from './explicitPreferenceSchema';
import { durationLearningControlStoreRecordSchema, DURATION_LEARNING_CONTROLS_RECORD_ID } from './durationLearningControlSchema';
import { calendarSourceRecordSchema } from './calendarSourceSchema';
import { persistedSchedulerPlacementSchema, schedulerPlanStateRecordSchema } from './schedulerPlanStateSchema';
import { icsCalendarAdapter } from '../domain/calendarAdapter';
import { validateCalendarCommitmentExpansion } from '../domain/calendarAvailability';
import { DAY_PROFILE_FOUNDATION_ID, loadSettingsResult, SETTINGS_APP_VERSION, SETTINGS_ID } from './settingsRepository';
import { isVisibleTodayStatus, poolStatusForActiveTask } from './taskLifecycleRepository';
import { advanceProfileRecoveryGeneration, PROFILE_RECOVERY_GENERATION_ID,
  profileRecoveryGenerationSchema, readProfileRecoveryGeneration } from './profileRecoveryGeneration';

export const PORTABLE_PROFILE_FORMAT = 'life-rhythm-portable-profile-backup';
export const PORTABLE_PROFILE_VERSION = 1;
export const REPLACE_LOCAL_PROFILE_CONFIRMATION = 'REPLACE LOCAL PROFILE';
export const MAX_PORTABLE_PROFILE_BYTES = 16 * 1024 * 1024;
const MAX_PORTABLE_PROFILE_RECORDS = 10_000;

/** Closed occurrences retain historical task/placement IDs, but only a live
 * routed occurrence needs an accepted coordinate to resume after recovery. */
function isLiveRoutedRhythmInstance(instance: RhythmInstance): instance is RhythmInstance & {
  activeTaskId: string; placementId: string;
} {
  return !!instance.activeTaskId && !!instance.placementId &&
    (instance.lifecycleState === 'today' || instance.lifecycleState === 'inProgress' ||
      instance.lifecycleState === 'paused');
}

const foundationSchema = profileAwareSettingsSchema.innerType().pick({
  id: true, appVersion: true, updatedAt: true,
  dayProfileMigrationState: true, dayProfiles: true, weekdayProfileAssignments: true,
}).extend({ id: z.literal(DAY_PROFILE_FOUNDATION_ID) }).strict();

function checkCollectionBounds(input: unknown) {
  if (!input || typeof input !== 'object' || !('data' in input)) return;
  const data = (input as { data: unknown }).data;
  if (!data || typeof data !== 'object') return;
  let count = 0;
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) count += value.length;
    if (count > MAX_PORTABLE_PROFILE_RECORDS) throw new Error('Portable profile exceeds safe record bounds.');
  }
  for (const key of ['explicitPreferences', 'durationControls'] as const) {
    const sidecar = (data as Record<string, unknown>)[key];
    if (sidecar && typeof sidecar === 'object') {
      const records = (sidecar as Record<string, unknown>)[key === 'explicitPreferences' ? 'preferences' : 'controls'];
      if (Array.isArray(records)) count += records.length;
    }
  }
  if (count > MAX_PORTABLE_PROFILE_RECORDS) throw new Error('Portable profile exceeds safe record bounds.');
}

const unique = (values: Array<{ id: string }>, path: string, context: z.RefinementCtx) => {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: [path, index, 'id'], message: 'Duplicate ID.' });
    seen.add(value.id);
  });
};

export const portableProfileSchema = z.object({
  format: z.literal(PORTABLE_PROFILE_FORMAT),
  formatVersion: z.literal(PORTABLE_PROFILE_VERSION),
  appVersion: z.string().min(1),
  exportedAt: strictIsoDateTimeSchema,
  data: z.object({
    settings: settingsSchema.nullable(),
    rhythmTemplates: z.array(rhythmTemplateSchema),
    rhythmPlans: z.array(rhythmPlanSchema),
    rhythmRecurrenceRevisions: z.array(rhythmRecurrenceRevisionSchema),
    rhythmInstances: z.array(rhythmInstanceSchema),
    activeTasks: z.array(activeTaskSchema),
    taskPoolItems: z.array(taskPoolItemSchema),
    softPlacements: z.array(softPlacementSchema),
    routedRhythmPlacements: z.array(persistedSchedulerPlacementSchema),
    behaviourEvents: z.array(behaviourEventSchema),
    explicitPreferences: explicitPreferenceStoreRecordSchema.nullable(),
    durationControls: durationLearningControlStoreRecordSchema.nullable(),
    calendarSource: calendarSourceRecordSchema.nullable(),
  }).strict(),
}).strict().superRefine((backup, context) => {
  const d = backup.data;
  if (d.settings && d.settings.id !== SETTINGS_ID) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'settings', 'id'],
      message: 'Settings must use the current canonical record ID.' });
  }
  for (const key of ['rhythmTemplates', 'rhythmPlans', 'rhythmRecurrenceRevisions', 'rhythmInstances',
    'activeTasks', 'taskPoolItems', 'softPlacements', 'behaviourEvents'] as const) unique(d[key], key, context);
  unique(d.routedRhythmPlacements, 'routedRhythmPlacements', context);
  validateRhythmAuthorityRelationships(d.rhythmTemplates, d.rhythmPlans, d.rhythmRecurrenceRevisions, d.rhythmInstances)
    .forEach((message) => context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances'], message }));
  const instances = new Map(d.rhythmInstances.map((row) => [row.id, row]));
  const tasks = new Map(d.activeTasks.map((row) => [row.id, row]));
  const pool = new Map(d.taskPoolItems.map((row) => [row.id, row]));
  const routed = new Map(d.routedRhythmPlacements.map((row) => [row.id, row]));
  const liveRhythmCorrections = new Map(d.softPlacements
    .filter((row) => row.targetKind === 'rhythm' && row.correctionKind &&
      (row.status === 'planned' || row.status === 'moved'))
    .map((row) => [row.id, row]));
  const routedOwners = new Map<string, number>();
  d.routedRhythmPlacements.forEach((placement, index) => {
    const owners = d.rhythmInstances.filter((row) => row.placementId === placement.id);
    const instance = owners[0];
    routedOwners.set(placement.id, owners.length);
    if (owners.length !== 1 || !instance || !isLiveRoutedRhythmInstance(instance) ||
      placement.targetKind !== 'rhythm' || placement.rhythmId !== instance.id ||
      placement.rhythmInstanceId !== instance.id || placement.intentionId !== instance.id ||
      placement.rhythmTemplateId !== instance.rhythmTemplateId || placement.rhythmPlanId !== instance.rhythmPlanId ||
      placement.rhythmRecurrenceRevisionId !== instance.recurrenceRevisionId ||
      placement.origin !== 'scheduler') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'routedRhythmPlacements', index],
        message: 'Accepted routed rhythm placement identity is inconsistent.' });
    }
  });
  d.activeTasks.forEach((task, index) => {
    if (task.showToday !== isVisibleTodayStatus(task.status)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'activeTasks', index, 'showToday'],
        message: 'Today visibility contradicts the task lifecycle.' });
    }
    if (task.source === 'custom') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'activeTasks', index, 'source'],
        message: 'This task source is not readable by the current Today repository.' });
    }
    if (task.sourceRhythmInstanceId && (instances.get(task.sourceRhythmInstanceId)?.rhythmTemplateId !== task.templateId ||
      instances.get(task.sourceRhythmInstanceId)?.activeTaskId !== task.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'activeTasks', index], message: 'Rhythm occurrence/Today task identity is inconsistent.' });
    }
    if (task.sourceRhythmInstanceId) {
      const instance = instances.get(task.sourceRhythmInstanceId);
      const expected = task.status === 'active' ? 'today'
        : task.status === 'paused' ? 'paused'
          : ['done', 'parked', 'skipped', 'notToday'].includes(task.status) ? 'closed' : 'inProgress';
      if (instance) {
        const closed = expected === 'closed';
        const completion = closed ? (task.status === 'done' ? 'done' : 'skipped')
          : task.status === 'minimumDone' ? 'minimumDone' : null;
        const validOpenCompletion = instance.completionState === 'notStarted' || instance.completionState === 'minimumDone';
        if (instance.lifecycleState !== expected || instance.planningState !== (closed ? 'closed' : 'today') ||
          (completion ? instance.completionState !== completion : !validOpenCompletion)) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'activeTasks', index, 'status'],
            message: 'Linked rhythm lifecycle, completion and planning states are inconsistent.' });
        }
      }
    }
  });
  d.taskPoolItems.forEach((item, index) => {
    const task = tasks.get(item.id);
    if (task?.sourceRhythmInstanceId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'taskPoolItems', index, 'id'],
        message: 'A generated rhythm Today task cannot also be a Pool intention.' });
    }
    if (item.status === 'today' && (!task || !task.showToday || !isVisibleTodayStatus(task.status) ||
      !!task.sourceRhythmInstanceId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'taskPoolItems', index, 'status'],
        message: 'A Today Pool item requires its matching visible Today task.' });
    }
    const expectedPoolStatus = task ? poolStatusForActiveTask(task.status) : null;
    const heldStatusAfterToday = task && ['parked', 'notToday', 'skipped'].includes(task.status) &&
      (item.status === 'deferred' || item.status === 'softPlaced' ||
        (task.status === 'skipped' && ['noLongerNeeded', 'captured'].includes(item.status)));
    if (task && !task.sourceRhythmInstanceId && item.status !== expectedPoolStatus && !heldStatusAfterToday) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'taskPoolItems', index, 'status'],
        message: 'Pool status contradicts the linked Today task lifecycle.' });
    }
  });
  d.rhythmInstances.forEach((instance, index) => {
    if (instance.activeTaskId && tasks.get(instance.activeTaskId)?.sourceRhythmInstanceId !== instance.id) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index], message: 'Linked Today task is missing.' });
    }
    if (!instance.activeTaskId && !['eligible', 'closed'].includes(instance.lifecycleState)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index, 'activeTaskId'],
        message: 'A routed rhythm occurrence requires its linked Today task.' });
    }
    if (!instance.activeTaskId && instance.placementId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index, 'placementId'],
        message: 'A placed rhythm occurrence requires its linked Today task.' });
    }
    if (isLiveRoutedRhythmInstance(instance)) {
      const correction = liveRhythmCorrections.get(instance.placementId);
      if (correction && routed.has(instance.placementId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index, 'placementId'],
          message: 'A routed rhythm occurrence cannot have both scheduler and user-correction placement authority.' });
      } else if (!correction && !routed.has(instance.placementId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index, 'placementId'],
          message: 'A routed rhythm occurrence requires its accepted placement.' });
      } else if (!correction && routedOwners.get(instance.placementId) !== 1) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index, 'placementId'],
          message: 'A routed rhythm placement must have one occurrence owner.' });
      }
    }
    if (!instance.activeTaskId && instance.lifecycleState === 'eligible' &&
      (instance.completionState !== 'notStarted' || !['unscheduled', 'placed'].includes(instance.planningState))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index],
        message: 'An eligible rhythm occurrence must remain uncompleted and not in Today.' });
    }
    if (!instance.activeTaskId && instance.lifecycleState === 'closed' &&
      (instance.planningState !== 'closed' || !['skipped', 'done'].includes(instance.completionState))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index],
        message: 'A closed rhythm occurrence requires a closed planning and completion outcome.' });
    }
  });
  // Historical facts and authored target IDs can outlive their live template or occurrence.
  // Their own strict schemas retain identity/provenance without inventing live referential authority.
  const visibleTaskDates = new Set<string>();
  const visibleBlockDates = new Set<string>();
  d.softPlacements.forEach((placement, index) => {
    const backingTask = tasks.get(placement.taskId);
    const live = placement.status === 'planned' || placement.status === 'moved';
    if (live && placement.targetKind === 'rhythm') {
      const instance = placement.rhythmInstanceId ? instances.get(placement.rhythmInstanceId) : undefined;
      if (!placement.correctionKind || !instance || instance.lifecycleState === 'closed' ||
          instance.placementId !== placement.id || placement.taskId !== instance.id ||
          placement.rhythmTemplateId !== instance.rhythmTemplateId ||
          placement.rhythmPlanId !== instance.rhythmPlanId ||
          placement.rhythmRecurrenceRevisionId !== instance.recurrenceRevisionId) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'softPlacements', index],
          message: 'A live rhythm correction requires one matching live rhythm occurrence.' });
      }
    } else if (live &&
      !(backingTask && !backingTask.sourceRhythmInstanceId && isVisibleTodayStatus(backingTask.status)) &&
      !(pool.get(placement.taskId)?.status === 'softPlaced' && !backingTask)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'softPlacements', index],
        message: 'A live placement requires a visible Today task or a confirmed soft-placed Held item.' });
    }
    if (placement.status === 'planned' || placement.status === 'moved' || placement.status === 'completedFromToday') {
      const taskDate = JSON.stringify([placement.date, placement.taskId]);
      const blockDate = JSON.stringify([placement.date, placement.blockId]);
      if (visibleTaskDates.has(taskDate)) context.addIssue({ code: z.ZodIssueCode.custom,
        path: ['data', 'softPlacements', index, 'taskId'], message: 'Task already has a visible placement on this date.' });
      if (visibleBlockDates.has(blockDate)) context.addIssue({ code: z.ZodIssueCode.custom,
        path: ['data', 'softPlacements', index, 'blockId'], message: 'Block already has a visible placement on this date.' });
      visibleTaskDates.add(taskDate);
      visibleBlockDates.add(blockDate);
    }
  });
});

export type PortableProfile = z.infer<typeof portableProfileSchema>;
type Snapshot = {
  settings: unknown[]; rhythmTemplates: unknown[]; rhythmPlans: unknown[];
  rhythmRecurrenceRevisions: unknown[]; rhythmInstances: unknown[]; activeTasks: unknown[];
  taskPoolItems: unknown[]; softPlacements: unknown[]; taskHistory: unknown[];
  calendarSources: unknown[]; schedulerPlanState: unknown[];
};

const tables = (db: LifeRhythmDatabase) => [db.settings, db.rhythmTemplates, db.rhythmPlans,
  db.rhythmRecurrenceRevisions, db.rhythmInstances, db.activeTasks, db.taskPoolItems,
  db.softPlacements, db.taskHistory, db.calendarSources, db.schedulerPlanState] as const;

async function snapshot(db: LifeRhythmDatabase): Promise<Snapshot> {
  const [settings, rhythmTemplates, rhythmPlans, rhythmRecurrenceRevisions, rhythmInstances,
    activeTasks, taskPoolItems, softPlacements, taskHistory, calendarSources, schedulerPlanState] =
    await Promise.all(tables(db).map((table) => table.toArray()));
  return { settings, rhythmTemplates, rhythmPlans, rhythmRecurrenceRevisions, rhythmInstances,
    activeTasks, taskPoolItems, softPlacements, taskHistory, calendarSources, schedulerPlanState };
}

// Sorting table rows by their stable primary IDs removes IndexedDB enumeration order
// from the expectation; all affected rows, including old sidecars, are compared.
function fingerprint(state: Snapshot, db: LifeRhythmDatabase): string {
  return JSON.stringify({ namespace: db.name, rows: Object.fromEntries(Object.entries(state).map(([key, rows]) => [key,
    [...rows].sort((a, b) => String((a as { id?: unknown }).id).localeCompare(String((b as { id?: unknown }).id)))])) });
}

function calendarOptions() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (name: string) => day.find((item) => item.type === name)?.value ?? '';
  const start = `${part('year')}-${part('month')}-${part('day')}`;
  const end = new Date(`${start}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 31);
  return { windowStartDate: start, windowEndDate: end.toISOString().slice(0, 10), targetTimezone: zone };
}

function checkCalendar(calendar: PortableProfile['data']['calendarSource']) {
  if (!calendar) return;
  const source = calendar.source.toUpperCase();
  if (!source.includes('BEGIN:VCALENDAR') || !source.includes('END:VCALENDAR')) {
    throw new Error('Calendar source is not an iCalendar document.');
  }
  const preview = icsCalendarAdapter.readForImport(calendar.source, calendarOptions());
  validateCalendarCommitmentExpansion(preview.events);
}

function validate(input: unknown): PortableProfile {
  checkCollectionBounds(input);
  const parsed = portableProfileSchema.parse(input);
  // Persistence schemas accept omitted fields for migration/write convenience. A
  // recovery snapshot cannot manufacture those fields while being checked.
  function requireSnapshotShape(raw: unknown, output: unknown, path: string): void {
    if (Array.isArray(output) && Array.isArray(raw)) {
      output.forEach((value, index) => requireSnapshotShape(raw[index], value, `${path}[${index}]`));
    } else if (output && typeof output === 'object' && !Array.isArray(output) &&
      raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(output)) {
        if (!Object.prototype.hasOwnProperty.call(raw, key)) {
          throw new Error(`Portable profile omitted canonical field ${path}.${key}.`);
        }
        requireSnapshotShape((raw as Record<string, unknown>)[key], value, `${path}.${key}`);
      }
    }
  }
  requireSnapshotShape(input, parsed, 'backup');
  checkCalendar(parsed.data.calendarSource);
  return parsed;
}

function payloadFromSnapshot(state: Snapshot, settings: PortableProfile['data']['settings'], exportedAt: string) {
  const settingsRows = state.settings as Array<{ id: string }>;
  const ids = new Set([SETTINGS_ID, DAY_PROFILE_FOUNDATION_ID, EXPLICIT_PREFERENCES_RECORD_ID,
    DURATION_LEARNING_CONTROLS_RECORD_ID, PROFILE_RECOVERY_GENERATION_ID]);
  if (settingsRows.some((row) => !row || !ids.has(row.id))) throw new Error('Unknown settings sidecar; backup was not created.');
  if (!settings && settingsRows.some((row) => row.id === DAY_PROFILE_FOUNDATION_ID)) throw new Error('Orphan day-profile foundation.');
  const foundation = settingsRows.find((row) => row.id === DAY_PROFILE_FOUNDATION_ID);
  if (foundation && !foundationSchema.safeParse(foundation).success) {
    throw new Error('Unreadable day-profile foundation; backup was not created.');
  }
  const generation = settingsRows.find((row) => row.id === PROFILE_RECOVERY_GENERATION_ID);
  if (generation && !profileRecoveryGenerationSchema.safeParse(generation).success) {
    throw new Error('Unreadable local recovery generation; backup was not created.');
  }
  const preferences = settingsRows.find((row) => row.id === EXPLICIT_PREFERENCES_RECORD_ID) ?? null;
  const duration = settingsRows.find((row) => row.id === DURATION_LEARNING_CONTROLS_RECORD_ID) ?? null;
  const history = state.taskHistory as Array<{ recordKind?: unknown }>;
  for (const row of history) {
    if (!behaviourEventSchema.safeParse(row).success && !legacyTaskHistorySchema.safeParse(row).success) {
      throw new Error('Unreadable behaviour history; use the separate raw history export before recovery.');
    }
  }
  const calendars = state.calendarSources;
  if (calendars.length > 1) throw new Error('Multiple calendar sources cannot be restored safely.');
  // Local persisted v1 rows may omit buffers. Normalize only the trusted local
  // row; supplied portable v1 snapshots still require the explicit fields.
  const calendarSource = calendars.length ? calendarSourceRecordSchema.parse(calendars[0]) : null;
  const planRows = state.schedulerPlanState;
  if (planRows.length > 1) throw new Error('Multiple scheduler plans cannot be checked safely.');
  const normalizedSoftPlacements = softPlacementSchema.array().parse(state.softPlacements);
  const liveRhythmCorrectionIds = new Set(normalizedSoftPlacements
    .filter((row) => row.targetKind === 'rhythm' && row.correctionKind &&
      (row.status === 'planned' || row.status === 'moved'))
    .map((row) => row.id));
  const routedInstances = rhythmInstanceSchema.array().parse(state.rhythmInstances)
    .filter((instance) => isLiveRoutedRhythmInstance(instance) &&
      !liveRhythmCorrectionIds.has(instance.placementId!));
  const acceptedPlan = planRows.length ? schedulerPlanStateRecordSchema.safeParse(planRows[0]) : null;
  if (routedInstances.length && (!acceptedPlan || !acceptedPlan.success)) {
    throw new Error('Routed rhythm occurrences require a readable accepted private plan.');
  }
  const routedRhythmPlacements = routedInstances.map((instance) => {
    const found = acceptedPlan?.success ? acceptedPlan.data.plan.placements.filter((row) => row.id === instance.placementId) : [];
    if (found.length !== 1) throw new Error(`Routed rhythm occurrence ${instance.id} lacks its accepted placement.`);
    return found[0];
  });
  return validate({ format: PORTABLE_PROFILE_FORMAT, formatVersion: PORTABLE_PROFILE_VERSION,
    appVersion: SETTINGS_APP_VERSION, exportedAt,
    data: { settings, rhythmTemplates: state.rhythmTemplates, rhythmPlans: state.rhythmPlans,
      rhythmRecurrenceRevisions: state.rhythmRecurrenceRevisions, rhythmInstances: state.rhythmInstances,
      activeTasks: state.activeTasks, taskPoolItems: state.taskPoolItems, softPlacements: state.softPlacements,
      routedRhythmPlacements,
      behaviourEvents: history.filter((row) => row.recordKind === 'behaviourEvent'),
      explicitPreferences: preferences, durationControls: duration, calendarSource } });
}

async function readValidatedProfile(db: LifeRhythmDatabase, state: Snapshot, timestamp: string) {
  const loaded = await loadSettingsResult(db, { persistMigration: false });
  if (loaded.status === 'invalid' || loaded.status === 'readFailed' || loaded.status === 'migrationPersistenceFailed') {
    throw new Error('Saved settings cannot be backed up safely.');
  }
  return payloadFromSnapshot(state, loaded.status === 'defaulted' ? null : loaded.settings, timestamp);
}

export function checkPortableProfileJson(json: string) {
  try {
    if (json.length > MAX_PORTABLE_PROFILE_BYTES || new TextEncoder().encode(json).byteLength > MAX_PORTABLE_PROFILE_BYTES) {
      throw new Error('Portable profile exceeds safe backup size bounds.');
    }
    const payload = validate(JSON.parse(json) as unknown);
    const d = payload.data;
    return { ok: true as const, payload, preview: { exportedAt: payload.exportedAt,
      settingsPresent: !!d.settings, pool: d.taskPoolItems.length, today: d.activeTasks.length,
      rhythms: d.rhythmPlans.length, instances: d.rhythmInstances.length, placements: d.softPlacements.length,
      routedRhythmTimes: d.routedRhythmPlacements.length,
      preferences: d.explicitPreferences?.preferences.length ?? 0,
      durationControls: d.durationControls?.controls.length ?? 0,
      behaviourEvents: d.behaviourEvents.length, calendarPresent: !!d.calendarSource } };
  } catch (error) {
    return { ok: false as const, errors: [error instanceof Error ? `backup: ${error.message}` : 'backup: Invalid profile.'] };
  }
}

export async function exportPortableProfile(db: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(), exportedAt = new Date().toISOString()) {
  const payload = await db.transaction('r', [...tables(db)], async () =>
    readValidatedProfile(db, await snapshot(db), exportedAt));
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  if (new TextEncoder().encode(json).byteLength > MAX_PORTABLE_PROFILE_BYTES) {
    throw new Error('Portable profile exceeds safe backup size bounds.');
  }
  return { payload, json,
    fileName: `life-rhythm-portable-profile-${exportedAt.slice(0, 10)}.json` };
}

export async function checkPortableProfileForRestore(json: string, db: LifeRhythmDatabase = getCurrentLifeRhythmDatabase()) {
  const checked = checkPortableProfileJson(json);
  if (!checked.ok) return checked;
  try {
    // A corrupt canonical destination must be repaired separately; never erase it by mistake.
    const state = await db.transaction('r', [...tables(db)], async () => {
      const current = await snapshot(db);
      await readValidatedProfile(db, current, checked.payload.exportedAt);
      return current;
    });
    const hasData = state.settings.some((row) => (row as { id?: string }).id !== PROFILE_RECOVERY_GENERATION_ID) ||
      state.rhythmTemplates.length > 0 || state.activeTasks.length > 0 ||
      state.taskPoolItems.length > 0 || state.softPlacements.length > 0 || state.rhythmPlans.length > 0 ||
      state.rhythmRecurrenceRevisions.length > 0 || state.rhythmInstances.length > 0 ||
      state.taskHistory.length > 0 || state.calendarSources.length > 0;
    return { ...checked, expectation: fingerprint(state, db), hasData };
  } catch {
    return { ok: false as const, errors: ['Current local profile could not be read or validated. Nothing changed.'] };
  }
}

export async function restorePortableProfile(json: string, expectation: string, confirmation: string,
  db: LifeRhythmDatabase = getCurrentLifeRhythmDatabase()) {
  const checked = checkPortableProfileJson(json);
  if (!checked.ok) return { ok: false as const, errors: checked.errors };
  if (!expectation) return { ok: false as const, errors: ['Check this backup again before restoring.'] };
  try {
    return await db.transaction('rw', [...tables(db)], async () => {
      const previous = await snapshot(db);
      if (fingerprint(previous, db) !== expectation) return { ok: false as const, errors: ['Local profile changed. Check the backup again.'] };
      const generation = await readProfileRecoveryGeneration(db);
      await readValidatedProfile(db, previous, checked.payload.exportedAt);
      const hasData = previous.settings.some((row) => (row as { id?: string }).id !== PROFILE_RECOVERY_GENERATION_ID) ||
        previous.rhythmTemplates.length > 0 ||
        previous.activeTasks.length > 0 || previous.taskPoolItems.length > 0 || previous.softPlacements.length > 0 ||
        previous.rhythmPlans.length > 0 || previous.rhythmRecurrenceRevisions.length > 0 ||
        previous.rhythmInstances.length > 0 || previous.taskHistory.length > 0 || previous.calendarSources.length > 0;
      if (hasData && confirmation !== REPLACE_LOCAL_PROFILE_CONFIRMATION) {
        return { ok: false as const, errors: [`Type ${REPLACE_LOCAL_PROFILE_CONFIRMATION} to replace this local profile.`] };
      }
      const d = checked.payload.data;
      for (const table of tables(db)) await table.clear();
      if (d.settings) {
        const { dayProfileMigrationState, dayProfiles, weekdayProfileAssignments, ...row } = d.settings;
        await db.settings.put(row as typeof d.settings);
        await db.settings.put({ id: DAY_PROFILE_FOUNDATION_ID, appVersion: d.settings.appVersion,
          updatedAt: d.settings.updatedAt, dayProfileMigrationState, dayProfiles, weekdayProfileAssignments } as typeof d.settings);
      }
      if (d.explicitPreferences) await db.settings.put(d.explicitPreferences as never);
      if (d.durationControls) await db.settings.put(d.durationControls as never);
      await db.rhythmTemplates.bulkPut(d.rhythmTemplates);
      await db.rhythmPlans.bulkPut(d.rhythmPlans);
      await db.rhythmRecurrenceRevisions.bulkPut(d.rhythmRecurrenceRevisions);
      await db.rhythmInstances.bulkPut(d.rhythmInstances);
      await db.activeTasks.bulkPut(d.activeTasks);
      await db.taskPoolItems.bulkPut(d.taskPoolItems);
      await db.softPlacements.bulkPut(d.softPlacements);
      await db.taskHistory.bulkPut(d.behaviourEvents);
      if (d.calendarSource) await db.calendarSources.put(d.calendarSource);
      if (d.routedRhythmPlacements.length) {
        // Restore only the accepted routed coordinates. The remaining scheduler
        // output is rebuilt under this namespace's canonical inputs.
        await db.schedulerPlanState.put(schedulerPlanStateRecordSchema.parse({ id: 'current', version: 1,
          updatedAt: new Date().toISOString(), rhythmInputRepairPendingAt: new Date().toISOString(),
          rhythmInputRepairTargetIds: d.rhythmInstances.filter((row) => row.placementId)
            .map((row) => `instance:${row.id}`),
          plan: { placements: d.routedRhythmPlacements, unscheduledIntentionIds: [],
            unscheduledRhythmIds: [], rejectedExistingPlacements: [] } }));
      }
      await advanceProfileRecoveryGeneration(db, generation);
      return { ok: true as const };
    });
  } catch {
    return { ok: false as const, errors: ['Profile restore failed. Local data was left unchanged.'] };
  }
}
