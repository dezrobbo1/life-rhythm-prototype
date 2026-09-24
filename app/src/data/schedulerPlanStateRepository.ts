import type { Table } from 'dexie';
import { scheduler } from '../domain/primaryScheduler';
import { clipSchedulingInputToNow } from '../domain/elapsedTimeCapacity';
import type {
  InternalPlacement,
  LocalDate,
  SchedulerChange,
  SchedulerPlan,
  AppliedDurationLearning,
  SchedulingDomainModel,
} from '../domain/schedulingModel';
import {
  CURRENT_CALENDAR_SOURCE_ID,
  calendarSourceRecordSchema,
} from './calendarSourceSchema';
import { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  durationLearningEventSnapshot,
} from './durationLearning';
import {
  canonicalSchedulingInputSnapshot,
  readCanonicalSchedulingInputRows,
  type CanonicalSchedulingInputSnapshot,
} from './schedulerCanonicalInputSnapshot';
import {
  schedulerPlanStateRecordSchema,
  type PreferenceRepairTarget,
  type SchedulerPlanStateRecord,
} from './schedulerPlanStateSchema';
import {
  appendBehaviourEvent,
  behaviourEventForSchedulerUndo,
  behaviourEventsForInitialSchedulerPlan,
  behaviourEventsForSchedulerRepair,
} from './behaviourEventRepository';
import type { BehaviourEvent } from './schemas';

export const CURRENT_SCHEDULER_PLAN_STATE_ID = 'current';

type SchedulerPlanStateTable = Pick<
  Table<SchedulerPlanStateRecord, string>,
  'delete' | 'get' | 'put' | 'update'
>;

export type SchedulerPlanStateStore = {
  schedulerPlanState: SchedulerPlanStateTable;
};

export type SchedulerDayModeContext = {
  dayMode: 'reduced';
  date: LocalDate;
};

type SchedulerModeFields = {
  dayModeContext?: SchedulerDayModeContext;
  undoDayModeContext?: SchedulerDayModeContext | null;
};

type SchedulerStateFields = SchedulerModeFields & {
  calendarRepairPendingAt?: string;
  preferenceRepairPendingAt?: string;
  preferenceRepairTargets?: PreferenceRepairTarget[];
  durationLearningApplied?: AppliedDurationLearning[];
};

export type CalendarSourceSnapshot = {
  source: string;
  updatedAt: string;
} | null;

export const CALENDAR_REPAIR_PENDING_MESSAGE =
  'Calendar change was saved, but the flexible private plan could not be repaired.';
export const PREFERENCE_REPAIR_PENDING_MESSAGE =
  'Scheduling preference was saved, but the flexible private plan could not be repaired.';

export type SchedulerPlanStateLoadResult =
  | { status: 'missing' }
  | ({ status: 'ok'; plan: SchedulerPlan; updatedAt: string } & SchedulerStateFields)
  | { status: 'invalid'; errors: string[] }
  | { status: 'error'; errors: string[] };

export type SchedulerPlanStateExpectation = Extract<
  SchedulerPlanStateLoadResult,
  { status: 'missing' | 'ok' }
>;

export type SchedulerPlanStateWriteResult =
  | ({ ok: true; plan: SchedulerPlan; updatedAt: string } & SchedulerStateFields)
  | { ok: false; errors: string[]; conflict?: 'stale' };

export type SchedulerPlanPersistActionResult =
  | ({ ok: true; mode: 'built' | 'repaired' | 'undone'; plan: SchedulerPlan; updatedAt: string } & SchedulerStateFields)
  | { ok: false; errors: string[]; conflict?: 'stale' };

const STALE_SCHEDULER_WRITE_ERROR =
  'schedulerPlanState: Scheduling inputs changed before the repaired plan could be saved.';

function staleSchedulerWriteResult() {
  return {
    ok: false as const,
    conflict: 'stale' as const,
    errors: [STALE_SCHEDULER_WRITE_ERROR],
  };
}

export function isStaleSchedulerPlanWrite(
  result: SchedulerPlanPersistActionResult,
): result is Extract<SchedulerPlanPersistActionResult, { ok: false }> & { conflict: 'stale' } {
  return !result.ok && result.conflict === 'stale';
}

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'schedulerPlanState';
    return `${path}: ${issue.message}`;
  });
}

