import { z } from 'zod';
import {
  areaSchema,
  bufferModeSchema,
  completionStyleSchema,
  dayOfWeekSchema,
  energySchema,
  idSchema,
  lateHandlingSchema,
  recurrencePeriodSchema,
  rhythmTemplateSchema,
  startBarrierSchema,
  taskKindSchema,
  taskPrioritySchema,
  taskTypeSchema,
  taskVersionSchema,
  timeWindowSchema,
} from './schemas';

export const LIBRARY_RHYTHM_BACKUP_APP_VERSION = '1.4.6';
export const LIBRARY_RHYTHM_BACKUP_FORMAT = 'life-rhythm-library-rhythm-backup';

const appVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, 'Expected a valid app version');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

const blockedDataKeys = new Set([
  'activeTasks',
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
  'rhythmTemplates',
  'schedulerOutput',
  'settings',
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

const libraryRhythmScheduleBackupSchema = z
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

export const libraryRhythmBackupItemSchema = z
  .object({
    archivedAt: isoDateTime.optional(),
    area: areaSchema,
    completionStyle: completionStyleSchema,
    createdAt: isoDateTime,
    energy: energySchema,
    fallback: z.string().max(240).optional(),
    full: taskVersionSchema,
    id: idSchema,
    kind: taskKindSchema,
    minimum: taskVersionSchema,
    normal: taskVersionSchema,
    priority: taskPrioritySchema,
    purpose: z.string().max(240).optional(),
    schedule: libraryRhythmScheduleBackupSchema,
    source: z.literal('custom'),
    startBarrier: startBarrierSchema,
    taskType: taskTypeSchema,
    title: z.string().min(1),
    updatedAt: isoDateTime,
  })
  .strict();

export const libraryRhythmBackupSchema = z
  .object({
    appVersion,
    exportedAt: isoDateTime,
    format: z.literal(LIBRARY_RHYTHM_BACKUP_FORMAT),
    rhythms: z.array(libraryRhythmBackupItemSchema),
  })
  .strict()
  .superRefine((backup, context) => {
    const seenIds = new Set<string>();

    backup.rhythms.forEach((rhythm, index) => {
      if (seenIds.has(rhythm.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate rhythm IDs are not allowed in a Library rhythm backup.',
          path: ['rhythms', index, 'id'],
        });
      }

      seenIds.add(rhythm.id);
    });
  });

export type LibraryRhythmBackupItem = z.infer<typeof libraryRhythmBackupItemSchema>;
export type LibraryRhythmBackup = z.infer<typeof libraryRhythmBackupSchema>;

export type LibraryRhythmBackupPreview = {
  appVersion: string;
  exportedAt: string;
  rhythmCount: number;
  rhythmTitles: string[];
};

export type LibraryRhythmBackupValidationResult =
  | {
      ok: true;
      payload: LibraryRhythmBackup;
      preview: LibraryRhythmBackupPreview;
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

function toBackupItem(rhythmInput: unknown): LibraryRhythmBackupItem {
  const rhythm = rhythmTemplateSchema.parse(rhythmInput);
  const backupItem = {
    area: rhythm.area,
    completionStyle: rhythm.completionStyle,
    createdAt: rhythm.createdAt,
    energy: rhythm.energy,
    full: rhythm.full,
    id: rhythm.id,
    kind: rhythm.kind,
    minimum: rhythm.minimum,
    normal: rhythm.normal,
    priority: rhythm.priority,
    purpose: rhythm.purpose,
    schedule: rhythm.schedule,
    source: rhythm.source,
    startBarrier: rhythm.startBarrier,
    taskType: rhythm.taskType,
    title: rhythm.title,
    updatedAt: rhythm.updatedAt,
    ...(rhythm.archivedAt ? { archivedAt: rhythm.archivedAt } : {}),
    ...(rhythm.fallback ? { fallback: rhythm.fallback } : {}),
  };

  return libraryRhythmBackupItemSchema.parse(backupItem);
}

function buildPreview(payload: LibraryRhythmBackup): LibraryRhythmBackupPreview {
  return {
    appVersion: payload.appVersion,
    exportedAt: payload.exportedAt,
    rhythmCount: payload.rhythms.length,
    rhythmTitles: payload.rhythms.map((rhythm) => rhythm.title),
  };
}

export function buildLibraryRhythmBackupPayload(
  rhythmTemplates: unknown[],
  exportedAt = nowIso(),
  appVersionValue = LIBRARY_RHYTHM_BACKUP_APP_VERSION,
): LibraryRhythmBackup {
  return libraryRhythmBackupSchema.parse({
    appVersion: appVersionValue,
    exportedAt,
    format: LIBRARY_RHYTHM_BACKUP_FORMAT,
    rhythms: rhythmTemplates.map(toBackupItem),
  });
}

export function serializeLibraryRhythmBackup(payload: LibraryRhythmBackup): string {
  return JSON.stringify(libraryRhythmBackupSchema.parse(payload), null, 2);
}

export function validateLibraryRhythmBackup(input: unknown): LibraryRhythmBackupValidationResult {
  if (!isRecord(input)) {
    return {
      errors: ['backup: Expected a Library rhythm backup object.'],
      ok: false,
    };
  }

  const blockedDataKey = findBlockedDataKey(input);

  if (blockedDataKey) {
    return {
      errors: [`${blockedDataKey}: Library rhythm backup cannot include settings, task, legacy, migration, or scheduler data.`],
      ok: false,
    };
  }

  const parsed = libraryRhythmBackupSchema.safeParse(input);

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

export function parseLibraryRhythmBackupJson(json: string): LibraryRhythmBackupValidationResult {
  try {
    return validateLibraryRhythmBackup(JSON.parse(json) as unknown);
  } catch {
    return {
      errors: ['backup: Library rhythm backup JSON is malformed.'],
      ok: false,
    };
  }
}
