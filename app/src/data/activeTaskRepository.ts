import type { Table } from 'dexie';
import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  activeTaskSchema,
  activeTaskStatusSchema,
  taskPoolItemSchema,
  type ActiveTask,
  type ActiveTaskStatus,
  type TaskPoolItem,
  type TaskPoolItemStatus,
} from './schemas';
import { updateTaskLifecycleStatus } from './taskLifecycleRepository';

type ActiveTasksTable = Pick<Table<ActiveTask, string>, 'get' | 'put' | 'toArray'>;
type TaskPoolItemsTable = Pick<Table<TaskPoolItem, string>, 'get' | 'put'>;

export type ActiveTaskStore = {
  activeTasks: ActiveTasksTable;
  taskPoolItems?: TaskPoolItemsTable;
};

export type ActiveTaskWriteResult =
  | {
      alreadyExists: boolean;
      ok: true;
      task: ActiveTask;
    }
  | {
      errors: string[];
      ok: false;
    };

export type ActiveTaskStatusUpdateResult =
  | {
      ok: true;
      task: ActiveTask;
      visibleToday: boolean;
    }
  | {
      errors: string[];
      ok: false;
    };

const visibleTodayStatuses: readonly ActiveTaskStatus[] = ['active', 'inProgress', 'paused', 'minimumDone'];

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'activeTask';

    return `${path}: ${issue.message}`;
  });
}

function validateCurrentWrite(input: unknown): ActiveTaskWriteResult {
  const parsed = activeTaskSchema.safeParse(input);

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
    };
  }

  if (parsed.data.source === 'custom') {
    return {
      errors: ['source: Custom active tasks are not approved for persistence yet.'],
      ok: false,
    };
  }

  if (!parsed.data.showToday) {
    return {
      errors: ['showToday: Active task writes are limited to Today tasks.'],
      ok: false,
    };
  }

  if (parsed.data.status !== 'active') {
    return {
      errors: ['status: Only active Today tasks are approved for this first write.'],
      ok: false,
    };
  }

  return {
    alreadyExists: false,
    ok: true,
    task: parsed.data,
  };
}

function isApprovedLoadedTask(task: ActiveTask) {
  return (
    task.showToday &&
    isVisibleTodayStatus(task.status) &&
    (task.source === 'adhoc' || task.source === 'library')
  );
}

function isApprovedPersistedTask(task: ActiveTask) {
  return task.source === 'adhoc' || task.source === 'library';
}

function isVisibleTodayStatus(status: ActiveTaskStatus) {
  return visibleTodayStatuses.includes(status);
}

function taskPoolStatusForActiveTask(status: ActiveTaskStatus): TaskPoolItemStatus {
  if (isVisibleTodayStatus(status)) {
    return 'today';
  }

  if (status === 'parked') {
    return 'parked';
  }

  if (status === 'notToday' || status === 'skipped') {
    return 'notToday';
  }

  return 'noLongerNeeded';
}

function isLifeRhythmDatabase(store: ActiveTaskStore): store is LifeRhythmDatabase {
  return (
    'transaction' in store &&
    'softPlacements' in store &&
    'taskPoolItems' in store
  );
}

async function syncLinkedTaskPoolItem(
  taskId: string,
  status: ActiveTaskStatus,
  timestamp: string,
  store: ActiveTaskStore,
) {
  if (!store.taskPoolItems) {
    return;
  }

  const storedPoolItem = await store.taskPoolItems.get(taskId);

  if (!storedPoolItem) {
    return;
  }

  const parsedPoolItem = taskPoolItemSchema.safeParse(storedPoolItem);

  if (!parsedPoolItem.success) {
    return;
  }

  const updatedPoolItem = taskPoolItemSchema.parse({
    ...parsedPoolItem.data,
    status: taskPoolStatusForActiveTask(status),
    updatedAt: timestamp,
  });

  await store.taskPoolItems.put(updatedPoolItem);
}