function clonePlan(plan: SchedulerPlan): SchedulerPlan {
  return JSON.parse(JSON.stringify(plan)) as SchedulerPlan;
}

function stateFields(record: SchedulerStateFields): SchedulerStateFields {
  return {
    ...(record.calendarRepairPendingAt
      ? { calendarRepairPendingAt: record.calendarRepairPendingAt }
      : {}),
    ...(record.preferenceRepairPendingAt
      ? { preferenceRepairPendingAt: record.preferenceRepairPendingAt }
      : {}),
    ...(record.preferenceRepairTargets
      ? { preferenceRepairTargets: record.preferenceRepairTargets.map((target) => ({ ...target })) }
      : {}),
    ...(record.durationLearningApplied
      ? { durationLearningApplied: record.durationLearningApplied.map((item) => ({ ...item })) }
      : {}),
    ...(record.dayModeContext ? { dayModeContext: { ...record.dayModeContext } } : {}),
    ...(record.undoDayModeContext !== undefined
      ? { undoDayModeContext: record.undoDayModeContext ? { ...record.undoDayModeContext } : null }
      : {}),
  };
}

function validatedSchedulerPlanStateRecord(
  plan: SchedulerPlan,
  updatedAt: string,
  fields: SchedulerStateFields,
) {
  return schedulerPlanStateRecordSchema.safeParse({
    id: CURRENT_SCHEDULER_PLAN_STATE_ID,
    version: 1,
    updatedAt,
    ...stateFields(fields),
    plan: clonePlan(plan),
  });
}

function loadedStateRecord(
  loaded: Extract<SchedulerPlanStateLoadResult, { status: 'ok' }>,
) {
  return schedulerPlanStateRecordSchema.parse({
    id: CURRENT_SCHEDULER_PLAN_STATE_ID,
    version: 1,
    updatedAt: loaded.updatedAt,
    ...stateFields(loaded),
    plan: clonePlan(loaded.plan),
  });
}

function storedStateMatchesLoaded(
  stored: unknown,
  loaded: SchedulerPlanStateExpectation,
) {
  if (loaded.status === 'missing') return stored === undefined;

  const parsed = schedulerPlanStateRecordSchema.safeParse(stored);
  if (!parsed.success) return false;
  return JSON.stringify(parsed.data) === JSON.stringify(loadedStateRecord(loaded));
}

function loadedStateMatchesExpected(
  loaded: SchedulerPlanStateExpectation,
  expected: SchedulerPlanStateExpectation,
) {
  if (loaded.status !== expected.status) return false;
  if (loaded.status === 'missing' || expected.status === 'missing') return true;
  return JSON.stringify(loadedStateRecord(loaded)) === JSON.stringify(loadedStateRecord(expected));
}

function orderedDurationLearning(
  items: readonly AppliedDurationLearning[],
): AppliedDurationLearning[] {
  return [...items]
    .map((item) => ({ ...item }))
    .sort((left, right) => left.templateId.localeCompare(right.templateId));
}

function durationLearningChangedTemplateIds(
  before: readonly AppliedDurationLearning[],
  after: readonly AppliedDurationLearning[],
) {
  const beforeById = new Map(before.map((item) => [item.templateId, JSON.stringify(item)]));
  const afterById = new Map(after.map((item) => [item.templateId, JSON.stringify(item)]));
  return [...new Set([...beforeById.keys(), ...afterById.keys()])]
    .filter((templateId) => beforeById.get(templateId) !== afterById.get(templateId))
    .sort();
}

function templateIdForPlacement(
  placement: InternalPlacement,
  input: SchedulingDomainModel,
) {
  const placementKind = placement.targetKind ?? 'intention';
  const targetId = placementKind === 'rhythm'
    ? placement.rhythmId ?? placement.intentionId
    : placement.intentionId;
  return placementKind === 'rhythm'
    ? input.rhythms.find((rhythm) => rhythm.id === targetId)?.templateId
    : input.intentions.find((intention) => intention.id === targetId)?.templateId;
}

