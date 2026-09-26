import {
  importIcsCalendarSource,
  removeCalendarSource,
  type CalendarSourceImportInput,
  type CalendarSourceImportResult,
  type CalendarSourceRemoveResult,
} from './calendarSourceRepository';
import {
  getCurrentLifeRhythmDatabase,
} from './localDataNamespace';
import {
  CURRENT_SCHEDULER_PLAN_STATE_ID,
  markCalendarRepairPending,
} from './schedulerPlanStateRepository';
import type { LifeRhythmDatabase } from './db';
import { loadCalendarSource } from './calendarSourceRepository';
import { calendarSourceRecordSchema } from './calendarSourceSchema';

export async function commitCalendarSourceBuffers(beforeBusyMinutes: number, afterBusyMinutes: number,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase()) {
  try {
    return await database.transaction('rw', database.calendarSources, database.schedulerPlanState, async () => {
      const existing = await loadCalendarSource(database);
      if (existing.status !== 'ok') return { ok: false as const, errors: ['Calendar must be imported and readable first.'] };
      const parsed = calendarSourceRecordSchema.safeParse({ ...existing.record, version: 2,
        beforeBusyMinutes, afterBusyMinutes, updatedAt: new Date().toISOString() });
      if (!parsed.success) return { ok: false as const, errors: parsed.error.issues.map((issue) => issue.message) };
      await database.calendarSources.put(parsed.data);
      const marked = await persistRepairAttentionForExistingPlan(database);
      if (!marked.ok) throw new Error('Calendar repair attention could not be stored.');
      return { ok: true as const, record: parsed.data };
    });
  } catch {
    return { ok: false as const, errors: ['Calendar buffers could not be saved safely.'] };
  }
}

const IMPORT_ATOMICITY_ERROR =
  'calendarSource: Calendar change was not saved because repair attention could not be stored safely.';
const REMOVE_ATOMICITY_ERROR =
  'calendarSource: Calendar removal was not saved because repair attention could not be stored safely.';

export type CalendarSourceImportCommitResult =
  | (Extract<CalendarSourceImportResult, { ok: true }> & {
      repairAttentionPersisted: boolean;
    })
  | Extract<CalendarSourceImportResult, { ok: false }>;

export type CalendarSourceRemoveCommitResult =
  | (Extract<CalendarSourceRemoveResult, { ok: true }> & {
      repairAttentionPersisted: boolean;
    })
  | Extract<CalendarSourceRemoveResult, { ok: false }>;

type AtomicFailure = {
  errors: string[];
  warnings?: string[];
};

async function persistRepairAttentionForExistingPlan(database: LifeRhythmDatabase) {
  const existingPlan = await database.schedulerPlanState.get(CURRENT_SCHEDULER_PLAN_STATE_ID);
  const marked = await markCalendarRepairPending(database);

  if (!marked.ok || (existingPlan && !marked.persisted)) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    persisted: marked.persisted,
  };
}

export async function commitCalendarSourceImport(
  input: CalendarSourceImportInput,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<CalendarSourceImportCommitResult> {
  const failureState: { current?: AtomicFailure } = {};

  try {
    return await database.transaction(
      'rw',
      database.calendarSources,
      database.schedulerPlanState,
      async () => {
        const imported = await importIcsCalendarSource(input, database);
        if (!imported.ok) return imported;

        const marked = await persistRepairAttentionForExistingPlan(database);
        if (!marked.ok) {
          failureState.current = {
            errors: [IMPORT_ATOMICITY_ERROR],
            warnings: imported.warnings,
          };
          throw new Error(IMPORT_ATOMICITY_ERROR);
        }

        return {
          ...imported,
          repairAttentionPersisted: marked.persisted,
        };
      },
    );
  } catch {
    return {
      ok: false,
      errors: failureState.current?.errors ?? [
        'calendarSource: Calendar source could not be saved on this device.',
      ],
      warnings: failureState.current?.warnings ?? [],
    };
  }
}

export async function commitCalendarSourceRemoval(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<CalendarSourceRemoveCommitResult> {
  const failureState: { current?: AtomicFailure } = {};

  try {
    return await database.transaction(
      'rw',
      database.calendarSources,
      database.schedulerPlanState,
      async () => {
        const removed = await removeCalendarSource(database);
        if (!removed.ok || !removed.removed) {
          return {
            ...removed,
            ...(removed.ok ? { repairAttentionPersisted: false } : {}),
          } as CalendarSourceRemoveCommitResult;
        }

        const marked = await persistRepairAttentionForExistingPlan(database);
        if (!marked.ok) {
          failureState.current = { errors: [REMOVE_ATOMICITY_ERROR] };
          throw new Error(REMOVE_ATOMICITY_ERROR);
        }

        return {
          ...removed,
          repairAttentionPersisted: marked.persisted,
        };
      },
    );
  } catch {
    return {
      ok: false,
      errors: failureState.current?.errors ?? [
        'calendarSource: Saved read-only calendar source could not be removed.',
      ],
    };
  }
}
