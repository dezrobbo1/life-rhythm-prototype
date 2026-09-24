import type { SchedulingPreference } from '../domain/schedulingModel';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import { strictIsoDateTimeSchema } from './schemas';
import { SETTINGS_APP_VERSION } from './settingsRepository';
import {
  EXPLICIT_PREFERENCES_RECORD_ID,
  explicitPreferenceIdSchema,
  explicitPreferenceSchema,
  explicitPreferenceStoreRecordSchema,
  explicitPreferenceWriteInputSchema,
  type ExplicitPreference,
  type ExplicitPreferenceStoreRecord,
} from './explicitPreferenceSchema';

/** An ID-scoped view of the shared settings store, not a Settings record cast. */
export type ExplicitPreferenceStore = {
  read(): Promise<unknown>;
  write(record: ExplicitPreferenceStoreRecord): Promise<unknown>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
};

export function createExplicitPreferenceStore(
  database = getCurrentLifeRhythmDatabase(),
): ExplicitPreferenceStore {
  const table = database.table<ExplicitPreferenceStoreRecord, string>('settings');
  return {
    read: () => table.get(EXPLICIT_PREFERENCES_RECORD_ID),
    write: (record) => table.put(explicitPreferenceStoreRecordSchema.parse(record)),
    transaction: (operation) => database.transaction('rw', database.settings, operation),
  };
}

type Failure = { ok: false; errors: string[] };
export type ExplicitPreferenceLoadResult =
  | { status: 'missing'; preferences: [] }
  | { status: 'ok'; record: ExplicitPreferenceStoreRecord; preferences: ExplicitPreference[] }
  | { status: 'invalid'; errors: string[] }
  | { status: 'readFailed'; errors: string[] };
export type ExplicitPreferenceWriteResult = Failure |
  { ok: true; preference: ExplicitPreference; preferences: ExplicitPreference[] };
export type ExplicitPreferenceDeleteResult = Failure |
  { ok: true; removed: boolean; preferences: ExplicitPreference[] };
export type ExplicitPreferenceExportResult =
  | { status: 'missing' }
  | { status: 'ok'; rawRecord: unknown }
  | { status: 'readFailed'; errors: string[] };

