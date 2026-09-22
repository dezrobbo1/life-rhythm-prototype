import type { Table } from 'dexie';
import { scheduler } from '../domain/primaryScheduler';
import { clipSchedulingInputToNow } from '../domain/elapsedTimeCapacity';
import type {
  LocalDate,
  SchedulerChange,
  SchedulerPlan,
  SchedulingDomainModel,
} from '../domain/schedulingModel';
import {
  CURRENT_CALENDAR_SOURCE_ID,
  calendarSourceRecordSchema,
} from './calendarSourceSchema';
import { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  canonicalSchedulingInputSnapshot,
  readCanonicalSchedulingInputRows,
  type CanonicalSchedulingInputSnapshot,
} from './schedulerCanonicalInputSnapshot';
import {
  schedulerPlanStateRecordSchema,
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
};

export type CalendarSourceSnapshot = {
  source: string;
  updatedAt: string;
} | null;

export const CALENDAR_REPAIR_PENDING_MESSAGE =
  'Calendar change was saved, but the flexible private plan could not be repaired.';

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
      ...(current.status === 'ok' && current.calendarRepairPendingAt
        ? { calendarRepairPendingAt: current.calendarRepairPendingAt }
        : {}),
    }, calendarSourceSnapshot, canonicalInputSnapshot,
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
    const safeChange = change.now
      ? { ...change, nextInput: clipSchedulingInputToNow(change.nextInput, change.now) }
      : change;
    const plan = current.status === 'missing'
      ? scheduler.buildPlan(safeChange.nextInput)
      : scheduler.repairPlan(current.plan, safeChange);
    const previousContext = current.status === 'ok' ? current.dayModeContext : undefined;
    const inheritedContext = change.now && previousContext?.date === change.now.date
      ? previousContext
      : undefined;
    const dayModeContext = nextDayModeContext === undefined
      ? inheritedContext
      : nextDayModeContext ?? undefined;
    const saved = await saveSchedulerPlanStateIfCurrent(plan, current, store, updatedAt, {
      dayModeContext,
      ...(current.status === 'ok' ? { undoDayModeContext: previousContext ?? null } : {}),
    }, calendarSourceSnapshot, canonicalInputSnapshot,
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
  const saved = await saveSchedulerPlanStateIfCurrent(reverted, current, store, updatedAt, {
    calendarRepairPendingAt,
    dayModeContext: current.undoDayModeContext ?? undefined,
  }, undefined, undefined, [behaviourEventForSchedulerUndo(current.plan, updatedAt)]);

  return saved.ok
    ? { ...saved, mode: 'undone' }
    : saved;
}
