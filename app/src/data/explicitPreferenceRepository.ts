import type { Table } from 'dexie';
import type { SchedulingPreference } from '../domain/schedulingModel';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import { SETTINGS_APP_VERSION } from './settingsRepository';
import type { Settings } from './schemas';
import {
  EXPLICIT_PREFERENCES_RECORD_ID,
  explicitPreferenceSchema,
  explicitPreferenceStoreRecordSchema,
  explicitPreferenceWriteInputSchema,
  type ExplicitPreference,
  type ExplicitPreferenceStoreRecord,
  type ExplicitPreferenceWriteInput,
} from './explicitPreferenceSchema';

type ExplicitPreferenceTable = Pick<
  Table<Settings, string>,
  'delete' | 'get' | 'put'
>;

export type ExplicitPreferenceStore = {
  settings: ExplicitPreferenceTable;
};

export type ExplicitPreferenceLoadResult =
  | { status: 'missing'; preferences: [] }
  | {
      status: 'ok';
      record: ExplicitPreferenceStoreRecord;
      preferences: ExplicitPreference[];
    }
  | { status: 'invalid' | 'readFailed'; errors: string[] };

export type ExplicitPreferenceWriteResult =
  | {
      ok: true;
      preference: ExplicitPreference;
      preferences: ExplicitPreference[];
    }
  | { ok: false; errors: string[] };

export type ExplicitPreferenceDeleteResult =
  | { ok: true; removed: boolean; preferences: ExplicitPreference[] }
  | { ok: false; errors: string[] };

function nowIso() {
  return new Date().toISOString();
}

function issueMessages(
  issues: Array<{ message: string; path: Array<string | number> }>,
) {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'explicitPreferences';
    return `${path}: ${issue.message}`;
  });
}

function ordered(preferences: readonly ExplicitPreference[]) {
  return [...preferences].sort((left, right) => left.id.localeCompare(right.id));
}

function recordForWrite(
  preferences: readonly ExplicitPreference[],
  timestamp: string,
  existing?: ExplicitPreferenceStoreRecord,
) {
  return explicitPreferenceStoreRecordSchema.parse({
    id: EXPLICIT_PREFERENCES_RECORD_ID,
    recordType: 'explicitPreferenceStore',
    formatVersion: 1,
    appVersion: SETTINGS_APP_VERSION,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    preferences: ordered(preferences),
  });
}

export async function loadExplicitPreferencesResult(
  store: ExplicitPreferenceStore = getCurrentLifeRhythmDatabase(),
): Promise<ExplicitPreferenceLoadResult> {
  let stored: unknown;

  try {
    stored = await store.settings.get(EXPLICIT_PREFERENCES_RECORD_ID);
  } catch {
    return {
      status: 'readFailed',
      errors: ['explicitPreferences: Saved explicit preferences could not be read.'],
    };
  }

  if (stored === undefined) {
    return { status: 'missing', preferences: [] };
  }

  const parsed = explicitPreferenceStoreRecordSchema.safeParse(stored);
  if (!parsed.success) {
    return {
      status: 'invalid',
      errors: issueMessages(parsed.error.issues),
    };
  }

  const record = {
    ...parsed.data,
    preferences: ordered(parsed.data.preferences),
  };

  return {
    status: 'ok',
    record,
    preferences: record.preferences,
  };
}

export async function upsertExplicitPreference(
  input: ExplicitPreferenceWriteInput,
  store: ExplicitPreferenceStore = getCurrentLifeRhythmDatabase(),
  timestamp = nowIso(),
): Promise<ExplicitPreferenceWriteResult> {
  const parsedInput = explicitPreferenceWriteInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, errors: issueMessages(parsedInput.error.issues) };
  }

  const loaded = await loadExplicitPreferencesResult(store);
  if (loaded.status === 'invalid' || loaded.status === 'readFailed') {
    return { ok: false, errors: loaded.errors };
  }

  const existingPreferences = loaded.status === 'ok' ? loaded.preferences : [];
  const existing = existingPreferences.find(
    (preference) => preference.id === parsedInput.data.id,
  );

  const parsedPreference = explicitPreferenceSchema.safeParse({
    ...parsedInput.data,
    source: 'explicitPersistent',
    provenance: {
      actor: 'user',
      mechanism: 'explicitPreference',
    },
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });

  if (!parsedPreference.success) {
    return {
      ok: false,
      errors: issueMessages(parsedPreference.error.issues),
    };
  }

  const preferences = ordered([
    ...existingPreferences.filter(
      (preference) => preference.id !== parsedPreference.data.id,
    ),
    parsedPreference.data,
  ]);
  const record = recordForWrite(
    preferences,
    timestamp,
    loaded.status === 'ok' ? loaded.record : undefined,
  );

  try {
    await store.settings.put(record as unknown as Settings);
  } catch {
    return {
      ok: false,
      errors: ['explicitPreferences: Explicit preference could not be saved on this device.'],
    };
  }

  return {
    ok: true,
    preference: parsedPreference.data,
    preferences,
  };
}

export async function deleteExplicitPreference(
  preferenceId: string,
  store: ExplicitPreferenceStore = getCurrentLifeRhythmDatabase(),
  timestamp = nowIso(),
): Promise<ExplicitPreferenceDeleteResult> {
  const loaded = await loadExplicitPreferencesResult(store);
  if (loaded.status === 'invalid' || loaded.status === 'readFailed') {
    return { ok: false, errors: loaded.errors };
  }

  if (loaded.status === 'missing') {
    return { ok: true, removed: false, preferences: [] };
  }

  const preferences = loaded.preferences.filter(
    (preference) => preference.id !== preferenceId,
  );
  if (preferences.length === loaded.preferences.length) {
    return { ok: true, removed: false, preferences: loaded.preferences };
  }

  try {
    if (preferences.length === 0) {
      await store.settings.delete(EXPLICIT_PREFERENCES_RECORD_ID);
    } else {
      await store.settings.put(
        recordForWrite(preferences, timestamp, loaded.record) as unknown as Settings,
      );
    }
  } catch {
    return {
      ok: false,
      errors: ['explicitPreferences: Explicit preference could not be removed on this device.'],
    };
  }

  return { ok: true, removed: true, preferences };
}

export function activeExplicitPreferences(
  preferences: readonly ExplicitPreference[],
  atIso: string,
): ExplicitPreference[] {
  const at = Date.parse(atIso);
  if (!Number.isFinite(at)) return [];

  return ordered(
    preferences.filter((preference) => {
      if (!preference.expiresAt) return true;
      const expiresAt = Date.parse(preference.expiresAt);
      return Number.isFinite(expiresAt) && expiresAt > at;
    }),
  );
}

export function explicitPreferencesForScheduler(
  preferences: readonly ExplicitPreference[],
  atIso: string,
): SchedulingPreference[] {
  return activeExplicitPreferences(preferences, atIso).map((preference) => ({
    id: preference.id,
    targetKind: preference.targetKind,
    targetValue: preference.targetValue,
    relation: preference.relation,
    days: preference.days,
    ...(preference.start ? { start: preference.start } : {}),
    ...(preference.end ? { end: preference.end } : {}),
    provenance: `Persisted explicit preference ${preference.id}; user-declared.`,
  }));
}