function failure(message: string): Failure {
  return { ok: false, errors: [`explicitPreferences: ${message}`] };
}
function ordered(preferences: readonly ExplicitPreference[]) {
  return [...preferences].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function recordForWrite(
  preferences: ExplicitPreference[], timestamp: string, existing?: ExplicitPreferenceStoreRecord,
) {
  return explicitPreferenceStoreRecordSchema.safeParse({
    id: EXPLICIT_PREFERENCES_RECORD_ID, recordType: 'explicitPreferenceStore', formatVersion: 1,
    appVersion: SETTINGS_APP_VERSION, createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp, preferences: ordered(preferences),
  });
}

/** Reads never write, replace corrupt state, or fabricate defaults on failure. */
export async function loadExplicitPreferencesResult(
  store: ExplicitPreferenceStore = createExplicitPreferenceStore(),
): Promise<ExplicitPreferenceLoadResult> {
  let stored: unknown;
  try { stored = await store.read(); } catch {
    return { status: 'readFailed', errors: ['explicitPreferences: Saved preferences could not be read.'] };
  }
  if (stored === undefined) return { status: 'missing', preferences: [] };
  const parsed = explicitPreferenceStoreRecordSchema.safeParse(stored);
  if (!parsed.success) return {
    status: 'invalid', errors: ['explicitPreferences: Saved preferences are invalid and were left untouched.'],
  };
  const record = { ...parsed.data, preferences: ordered(parsed.data.preferences) };
  return { status: 'ok', record, preferences: record.preferences };
}

export async function upsertExplicitPreference(
  input: unknown,
  store: ExplicitPreferenceStore = createExplicitPreferenceStore(),
  timestamp = new Date().toISOString(),
): Promise<ExplicitPreferenceWriteResult> {
  const parsed = explicitPreferenceWriteInputSchema.safeParse(input);
  if (!parsed.success) return failure('Preference target, scope, or time window is invalid.');
  if (!strictIsoDateTimeSchema.safeParse(timestamp).success) return failure('Invalid write timestamp.');
  try {
    return await store.transaction(async (): Promise<ExplicitPreferenceWriteResult> => {
      const loaded = await loadExplicitPreferencesResult(store);
      if (loaded.status === 'invalid' || loaded.status === 'readFailed') return { ok: false, errors: loaded.errors };
      const previous = loaded.status === 'ok' ? loaded.record : undefined;
      if (previous && Date.parse(timestamp) < Date.parse(previous.updatedAt)) {
        return failure('Write timestamp is older than the saved preferences; nothing was changed.');
      }
      // An empty record is a durable deletion boundary, including timestamp ties.
      if (previous && previous.preferences.length === 0 &&
          Date.parse(timestamp) === Date.parse(previous.updatedAt)) {
        return failure('Write timestamp must follow the last preference deletion; nothing was changed.');
      }
      const existing = loaded.preferences.find((item) => item.id === parsed.data.id);
      const preference = explicitPreferenceSchema.safeParse({
        ...parsed.data, source: 'explicitPersistent',
        provenance: { actor: 'user', mechanism: 'explicitPreference' },
        createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      });
      if (!preference.success) return failure('Preference timestamps are inconsistent.');
      const preferences = ordered([
        ...loaded.preferences.filter((item) => item.id !== preference.data.id), preference.data,
      ]);
      const record = recordForWrite(preferences, timestamp, previous);
      if (!record.success) return failure('Preference store validation failed; nothing was changed.');
      await store.write(record.data);
      return { ok: true, preference: preference.data, preferences };
    });
  } catch { return failure('Preference could not be saved on this device.'); }
}

export async function deleteExplicitPreference(
  preferenceId: string,
  store: ExplicitPreferenceStore = createExplicitPreferenceStore(),
  timestamp = new Date().toISOString(),
): Promise<ExplicitPreferenceDeleteResult> {
  if (!explicitPreferenceIdSchema.safeParse(preferenceId).success ||
      !strictIsoDateTimeSchema.safeParse(timestamp).success) return failure('Invalid deletion ID or timestamp.');
  try {
    return await store.transaction(async (): Promise<ExplicitPreferenceDeleteResult> => {
      const loaded = await loadExplicitPreferencesResult(store);
      if (loaded.status === 'invalid' || loaded.status === 'readFailed') return { ok: false, errors: loaded.errors };
      if (loaded.status === 'missing') return { ok: true, removed: false, preferences: [] };
      const preferences = loaded.preferences.filter((item) => item.id !== preferenceId);
      if (preferences.length === loaded.preferences.length) {
        return { ok: true, removed: false, preferences };
      }
      if (Date.parse(timestamp) < Date.parse(loaded.record.updatedAt)) {
        return failure('Deletion timestamp is older than the saved preferences; nothing was changed.');
      }
      // Keep ordering metadata even when no preference content remains.
      const record = recordForWrite(preferences, timestamp, loaded.record);
      if (!record.success) return failure('Preference store validation failed; nothing was changed.');
      await store.write(record.data);
      return { ok: true, removed: true, preferences };
    });
  } catch { return failure('Preference could not be removed on this device.'); }
}

/** A raw recovery/export read includes corrupt data but never treats it as authority. */
export async function exportExplicitPreferencesResult(
  store: ExplicitPreferenceStore = createExplicitPreferenceStore(),
): Promise<ExplicitPreferenceExportResult> {
  try {
    const rawRecord = await store.read();
    return rawRecord === undefined ? { status: 'missing' } : { status: 'ok', rawRecord };
  } catch {
    return { status: 'readFailed', errors: ['explicitPreferences: Preferences could not be exported.'] };
  }
}

export const DELETE_EXPLICIT_PREFERENCES_CONFIRMATION = 'DELETE EXPLICIT PREFERENCES';
/** Explicit recovery deletion is separate from ordinary, fail-closed item editing. */
export async function resetExplicitPreferences(
  confirmation: string,
  store: ExplicitPreferenceStore = createExplicitPreferenceStore(),
  timestamp = new Date().toISOString(),
): Promise<ExplicitPreferenceDeleteResult> {
  if (confirmation !== DELETE_EXPLICIT_PREFERENCES_CONFIRMATION) return failure('Deletion confirmation is required.');
  if (!strictIsoDateTimeSchema.safeParse(timestamp).success) return failure('Invalid reset timestamp.');
  try {
    return await store.transaction(async (): Promise<ExplicitPreferenceDeleteResult> => {
      const existing = await store.read();
      const parsed = explicitPreferenceStoreRecordSchema.safeParse(existing);
      const previous = parsed.success ? parsed.data : undefined;
      if (previous && Date.parse(timestamp) < Date.parse(previous.updatedAt)) {
        return failure('Reset timestamp is older than the saved preferences; nothing was changed.');
      }
      // Recovery discards untrusted content/metadata; even a missing store needs
      // a boundary so a command queued before this confirmed reset cannot return.
      const record = recordForWrite([], timestamp, previous);
      if (!record.success) return failure('Preference store validation failed; nothing was changed.');
      await store.write(record.data);
      return {
        ok: true, removed: previous ? previous.preferences.length > 0 : existing !== undefined,
        preferences: [],
      };
    });
  } catch { return failure('Preferences could not be deleted on this device.'); }
}

/** Input preferences must come from the strict reader; atIso is an explicit decision instant. */
export function activeExplicitPreferences(
  preferences: readonly ExplicitPreference[], atIso: string,
): ExplicitPreference[] {
  if (!strictIsoDateTimeSchema.safeParse(atIso).success) throw new RangeError('Invalid preference evaluation timestamp.');
  const at = Date.parse(atIso);
  return ordered(preferences.filter((preference) =>
    Date.parse(preference.updatedAt) <= at && (!preference.expiresAt || Date.parse(preference.expiresAt) > at),
  ));
}

/** Projection for one decision instant, NOT a lifetime-safe whole-horizon preference loader. */
export function explicitPreferencesForScheduler(
  preferences: readonly ExplicitPreference[], atIso: string,
): SchedulingPreference[] {
  return activeExplicitPreferences(preferences, atIso).map((preference) => ({
    id: preference.id, targetKind: preference.targetKind, targetValue: preference.targetValue,
    relation: preference.relation, days: [...preference.days],
    ...(preference.start !== undefined ? { start: preference.start, end: preference.end } : {}),
    provenance: `Persisted explicit preference ${preference.id}; user-declared.`,
  }));
}

/**
 * Whole-horizon scheduler rules retain absolute lifetime metadata.
 * The scheduler evaluates activeFrom/expiresAt for each candidate slot instead
 * of treating a temporary preference as active for the entire planning horizon.
 */
export function explicitPreferenceRulesForScheduler(
  preferences: readonly ExplicitPreference[],
): SchedulingPreference[] {
  return ordered(preferences).map((preference) => ({
    id: preference.id,
    targetKind: preference.targetKind,
    targetValue: preference.targetValue,
    relation: preference.relation,
    days: [...preference.days],
    ...(preference.start !== undefined ? { start: preference.start, end: preference.end } : {}),
    precedenceSource: 'explicitPersistent',
    activeFrom: preference.updatedAt,
    ...(preference.expiresAt ? { expiresAt: preference.expiresAt } : {}),
    provenance: `Persisted explicit preference ${preference.id}; user-declared.`,
  }));
}
