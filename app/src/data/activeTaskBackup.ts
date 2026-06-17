import { z } from 'zod';
import {
  activeTaskDeadlineIsoDateTimeSchema,
  activeTaskSchema,
  activeTaskStatusSchema,
  areaSchema,
  bufferModeSchema,
  dayOfWeekSchema,
  idSchema,
  lateHandlingSchema,
  recurrencePeriodSchema,
  taskTypeSchema,
  taskVersionSchema,
  missedPolicySchema,
  timeConstraintSchema,
  timeWindowSchema,
} from './schemas';

export const ACTIVE_TASK_BACKUP_APP_VERSION = '1.4.6';
export const ACTIVE_TASK_BACKUP_FORMAT = 'life-rhythm-active-task-backup';

const appVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, 'Expected a valid app version');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

const blockedDataKeys = new Set([
  'calendar',
  'calendarData',
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
  'oneOff',
  'oneOffs',
  'quickPacks',
  'resetLog',
  'resetLogs',
  'restores',
  'rhythmTemplates',
  'rhythms',
  'rootAppData',
  'rootData',
  'rootLocalStorage',
  'schedulerOutput',
  'settings',
  'startBoostLog',
  'startBoostLogs',
  'taskHistory',
  'tasks',
]);

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

const activeTaskScheduleBackupSchema = z
  .object({
    bestTime: timeWindowSchema,
    bufferMode: bufferModeSchema,
    catchupAllowed: z.boolean(),
    cleanupMinutes: z.number().int().min(0),
    droppable: z.boolean(),
    fixedTime: timeOfDay.optional(),
    frequency: z.number().int().min(0),
    lateHandling: lateHandlingSchema,
    maxPerDay: z.number().int().positive(),
    movable: z.boolean(),
    period: recurrencePeriodSchema,
    preferredDays: z.array(dayOfWeekSchema),
    prepMinutes: z.number().int().min(0),
    targetDate: isoDate.optional(),
    transitionMinutes: z.number().int().min(0),
    travelMinutes: z.number().int().min(0),
  })
  .strict();

function validateBackupDeadlineFields(
  task: {
    dueAt?: string;
    expiresAfter?: string;
    fixedAt?: string;
    latestUsefulStartAt?: string;
    notUsefulAfter?: string;
    timeConstraint?: z.infer<typeof timeConstraintSchema>;
  },
  context: z.RefinementCtx,
) {
  const timeConstraint = task.timeConstraint ?? 'flexible';

  if (task.dueAt && timeConstraint !== 'dueBy') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'dueAt is only valid for dueBy tasks.',
      path: ['dueAt'],
    });
  }

  if (task.fixedAt && timeConstraint !== 'fixedAt') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'fixedAt is only valid for fixedAt tasks.',
      path: ['fixedAt'],
    });
  }

  if (task.expiresAfter && timeConstraint !== 'expiresAfter') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'expiresAfter is only valid for expiresAfter tasks.',
      path: ['expiresAfter'],
    });
  }

  if (
    task.latestUsefulStartAt &&
    task.notUsefulAfter &&
    Date.parse(task.latestUsefulStartAt) > Date.parse(task.notUsefulAfter)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'latestUsefulStartAt must not be after notUsefulAfter.',
      path: ['latestUsefulStartAt'],
    });
  }
}

export const activeTaskBackupItemSchema = z
  .object({
    area: areaSchema,
    createdAt: isoDateTime,
    fallback: z.string().max(240).optional(),
    full: taskVersionSchema,
    id: idSchema,
    minimum: taskVersionSchema,
    normal: taskVersionSchema,
    purpose: z.string().max(240).optional(),
    schedule: activeTaskScheduleBackupSchema,
    showToday: z.boolean(),
    source: z.enum(['adhoc', 'library', 'custom']),
    status: activeTaskStatusSchema,
    taskType: taskTypeSchema,
    templateId: idSchema.optional(),
    timeConstraint: timeConstraintSchema.optional(),
    dueAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    fixedAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    expiresAfter: activeTaskDeadlineIsoDateTimeSchema.optional(),
    latestUsefulStartAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    notUsefulAfter: activeTaskDeadlineIsoDateTimeSchema.optional(),
    minimumStillUsefulAfterDeadline: z.boolean().optional(),
    missedPolicy: missedPolicySchema.optional(),
    title: z.string().min(1),
    updatedAt: isoDateTime,
  })
  .strict()
  .superRefine((task, context) => {
    if (task.source === 'library' && !task.templateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Library active tasks must reference a templateId.',
        path: ['templateId'],
      });
    }

    validateBackupDeadlineFields(task, context);
  });

