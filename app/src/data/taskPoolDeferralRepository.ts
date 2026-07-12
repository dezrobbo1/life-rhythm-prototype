import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import { taskPoolItemSchema, type TaskPoolItem } from './schemas';
import type { LifeRhythmDatabase } from './db';

export type TaskPoolDeferralResult =
  | {
      item: TaskPoolItem;
      ok: true;
    }
  | {
      errors: string[];
      ok: false;
    };

const deferrableStatuses = new Set<TaskPoolItem['status']>([
  'captured',
  'suggested',
  'parked',
  'notToday',
  'deferred',
]);

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'taskPoolDeferral';
    return `${path}: ${issue.message}`;
  });
}

export async function deferTaskPoolItem(
  itemId: string,
  bringBackAfter: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  now: Date = new Date(),
): Promise<TaskPoolDeferralResult> {
  const bringBackDate = new Date(bringBackAfter);

  if (Number.isNaN(bringBackDate.getTime())) {
    return {
      errors: ['bringBackAfter: Choose a valid date and time.'],
      ok: false,
    };
  }

  if (bringBackDate.getTime() <= now.getTime()) {
    return {
      errors: ['bringBackAfter: Choose a time later than now.'],
      ok: false,
    };
  }

  return database.transaction('rw', database.taskPoolItems, async () => {
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

    if (!deferrableStatuses.has(parsedItem.data.status)) {
      return {
        errors: ['status: This task cannot be held for later from its current state.'],
        ok: false,
      };
    }

    const updatedItem = taskPoolItemSchema.parse({
      ...parsedItem.data,
      bringBackAfter: bringBackDate.toISOString(),
      status: 'deferred',
      updatedAt: now.toISOString(),
    });

    await database.taskPoolItems.put(updatedItem);

    return {
      item: updatedItem,
      ok: true,
    };
  });
}
