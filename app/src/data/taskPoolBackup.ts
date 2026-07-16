import { z } from 'zod';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  taskPoolItemSchema,
  type TaskPoolItem,
} from './schemas';
import {
  loadTaskPoolItems,
  type TaskPoolStore,
} from './taskPoolRepository';

export const TASK_POOL_BACKUP_APP_VERSION = '1.4.6';
export const TASK_POOL_BACKUP_FORMAT = 'life-rhythm-task-pool-backup';

const appVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, 'Expected a valid app version');
const isoDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function isValidIsoDateTime(value: string): boolean {
  const match = isoDateTimePattern.exec(value);

  if (!match) {
    return false;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, millisecondValue = '0'] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const millisecond = Number(millisecondValue.padEnd(3, '0'));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second &&
    date.getUTCMilliseconds() === millisecond
  );
}

const isoDateTime = z
  .string()
  .regex(isoDateTimePattern, 'Expected a valid ISO timestamp')
  .refine(isValidIsoDateTime, 'Expected a valid ISO timestamp');

const blockedDataKeys = new Set([
  'activeTasks',
  'ai',
  'aiSuggestions',
  'analytics',
  'backend',
  'calendar',
  'calendarData',
  'calendarEventId',
  'completionLog',
  'completionLogs',
  'devTickets',
  'futureModules',
  'imports',
  'legacy',
  'legacyData',
  'legacyLocalStorage',
  'libraryEnablement',
  'lifeRhythmPrototype13',
  'lifeRhythm_v140',
  'lifeRhythm_v143',
  'lifeRhythm_v146',
  'migrationLog',
  'migrations',
  'notifications',
  'oneOff',
  'oneOffs',
  'placements',
  'quickPacks',
  'resetLog',
  'resetLogs',
  'restores',
  'rhythmTemplates',
  'rhythms',
  'rootAppData',
  'rootData',
  'rootLocalStorage',
  'scheduler',
  'schedulerOutput',
  'score',
  'settings',
  'softPlacements',
  'startBoostLog',
  'startBoostLogs',
  'streak',
  'sync',
  'taskHistory',
  'tasks',
  'upload',
]);

export const taskPoolBackupItemSchema = taskPoolItemSchema;

export const taskPoolBackupSchema = z
  .object({
    appVersion,
    exportedAt: isoDateTime,
    format: z.literal(TASK_POOL_BACKUP_FORMAT),
    items: z.array(taskPoolBackupItemSchema),
  })
  .strict()
  .superRefine((backup, context) => {
    const seenIds = new Set<string>();

    backup.items.forEach((item, index) => {
      if (seenIds.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate Pool item IDs are not allowed in a Task Pool backup.',
          path: ['items', index, 'id'],
        });
      }

      seenIds.add(item.id);
    });
  });

export type TaskPoolBackupItem = z.infer<typeof taskPoolBackupItemSchema>;
export type TaskPoolBackup = z.infer<typeof taskPoolBackupSchema>;

export type TaskPoolBackupPreview = {
  appVersion: string;
  deferredCount: number;
  exportedAt: string;
  includesDeferralMetadata: boolean;
  itemCount: number;
  itemTitles: string[];
  statusSummary: string;
};

export type TaskPoolBackupValidationResult =
  | {
      ok: true;
      payload: TaskPoolBackup;
      preview: TaskPoolBackupPreview;
    }
  | {
      errors: string[];
      ok: false;
    };

export type TaskPoolBackupExport = {
  fileName: string;
  json: string;
  itemCount: number;
  payload: TaskPoolBackup;
};

function nowIso() {
  return new Date().toISOString();
}

function fileDate(timestamp: string) {
  return timestamp.slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findBlockedDataKey(value: unknown, path: Array<string | number> = []): string | undefined {
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      const nestedPath = findBlockedDataKey(child, [...path, index]);

      if (nestedPath) {
        return nestedPath;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];

    if (blockedDataKeys.has(key)) {
      return nextPath.join('.');
    }

    const nestedPath = findBlockedDataKey(child, nextPath);

    if (nestedPath) {
      return nestedPath;
    }
  }

  return undefined;
}

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'backup';

    return `${path}: ${issue.message}`;
  });
}

function toBackupItem(itemInput: unknown): TaskPoolBackupItem {
  return taskPoolBackupItemSchema.parse(itemInput);
}

function buildPreview(payload: TaskPoolBackup): TaskPoolBackupPreview {
  const statusCounts = payload.items.reduce<Record<TaskPoolItem['status'], number>>(
    (counts, item) => ({
      ...counts,
      [item.status]: counts[item.status] + 1,
    }),
    {
      captured: 0,
      deferred: 0,
      noLongerNeeded: 0,
      notToday: 0,
      parked: 0,
      softPlaced: 0,
      suggested: 0,
      today: 0,
    },
  );
  const statusSummary = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');

  return {
    appVersion: payload.appVersion,
    deferredCount: payload.items.filter((item) => item.status === 'deferred').length,
    exportedAt: payload.exportedAt,
    includesDeferralMetadata: payload.items.some((item) => Boolean(item.bringBackAfter)),
    itemCount: payload.items.length,
    itemTitles: payload.items.map((item) => item.title),
    statusSummary: statusSummary || 'No saved Pool items',
  };
}

export function buildTaskPoolBackupPayload(
  items: unknown[],
  exportedAt = nowIso(),
  appVersionValue = TASK_POOL_BACKUP_APP_VERSION,
): TaskPoolBackup {
  return taskPoolBackupSchema.parse({
    appVersion: appVersionValue,
    exportedAt,
    format: TASK_POOL_BACKUP_FORMAT,
    items: items.map(toBackupItem),
  });
}

export function serializeTaskPoolBackup(payload: TaskPoolBackup): string {
  return JSON.stringify(taskPoolBackupSchema.parse(payload), null, 2);
}

export function validateTaskPoolBackup(input: unknown): TaskPoolBackupValidationResult {
  if (!isRecord(input)) {
    return {
      errors: ['backup: Expected a Task Pool backup object.'],
      ok: false,
    };
  }

  const blockedDataKey = findBlockedDataKey(input);

  if (blockedDataKey) {
    return {
      errors: [`${blockedDataKey}: Task Pool backup cannot include settings, Today tasks, Library rhythms, placements, scheduler, calendar, AI, backend, sync, legacy, migration, log, score, streak, or compliance data.`],
      ok: false,
    };
  }

  const parsed = taskPoolBackupSchema.safeParse(input);

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
    };
  }

  return {
    ok: true,
    payload: parsed.data,
    preview: buildPreview(parsed.data),
  };
}

export function parseTaskPoolBackupJson(json: string): TaskPoolBackupValidationResult {
  try {
    return validateTaskPoolBackup(JSON.parse(json) as unknown);
  } catch {
    return {
      errors: ['backup: Task Pool backup JSON is malformed.'],
      ok: false,
    };
  }
}

export async function exportTaskPoolBackup(
  store: TaskPoolStore = getCurrentLifeRhythmDatabase(),
  exportedAt = nowIso(),
): Promise<TaskPoolBackupExport | null> {
  const items = await loadTaskPoolItems(store);

  if (items.length === 0) {
    return null;
  }

  const payload = buildTaskPoolBackupPayload(items, exportedAt);

  return {
    fileName: `life-rhythm-task-pool-backup-${fileDate(exportedAt)}.json`,
    json: serializeTaskPoolBackup(payload),
    itemCount: payload.items.length,
    payload,
  };
}