function releaseIdsForDurationLearning(
  current: SchedulerPlanStateExpectation,
  change: SchedulerChange,
  changedTemplateIds: readonly string[],
) {
  if (current.status !== 'ok' || !change.now || changedTemplateIds.length === 0) return [];
  const changed = new Set(changedTemplateIds);
  return current.plan.placements
    .filter((placement) =>
      placement.origin === 'scheduler' &&
      (
        placement.date > change.now!.date ||
        (placement.date === change.now!.date && placement.start >= change.now!.time)
      ) &&
      Boolean(templateIdForPlacement(placement, change.nextInput)) &&
      changed.has(templateIdForPlacement(placement, change.nextInput)!),
    )
    .map((placement) => placement.id)
    .sort();
}

export type DurationLearningPersistInput = {
  applied: AppliedDurationLearning[];
  eventSnapshot?: string;
};

function storedCalendarMatchesSnapshot(
  stored: unknown,
  snapshot: CalendarSourceSnapshot,
) {
  if (snapshot === null) return stored === undefined;

  const parsed = calendarSourceRecordSchema.safeParse(stored);
  return parsed.success &&
    parsed.data.source === snapshot.source &&
    parsed.data.updatedAt === snapshot.updatedAt;
}

async function saveSchedulerPlanStateIfCurrent(
  plan: SchedulerPlan,
  expected: Extract<SchedulerPlanStateLoadResult, { status: 'missing' | 'ok' }>,
  store: SchedulerPlanStateStore,
  updatedAt: string,
  fields: SchedulerStateFields,
  calendarSourceSnapshot?: CalendarSourceSnapshot,
  canonicalInputSnapshot?: CanonicalSchedulingInputSnapshot,
  expectedDurationLearningEventSnapshot?: string,
  behaviourEvents: BehaviourEvent[] = [],
): Promise<SchedulerPlanStateWriteResult> {
  const candidate = validatedSchedulerPlanStateRecord(plan, updatedAt, fields);
  if (!candidate.success) {
    return { ok: false, errors: issuesToMessages(candidate.error.issues) };
  }

  if (!(store instanceof LifeRhythmDatabase)) {
    if (
      expected.status === 'ok' &&
      expected.calendarRepairPendingAt &&
      !fields.calendarRepairPendingAt &&
      calendarSourceSnapshot === undefined
    ) {
      return staleSchedulerWriteResult();
    }
    return saveSchedulerPlanState(plan, store, updatedAt, fields);
  }

  try {
    return await store.transaction(
      'rw',
      [
        store.schedulerPlanState,
        store.calendarSources,
        store.settings,
        store.activeTasks,
        store.taskPoolItems,
        store.rhythmTemplates,
        store.softPlacements,
        store.taskHistory,
      ],
      async () => {
        const latest = await store.schedulerPlanState.get(CURRENT_SCHEDULER_PLAN_STATE_ID);
        if (!storedStateMatchesLoaded(latest, expected)) {
          return staleSchedulerWriteResult();
        }

        if (calendarSourceSnapshot !== undefined) {
          const calendar = await store.calendarSources.get(CURRENT_CALENDAR_SOURCE_ID);
          if (!storedCalendarMatchesSnapshot(calendar, calendarSourceSnapshot)) {
            return staleSchedulerWriteResult();
          }
        } else if (
          expected.status === 'ok' &&
          expected.calendarRepairPendingAt &&
          !fields.calendarRepairPendingAt
        ) {
          return staleSchedulerWriteResult();
        }

        if (canonicalInputSnapshot !== undefined) {
          const latestCanonicalRows = await readCanonicalSchedulingInputRows(store);
          if (canonicalSchedulingInputSnapshot(latestCanonicalRows) !== canonicalInputSnapshot) {
            return staleSchedulerWriteResult();
          }
        }

        if (expectedDurationLearningEventSnapshot !== undefined) {
          const latestTaskHistory = await store.taskHistory.toArray();
          if (durationLearningEventSnapshot(latestTaskHistory) !== expectedDurationLearningEventSnapshot) {
            return staleSchedulerWriteResult();
          }
        }

        await store.schedulerPlanState.put(candidate.data);
        for (const event of behaviourEvents) {
          await appendBehaviourEvent(event, store);
        }
        return {
          ok: true as const,
          plan: clonePlan(candidate.data.plan as SchedulerPlan),
          updatedAt: candidate.data.updatedAt,
          ...stateFields(candidate.data),
        };
      },
    );
  } catch {
    return {
      ok: false,
      errors: ['schedulerPlanState: Saved scheduler state could not be written.'],
    };
  }
}

