import { exportExplicitPreferencesResult } from './explicitPreferenceRepository';

export type ExplicitPreferenceBackupExport =
  | {
      ok: true;
      fileName: string;
      json: string;
    }
  | {
      ok: false;
      errors: string[];
    };

function datePart(instant: string) {
  return instant.slice(0, 10);
}

export async function buildExplicitPreferenceBackup(
  exportedAt = new Date().toISOString(),
): Promise<ExplicitPreferenceBackupExport> {
  const result = await exportExplicitPreferencesResult();
  if (result.status === 'readFailed') {
    return { ok: false, errors: result.errors };
  }

  const payload = {
    format: 'life-rhythm-explicit-preferences-export',
    formatVersion: 1,
    exportedAt,
    record: result.status === 'ok' ? result.rawRecord : null,
  };

  return {
    ok: true,
    fileName: `life-rhythm-scheduling-preferences-${datePart(exportedAt)}.json`,
    json: JSON.stringify(payload, null, 2),
  };
}
