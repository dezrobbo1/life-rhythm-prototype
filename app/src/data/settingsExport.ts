import { z } from 'zod';
import { migrateSettingsDayProfileFoundation } from './dayProfileMigration';
import {
  loadSettingsForBackup,
  type SettingsStore,
} from './settingsRepository';
import {
  dayProfileKindSchema,
  dayProfileFoundationSchema,
  dayProfileMigrationStateSchema,
  dayProfileWorkPlanningUseSchema,
  idSchema,
  lifeShapeSettingsSchema,
  semanticAppVersionSchema,
  startBoostSafetySettingsSchema,
  strictIsoDateTimeSchema,
  themeNameSchema,
  weekdayProfileAssignmentSchema,
} from './schemas';

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

const backupDayProfileTimeRangeSchema = z
  .object({
    end: timeOfDay,
    start: timeOfDay,
  })
  .strict()
  .superRefine((range, context) => {
    const [startHours, startMinutes] = range.start.split(':').map(Number);
    const [endHours, endMinutes] = range.end.split(':').map(Number);

    if (startHours * 60 + startMinutes >= endHours * 60 + endMinutes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End must be later than start.',
        path: ['end'],
      });
    }
  });

export const settingsBackupDayProfileSchema = z
  .object({
    id: idSchema,
    kind: dayProfileKindSchema,
    name: z.string().min(1),
    usableDay: backupDayProfileTimeRangeSchema.optional(),
    workPeriod: backupDayProfileTimeRangeSchema.optional(),
    workPlanningUse: dayProfileWorkPlanningUseSchema,
  })
  .strict();

export const settingsBackupSettingsSchema = z
  .object({
    appVersion: semanticAppVersionSchema,
    createdAt: strictIsoDateTimeSchema,
    dayProfileMigrationState: dayProfileMigrationStateSchema,
    dayProfiles: z.array(settingsBackupDayProfileSchema).length(2),
    id: z.literal('settings'),
    lifeShape: lifeShapeSettingsSchema,
    startBoostSafety: startBoostSafetySettingsSchema,
    theme: themeNameSchema,
    updatedAt: strictIsoDateTimeSchema,
    weekdayProfileAssignments: z.array(weekdayProfileAssignmentSchema).length(7),
  })
  .strict()
  .superRefine((settings, context) => {
    const foundation = dayProfileFoundationSchema.safeParse({
      dayProfileMigrationState: settings.dayProfileMigrationState,
      dayProfiles: settings.dayProfiles,
      weekdayProfileAssignments: settings.weekdayProfileAssignments,
    });

    if (!foundation.success) {
      for (const issue of foundation.error.issues) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });

export const settingsBackupSchema = z
  .object({
    appVersion: semanticAppVersionSchema,
    exportedAt: strictIsoDateTimeSchema,
    format: z.literal('life-rhythm-settings-backup'),
    formatVersion: z.literal(2),
    settings: settingsBackupSettingsSchema,
  })
  .strict();

export type SettingsBackup = z.infer<typeof settingsBackupSchema>;

export type SettingsBackupExport = {
  fileName: string;
  json: string;
  payload: SettingsBackup;
};

function nowIso() {
  return new Date().toISOString();
}

function fileDate(timestamp: string) {
  return timestamp.slice(0, 10);
}

export function buildSettingsBackupPayload(settings: unknown, exportedAt = nowIso()): SettingsBackup {
  const migratedSettings = migrateSettingsDayProfileFoundation(settings);

  if (!migratedSettings.ok) {
    throw new Error(
      `Settings backup could not be created: ${migratedSettings.errors.join(' ')}`,
    );
  }

  const parsedSettings = migratedSettings.settings;

  return settingsBackupSchema.parse({
    appVersion: parsedSettings.appVersion,
    exportedAt,
    format: 'life-rhythm-settings-backup',
    formatVersion: 2,
    settings: {
      appVersion: parsedSettings.appVersion,
      createdAt: parsedSettings.createdAt,
      dayProfileMigrationState: parsedSettings.dayProfileMigrationState,
      dayProfiles: parsedSettings.dayProfiles.map((profile) => ({
        id: profile.id,
        kind: profile.kind,
        name: profile.name,
        usableDay: profile.usableDay
          ? { end: profile.usableDay.end, start: profile.usableDay.start }
          : undefined,
        workPeriod: profile.workPeriod
          ? { end: profile.workPeriod.end, start: profile.workPeriod.start }
          : undefined,
        workPlanningUse: profile.workPlanningUse,
      })),
      id: parsedSettings.id,
      lifeShape: parsedSettings.lifeShape,
      startBoostSafety: parsedSettings.startBoostSafety,
      theme: parsedSettings.theme,
      updatedAt: parsedSettings.updatedAt,
      weekdayProfileAssignments: parsedSettings.weekdayProfileAssignments,
    },
  });
}

export function serializeSettingsBackup(payload: SettingsBackup): string {
  return JSON.stringify(settingsBackupSchema.parse(payload), null, 2);
}

export async function exportSettingsBackup(
  store?: SettingsStore,
  exportedAt = nowIso(),
): Promise<SettingsBackupExport> {
  const loadResult = await loadSettingsForBackup(store);

  if (loadResult.status === 'invalid' || loadResult.status === 'readFailed') {
    throw new Error(`Settings backup could not be created: ${loadResult.errors.join(' ')}`);
  }

  const payload = buildSettingsBackupPayload(loadResult.settings, exportedAt);

  return {
    fileName: `life-rhythm-settings-backup-${fileDate(exportedAt)}.json`,
    json: serializeSettingsBackup(payload),
    payload,
  };
}
