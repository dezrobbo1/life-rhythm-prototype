import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import type { LifeRhythmDatabase } from './db';
import {
  activeTaskSchema,
  taskPoolItemSchema,
  type ActiveTask,
  type TaskPoolItem,
} from './schemas';
import { markTaskInputRepairPending } from './schedulerPlanStateRepository';

export type UserTaskDefinition = {
  title: string;
  area: ActiveTask['area'];
  minimum: ActiveTask['minimum'];
  normal: ActiveTask['normal'];
  full: ActiveTask['full'];
  purpose?: string;
  notes?: string;
  timeConstraint?: ActiveTask['timeConstraint'];
  dueAt?: string;
  fixedAt?: string;
  expiresAfter?: string;
  latestUsefulStartAt?: string;
  notUsefulAfter?: string;
  minimumStillUsefulAfterDeadline?: boolean;
  missedPolicy?: ActiveTask['missedPolicy'];
};

export type UserTaskDefinitionResult =
  | { ok: true; task: ActiveTask | null; item: TaskPoolItem | null }
  | { ok: false; errors: string[] };

/** Only these authored fields change. Status, identity, history, and template links stay put. */
function withoutDefinition<T extends ActiveTask | TaskPoolItem>(record: T) {
  const {
    title: _title, area: _area, minimum: _minimum, normal: _normal, full: _full,
    purpose: _purpose, timeConstraint: _timeConstraint, dueAt: _dueAt,
    fixedAt: _fixedAt, expiresAfter: _expiresAfter,
    latestUsefulStartAt: _latestUsefulStartAt, notUsefulAfter: _notUsefulAfter,
    minimumStillUsefulAfterDeadline: _minimumStillUsefulAfterDeadline,
    missedPolicy: _missedPolicy, notes: _notes, ...rest
  } = record as T & { notes?: string };
  return rest;
}

/** A task with a linked Held/Today record is corrected in both stores atomically. */
export async function updateUserTaskDefinition(
  id: string,
  expectedUpdatedAt: string,
  surface: 'held' | 'today',
  definition: UserTaskDefinition,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<UserTaskDefinitionResult> {
  try {
    return await database.transaction(
      'rw', [database.taskPoolItems, database.activeTasks, database.schedulerPlanState],
      async () => {
        const [storedPool, storedActive] = await Promise.all([
          database.taskPoolItems.get(id), database.activeTasks.get(id),
        ]);
        if (!storedPool && !storedActive) return { ok: false as const, errors: ['Task no longer exists.'] };
        const pool = storedPool ? taskPoolItemSchema.safeParse(storedPool) : null;
        const active = storedActive ? activeTaskSchema.safeParse(storedActive) : null;
        if ((pool && !pool.success) || (active && !active.success)) {
          return { ok: false as const, errors: ['Saved task data could not be read safely. No change was made.'] };
        }
        const item = pool?.success ? pool.data : null;
        const task = active?.success ? active.data : null;
        const selected = surface === 'held' ? item : task;
        if (!selected || selected.updatedAt !== expectedUpdatedAt ||
            (item && item.updatedAt > expectedUpdatedAt) ||
            (task && task.updatedAt > expectedUpdatedAt)) {
          return { ok: false as const, errors: ['This task changed elsewhere. Reopen it before saving.'] };
        }
        if ((item && item.source !== 'adhoc') || (task && task.source !== 'adhoc') ||
            (task && !['active', 'inProgress', 'paused', 'minimumDone'].includes(task.status))) {
          return { ok: false as const, errors: ['Only a user-created Held or Today task can be corrected here.'] };
        }
        const timestamp = new Date().toISOString();
        const { notes: _notes, ...authoredDefinition } = definition;
        const fields = { ...authoredDefinition, updatedAt: timestamp };
        const nextPool = item ? taskPoolItemSchema.safeParse({
          ...withoutDefinition(item), ...fields,
          ...(definition.notes === undefined
            ? item.notes ? { notes: item.notes } : {}
            : definition.notes.trim() ? { notes: definition.notes.trim() } : {}),
        }) : null;
        const nextTask = task ? activeTaskSchema.safeParse({
          ...withoutDefinition(task), ...fields,
        }) : null;
        if ((nextPool && !nextPool.success) || (nextTask && !nextTask.success)) {
          const issues = [
            ...(nextPool && !nextPool.success ? nextPool.error.issues : []),
            ...(nextTask && !nextTask.success ? nextTask.error.issues : []),
          ];
          return { ok: false as const, errors: issues.map((issue) =>
            `${issue.path.join('.') || 'task'}: ${issue.message}`) };
        }
        if (nextPool?.success) await database.taskPoolItems.put(nextPool.data);
        if (nextTask?.success) await database.activeTasks.put(nextTask.data);
        const marked = await markTaskInputRepairPending(database, id, timestamp);
        if (!marked.ok) throw new Error(marked.errors.join(' '));
        return {
          ok: true as const,
          item: nextPool?.success ? nextPool.data : null,
          task: nextTask?.success ? nextTask.data : null,
        };
      },
    );
  } catch {
    return { ok: false, errors: ['Task correction was not saved. Check device storage and the private plan.'] };
  }
}
