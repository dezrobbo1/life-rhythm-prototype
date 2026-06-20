import type { Table } from 'dexie';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  taskPoolItemSchema,
  taskPoolItemStatusSchema,
  type TaskPoolItem,
  type TaskPoolItemStatus,
} from './schemas';

type TaskPoolItemsTable = Pick<Table<TaskPoolItem, string>, 'get' | 'put' | 'toArray' | 'where'>;

export type TaskPoolStore = {
  taskPoolItems: TaskPoolItemsTable;
};

export type TaskPoolWriteResult =
  | {
      item: TaskPoolItem;
      ok: true;
    }
  | {
      errors: string[];
      ok: false;
    };

export type TaskPoolStatusUpdateResult = TaskPoolWriteResult;

function nowIso() {
  return new Date().toISOString();
}

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'taskPoolItem';

    return `${path}: ${issue.message}`;
  });
}

function parseStoredTaskPoolItem(input: unknown): TaskPoolItem | null {
  const parsed = taskPoolItemSchema.safeParse(input);

  return parsed.success ? parsed.data : null;
}

export function createTaskPoolItemId(prefix = 'task-pool-item') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

export function validateTaskPoolItemWrite(input: unknown): TaskPoolWriteResult {
  const parsed = taskPoolItemSchema.safeParse(input);

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
    };
  }

  return {
    item: parsed.data,
    ok: true,
  };
}

export async function saveTaskPoolItem(
  input: unknown,
  store: TaskPoolStore = getCurrentLifeRhythmDatabase(),
): Promise<TaskPoolWriteResult> {
  const validated = validateTaskPoolItemWrite(input);

  if (!validated.ok) {
    return validated;
  }

  const existing = await store.taskPoolItems.get(validated.item.id);

  if (existing) {
    return {
      errors: ['id: A task pool item with this ID already exists.'],
      ok: false,
    };
  }

  await store.taskPoolItems.put(validated.item);

  return validated;
}

export async function loadTaskPoolItems(
  store: TaskPoolStore = getCurrentLifeRhythmDatabase(),
): Promise<TaskPoolItem[]> {
  try {
    const stored = await store.taskPoolItems.toArray();

    return stored.flatMap((item) => {
      const parsed = parseStoredTaskPoolItem(item);

      return parsed ? [parsed] : [];
    });
  } catch {
    return [];
  }
}

export async function loadTaskPoolItemsByStatus(
  status: TaskPoolItemStatus,
  store: TaskPoolStore = getCurrentLifeRhythmDatabase(),
): Promise<TaskPoolItem[]> {
  const parsedStatus = taskPoolItemStatusSchema.safeParse(status);

  if (!parsedStatus.success) {
    return [];
  }

  try {
    const stored = await store.taskPoolItems.where('status').equals(parsedStatus.data).toArray();

    return stored.flatMap((item) => {
      const parsed = parseStoredTaskPoolItem(item);

      return parsed ? [parsed] : [];
    });
  } catch {
    return [];
  }
}

export async function getTaskPoolItem(
  id: string,
  store: TaskPoolStore = getCurrentLifeRhythmDatabase(),
): Promise<TaskPoolItem | null> {
  try {
    const stored = await store.taskPoolItems.get(id);

    return stored ? parseStoredTaskPoolItem(stored) : null;
  } catch {
    return null;
  }
}

export async function updateTaskPoolItemStatus(
  id: string,
  status: TaskPoolItemStatus,
  store: TaskPoolStore = getCurrentLifeRhythmDatabase(),
): Promise<TaskPoolStatusUpdateResult> {
  const parsedStatus = taskPoolItemStatusSchema.safeParse(status);

  if (!parsedStatus.success) {
    return {
      errors: issuesToMessages(parsedStatus.error.issues),
      ok: false,
    };
  }

  const stored = await store.taskPoolItems.get(id);

  if (!stored) {
    return {
      errors: ['id: Task pool item was not found.'],
      ok: false,
    };
  }

  const parsedItem = taskPoolItemSchema.safeParse(stored);

  if (!parsedItem.success) {
    return {
      errors: issuesToMessages(parsedItem.error.issues),
      ok: false,
    };
  }

  const updatedItem = taskPoolItemSchema.parse({
    ...parsedItem.data,
    status: parsedStatus.data,
    updatedAt: nowIso(),
  });

  await store.taskPoolItems.put(updatedItem);

  return {
    item: updatedItem,
    ok: true,
  };
}

export function markTaskPoolItemNoLongerNeeded(
  id: string,
  store: TaskPoolStore = getCurrentLifeRhythmDatabase(),
) {
  return updateTaskPoolItemStatus(id, 'noLongerNeeded', store);
}
