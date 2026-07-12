import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  activeTaskSchema,
  activeTaskStatusSchema,
  softPlacementSchema,
  taskPoolItemSchema,
  type ActiveTask,
  type ActiveTaskStatus,
  type SoftPlacement,
  type TaskPoolItem,
  type TaskPoolItemStatus,
} from './schemas';
import type { LifeRhythmDatabase } from './db';

export type BringTaskPoolItemToTodayResult =
  | {
      alreadyInToday: boolean;
      item: TaskPoolItem;
      ok: true;
      task: ActiveTask;
    }
  | {
      errors: string[];
      ok: false;
    };

export type UpdateTaskLifecycleStatusResult =
  | {
      item: TaskPoolItem | null;
      ok: true;
      placements: SoftPlacement[];
      task: ActiveTask;
      visibleToday: boolean;
    }
  | {
      errors: string[];
      ok: false;
    };

export type MarkTaskNoLongerNeededResult =
  | {
      item: TaskPoolItem;
      ok: true;
      placements: SoftPlacement[];
      task: ActiveTask | null;
    }
  | {
      errors: string[];
      ok: false;
    };

const visibleTodayStatuses: readonly ActiveTaskStatus[] = [
  'active',
  'inProgress',
  'paused',
  'minimumDone',
];

const mutablePlacementStatuses = new Set<SoftPlacement['status']>(['planned', 'moved']);

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'taskLifecycle';

    return `${path}: ${issue.message}`;
  });
}

function isVisibleTodayStatus(status: ActiveTaskStatus) {
  return visibleTodayStatuses.includes(status);
}

function poolStatusForActiveTask(status: ActiveTaskStatus): TaskPoolItemStatus {
  if (isVisibleTodayStatus(status)) return 'today';
  if (status === 'parked') return 'parked';
  if (status === 'notToday' || status === 'skipped') return 'notToday';
  return 'noLongerNeeded';
}

function placementStatusForActiveTask(
  status: ActiveTaskStatus,
): Extract<SoftPlacement['status'], 'completedFromToday' | 'removed'> | null {
  if (status === 'done') return 'completedFromToday';
  if (status === 'parked' || status === 'notToday' || status === 'skipped') return 'removed';
  return null;
}

function withoutBringBackAfter(item: TaskPoolItem) {
  const nextItem = { ...item };
  delete nextItem.bringBackAfter;
  return nextItem;
}

async function transitionLinkedPlacements(
  taskId: string,
  status: ActiveTaskStatus,
  timestamp: string,
  database: LifeRhythmDatabase,
): Promise<SoftPlacement[]> {
  const nextStatus = placementStatusForActiveTask(status);
  if (!nextStatus) return [];

  const storedPlacements = await database.softPlacements.where('taskId').equals(taskId).toArray();
  const updatedPlacements = storedPlacements.flatMap((storedPlacement) => {
    const parsedPlacement = softPlacementSchema.safeParse(storedPlacement);

    if (!parsedPlacement.success || !mutablePlacementStatuses.has(parsedPlacement.data.status)) {
      return [];
    }

    return [
      softPlacementSchema.parse({
        ...parsedPlacement.data,
        status: nextStatus,
        updatedAt: timestamp,
      }),
    ];
  });

  for (const placement of updatedPlacements) {
    await database.softPlacements.put(placement);
  }

  return updatedPlacements;
}

function activeTaskSourceFromPoolItem(item: TaskPoolItem):
  | {
      ok: true;
      source: 'adhoc' | 'library';
      templateId?: string;
    }
  | {
      errors: string[];
      ok: false;
    } {
  if (item.source === 'adhoc') {
    return {
      ok: true,
      source: 'adhoc',
    };
  }

  if (item.source === 'library' || item.source === 'rhythm') {
    if (!item.templateId) {
      return {
        errors: ['templateId: Reusable Pool tasks need a Library rhythm reference before they can move to Today.'],
        ok: false,
      };
    }

    return {
      ok: true,
      source: 'library',
      templateId: item.templateId,
    };
  }

  return {
    errors: ['source: This Pool task type cannot move to Today yet.'],
    ok: false,
  };
}