function parseStoredActiveTask(input: unknown): ActiveTask | null {
  const parsed = activeTaskSchema.safeParse(input);

  if (!parsed.success || !isApprovedLoadedTask(parsed.data)) {
    return null;
  }

  return parsed.data;
}

function parseStoredPersistedTask(input: unknown): ActiveTask | null {
  const parsed = activeTaskSchema.safeParse(input);

  if (!parsed.success || !isApprovedPersistedTask(parsed.data)) {
    return null;
  }

  return parsed.data;
}

function findExistingLibraryTask(tasks: ActiveTask[], candidate: ActiveTask) {
  if (candidate.source !== 'library' || !candidate.templateId) {
    return undefined;
  }

  return tasks.find(
    (task) =>
      task.source === 'library' &&
      task.templateId === candidate.templateId &&
      task.showToday &&
      isVisibleTodayStatus(task.status),
  );
}

export function createActiveTaskId(prefix = 'active-task') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

export async function loadActiveTodayTasks(
  store: ActiveTaskStore = getCurrentLifeRhythmDatabase(),
): Promise<ActiveTask[]> {
  try {
    const stored = await store.activeTasks.toArray();

    return stored.flatMap((task) => {
      const parsed = parseStoredActiveTask(task);

      return parsed ? [parsed] : [];
    });
  } catch {
    return [];
  }
}

export async function loadPersistedActiveTasks(
  store: ActiveTaskStore = getCurrentLifeRhythmDatabase(),
): Promise<ActiveTask[]> {
  try {
    const stored = await store.activeTasks.toArray();

    return stored.flatMap((task) => {
      const parsed = parseStoredPersistedTask(task);

      return parsed ? [parsed] : [];
    });
  } catch {
    return [];
  }
}

export async function saveActiveTodayTask(
  input: unknown,
  store: ActiveTaskStore = getCurrentLifeRhythmDatabase(),
): Promise<ActiveTaskWriteResult> {
  const validated = validateCurrentWrite(input);

  if (!validated.ok) {
    return validated;
  }

  const existingTasks = await loadActiveTodayTasks(store);
  const existingLibraryTask = findExistingLibraryTask(existingTasks, validated.task);

  if (existingLibraryTask) {
    return {
      alreadyExists: true,
      ok: true,
      task: existingLibraryTask,
    };
  }

  const existingById = await store.activeTasks.get(validated.task.id);

  if (existingById) {
    return {
      errors: ['id: An active Today task with this ID already exists.'],
      ok: false,
    };
  }

  await store.activeTasks.put(validated.task);

  return validated;
}

export async function updateActiveTaskStatus(
  taskId: string,
  status: ActiveTaskStatus,
  store: ActiveTaskStore = getCurrentLifeRhythmDatabase(),
): Promise<ActiveTaskStatusUpdateResult> {
  if (isLifeRhythmDatabase(store)) {
    const result = await updateTaskLifecycleStatus(taskId, status, store);

    if (!result.ok) return result;

    return {
      ok: true,
      task: result.task,
      visibleToday: result.visibleToday,
    };
  }

  const statusResult = activeTaskStatusSchema.safeParse(status);

  if (!statusResult.success) {
    return {
      errors: issuesToMessages(statusResult.error.issues),
      ok: false,
    };
  }

  const storedTask = await store.activeTasks.get(taskId);

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

  const visibleToday = isVisibleTodayStatus(statusResult.data);
  const timestamp = new Date().toISOString();
  const updatedTask = activeTaskSchema.parse({
    ...parsedTask.data,
    showToday: visibleToday,
    status: statusResult.data,
    updatedAt: timestamp,
  });

  await store.activeTasks.put(updatedTask);
  await syncLinkedTaskPoolItem(taskId, statusResult.data, timestamp, store);

  return {
    ok: true,
    task: updatedTask,
    visibleToday,
  };
}
