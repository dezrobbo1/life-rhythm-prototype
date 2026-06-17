import type { Table } from 'dexie';
import { createLifeRhythmDatabase } from './db';
import {
  activeTaskSchema,
  activeTaskStatusSchema,
  type ActiveTask,
  type ActiveTaskStatus,
} from './schemas';

type ActiveTasksTable = Pick<Table<ActiveTask, string>, 'get' | 'put' | 'toArray'>;

export type ActiveTaskStore = {
  activeTasks: ActiveTasksTable;
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

const defaultDatabase = createLifeRhythmDatabase();
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
  store: ActiveTaskStore = defaultDatabase,
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
  store: ActiveTaskStore = defaultDatabase,
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
  store: ActiveTaskStore = defaultDatabase,
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
  store: ActiveTaskStore = defaultDatabase,
): Promise<ActiveTaskStatusUpdateResult> {
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
  const updatedTask = activeTaskSchema.parse({
    ...parsedTask.data,
    showToday: visibleToday,
    status: statusResult.data,
    updatedAt: new Date().toISOString(),
  });

  await store.activeTasks.put(updatedTask);

  return {
    ok: true,
    task: updatedTask,
    visibleToday,
  };
}
