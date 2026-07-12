import { z } from 'zod';
import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  activeTaskSchema,
  completionLogSchema,
  devTicketSchema,
  isoTimestampSchema,
  migrationLogSchema,
  resetLogSchema,
  rhythmTemplateSchema,
  settingsSchema,
  softPlacementSchema,
  startBoostLogSchema,
  taskHistoryEventSchema,
  taskPoolItemSchema,
  type Settings,
} from './schemas';
import { loadSettings, SETTINGS_APP_VERSION } from './settingsRepository';

const personalTrialBackupDataSchema = z
  .object({
    activeTasks: z.array(activeTaskSchema),
    completionLog: z.array(completionLogSchema),
    devTickets: z.array(devTicketSchema),
    migrationLog: z.array(migrationLogSchema),
    resetLog: z.array(resetLogSchema),
    rhythmTemplates: z.array(rhythmTemplateSchema),
    settings: settingsSchema,
    softPlacements: z.array(softPlacementSchema),
    startBoostLog: z.array(startBoostLogSchema),
    taskHistory: z.array(taskHistoryEventSchema),
    taskPoolItems: z.array(taskPoolItemSchema),
  })
  .strict();

export const personalTrialBackupSchema = z
  .object({
    appVersion: z.literal(SETTINGS_APP_VERSION),
    data: personalTrialBackupDataSchema,
    exportedAt: isoTimestampSchema,
    format: z.literal('life-rhythm-personal-trial-backup'),
    formatVersion: z.literal(1),
  })
  .strict()
  .superRefine((backup, context) => {
    const collections: Array<{
      name: keyof typeof backup.data;
      records: Array<{ id: string }>;
    }> = [
      { name: 'activeTasks', records: backup.data.activeTasks },
      { name: 'completionLog', records: backup.data.completionLog },
      { name: 'devTickets', records: backup.data.devTickets },
      { name: 'migrationLog', records: backup.data.migrationLog },
      { name: 'resetLog', records: backup.data.resetLog },
      { name: 'rhythmTemplates', records: backup.data.rhythmTemplates },
      { name: 'softPlacements', records: backup.data.softPlacements },
      { name: 'startBoostLog', records: backup.data.startBoostLog },
      { name: 'taskHistory', records: backup.data.taskHistory },
      { name: 'taskPoolItems', records: backup.data.taskPoolItems },
    ];

    for (const collection of collections) {
      const seenIds = new Set<string>();

      collection.records.forEach((record, index) => {
        if (seenIds.has(record.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate ${collection.name} IDs are not allowed.`,
            path: ['data', collection.name, index, 'id'],
          });
        }

        seenIds.add(record.id);
      });
    }

    const taskIds = new Set([
      ...backup.data.activeTasks.map((task) => task.id),
      ...backup.data.taskPoolItems.map((task) => task.id),
    ]);

    backup.data.softPlacements.forEach((placement, index) => {
      if (!taskIds.has(placement.taskId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Soft placement taskId must reference a backed-up task.',
          path: ['data', 'softPlacements', index, 'taskId'],
        });
      }
    });
  });

export type PersonalTrialBackup = z.infer<typeof personalTrialBackupSchema>;

export type PersonalTrialBackupPreview = {
  activeTaskCount: number;
  customRhythmCount: number;
  exportedAt: string;
  poolTaskCount: number;
  settingsTheme: Settings['theme'];
  softPlacementCount: number;
};

export type PersonalTrialBackupExport = {
  fileName: string;
  json: string;
  payload: PersonalTrialBackup;
  preview: PersonalTrialBackupPreview;
};

export type PersonalTrialBackupParseResult =
  | {
      ok: true;
      payload: PersonalTrialBackup;
      preview: PersonalTrialBackupPreview;
    }
  | {
      errors: string[];
      ok: false;
    };

export type PersonalTrialRestoreResult =
  | {
      ok: true;
      preview: PersonalTrialBackupPreview;
      settings: Settings;
    }
  | {
      errors: string[];
      ok: false;
    };

function nowIso() {
  return new Date().toISOString();
}

function fileDate(timestamp: string) {
  return timestamp.slice(0, 10);
}

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'backup';
    return `${path}: ${issue.message}`;
  });
}

function previewForBackup(payload: PersonalTrialBackup): PersonalTrialBackupPreview {
  return {
    activeTaskCount: payload.data.activeTasks.length,
    customRhythmCount: payload.data.rhythmTemplates.filter((rhythm) => rhythm.source === 'custom').length,
    exportedAt: payload.exportedAt,
    poolTaskCount: payload.data.taskPoolItems.length,
    settingsTheme: payload.data.settings.theme,
    softPlacementCount: payload.data.softPlacements.length,
  };
}

export async function buildPersonalTrialBackup(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  exportedAt = nowIso(),
): Promise<PersonalTrialBackup> {
  const [
    settings,
    rhythmTemplates,
    activeTasks,
    taskHistory,
    completionLog,
    resetLog,
    startBoostLog,
    devTickets,
    migrationLog,
    softPlacements,
    taskPoolItems,
  ] = await Promise.all([
    loadSettings(database),
    database.rhythmTemplates.toArray(),
    database.activeTasks.toArray(),
    database.taskHistory.toArray(),
    database.completionLog.toArray(),
    database.resetLog.toArray(),
    database.startBoostLog.toArray(),
    database.devTickets.toArray(),
    database.migrationLog.toArray(),
    database.softPlacements.toArray(),
    database.taskPoolItems.toArray(),
  ]);

  return personalTrialBackupSchema.parse({
    appVersion: SETTINGS_APP_VERSION,
    data: {
      activeTasks,
      completionLog,
      devTickets,
      migrationLog,
      resetLog,
      rhythmTemplates,
      settings,
      softPlacements,
      startBoostLog,
      taskHistory,
      taskPoolItems,
    },
    exportedAt,
    format: 'life-rhythm-personal-trial-backup',
    formatVersion: 1,
  });
}

export function serializePersonalTrialBackup(payload: PersonalTrialBackup): string {
  return JSON.stringify(personalTrialBackupSchema.parse(payload), null, 2);
}

export async function exportPersonalTrialBackup(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  exportedAt = nowIso(),
): Promise<PersonalTrialBackupExport> {
  const payload = await buildPersonalTrialBackup(database, exportedAt);

  return {
    fileName: `life-rhythm-personal-trial-backup-${fileDate(exportedAt)}.json`,
    json: serializePersonalTrialBackup(payload),
    payload,
    preview: previewForBackup(payload),
  };
}

export function parsePersonalTrialBackup(input: unknown): PersonalTrialBackupParseResult {
  const parsed = personalTrialBackupSchema.safeParse(input);

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
    };
  }

  return {
    ok: true,
    payload: parsed.data,
    preview: previewForBackup(parsed.data),
  };
}

export function parsePersonalTrialBackupJson(json: string): PersonalTrialBackupParseResult {
  try {
    return parsePersonalTrialBackup(JSON.parse(json));
  } catch {
    return {
      errors: ['backup: Personal trial backup JSON is malformed.'],
      ok: false,
    };
  }
}

export async function restorePersonalTrialBackup(
  input: unknown,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<PersonalTrialRestoreResult> {
  const parsed = parsePersonalTrialBackup(input);

  if (!parsed.ok) return parsed;

  const { data } = parsed.payload;

  try {
    await database.transaction(
      'rw',
      database.settings,
      database.rhythmTemplates,
      database.activeTasks,
      database.taskHistory,
      database.completionLog,
      database.resetLog,
      database.startBoostLog,
      database.devTickets,
      database.migrationLog,
      database.softPlacements,
      database.taskPoolItems,
      async () => {
        await Promise.all([
          database.settings.clear(),
          database.rhythmTemplates.clear(),
          database.activeTasks.clear(),
          database.taskHistory.clear(),
          database.completionLog.clear(),
          database.resetLog.clear(),
          database.startBoostLog.clear(),
          database.devTickets.clear(),
          database.migrationLog.clear(),
          database.softPlacements.clear(),
          database.taskPoolItems.clear(),
        ]);

        await database.settings.put(data.settings);

        await Promise.all([
          data.rhythmTemplates.length ? database.rhythmTemplates.bulkPut(data.rhythmTemplates) : Promise.resolve(),
          data.activeTasks.length ? database.activeTasks.bulkPut(data.activeTasks) : Promise.resolve(),
          data.taskHistory.length ? database.taskHistory.bulkPut(data.taskHistory) : Promise.resolve(),
          data.completionLog.length ? database.completionLog.bulkPut(data.completionLog) : Promise.resolve(),
          data.resetLog.length ? database.resetLog.bulkPut(data.resetLog) : Promise.resolve(),
          data.startBoostLog.length ? database.startBoostLog.bulkPut(data.startBoostLog) : Promise.resolve(),
          data.devTickets.length ? database.devTickets.bulkPut(data.devTickets) : Promise.resolve(),
          data.migrationLog.length ? database.migrationLog.bulkPut(data.migrationLog) : Promise.resolve(),
          data.softPlacements.length ? database.softPlacements.bulkPut(data.softPlacements) : Promise.resolve(),
          data.taskPoolItems.length ? database.taskPoolItems.bulkPut(data.taskPoolItems) : Promise.resolve(),
        ]);
      },
    );

    return {
      ok: true,
      preview: parsed.preview,
      settings: data.settings,
    };
  } catch {
    return {
      errors: ['backup: Restore did not complete. Existing local data was left unchanged.'],
      ok: false,
    };
  }
}
