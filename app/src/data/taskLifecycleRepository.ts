import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  activeTaskSchema,
  taskPoolItemSchema,
  type ActiveTask,
  type TaskPoolItem,
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

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'taskLifecycle';

    return `${path}: ${issue.message}`;
  });
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

      alreadyInToday = parsedActiveTask.data.showToday && [
        'active',
        'inProgress',
        'paused',
        'minimumDone',
      ].includes(parsedActiveTask.data.status);

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

    const poolItemWithoutDeferral = { ...parsedPoolItem.data };
    delete poolItemWithoutDeferral.bringBackAfter;

    const updatedPoolItem = taskPoolItemSchema.parse({
      ...poolItemWithoutDeferral,
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