export async function loadSchedulerPlanState(
  store: SchedulerPlanStateStore = getCurrentLifeRhythmDatabase(),
): Promise<SchedulerPlanStateLoadResult> {
  try {
    const stored = await store.schedulerPlanState.get(CURRENT_SCHEDULER_PLAN_STATE_ID);

    if (!stored) {
      return { status: 'missing' };
    }

    const parsed = schedulerPlanStateRecordSchema.safeParse(stored);

    if (!parsed.success) {
      return {
        status: 'invalid',
        errors: issuesToMessages(parsed.error.issues),
      };
    }

    return {
      status: 'ok',
      plan: clonePlan(parsed.data.plan as SchedulerPlan),
      updatedAt: parsed.data.updatedAt,
      ...stateFields(parsed.data),
    };
  } catch {
    return {
      status: 'error',
      errors: ['schedulerPlanState: Saved scheduler state could not be read.'],
    };
  }
}

export async function saveSchedulerPlanState(
  plan: SchedulerPlan,
  store: SchedulerPlanStateStore = getCurrentLifeRhythmDatabase(),
  updatedAt = new Date().toISOString(),
  fields: SchedulerStateFields = {},
): Promise<SchedulerPlanStateWriteResult> {
  const parsed = validatedSchedulerPlanStateRecord(plan, updatedAt, fields);

  if (!parsed.success) {
    return {
      ok: false,
      errors: issuesToMessages(parsed.error.issues),
    };
  }

  try {
    await store.schedulerPlanState.put(parsed.data);
  } catch {
    return {
      ok: false,
      errors: ['schedulerPlanState: Saved scheduler state could not be written.'],
    };
  }

  return {
    ok: true,
    plan: clonePlan(parsed.data.plan as SchedulerPlan),
    updatedAt: parsed.data.updatedAt,
    ...stateFields(parsed.data),
  };
}

export async function markCalendarRepairPending(
  store: SchedulerPlanStateStore = getCurrentLifeRhythmDatabase(),
  detectedAt = new Date().toISOString(),
): Promise<{ ok: true; persisted: boolean } | { ok: false; errors: string[] }> {
  try {
    const stored = await store.schedulerPlanState.get(CURRENT_SCHEDULER_PLAN_STATE_ID);

    if (!stored) {
      return { ok: true, persisted: false };
    }

    const candidate = schedulerPlanStateRecordSchema.safeParse({
      ...stored,
      calendarRepairPendingAt: detectedAt,
    });

    if (!candidate.success) {
      return { ok: false, errors: issuesToMessages(candidate.error.issues) };
    }

    const updated = await store.schedulerPlanState.update(
      CURRENT_SCHEDULER_PLAN_STATE_ID,
      { calendarRepairPendingAt: candidate.data.calendarRepairPendingAt },
    );
    return { ok: true, persisted: updated === 1 };
  } catch {
    return {
      ok: false,
      errors: ['schedulerPlanState: Calendar repair attention could not be saved.'],
    };
  }
}

function preferencePlacementTargetId(placement: InternalPlacement) {
  return placement.targetKind === 'rhythm'
    ? placement.rhythmId ?? placement.intentionId
    : placement.intentionId;
}

function preferenceRepairTargetMatchesPlacement(
  target: PreferenceRepairTarget,
  placement: InternalPlacement,
  input: SchedulingDomainModel,
) {
  const placementKind = placement.targetKind ?? 'intention';
  const targetId = preferencePlacementTargetId(placement);

  if (target.targetKind === placementKind) return target.targetValue === targetId;

  if (placementKind === 'rhythm') {
    const rhythm = input.rhythms.find((candidate) => candidate.id === targetId);
    return target.targetKind === 'area' && rhythm?.area === target.targetValue;
  }

  const intention = input.intentions.find((candidate) => candidate.id === targetId);
  if (!intention) return false;
  if (target.targetKind === 'area') return intention.area === target.targetValue;
  if (target.targetKind === 'taskType') return intention.taskType === target.targetValue;
  return false;
}

