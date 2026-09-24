import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase, type LifeRhythmDatabase } from './db';
import {
  createAuthLocalDataNamespace, getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace, setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { legacySettingsSchema } from './schemas';
import { loadSettingsResult, resetSettingsToDefaults } from './settingsRepository';
import {
  activeExplicitPreferences, createExplicitPreferenceStore, deleteExplicitPreference,
  DELETE_EXPLICIT_PREFERENCES_CONFIRMATION, explicitPreferencesForScheduler,
  exportExplicitPreferencesResult, loadExplicitPreferencesResult, resetExplicitPreferences,
  upsertExplicitPreference, type ExplicitPreferenceStore,
} from './explicitPreferenceRepository';
import {
  EXPLICIT_PREFERENCES_RECORD_ID, explicitPreferenceSchema, type ExplicitPreferenceWriteInput,
} from './explicitPreferenceSchema';

const time = '2026-09-23T09:00:00.000Z';
const later = '2026-09-23T10:00:00.000Z';
const input: ExplicitPreferenceWriteInput = {
  id: 'admin-weekend', targetKind: 'area', targetValue: 'admin', relation: 'prefer',
  days: ['Saturday', 'Sunday'], start: '08:00', end: '12:00',
};
let index = 0;
let database: LifeRhythmDatabase;
let secondary: LifeRhythmDatabase | undefined;
beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate7c-${++index}`));
  database = getCurrentLifeRhythmDatabase();
});
afterEach(async () => {
  secondary?.close();
  secondary = undefined;
  await database.delete();
  resetCurrentLocalDataNamespace();
});

function unavailableStore(): ExplicitPreferenceStore {
  return {
    read: vi.fn().mockRejectedValue(new Error('unavailable')),
    write: vi.fn(), remove: vi.fn(), transaction: (operation) => operation(),
  };
}

describe('Gate 7C explicit preference persistence', () => {
  it('persists valid local windows and provenance without changing either settings record', async () => {
    await resetSettingsToDefaults();
    const primary = await database.settings.get('settings');
    const foundation = await database.settings.get('dayProfileFoundation');
    expect((await upsertExplicitPreference(input, undefined, time)).ok).toBe(true);
    const loaded = await loadExplicitPreferencesResult();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') throw new Error('Expected saved preferences');
    expect(loaded.record.formatVersion).toBe(1);
    expect(loaded.preferences).toEqual([expect.objectContaining({
      ...input, source: 'explicitPersistent', createdAt: time, updatedAt: time,
      provenance: { actor: 'user', mechanism: 'explicitPreference' },
    })]);
    expect(await database.settings.get('settings')).toEqual(primary);
    expect(await database.settings.get('dayProfileFoundation')).toEqual(foundation);
    expect(legacySettingsSchema.safeParse(await database.settings.get('settings')).success).toBe(true);
    expect((await loadSettingsResult()).status).toBe('loaded');
    expect(database.verno).toBe(5);
  });

  it('preserves creation time when editing and returns deterministic ID order', async () => {
    await upsertExplicitPreference({ ...input, id: 'z' }, undefined, time);
    await upsertExplicitPreference({ ...input, id: 'A' }, undefined, time);
    const edited = await upsertExplicitPreference({ ...input, id: 'z', relation: 'avoid' }, undefined, later);
    expect(edited.ok).toBe(true);
    if (!edited.ok) throw new Error('Expected edit');
    expect(edited.preference.createdAt).toBe(time);
    expect(edited.preference.updatedAt).toBe(later);
    expect(edited.preference.relation).toBe('avoid');
    expect(edited.preferences.map((item) => item.id)).toEqual(['A', 'z']);
    await resetSettingsToDefaults();
    expect((await loadExplicitPreferencesResult()).status).toBe('ok');
  });

  it('does not lose concurrent independent saves across two database connections', async () => {
    await database.open();
    secondary = createLifeRhythmDatabase(database.name);
    await secondary.open();
    const results = await Promise.all([
      upsertExplicitPreference({ ...input, id: 'a' }, createExplicitPreferenceStore(database), time),
      upsertExplicitPreference({ ...input, id: 'b' }, createExplicitPreferenceStore(secondary), time),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    const loaded = await loadExplicitPreferencesResult();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') throw new Error('Expected both saves');
    expect(loaded.preferences.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('does not resurrect a deleted item when an independent save runs concurrently', async () => {
    await upsertExplicitPreference({ ...input, id: 'a' }, undefined, time);
    await upsertExplicitPreference({ ...input, id: 'b' }, undefined, time);
    const results = await Promise.all([
      deleteExplicitPreference('a', undefined, later),
      upsertExplicitPreference({ ...input, id: 'c' }, undefined, later),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    const loaded = await loadExplicitPreferencesResult();
    if (loaded.status !== 'ok') throw new Error('Expected saved preferences');
    expect(loaded.preferences.map((item) => item.id)).toEqual(['b', 'c']);
  });

  it('rolls back an aborted write without reporting success or replacing prior state', async () => {
    await upsertExplicitPreference(input, undefined, time);
    const before = await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID);
    const base = createExplicitPreferenceStore();
    const failing: ExplicitPreferenceStore = {
      ...base, write: async (record) => { await base.write(record); throw new Error('abort after put'); },
    };
    expect((await upsertExplicitPreference({ ...input, relation: 'avoid' }, failing, later)).ok).toBe(false);
    expect(await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID)).toEqual(before);
  });

  it('rolls back an aborted final deletion', async () => {
    await upsertExplicitPreference(input, undefined, time);
    const before = await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID);
    const base = createExplicitPreferenceStore();
    const failing: ExplicitPreferenceStore = {
      ...base, remove: async () => { await base.remove(); throw new Error('abort after delete'); },
    };
    expect((await deleteExplicitPreference(input.id, failing, later)).ok).toBe(false);
    expect(await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID)).toEqual(before);
  });

  it('distinguishes a missing record from read failure without writing', async () => {
    expect(await loadExplicitPreferencesResult()).toEqual({ status: 'missing', preferences: [] });
    const store = unavailableStore();
    expect((await loadExplicitPreferencesResult(store)).status).toBe('readFailed');
    expect((await upsertExplicitPreference(input, store, time)).ok).toBe(false);
    expect((await deleteExplicitPreference(input.id, store, time)).ok).toBe(false);
    expect((await exportExplicitPreferencesResult(store)).status).toBe('readFailed');
    expect(store.write).not.toHaveBeenCalled();
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('rejects invalid inputs and timestamps before reading or writing', async () => {
    const store = unavailableStore();
    expect((await upsertExplicitPreference({ ...input, end: '07:00' }, store, time)).ok).toBe(false);
    expect((await upsertExplicitPreference(input, store, 'not-a-time')).ok).toBe(false);
    expect((await deleteExplicitPreference(input.id, store, 'not-a-time')).ok).toBe(false);
    expect(store.read).not.toHaveBeenCalled();
    expect(store.write).not.toHaveBeenCalled();
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('rejects backward write time and invalid expiry while retaining saved bytes', async () => {
    await upsertExplicitPreference(input, undefined, time);
    const before = await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID);
    expect((await upsertExplicitPreference(input, undefined, '2026-09-23T08:00:00Z')).ok).toBe(false);
    expect((await deleteExplicitPreference(input.id, undefined, '2026-09-23T08:00:00Z')).ok).toBe(false);
    expect((await upsertExplicitPreference({ ...input, expiresAt: time }, undefined, later)).ok).toBe(false);
    expect(await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID)).toEqual(before);
  });

  it('deletes only the requested preference; missing IDs are no-ops and the final delete removes the sidecar', async () => {
    await resetSettingsToDefaults();
    const primary = await database.settings.get('settings');
    await upsertExplicitPreference({ ...input, id: 'a' }, undefined, time);
    await upsertExplicitPreference({ ...input, id: 'b' }, undefined, time);
    const before = await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID);
    expect(await deleteExplicitPreference('missing', undefined, later)).toMatchObject({ ok: true, removed: false });
    expect(await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID)).toEqual(before);
    expect(await deleteExplicitPreference('a', undefined, later)).toMatchObject({
      ok: true, removed: true, preferences: [expect.objectContaining({ id: 'b' })],
    });
    expect(await deleteExplicitPreference('b', undefined, later)).toEqual({ ok: true, removed: true, preferences: [] });
    expect((await loadExplicitPreferencesResult()).status).toBe('missing');
    expect(await database.settings.get('settings')).toEqual(primary);
  });

  it('exports corrupt sidecar data without trusting it and requires explicit recovery confirmation to delete it', async () => {
    await resetSettingsToDefaults();
    const primary = await database.settings.get('settings');
    const foundation = await database.settings.get('dayProfileFoundation');
    const corrupt = { id: EXPLICIT_PREFERENCES_RECORD_ID, formatVersion: 99, preserved: 'synthetic recovery data' };
    await database.table<typeof corrupt, string>('settings').put(corrupt);
    const sentinel = { id: 'sentinel', preserved: true };
    await database.table<typeof sentinel, string>('taskHistory').put(sentinel);
    expect((await loadExplicitPreferencesResult()).status).toBe('invalid');
    expect((await upsertExplicitPreference(input, undefined, time)).ok).toBe(false);
    expect((await deleteExplicitPreference(input.id, undefined, time)).ok).toBe(false);
    expect(await exportExplicitPreferencesResult()).toEqual({ status: 'ok', rawRecord: corrupt });
    expect((await resetExplicitPreferences('delete')).ok).toBe(false);
    expect(await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID)).toEqual(corrupt);
    expect(await resetExplicitPreferences(DELETE_EXPLICIT_PREFERENCES_CONFIRMATION)).toEqual({
      ok: true, removed: true, preferences: [],
    });
    expect(await database.settings.get('settings')).toEqual(primary);
    expect(await database.settings.get('dayProfileFoundation')).toEqual(foundation);
    expect(await database.table('taskHistory').get('sentinel')).toEqual(sentinel);
    expect(await exportExplicitPreferencesResult()).toEqual({ status: 'missing' });
  });

  it('does not read for unconfirmed bulk deletion', async () => {
    const store = unavailableStore();
    expect((await resetExplicitPreferences('', store)).ok).toBe(false);
    expect(store.read).not.toHaveBeenCalled();
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('isolates namespaces and keeps an explicitly captured store bound to its original database', async () => {
    const original = createExplicitPreferenceStore();
    await upsertExplicitPreference(input, original, time);
    setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate7c-other-${index}`));
    secondary = getCurrentLifeRhythmDatabase();
    expect((await loadExplicitPreferencesResult()).status).toBe('missing');
    expect((await loadExplicitPreferencesResult(original)).status).toBe('ok');
    await secondary.delete();
  });

  it('projects only active explicit facts at the decision instant and never writes during projection', async () => {
    await upsertExplicitPreference(input, undefined, time);
    await upsertExplicitPreference({ ...input, id: 'temporary', expiresAt: later }, undefined, time);
    const loaded = await loadExplicitPreferencesResult();
    if (loaded.status !== 'ok') throw new Error('Expected saved preferences');
    const before = await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID);
    expect(activeExplicitPreferences(loaded.preferences, '2026-09-23T08:59:59Z')).toEqual([]);
    expect(activeExplicitPreferences(loaded.preferences, '2026-09-23T09:59:59.999Z')).toHaveLength(2);
    expect(activeExplicitPreferences(loaded.preferences, '2026-09-23T18:00:00+08:00').map((item) => item.id))
      .toEqual([input.id]);
    expect(explicitPreferencesForScheduler(loaded.preferences, later)).toEqual([{
      ...input, provenance: `Persisted explicit preference ${input.id}; user-declared.`,
    }]);
    expect(() => activeExplicitPreferences(loaded.preferences, 'invalid')).toThrow(RangeError);
    expect(() => explicitPreferencesForScheduler(loaded.preferences, '2026-02-30T00:00:00Z')).toThrow(RangeError);
    expect(await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID)).toEqual(before);
  });

  it('uses equivalent instants for expiry independent of the host timezone', () => {
    const preference = explicitPreferenceSchema.parse({
      ...input, source: 'explicitPersistent', provenance: { actor: 'user', mechanism: 'explicitPreference' },
      createdAt: time, updatedAt: time, expiresAt: later,
    });
    const previous = process.env.TZ;
    try {
      for (const timezone of ['UTC', 'Australia/Perth']) {
        process.env.TZ = timezone;
        expect(activeExplicitPreferences([preference], '2026-09-23T17:59:59+08:00')).toHaveLength(1);
        expect(activeExplicitPreferences([preference], '2026-09-23T18:00:00+08:00')).toEqual([]);
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