function taskFromPoolItem(item: TaskPoolItem, timestamp: string): BringTaskPoolItemToTodayResult {
  const source = activeTaskSourceFromPoolItem(item);

  if (!source.ok) {
    return source;
  }

  const parsed = activeTaskSchema.safeParse({
    area: item.area,
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    expiresAfter: item.expiresAfter,
    fixedAt: item.fixedAt,
    full: item.full,
    id: item.id,
    kind: item.source === 'rhythm' ? 'repeating' : 'adhoc',
    latestUsefulStartAt: item.latestUsefulStartAt,
    minimum: item.minimum,
    minimumStillUsefulAfterDeadline: item.minimumStillUsefulAfterDeadline,
    missedPolicy: item.missedPolicy,
    normal: item.normal,
    notUsefulAfter: item.notUsefulAfter,
    purpose: item.purpose,
    showToday: true,
    source: source.source,
    status: 'active',
    templateId: source.templateId,
    timeConstraint: item.timeConstraint,
    title: item.title,
    updatedAt: timestamp,
  });

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
    };
  }

  return {
    alreadyInToday: false,
    item,
    ok: true,
    task: parsed.data,
  };
}

export async function bringTaskPoolItemToToday(
  itemId: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<BringTaskPoolItemToTodayResult> {
  return database.transaction('rw', database.taskPoolItems, database.activeTasks, async () => {
    const storedPoolItem = await database.taskPoolItems.get(itemId);

    if (!storedPoolItem) {
      return {
        errors: ['id: Task Pool item was not found.'],
        ok: false,
      };
    }

    const parsedPoolItem = taskPoolItemSchema.safeParse(storedPoolItem);

    if (!parsedPoolItem.success) {
      return {
        errors: issuesToMessages(parsedPoolItem.error.issues),
        ok: false,
      };
    }

    if (parsedPoolItem.data.status === 'noLongerNeeded') {
      return {
        errors: ['status: This task is no longer active in the Pool.'],
        ok: false,
      };
    }

    const timestamp = new Date().toISOString();
    const storedActiveTask = await database.activeTasks.get(itemId);
    let activeTask: ActiveTask;
    let alreadyInToday = false;

    if (storedActiveTask) {
      const parsedActiveTask = activeTaskSchema.safeParse(storedActiveTask);

      if (!parsedActiveTask.success) {
        return {
          errors: issuesToMessages(parsedActiveTask.error.issues),
          ok: false,
        };
      }

      if (parsedActiveTask.data.source === 'custom') {
        return {
          errors: ['source: This saved task type cannot move to Today yet.'],
          ok: false,
        };
      }

      if (parsedActiveTask.data.status === 'done') {
        return {
          errors: ['status: This task is already complete.'],
          ok: false,
        };
      }

      alreadyInToday = parsedActiveTask.data.showToday && isVisibleTodayStatus(parsedActiveTask.data.status);
      activeTask = alreadyInToday
        ? parsedActiveTask.data
        : activeTaskSchema.parse({
            ...parsedActiveTask.data,
            showToday: true,
            status: 'active',
            updatedAt: timestamp,
          });
    } else {
      const converted = taskFromPoolItem(parsedPoolItem.data, timestamp);

      if (!converted.ok) {
        return converted;
      }

      activeTask = converted.task;
    }

    const updatedPoolItem = taskPoolItemSchema.parse({
      ...withoutBringBackAfter(parsedPoolItem.data),
      status: 'today',
      updatedAt: timestamp,
    });

    if (!alreadyInToday) {
      await database.activeTasks.put(activeTask);
    }
    await database.taskPoolItems.put(updatedPoolItem);

    return {
      alreadyInToday,
      item: updatedPoolItem,
      ok: true,
      task: activeTask,
    };
  });
}

export async function updateTaskLifecycleStatus(
  taskId: string,
  status: ActiveTaskStatus,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<UpdateTaskLifecycleStatusResult> {
  const parsedStatus = activeTaskStatusSchema.safeParse(status);

  if (!parsedStatus.success) {
    return {
      errors: issuesToMessages(parsedStatus.error.issues),
      ok: false,
    };
  }

  return database.transaction(
    'rw',
    database.activeTasks,
    database.taskPoolItems,
    database.softPlacements,
    async () => {
      const storedTask = await database.activeTasks.get(taskId);

      if (!storedTask) {
        return {
          errors: ['id: Active Today task was not found.'],
          ok: false,
        };
      }

      const parsedTask = activeTaskSchema.safeParse(storedTask);

      if (!parsedTask.success) {
        return {
          errors: issuesToMessages(parsedTask.error.issues),
          ok: false,
        };
      }

      if (parsedTask.data.source === 'custom') {
        return {
          errors: ['source: Custom active tasks are not approved for persistence yet.'],
          ok: false,
        };
      }

      const timestamp = new Date().toISOString();
      const visibleToday = isVisibleTodayStatus(parsedStatus.data);
      const updatedTask = activeTaskSchema.parse({
        ...parsedTask.data,
        showToday: visibleToday,
        status: parsedStatus.data,
        updatedAt: timestamp,
      });
      const storedPoolItem = await database.taskPoolItems.get(taskId);
      let updatedPoolItem: TaskPoolItem | null = null;

      if (storedPoolItem) {
        const parsedPoolItem = taskPoolItemSchema.safeParse(storedPoolItem);

        if (!parsedPoolItem.success) {
          return {
            errors: issuesToMessages(parsedPoolItem.error.issues),
            ok: false,
          };
        }

        updatedPoolItem = taskPoolItemSchema.parse({
          ...withoutBringBackAfter(parsedPoolItem.data),
          status: poolStatusForActiveTask(parsedStatus.data),
          updatedAt: timestamp,
        });
      }

      const placements = await transitionLinkedPlacements(
        taskId,
        parsedStatus.data,
        timestamp,
        database,
      );

      await database.activeTasks.put(updatedTask);
      if (updatedPoolItem) {
        await database.taskPoolItems.put(updatedPoolItem);
      }

      return {
        item: updatedPoolItem,
        ok: true,
        placements,
        task: updatedTask,
        visibleToday,
      };
    },
  );
}

export async function markTaskLifecycleNoLongerNeeded(
  itemId: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<MarkTaskNoLongerNeededResult> {
  return database.transaction(
    'rw',
    database.taskPoolItems,
    database.activeTasks,
    database.softPlacements,
    async () => {
      const storedItem = await database.taskPoolItems.get(itemId);

      if (!storedItem) {
        return {
          errors: ['id: Task Pool item was not found.'],
          ok: false,
        };
      }

      const parsedItem = taskPoolItemSchema.safeParse(storedItem);

      if (!parsedItem.success) {
        return {
          errors: issuesToMessages(parsedItem.error.issues),
          ok: false,
        };
      }

      const timestamp = new Date().toISOString();
      const updatedItem = taskPoolItemSchema.parse({
        ...withoutBringBackAfter(parsedItem.data),
        status: 'noLongerNeeded',
        updatedAt: timestamp,
      });
      const storedTask = await database.activeTasks.get(itemId);
      let updatedTask: ActiveTask | null = null;

      if (storedTask) {
        const parsedTask = activeTaskSchema.safeParse(storedTask);

        if (!parsedTask.success) {
          return {
            errors: issuesToMessages(parsedTask.error.issues),
            ok: false,
          };
        }

        if (parsedTask.data.source === 'custom') {
          return {
            errors: ['source: Custom active tasks are not approved for this lifecycle transition.'],
            ok: false,
          };
        }

        updatedTask = activeTaskSchema.parse({
          ...parsedTask.data,
          showToday: false,
          status: 'skipped',
          updatedAt: timestamp,
        });
      }

      const placements = await transitionLinkedPlacements(itemId, 'skipped', timestamp, database);

      await database.taskPoolItems.put(updatedItem);
      if (updatedTask) {
        await database.activeTasks.put(updatedTask);
      }

      return {
        item: updatedItem,
        ok: true,
        placements,
        task: updatedTask,
      };
    },
  );
}