function pendingPreferenceReleaseIds(
  current: SchedulerPlanStateExpectation,
  change: SchedulerChange,
) {
  if (
    current.status !== 'ok' ||
    !current.preferenceRepairPendingAt ||
    !change.now ||
    !current.preferenceRepairTargets ||
    current.preferenceRepairTargets.length === 0
  ) {
    return [];
  }

  return current.plan.placements
    .filter((placement) =>
      placement.origin === 'scheduler' &&
      (
        placement.date > change.now!.date ||
        (placement.date === change.now!.date && placement.start >= change.now!.time)
      ) &&
      current.preferenceRepairTargets!.some((target) =>
        preferenceRepairTargetMatchesPlacement(target, placement, change.nextInput),
      ),
    )
    .map((placement) => placement.id)
    .sort();
}

function withPendingPreferenceRepair(
  current: SchedulerPlanStateExpectation,
  change: SchedulerChange,
): {
  change: SchedulerChange;
  applied: boolean;
} {
  const releases = pendingPreferenceReleaseIds(current, change);
  const canApply = current.status === 'ok' &&
    Boolean(current.preferenceRepairPendingAt) &&
    Boolean(change.now) &&
    Boolean(current.preferenceRepairTargets?.length);

  if (!canApply) return { change, applied: false };

  return {
    applied: true,
    change: {
      ...change,
      releasePlacementIds: [...new Set([
        ...(change.releasePlacementIds ?? []),
        ...releases,
      ])].sort(),
    },
  };
}

function orderedPreferenceRepairTargets(
  targets: readonly PreferenceRepairTarget[],
): PreferenceRepairTarget[] {
  const byKey = new Map<string, PreferenceRepairTarget>();
  for (const target of targets) {
    byKey.set(`${target.targetKind}:${target.targetValue}`, { ...target });
  }
  return [...byKey.values()].sort((left, right) =>
    left.targetKind.localeCompare(right.targetKind) ||
    left.targetValue.localeCompare(right.targetValue),
  );
}

export async function markPreferenceRepairPending(
  store: SchedulerPlanStateStore = getCurrentLifeRhythmDatabase(),
  detectedAt = new Date().toISOString(),
  targets: readonly PreferenceRepairTarget[] = [],
): Promise<{ ok: true; persisted: boolean } | { ok: false; errors: string[] }> {
  try {
    const stored = await store.schedulerPlanState.get(CURRENT_SCHEDULER_PLAN_STATE_ID);

    if (!stored) {
      return { ok: true, persisted: false };
    }

    const candidate = schedulerPlanStateRecordSchema.safeParse({
      ...stored,
      preferenceRepairPendingAt: detectedAt,
      preferenceRepairTargets: orderedPreferenceRepairTargets([
        ...(stored.preferenceRepairTargets ?? []),
        ...targets,
      ]),
    });

    if (!candidate.success) {
      return { ok: false, errors: issuesToMessages(candidate.error.issues) };
    }

    const updated = await store.schedulerPlanState.update(
      CURRENT_SCHEDULER_PLAN_STATE_ID,
      {
        preferenceRepairPendingAt: candidate.data.preferenceRepairPendingAt,
        preferenceRepairTargets: candidate.data.preferenceRepairTargets,
      },
    );
    return { ok: true, persisted: updated === 1 };
  } catch {
    return {
      ok: false,
      errors: ['schedulerPlanState: Preference repair attention could not be saved.'],
    };
  }
}

export async function clearSchedulerPlanState(
  store: SchedulerPlanStateStore = getCurrentLifeRhythmDatabase(),
): Promise<void> {
  await store.schedulerPlanState.delete(CURRENT_SCHEDULER_PLAN_STATE_ID);
}

