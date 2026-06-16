import {
  buildLibraryRhythmBackupPayload,
  serializeLibraryRhythmBackup,
  type LibraryRhythmBackup,
} from './libraryRhythmBackup';
import {
  loadCustomLibraryRhythms,
  type LibraryRhythmStore,
} from './libraryRhythmRepository';

export type LibraryRhythmBackupExport = {
  fileName: string;
  json: string;
  payload: LibraryRhythmBackup;
  rhythmCount: number;
};

function nowIso() {
  return new Date().toISOString();
}

function fileDate(timestamp: string) {
  return timestamp.slice(0, 10);
}

export async function exportLibraryRhythmBackup(
  store?: LibraryRhythmStore,
  exportedAt = nowIso(),
): Promise<LibraryRhythmBackupExport | null> {
  const rhythms = await loadCustomLibraryRhythms(store);

  if (rhythms.length === 0) {
    return null;
  }

  const payload = buildLibraryRhythmBackupPayload(rhythms, exportedAt);

  return {
    fileName: `life-rhythm-library-rhythms-backup-${fileDate(exportedAt)}.json`,
    json: serializeLibraryRhythmBackup(payload),
    payload,
    rhythmCount: payload.rhythms.length,
  };
}