export const activeTaskBackupSchema = z
  .object({
    activeTasks: z.array(activeTaskBackupItemSchema),
    appVersion,
    exportedAt: isoDateTime,
    format: z.literal(ACTIVE_TASK_BACKUP_FORMAT),
  })
  .strict()
  .superRefine((backup, context) => {
    const seenIds = new Set<string>();

    backup.activeTasks.forEach((task, index) => {
      if (seenIds.has(task.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate active task IDs are not allowed in an active task backup.',
          path: ['activeTasks', index, 'id'],
        });
      }

      seenIds.add(task.id);
    });
  });

export type ActiveTaskBackupItem = z.infer<typeof activeTaskBackupItemSchema>;
export type ActiveTaskBackup = z.infer<typeof activeTaskBackupSchema>;

export type ActiveTaskBackupPreview = {
  activeTaskCount: number;
  appVersion: string;
  exportedAt: string;
  taskTitles: string[];
};

export type ActiveTaskBackupValidationResult =
  | {
      ok: true;
      payload: ActiveTaskBackup;
      preview: ActiveTaskBackupPreview;
    }
  | {
      errors: string[];
      ok: false;
    };

function nowIso() {
  return new Date().toISOString();
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

function toBackupItem(activeTaskInput: unknown): ActiveTaskBackupItem {
  const task = activeTaskSchema.parse(activeTaskInput);
  const backupItem = {
    area: task.area,
    createdAt: task.createdAt,
    full: task.full,
    id: task.id,
    minimum: task.minimum,
    normal: task.normal,
    schedule: task.schedule,
    showToday: task.showToday,
    source: task.source,
    status: task.status,
    taskType: task.taskType,
    title: task.title,
    updatedAt: task.updatedAt,
    ...(task.fallback ? { fallback: task.fallback } : {}),
    ...(task.purpose ? { purpose: task.purpose } : {}),
    ...(task.templateId ? { templateId: task.templateId } : {}),
    ...(task.timeConstraint ? { timeConstraint: task.timeConstraint } : {}),
    ...(task.dueAt ? { dueAt: task.dueAt } : {}),
    ...(task.fixedAt ? { fixedAt: task.fixedAt } : {}),
    ...(task.expiresAfter ? { expiresAfter: task.expiresAfter } : {}),
    ...(task.latestUsefulStartAt ? { latestUsefulStartAt: task.latestUsefulStartAt } : {}),
    ...(task.notUsefulAfter ? { notUsefulAfter: task.notUsefulAfter } : {}),
    ...(task.minimumStillUsefulAfterDeadline !== undefined
      ? { minimumStillUsefulAfterDeadline: task.minimumStillUsefulAfterDeadline }
      : {}),
    ...(task.missedPolicy ? { missedPolicy: task.missedPolicy } : {}),
  };

  return activeTaskBackupItemSchema.parse(backupItem);
}

function buildPreview(payload: ActiveTaskBackup): ActiveTaskBackupPreview {
  return {
    activeTaskCount: payload.activeTasks.length,
    appVersion: payload.appVersion,
    exportedAt: payload.exportedAt,
    taskTitles: payload.activeTasks.map((task) => task.title),
  };
}

export function buildActiveTaskBackupPayload(
  activeTasks: unknown[],
  exportedAt = nowIso(),
  appVersionValue = ACTIVE_TASK_BACKUP_APP_VERSION,
): ActiveTaskBackup {
  return activeTaskBackupSchema.parse({
    activeTasks: activeTasks.map(toBackupItem),
    appVersion: appVersionValue,
    exportedAt,
    format: ACTIVE_TASK_BACKUP_FORMAT,
  });
}

export function serializeActiveTaskBackup(payload: ActiveTaskBackup): string {
  return JSON.stringify(activeTaskBackupSchema.parse(payload), null, 2);
}

export function validateActiveTaskBackup(input: unknown): ActiveTaskBackupValidationResult {
  if (!isRecord(input)) {
    return {
      errors: ['backup: Expected an active task backup object.'],
      ok: false,
    };
  }

  const blockedDataKey = findBlockedDataKey(input);

  if (blockedDataKey) {
    return {
      errors: [`${blockedDataKey}: Active task backup cannot include settings, rhythm, legacy, scheduler, calendar, migration, reset, log, or module data.`],
      ok: false,
    };
  }

  const parsed = activeTaskBackupSchema.safeParse(input);

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

export function parseActiveTaskBackupJson(json: string): ActiveTaskBackupValidationResult {
  try {
    return validateActiveTaskBackup(JSON.parse(json) as unknown);
  } catch {
    return {
      errors: ['backup: Active task backup JSON is malformed.'],
      ok: false,
    };
  }
}