export async function buildAndPersistSchedulerPlan(
  input: SchedulingDomainModel,
  store: SchedulerPlanStateStore = getCurrentLifeRhythmDatabase(),
  updatedAt = new Date().toISOString(),
  dayModeContext?: SchedulerDayModeContext,
  calendarSourceSnapshot?: CalendarSourceSnapshot,
  canonicalInputSnapshot?: CanonicalSchedulingInputSnapshot,
  expectedSchedulerState?: SchedulerPlanStateExpectation,
  durationLearning?: DurationLearningPersistInput,
): Promise<SchedulerPlanPersistActionResult> {
  const observed = await loadSchedulerPlanState(store);
  if (observed.status === 'invalid' || observed.status === 'error') {
    return { ok: false, errors: observed.errors };
  }
  if (expectedSchedulerState && !loadedStateMatchesExpected(observed, expectedSchedulerState)) {
    return staleSchedulerWriteResult();
  }
  const current = expectedSchedulerState ?? observed;

  try {
    const plan = scheduler.buildPlan(input);
    const saved = await saveSchedulerPlanStateIfCurrent(plan, current, store, updatedAt, {
      dayModeContext,
      ...(durationLearning
        ? { durationLearningApplied: orderedDurationLearning(durationLearning.applied) }
        : current.status === 'ok' && current.durationLearningApplied
          ? { durationLearningApplied: current.durationLearningApplied }
          : {}),
      ...(current.status === 'ok' && current.calendarRepairPendingAt
        ? { calendarRepairPendingAt: current.calendarRepairPendingAt }
        : {}),
    }, calendarSourceSnapshot, canonicalInputSnapshot, durationLearning?.eventSnapshot,
    current.status === 'missing' ? behaviourEventsForInitialSchedulerPlan(plan, updatedAt) : []);

    return saved.ok
      ? { ...saved, mode: 'built' }
      : saved;
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Scheduler plan could not be built.'],
    };
  }
}

export async function repairAndPersistSchedulerPlan(
  change: SchedulerChange,
  store: SchedulerPlanStateStore = getCurrentLifeRhythmDatabase(),
  updatedAt = new Date().toISOString(),
  nextDayModeContext?: SchedulerDayModeContext | null,
  calendarSourceSnapshot?: CalendarSourceSnapshot,
  canonicalInputSnapshot?: CanonicalSchedulingInputSnapshot,
  expectedSchedulerState?: SchedulerPlanStateExpectation,
  durationLearning?: DurationLearningPersistInput,
): Promise<SchedulerPlanPersistActionResult> {
  const observed = await loadSchedulerPlanState(store);
  if (observed.status === 'invalid' || observed.status === 'error') {
    return { ok: false, errors: observed.errors };
  }
  if (expectedSchedulerState && !loadedStateMatchesExpected(observed, expectedSchedulerState)) {
    return staleSchedulerWriteResult();
  }
  const current = expectedSchedulerState ?? observed;

  try {
    const preferenceAware = withPendingPreferenceRepair(current, change);
    const previousDurationLearning = current.status === 'ok'
      ? orderedDurationLearning(current.durationLearningApplied ?? [])
      : [];
    const nextDurationLearning = durationLearning
      ? orderedDurationLearning(durationLearning.applied)
      : previousDurationLearning;
    const changedDurationTemplateIds = durationLearningChangedTemplateIds(
      previousDurationLearning,
      nextDurationLearning,
    );
    const durationReleaseIds = releaseIdsForDurationLearning(
      current,
      preferenceAware.change,
      changedDurationTemplateIds,
    );
    const durationAwareChange: SchedulerChange = {
      ...preferenceAware.change,
      ...(durationReleaseIds.length > 0
        ? {
            releasePlacementIds: [...new Set([
              ...(preferenceAware.change.releasePlacementIds ?? []),
              ...durationReleaseIds,
            ])].sort(),
          }
        : {}),
    };
    const safeChange = durationAwareChange.now
      ? {
          ...durationAwareChange,
          nextInput: clipSchedulingInputToNow(
            durationAwareChange.nextInput,
            durationAwareChange.now,
          ),
        }
      : durationAwareChange;
    const calculatedPlan = current.status === 'missing'
      ? scheduler.buildPlan(safeChange.nextInput)
      : scheduler.repairPlan(current.plan, safeChange);
    const appliedPreferenceRepairTargets = preferenceAware.applied && current.status === 'ok'
      ? orderedPreferenceRepairTargets(current.preferenceRepairTargets ?? [])
      : [];
    const plan = calculatedPlan.repair && (
      appliedPreferenceRepairTargets.length > 0 ||
      changedDurationTemplateIds.length > 0
    )
      ? {
          ...calculatedPlan,
          repair: {
            ...calculatedPlan.repair,
            ...(appliedPreferenceRepairTargets.length > 0
              ? { appliedPreferenceRepairTargets }
              : {}),
            ...(changedDurationTemplateIds.length > 0
              ? {
                  appliedDurationLearningTemplateIds: changedDurationTemplateIds,
                  previousDurationLearningApplied: previousDurationLearning,
                }
              : {}),
          },
        }
      : calculatedPlan;
    const previousContext = current.status === 'ok' ? current.dayModeContext : undefined;
    const inheritedContext = change.now && previousContext?.date === change.now.date
      ? previousContext
      : undefined;
    const dayModeContext = nextDayModeContext === undefined
      ? inheritedContext
      : nextDayModeContext ?? undefined;
    const preservePendingPreferenceRepair = current.status === 'ok' &&
      Boolean(current.preferenceRepairPendingAt) &&
      !preferenceAware.applied;
    const saved = await saveSchedulerPlanStateIfCurrent(plan, current, store, updatedAt, {
      dayModeContext,
      ...(current.status === 'ok' ? { undoDayModeContext: previousContext ?? null } : {}),
      ...(preservePendingPreferenceRepair && current.status === 'ok'
        ? {
            preferenceRepairPendingAt: current.preferenceRepairPendingAt,
            preferenceRepairTargets: current.preferenceRepairTargets,
          }
        : {}),
      durationLearningApplied: nextDurationLearning,
    }, calendarSourceSnapshot, canonicalInputSnapshot, durationLearning?.eventSnapshot,
    current.status === 'missing'
      ? behaviourEventsForInitialSchedulerPlan(plan, updatedAt)
      : behaviourEventsForSchedulerRepair(plan, updatedAt));

    if (!saved.ok) {
      return saved;
    }

    return {
      ...saved,
      mode: current.status === 'missing' ? 'built' : 'repaired',
    };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Scheduler plan could not be repaired.'],
    };
  }
}

