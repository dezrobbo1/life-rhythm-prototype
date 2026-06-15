import { z } from 'zod';
import { loadSettings, SETTINGS_APP_VERSION, type SettingsStore } from './settingsRepository';
import { settingsSchema } from './schemas';

const settingsBackupSettingsSchema = settingsSchema
  .pick({
    appVersion: true,
    createdAt: true,
    id: true,
    lifeShape: true,
    startBoostSafety: true,
    theme: true,
    updatedAt: true,
  })
  .strict();

export const settingsBackupSchema = z
  .object({
    appVersion: settingsSchema.shape.appVersion,
    exportedAt: settingsSchema.shape.updatedAt,
    format: z.literal('life-rhythm-settings-backup'),
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
  const safeSettings = settingsSchema.safeParse(settings);
  const parsedSettings = safeSettings.success ? safeSettings.data : settingsSchema.parse({
    appVersion: SETTINGS_APP_VERSION,
    createdAt: exportedAt,
    id: 'settings',
    updatedAt: exportedAt,
  });

  return settingsBackupSchema.parse({
    appVersion: parsedSettings.appVersion,
    exportedAt,
    format: 'life-rhythm-settings-backup',
    settings: {
      appVersion: parsedSettings.appVersion,
      createdAt: parsedSettings.createdAt,
      id: parsedSettings.id,
      lifeShape: parsedSettings.lifeShape,
      startBoostSafety: parsedSettings.startBoostSafety,
      theme: parsedSettings.theme,
      updatedAt: parsedSettings.updatedAt,
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
  const settings = await loadSettings(store);
  const payload = buildSettingsBackupPayload(settings, exportedAt);

  return {
    fileName: `life-rhythm-settings-backup-${fileDate(exportedAt)}.json`,
    json: serializeSettingsBackup(payload),
    payload,
  };
}
