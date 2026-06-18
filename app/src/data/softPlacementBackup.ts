import { z } from 'zod';
import {
  loadAllSoftPlacements,
  type SoftPlacementStore,
} from './softPlacementRepository';
import {
  softPlacementSchema,
  type SoftPlacement,
} from './schemas';

export const SOFT_PLACEMENT_BACKUP_APP_VERSION = '1.4.6';
export const SOFT_PLACEMENT_BACKUP_FORMAT = 'life-rhythm-soft-placement-backup';

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
  'compliance',
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
  'startBoostLog',
  'startBoostLogs',
  'streak',
  'sync',
  'taskHistory',
  'tasks',
  'upload',
]);

export const softPlacementBackupItemSchema = softPlacementSchema;

export const softPlacementBackupSchema = z
  .object({
    appVersion,
    exportedAt: isoDateTime,
    format: z.literal(SOFT_PLACEMENT_BACKUP_FORMAT),
    placements: z.array(softPlacementBackupItemSchema),
  })
  .strict()
  .superRefine((backup, context) => {
    const seenIds = new Set<string>();

    backup.placements.forEach((placement, index) => {
      if (seenIds.has(placement.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate soft placement IDs are not allowed in a soft placement backup.',
          path: ['placements', index, 'id'],
        });
      }

      seenIds.add(placement.id);
    });
  });

export type SoftPlacementBackupItem = z.infer<typeof softPlacementBackupItemSchema>;
export type SoftPlacementBackup = z.infer<typeof softPlacementBackupSchema>;

export type SoftPlacementBackupPreview = {
  appVersion: string;
  exportedAt: string;
  includesRemovedPlacements: boolean;
  placementCount: number;
  placementTitles: string[];
  statusSummary: string;
};

export type SoftPlacementBackupValidationResult =
  | {
      ok: true;
      payload: SoftPlacementBackup;
      preview: SoftPlacementBackupPreview;
    }
  | {
      errors: string[];
      ok: false;
    };

export type SoftPlacementBackupExport = {
  fileName: string;
  json: string;
  payload: SoftPlacementBackup;
  placementCount: number;
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

function toBackupItem(placementInput: unknown): SoftPlacementBackupItem {
  return softPlacementBackupItemSchema.parse(placementInput);
}

function buildPreview(payload: SoftPlacementBackup): SoftPlacementBackupPreview {
  const statusCounts = payload.placements.reduce<Record<SoftPlacement['status'], number>>(
    (counts, placement) => ({
      ...counts,
      [placement.status]: counts[placement.status] + 1,
    }),
    {
      completedFromToday: 0,
      moved: 0,
      planned: 0,
      removed: 0,
    },
  );
  const statusSummary = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');

  return {
    appVersion: payload.appVersion,
    exportedAt: payload.exportedAt,
    includesRemovedPlacements: payload.placements.some((placement) => placement.status === 'removed'),
    placementCount: payload.placements.length,
    placementTitles: payload.placements.map((placement) => placement.taskTitleSnapshot),
    statusSummary: statusSummary || 'No saved soft placements',
  };
}

export function buildSoftPlacementBackupPayload(
  placements: unknown[],
  exportedAt = nowIso(),
  appVersionValue = SOFT_PLACEMENT_BACKUP_APP_VERSION,
): SoftPlacementBackup {
  return softPlacementBackupSchema.parse({
    appVersion: appVersionValue,
    exportedAt,
    format: SOFT_PLACEMENT_BACKUP_FORMAT,
    placements: placements.map(toBackupItem),
  });
}

export function serializeSoftPlacementBackup(payload: SoftPlacementBackup): string {
  return JSON.stringify(softPlacementBackupSchema.parse(payload), null, 2);
}

export function validateSoftPlacementBackup(input: unknown): SoftPlacementBackupValidationResult {
  if (!isRecord(input)) {
    return {
      errors: ['backup: Expected a soft placement backup object.'],
      ok: false,
    };
  }

  const blockedDataKey = findBlockedDataKey(input);

  if (blockedDataKey) {
    return {
      errors: [`${blockedDataKey}: Soft placement backup cannot include task, settings, rhythm, scheduler, calendar, AI, backend, sync, legacy, migration, log, score, streak, or compliance data.`],
      ok: false,
    };
  }

  const parsed = softPlacementBackupSchema.safeParse(input);

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

export function parseSoftPlacementBackupJson(json: string): SoftPlacementBackupValidationResult {
  try {
    return validateSoftPlacementBackup(JSON.parse(json) as unknown);
  } catch {
    return {
      errors: ['backup: Soft placement backup JSON is malformed.'],
      ok: false,
    };
  }
}

export async function exportSoftPlacementBackup(
  store?: SoftPlacementStore,
  exportedAt = nowIso(),
): Promise<SoftPlacementBackupExport | null> {
  const placements = await loadAllSoftPlacements(store);

  if (placements.length === 0) {
    return null;
  }

  const payload = buildSoftPlacementBackupPayload(placements, exportedAt);

  return {
    fileName: `life-rhythm-soft-placements-backup-${fileDate(exportedAt)}.json`,
    json: serializeSoftPlacementBackup(payload),
    payload,
    placementCount: payload.placements.length,
  };
}