export async function undoPersistedSchedulerRepair(
  store: SchedulerPlanStateStore = getCurrentLifeRhythmDatabase(),
  updatedAt = new Date().toISOString(),
): Promise<SchedulerPlanPersistActionResult> {
  const current = await loadSchedulerPlanState(store);

  if (current.status === 'missing') {
    return {
      ok: false,
      errors: ['schedulerPlanState: There is no saved plan to undo.'],
    };
  }

  if (current.status === 'invalid' || current.status === 'error') {
    return { ok: false, errors: current.errors };
  }

  if (!current.plan.repair?.undo) {
    return {
      ok: false,
      errors: ['schedulerPlanState: There is no saved repair to undo.'],
    };
  }

  const reverted = scheduler.undoRepair(current.plan);
  const calendarRepairPendingAt = current.calendarRepairPendingAt ??
    (current.plan.repair?.trigger === 'calendarChanged' ? updatedAt : undefined);
  const appliedPreferenceRepairTargets = orderedPreferenceRepairTargets(
    current.plan.repair?.appliedPreferenceRepairTargets ?? [],
  );
  const legacyPreferenceRepairTargets = current.plan.repair?.trigger === 'preferenceChanged'
    ? orderedPreferenceRepairTargets(current.plan.repair.changes.map((change) => ({
        targetKind: change.targetKind,
        targetValue: change.targetId,
      })))
    : [];
  const restoredPreferenceRepairTargets = appliedPreferenceRepairTargets.length > 0
    ? appliedPreferenceRepairTargets
    : legacyPreferenceRepairTargets;
  const preferenceRepairTargets = orderedPreferenceRepairTargets([
    ...(current.preferenceRepairTargets ?? []),
    ...restoredPreferenceRepairTargets,
  ]);
  const preferenceRepairPendingAt = preferenceRepairTargets.length === 0
    ? undefined
    : restoredPreferenceRepairTargets.length > 0
      ? updatedAt
      : current.preferenceRepairPendingAt;
  const undoDurationLearningApplied = current.plan.repair?.previousDurationLearningApplied
    ? orderedDurationLearning(current.plan.repair.previousDurationLearningApplied)
    : orderedDurationLearning(current.durationLearningApplied ?? []);
  const saved = await saveSchedulerPlanStateIfCurrent(reverted, current, store, updatedAt, {
    calendarRepairPendingAt,
    preferenceRepairPendingAt,
    ...(preferenceRepairTargets.length > 0 ? { preferenceRepairTargets } : {}),
    durationLearningApplied: undoDurationLearningApplied,
    dayModeContext: current.undoDayModeContext ?? undefined,
  }, undefined, undefined, undefined, [behaviourEventForSchedulerUndo(current.plan, updatedAt)]);

  return saved.ok
    ? { ...saved, mode: 'undone' }
    : saved;
}
