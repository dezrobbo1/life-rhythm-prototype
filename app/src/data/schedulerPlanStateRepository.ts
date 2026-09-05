import type { Table } from 'dexie';
import { scheduler } from '../domain/primaryScheduler';
import type {
  LocalDate,
  SchedulerChange,
  SchedulerDayMode,
  SchedulerPlan,
  SchedulingDomainModel,
} from '../domain/schedulingModel';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  schedulerPlanStateRecordSchema,
  type SchedulerPlanStateRecord,
} from './schedulerPlanStateSchema';

export const CURRENT_SCHEDULER_PLAN_STATE_ID = 'current';

type SchedulerPlanStateTable = Pick<
  Table<SchedulerPlanStateRecord, string>,
  'delete' | 'get' | 'put'
>;

export type SchedulerPlanStateStore = {
  schedulerPlanState: SchedulerPlanStateTable;
};

export type SchedulerPlanDayModeContext = {
  dayMode: SchedulerDayMode;
  dayModeDate: LocalDate;
};

type SchedulerPlanModeFields = Partial<SchedulerPlanDayModeContext>;

export type SchedulerPlanStateLoadResult =
  | { status: 'missing' }
  | ({ status: 'ok'; plan: SchedulerPlan; updatedAt: string } & SchedulerPlanModeFields)
  | { status: 'invalid'; errors: string[] }
  | { status: 'error'; errors: string[] };

export type SchedulerPlanStateWriteResult =
  | ({ ok: true; plan: SchedulerPlan; updatedAt: string } & SchedulerPlanModeFields)
  | { ok: false; errors: string[] };

export type SchedulerPlanPersistActionResult =
  | ({
      ok: true;
      mode: 'built' | 'repaired' | 'undone';
      plan: SchedulerPlan;
      updatedAt: string;
    } & SchedulerPlanModeFields)
  | { ok: false; errors: string[] };

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'schedulerPlanState';
    return `${path}: ${issue.message}`;
  });
}

function clonePlan(plan: SchedulerPlan): SchedulerPlan {
  return JSON.parse(JSON.stringify(plan)) as SchedulerPlan;
}

function modeContextFromLoad(
  result: SchedulerPlanStateLoadResult,
): SchedulerPlanDayModeContext | undefined {
  if (result.status !== 'ok' || !result.dayMode || !result.dayModeDate) return undefined;
  return {
    dayMode: result.dayMode,
    dayModeDate: result.dayModeDate,
  };
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
      ...(parsed.data.dayMode && parsed.data.dayModeDate
        ? {
            dayMode: parsed.data.dayMode,
            dayModeDate: parsed.data.dayModeDate,
          }
        : {}),
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
  dayModeContext?: SchedulerPlanDayModeContext,
): Promise<SchedulerPlanStateWriteResult> {
  const candidate = {
    id: CURRENT_SCHEDULER_PLAN_STATE_ID,
    version: 1,
    updatedAt,
    ...(dayModeContext ?? {}),
    plan: clonePlan(plan),
  };
  const parsed = schedulerPlanStateRecordSchema.safeParse(candidate);

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
    ...(parsed.data.dayMode && parsed.data.dayModeDate
      ? {
          dayMode: parsed.data.dayMode,
          dayModeDate: parsed.data.dayModeDate,
        }
      : {}),
  };
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
  dayModeContext?: SchedulerPlanDayModeContext,
): Promise<SchedulerPlanPersistActionResult> {
  try {
    const plan = scheduler.buildPlan(input);
    const saved = await saveSchedulerPlanState(plan, store, updatedAt, dayModeContext);

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
  dayModeContext?: SchedulerPlanDayModeContext,
): Promise<SchedulerPlanPersistActionResult> {
  const current = await loadSchedulerPlanState(store);

  if (current.status === 'invalid' || current.status === 'error') {
    return { ok: false, errors: current.errors };
  }

  const inferredContext = change.now && change.nextInput.planningPolicy?.dayMode
    ? {
        dayMode: change.nextInput.planningPolicy.dayMode,
        dayModeDate: change.now.date,
      }
    : undefined;
  const nextModeContext = dayModeContext ?? inferredContext ?? modeContextFromLoad(current);

  try {
    const plan = current.status === 'missing'
      ? scheduler.buildPlan(change.nextInput)
      : scheduler.repairPlan(current.plan, change);
    const saved = await saveSchedulerPlanState(plan, store, updatedAt, nextModeContext);

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
  const saved = await saveSchedulerPlanState(
    reverted,
    store,
    updatedAt,
    modeContextFromLoad(current),
  );

  return saved.ok
    ? { ...saved, mode: 'undone' }
    : saved;
}
