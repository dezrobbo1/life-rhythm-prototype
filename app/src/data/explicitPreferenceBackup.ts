import {
  exportExplicitPreferencesResult,
  type ExplicitPreferenceExportResult,
} from './explicitPreferenceRepository';

export const EXPLICIT_PREFERENCE_BACKUP_KIND = 'life-rhythm-explicit-preferences-backup';
export const EXPLICIT_PREFERENCE_BACKUP_VERSION = 1;

export type ExplicitPreferenceBackupPayload = {
  kind: typeof EXPLICIT_PREFERENCE_BACKUP_KIND;
  version: typeof EXPLICIT_PREFERENCE_BACKUP_VERSION;
  exportedAt: string;
  rawRecord: unknown;
};

export type ExplicitPreferenceBackupResult =
  | { status: 'missing' }
  | { status: 'readFailed'; errors: string[] }
  | {
      status: 'ok';
      fileName: string;
      json: string;
      payload: ExplicitPreferenceBackupPayload;
    };

export function buildExplicitPreferenceBackupPayload(
  rawRecord: unknown,
  exportedAt: string,
): ExplicitPreferenceBackupPayload {
  return {
    kind: EXPLICIT_PREFERENCE_BACKUP_KIND,
    version: EXPLICIT_PREFERENCE_BACKUP_VERSION,
    exportedAt,
    rawRecord,
  };
}

export async function exportExplicitPreferenceBackup(
  exportedAt = new Date().toISOString(),
  read: () => Promise<ExplicitPreferenceExportResult> = exportExplicitPreferencesResult,
): Promise<ExplicitPreferenceBackupResult> {
  const result = await read();

  if (result.status === 'missing') return { status: 'missing' };
  if (result.status === 'readFailed') return result;

  const payload = buildExplicitPreferenceBackupPayload(result.rawRecord, exportedAt);
  return {
    status: 'ok',
    fileName: `life-rhythm-scheduling-preferences-${exportedAt.slice(0, 10)}.json`,
    json: JSON.stringify(payload, null, 2),
    payload,
  };
}
