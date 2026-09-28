import { z } from 'zod';
import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  activeTaskSchema, behaviourEventSchema, legacyTaskHistorySchema, rhythmTemplateSchema, settingsSchema,
  softPlacementSchema, strictIsoDateTimeSchema, taskPoolItemSchema,
} from './schemas';
import { rhythmInstanceSchema, rhythmPlanSchema, rhythmRecurrenceRevisionSchema } from './rhythmAuthoritySchemas';
import { validateRhythmAuthorityRelationships } from './rhythmAuthorityRepository';
import { explicitPreferenceStoreRecordSchema, EXPLICIT_PREFERENCES_RECORD_ID } from './explicitPreferenceSchema';
import { durationLearningControlStoreRecordSchema, DURATION_LEARNING_CONTROLS_RECORD_ID } from './durationLearningControlSchema';
import { calendarSourceRecordSchema } from './calendarSourceSchema';
import { icsCalendarAdapter } from '../domain/calendarAdapter';
import { validateCalendarCommitmentExpansion } from '../domain/calendarAvailability';
import { DAY_PROFILE_FOUNDATION_ID, loadSettingsResult, SETTINGS_APP_VERSION, SETTINGS_ID } from './settingsRepository';

export const PORTABLE_PROFILE_FORMAT = 'life-rhythm-portable-profile-backup';
export const PORTABLE_PROFILE_VERSION = 1;
export const REPLACE_LOCAL_PROFILE_CONFIRMATION = 'REPLACE LOCAL PROFILE';

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
    behaviourEvents: z.array(behaviourEventSchema),
    explicitPreferences: explicitPreferenceStoreRecordSchema.nullable(),
    durationControls: durationLearningControlStoreRecordSchema.nullable(),
    calendarSource: calendarSourceRecordSchema.nullable(),
  }).strict(),
}).strict().superRefine((backup, context) => {
  const d = backup.data;
  for (const key of ['rhythmTemplates', 'rhythmPlans', 'rhythmRecurrenceRevisions', 'rhythmInstances',
    'activeTasks', 'taskPoolItems', 'softPlacements', 'behaviourEvents'] as const) unique(d[key], key, context);
  validateRhythmAuthorityRelationships(d.rhythmTemplates, d.rhythmPlans, d.rhythmRecurrenceRevisions, d.rhythmInstances)
    .forEach((message) => context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances'], message }));
  const templates = new Set(d.rhythmTemplates.map((row) => row.id));
  const instances = new Map(d.rhythmInstances.map((row) => [row.id, row]));
  const tasks = new Map(d.activeTasks.map((row) => [row.id, row]));
  d.activeTasks.forEach((task, index) => {
    if (task.sourceRhythmInstanceId && (instances.get(task.sourceRhythmInstanceId)?.rhythmTemplateId !== task.templateId ||
      instances.get(task.sourceRhythmInstanceId)?.activeTaskId !== task.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'activeTasks', index], message: 'Rhythm occurrence/Today task identity is inconsistent.' });
    }
    if (task.source === 'library' && task.templateId && !templates.has(task.templateId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'activeTasks', index], message: 'Library template is missing.' });
    }
  });
  d.rhythmInstances.forEach((instance, index) => {
    if (instance.activeTaskId && tasks.get(instance.activeTaskId)?.sourceRhythmInstanceId !== instance.id) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'rhythmInstances', index], message: 'Linked Today task is missing.' });
    }
  });
  d.behaviourEvents.forEach((event, index) => {
    if (event.rhythmInstanceId && (instances.get(event.rhythmInstanceId)?.rhythmTemplateId !== event.templateId &&
      (event.templateId || !instances.has(event.rhythmInstanceId)))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['data', 'behaviourEvents', index], message: 'Referenced rhythm occurrence is missing.' });
    }
  });
  d.durationControls?.controls.forEach((control, index) => {
    if (!templates.has(control.templateId)) context.addIssue({ code: z.ZodIssueCode.custom,
      path: ['data', 'durationControls', 'controls', index], message: 'Controlled template is missing.' });
  });
  d.softPlacements.forEach((placement, index) => {
    if ((placement.status === 'planned' || placement.status === 'moved') && !tasks.has(placement.taskId)) context.addIssue({ code: z.ZodIssueCode.custom,
      path: ['data', 'softPlacements', index], message: 'Confirmed placement has no Today task.' });
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
  const parsed = portableProfileSchema.parse(input);
  checkCalendar(parsed.data.calendarSource);
  return parsed;
}

function payloadFromSnapshot(state: Snapshot, settings: PortableProfile['data']['settings'], exportedAt: string) {
  const settingsRows = state.settings as Array<{ id: string }>;
  const ids = new Set([SETTINGS_ID, DAY_PROFILE_FOUNDATION_ID, EXPLICIT_PREFERENCES_RECORD_ID, DURATION_LEARNING_CONTROLS_RECORD_ID]);
  if (settingsRows.some((row) => !row || !ids.has(row.id))) throw new Error('Unknown settings sidecar; backup was not created.');
  if (!settings && settingsRows.some((row) => row.id === DAY_PROFILE_FOUNDATION_ID)) throw new Error('Orphan day-profile foundation.');
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
  return validate({ format: PORTABLE_PROFILE_FORMAT, formatVersion: PORTABLE_PROFILE_VERSION,
    appVersion: SETTINGS_APP_VERSION, exportedAt,
    data: { settings, rhythmTemplates: state.rhythmTemplates, rhythmPlans: state.rhythmPlans,
      rhythmRecurrenceRevisions: state.rhythmRecurrenceRevisions, rhythmInstances: state.rhythmInstances,
      activeTasks: state.activeTasks, taskPoolItems: state.taskPoolItems, softPlacements: state.softPlacements,
      behaviourEvents: history.filter((row) => row.recordKind === 'behaviourEvent'),
      explicitPreferences: preferences, durationControls: duration, calendarSource: calendars[0] ?? null } });
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
    const payload = validate(JSON.parse(json) as unknown);
    const d = payload.data;
    return { ok: true as const, payload, preview: { exportedAt: payload.exportedAt,
      settingsPresent: !!d.settings, pool: d.taskPoolItems.length, today: d.activeTasks.length,
      rhythms: d.rhythmPlans.length, instances: d.rhythmInstances.length, placements: d.softPlacements.length,
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
  return { payload, json: `${JSON.stringify(payload, null, 2)}\n`,
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
    const hasData = state.settings.length > 0 || state.rhythmTemplates.length > 0 || state.activeTasks.length > 0 ||
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
      await readValidatedProfile(db, previous, checked.payload.exportedAt);
      const hasData = previous.settings.length > 0 || previous.rhythmTemplates.length > 0 ||
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
      return { ok: true as const };
    });
  } catch {
    return { ok: false as const, errors: ['Profile restore failed. Local data was left unchanged.'] };
  }
}
