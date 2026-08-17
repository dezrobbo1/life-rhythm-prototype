import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { exportSettingsBackup, settingsBackupSchema } from './settingsExport';
import { validateSettingsBackupImport } from './settingsImportValidation';
import {
  createDefaultSettings,
  saveSettings,
  SETTINGS_APP_VERSION,
  type SettingsStore,
  type SettingsWriteInput,
} from './settingsRepository';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-settings-export-test-${testDatabaseIndex}`);
}

function validInput(overrides: Partial<SettingsWriteInput> = {}): SettingsWriteInput {
  return {
    lifeShape: {
      commuteMinutes: 25,
      fixedCommitments: [
        {
          id: 'school-run',
          label: 'School run',
        },
      ],
      lowCapacityPreference: 'minimum-first',
      mealAnchors: {
        breakfast: '07:30',
        dinner: '18:30',
        lunch: '12:30',
      },
      sleepWakeAnchors: {
        sleep: '22:00',
        wake: '06:30',
      },
      transitionBufferMinutes: 20,
      travelMinutes: 25,
      usualWorkHours: {
        end: '17:00',
        start: '09:00',
      },
    },
    startBoostSafety: {
      avoidAccountabilityPrompts: true,
      avoidFoodRewards: true,
      avoidScrollingRewards: true,
      avoidShoppingRewards: true,
      avoidStreakPressure: true,
      avoidUrgencyCountdowns: true,
    },
    theme: 'clear',
    ...overrides,
  };
}

describe('settings export backup', () => {
  it('exports only approved settings fields', async () => {
    const database = createTestDatabase();

    try {
      await saveSettings(validInput(), database);
      const backup = await exportSettingsBackup(database, '2026-06-16T00:00:00.000Z');

      expect(Object.keys(backup.payload).sort()).toEqual([
        'appVersion',
        'exportedAt',
        'format',
        'formatVersion',
        'settings',
      ]);
      expect(Object.keys(backup.payload.settings).sort()).toEqual([
        'appVersion',
        'createdAt',
        'dayProfileMigrationState',
        'dayProfiles',
        'id',
        'lifeShape',
        'startBoostSafety',
        'theme',
        'updatedAt',
        'weekdayProfileAssignments',
      ]);
      expect(backup.payload.formatVersion).toBe(2);
      expect(backup.payload.settings.theme).toBe('clear');
      expect(backup.payload.settings.startBoostSafety.avoidFoodRewards).toBe(true);
      expect(backup.payload.settings.lifeShape.commuteMinutes).toBe(25);
      expect(backup.payload.settings.dayProfiles).toHaveLength(2);
      expect(backup.payload.settings.weekdayProfileAssignments).toHaveLength(7);
      expect(backup.payload.settings.dayProfileMigrationState.reviewState).toBe('notStarted');
      expect(backup.fileName).toBe('life-rhythm-settings-backup-2026-06-16.json');
    } finally {
      await database.delete();
    }
  });

  it('exports safe defaults when settings are missing', async () => {
    const database = createTestDatabase();

    try {
      const backup = await exportSettingsBackup(database, '2026-06-16T00:00:00.000Z');

      expect(backup.payload.settings.theme).toBe('exhale');
      expect(backup.payload.settings.lifeShape.transitionBufferMinutes).toBe(10);
      expect(backup.payload.settings.startBoostSafety.avoidScrollingRewards).toBe(true);
      expect(backup.payload.settings.dayProfiles.every((profile) => profile.usableDay === undefined)).toBe(true);
    } finally {
      await database.delete();
    }
  });

  it('fails visibly instead of exporting defaults when stored settings are invalid', async () => {
    const database = createTestDatabase();

    try {
      await database.settings.put({
        appVersion: '1.4.6',
        createdAt: '2026-06-16T00:00:00.000Z',
        id: 'settings',
        theme: 'warm-cream',
        updatedAt: '2026-06-16T00:00:00.000Z',
      } as never);

      await expect(
        exportSettingsBackup(database, '2026-06-16T00:00:00.000Z'),
      ).rejects.toThrow('Settings backup could not be created');
      expect(await database.settings.get('settings')).toMatchObject({ theme: 'warm-cream' });
    } finally {
      await database.delete();
    }
  });

  it('serializes a payload that parses through settings backup validation', async () => {
    const database = createTestDatabase();

    try {
      await saveSettings(validInput({ theme: 'grounded' }), database);
      const backup = await exportSettingsBackup(database, '2026-06-16T00:00:00.000Z');

      expect(settingsBackupSchema.parse(JSON.parse(backup.json))).toEqual(backup.payload);
    } finally {
      await database.delete();
    }
  });

  it('exports saved Life Shape time blocks as settings-only data', async () => {
    const database = createTestDatabase();

    try {
      await saveSettings(validInput({
        lifeShape: {
          ...(validInput().lifeShape as Record<string, unknown>),
          timeBlocks: [
            {
              days: ['Monday'],
              end: '12:00',
              id: 'protected-writing',
              label: 'Protected writing space',
              start: '10:00',
              type: 'protectedTime',
            },
          ],
        },
      }), database);
      const backup = await exportSettingsBackup(database, '2026-06-16T00:00:00.000Z');

      expect(backup.payload.settings.lifeShape.timeBlocks).toEqual([
        expect.objectContaining({
          id: 'protected-writing',
          schedulerUse: 'unavailable',
          type: 'protectedTime',
        }),
      ]);
      expect(backup.json).not.toMatch(/schedulerOutput|activeTasks|rhythmTemplates|lifeRhythm_v146/i);
    } finally {
      await database.delete();
    }
  });

  it('does not include app data, root legacy data, or future module data', async () => {
    const database = createTestDatabase();

    try {
      await saveSettings(validInput(), database);
      const backup = await exportSettingsBackup(database, '2026-06-16T00:00:00.000Z');

      expect(backup.json).not.toMatch(/activeTasks|rhythmTemplates|oneOff|libraryEnablement|quickPacks/i);
      expect(backup.json).not.toMatch(/scheduler|resetLog|devTickets|futureModules|migrationLog|import/i);
      expect(backup.json).not.toContain('lifeRhythm_v146');
    } finally {
      await database.delete();
    }
  });

  it('does not read or write localStorage', async () => {
    const database = createTestDatabase();
    const getItem = vi.fn(() => {
      throw new Error('localStorage must not be read');
    });
    const setItem = vi.fn(() => {
      throw new Error('localStorage must not be written');
    });

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem,
        setItem,
      },
    });

    try {
      await exportSettingsBackup(database, '2026-06-16T00:00:00.000Z');

      expect(getItem).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      await database.delete();
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('does not write Dexie tables while exporting', async () => {
    const get = vi.fn(async () => undefined);
    const put = vi.fn();
    const store = {
      settings: {
        get,
        put,
      },
    } as unknown as SettingsStore;

    await exportSettingsBackup(store, '2026-06-16T00:00:00.000Z');

    expect(get).toHaveBeenCalledWith('settings');
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps a migrated non-semantic settings row immediately backupable without persisting migration', async () => {
    const current = createDefaultSettings('2026-06-15T00:00:00.000Z');
    const legacySettings = {
      appVersion: 'dev',
      bedTime: current.lifeShape.sleepWakeAnchors.sleep,
      breakfastTime: current.lifeShape.mealAnchors.breakfast,
      createdAt: current.createdAt,
      dinnerTime: current.lifeShape.mealAnchors.dinner,
      id: current.id,
      lifeShape: {
        ...current.lifeShape,
        usualWorkHours: {
          days: ['Tuesday', 'Thursday'],
          end: '18:00',
          start: '10:00',
        },
      },
      lunchTime: current.lifeShape.mealAnchors.lunch,
      startBoostSafety: current.startBoostSafety,
      theme: current.theme,
      updatedAt: current.updatedAt,
      wakeTime: current.lifeShape.sleepWakeAnchors.wake,
      workDays: ['Tuesday', 'Thursday'],
      workEnd: '18:00',
      workStart: '10:00',
    };
    const storedBeforeExport = structuredClone(legacySettings);
    let stored: unknown = legacySettings;
    const put = vi.fn(async (settings: unknown) => {
      stored = settings;
    });
    const store = {
      settings: {
        get: vi.fn(async () => stored),
        put,
      },
    } as unknown as SettingsStore;

    const backup = await exportSettingsBackup(store, '2026-06-16T00:00:00.000Z');
    const validation = validateSettingsBackupImport(backup.payload);

    expect(backup.payload.formatVersion).toBe(2);
    expect(backup.payload.appVersion).toBe(SETTINGS_APP_VERSION);
    expect(backup.payload.settings.appVersion).toBe(SETTINGS_APP_VERSION);
    expect(
      backup.payload.settings.dayProfileMigrationState.sourceSettingsVersion,
    ).toBe('dev');
    expect(backup.payload.settings.dayProfileMigrationState.reviewState).toBe('needsReview');
    expect(backup.payload.settings.dayProfiles[0].workPeriod).toEqual({
      end: '18:00',
      start: '10:00',
    });
    expect(validation.ok).toBe(true);
    expect(put).not.toHaveBeenCalled();
    expect(stored).toStrictEqual(storedBeforeExport);
    expect(legacySettings).toStrictEqual(storedBeforeExport);
  });

  it('projects only approved profile fields and remains import-compatible', async () => {
    const current = createDefaultSettings('2026-06-15T00:00:00.000Z');
    const futureAware = {
      ...current,
      dayProfiles: current.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? {
              ...profile,
              futureProfileContext: { mode: 'preserve-in-settings-only' },
            }
          : profile,
      ),
    };
    const store = {
      settings: {
        get: vi.fn(async () => futureAware),
        put: vi.fn(),
      },
    } as unknown as SettingsStore;

    const backup = await exportSettingsBackup(store, '2026-06-16T00:00:00.000Z');
    const validation = validateSettingsBackupImport(backup.payload);

    expect(backup.json).not.toContain('futureProfileContext');
    expect(validation.ok).toBe(true);
    expect(store.settings.put).not.toHaveBeenCalled();
  });

  it('refuses to export a row hiding another data class inside a day profile', async () => {
    const current = createDefaultSettings('2026-06-15T00:00:00.000Z');
    const smuggled = {
      ...current,
      dayProfiles: current.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? {
              ...profile,
              activeTasks: [{ id: 'must-not-export' }],
            }
          : profile,
      ),
    };
    const put = vi.fn();
    const store = {
      settings: {
        get: vi.fn(async () => smuggled),
        put,
      },
    } as unknown as SettingsStore;

    await expect(exportSettingsBackup(store, '2026-06-16T00:00:00.000Z')).rejects.toThrow(
      /dayProfiles\.0\.activeTasks/,
    );
    expect(put).not.toHaveBeenCalled();
  });
});
