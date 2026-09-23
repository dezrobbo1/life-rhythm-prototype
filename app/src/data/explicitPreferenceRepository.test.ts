import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { loadSettingsResult, resetSettingsToDefaults } from './settingsRepository';
import {
  activeExplicitPreferences,
  deleteExplicitPreference,
  explicitPreferencesForScheduler,
  loadExplicitPreferencesResult,
  upsertExplicitPreference,
} from './explicitPreferenceRepository';
import {
  EXPLICIT_PREFERENCES_RECORD_ID,
  explicitPreferenceStoreRecordSchema,
  explicitPreferenceWriteInputSchema,
} from './explicitPreferenceSchema';

let namespaceIndex = 0;

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`gate7c-preferences-${namespaceIndex}`),
  );
});

describe('Gate 7C explicit preference persistence', () => {
  it('persists strict user-declared preferences in a rollback-ignored settings sidecar', async () => {
    await resetSettingsToDefaults();

    const saved = await upsertExplicitPreference(
      {
        id: 'admin-weekend-morning',
        targetKind: 'area',
        targetValue: 'admin',
        relation: 'prefer',
        days: ['Saturday', 'Sunday'],
        start: '08:00',
        end: '12:00',
      },
      undefined,
      '2026-09-23T09:00:00.000Z',
    );

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.preference).toMatchObject({
      id: 'admin-weekend-morning',
      source: 'explicitPersistent',
      provenance: {
        actor: 'user',
        mechanism: 'explicitPreference',
      },
    });

    const loaded = await loadExplicitPreferencesResult();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record.id).toBe(EXPLICIT_PREFERENCES_RECORD_ID);
    expect(loaded.record.formatVersion).toBe(1);
    expect(loaded.preferences.map((preference) => preference.id)).toEqual([
      'admin-weekend-morning',
    ]);

    const settings = await loadSettingsResult();
    expect(settings.status).toBe('loaded');
    expect(settings.settings.id).toBe('settings');

    const database = getCurrentLifeRhythmDatabase();
    expect(await database.settings.get('settings')).toBeDefined();
    expect(await database.settings.get('dayProfileFoundation')).toBeDefined();
    expect(await database.settings.get(EXPLICIT_PREFERENCES_RECORD_ID)).toBeDefined();
  });

  it('updates an existing preference without changing its original creation time', async () => {
    const first = await upsertExplicitPreference(
      {
        id: 'work-window',
        targetKind: 'taskType',
        targetValue: 'work',
        relation: 'prefer',
        days: ['Monday'],
        start: '09:00',
        end: '11:00',
      },
      undefined,
      '2026-09-23T09:00:00.000Z',
    );
    expect(first.ok).toBe(true);

    const second = await upsertExplicitPreference(
      {
        id: 'work-window',
        targetKind: 'taskType',
        targetValue: 'work',
        relation: 'avoid',
        days: ['Monday'],
        start: '17:00',
        end: '20:00',
      },
      undefined,
      '2026-09-23T10:00:00.000Z',
    );

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.preference.createdAt).toBe('2026-09-23T09:00:00.000Z');
    expect(second.preference.updatedAt).toBe('2026-09-23T10:00:00.000Z');
    expect(second.preference.relation).toBe('avoid');
  });

  it('rejects malformed target and time-window data before persistence', async () => {
    expect(
      explicitPreferenceWriteInputSchema.safeParse({
        id: 'bad-area',
        targetKind: 'area',
        targetValue: 'not-an-area',
        relation: 'prefer',
      }).success,
    ).toBe(false);

    expect(
      explicitPreferenceWriteInputSchema.safeParse({
        id: 'half-window',
        targetKind: 'area',
        targetValue: 'admin',
        relation: 'avoid',
        start: '18:00',
      }).success,
    ).toBe(false);

    expect(
      explicitPreferenceWriteInputSchema.safeParse({
        id: 'backwards-window',
        targetKind: 'area',
        targetValue: 'admin',
        relation: 'avoid',
        start: '20:00',
        end: '18:00',
      }).success,
    ).toBe(false);

    expect((await loadExplicitPreferencesResult()).status).toBe('missing');
  });

  it('does not overwrite an unreadable preference record', async () => {
    const put = vi.fn();
    const store = {
      settings: {
        get: vi.fn().mockResolvedValue({
          id: EXPLICIT_PREFERENCES_RECORD_ID,
          recordType: 'explicitPreferenceStore',
          formatVersion: 1,
        }),
        put,
        delete: vi.fn(),
      },
    };

    const result = await upsertExplicitPreference(
      {
        id: 'safe-write',
        targetKind: 'area',
        targetValue: 'admin',
        relation: 'prefer',
      },
      store as never,
      '2026-09-23T09:00:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(put).not.toHaveBeenCalled();
  });

  it('deletes only the requested preference and removes the sidecar when empty', async () => {
    await upsertExplicitPreference(
      {
        id: 'a',
        targetKind: 'area',
        targetValue: 'admin',
        relation: 'prefer',
      },
      undefined,
      '2026-09-23T09:00:00.000Z',
    );
    await upsertExplicitPreference(
      {
        id: 'b',
        targetKind: 'area',
        targetValue: 'work',
        relation: 'avoid',
      },
      undefined,
      '2026-09-23T09:01:00.000Z',
    );

    const firstDelete = await deleteExplicitPreference(
      'a',
      undefined,
      '2026-09-23T09:02:00.000Z',
    );
    expect(firstDelete).toMatchObject({
      ok: true,
      removed: true,
      preferences: [expect.objectContaining({ id: 'b' })],
    });

    const finalDelete = await deleteExplicitPreference(
      'b',
      undefined,
      '2026-09-23T09:03:00.000Z',
    );
    expect(finalDelete).toEqual({
      ok: true,
      removed: true,
      preferences: [],
    });
    expect((await loadExplicitPreferencesResult()).status).toBe('missing');
  });

  it('filters expired preferences and adapts only active explicit facts to scheduler input', async () => {
    const active = await upsertExplicitPreference(
      {
        id: 'active',
        targetKind: 'area',
        targetValue: 'admin',
        relation: 'prefer',
        days: ['Saturday'],
        start: '08:00',
        end: '12:00',
      },
      undefined,
      '2026-09-23T09:00:00.000Z',
    );
    expect(active.ok).toBe(true);

    const expired = await upsertExplicitPreference(
      {
        id: 'expired',
        targetKind: 'taskType',
        targetValue: 'work',
        relation: 'avoid',
        expiresAt: '2026-09-23T09:30:00.000Z',
      },
      undefined,
      '2026-09-23T09:01:00.000Z',
    );
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;

    expect(
      activeExplicitPreferences(
        expired.preferences,
        '2026-09-23T10:00:00.000Z',
      ).map((preference) => preference.id),
    ).toEqual(['active']);

    expect(
      explicitPreferencesForScheduler(
        expired.preferences,
        '2026-09-23T10:00:00.000Z',
      ),
    ).toEqual([
      {
        id: 'active',
        targetKind: 'area',
        targetValue: 'admin',
        relation: 'prefer',
        days: ['Saturday'],
        start: '08:00',
        end: '12:00',
        provenance: 'Persisted explicit preference active; user-declared.',
      },
    ]);
  });

  it('rejects duplicate IDs in the persisted sidecar contract', () => {
    const preference = {
      id: 'duplicate',
      targetKind: 'area' as const,
      targetValue: 'admin',
      relation: 'prefer' as const,
      days: [],
      source: 'explicitPersistent' as const,
      provenance: {
        actor: 'user' as const,
        mechanism: 'explicitPreference' as const,
      },
      createdAt: '2026-09-23T09:00:00.000Z',
      updatedAt: '2026-09-23T09:00:00.000Z',
    };

    expect(
      explicitPreferenceStoreRecordSchema.safeParse({
        id: EXPLICIT_PREFERENCES_RECORD_ID,
        recordType: 'explicitPreferenceStore',
        formatVersion: 1,
        appVersion: '1.4.6',
        createdAt: '2026-09-23T09:00:00.000Z',
        updatedAt: '2026-09-23T09:00:00.000Z',
        preferences: [preference, preference],
      }).success,
    ).toBe(false);
  });
});
