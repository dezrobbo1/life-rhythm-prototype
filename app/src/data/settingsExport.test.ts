import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { exportSettingsBackup, settingsBackupSchema } from './settingsExport';
import { saveSettings, type SettingsStore, type SettingsWriteInput } from './settingsRepository';

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

      expect(Object.keys(backup.payload).sort()).toEqual(['appVersion', 'exportedAt', 'format', 'settings']);
      expect(Object.keys(backup.payload.settings).sort()).toEqual([
        'appVersion',
        'createdAt',
        'id',
        'lifeShape',
        'startBoostSafety',
        'theme',
        'updatedAt',
      ]);
      expect(backup.payload.settings.theme).toBe('clear');
      expect(backup.payload.settings.startBoostSafety.avoidFoodRewards).toBe(true);
      expect(backup.payload.settings.lifeShape.commuteMinutes).toBe(25);
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
    } finally {
      await database.delete();
    }
  });

  it('exports safe defaults when stored settings are invalid', async () => {
    const database = createTestDatabase();

    try {
      await database.settings.put({
        appVersion: '1.4.6',
        createdAt: '2026-06-16T00:00:00.000Z',
        id: 'settings',
        theme: 'warm-cream',
        updatedAt: '2026-06-16T00:00:00.000Z',
      } as never);

      const backup = await exportSettingsBackup(database, '2026-06-16T00:00:00.000Z');

      expect(backup.payload.settings.theme).toBe('exhale');
      expect(backup.payload.settings.lifeShape.lowCapacityPreference).toBe('protect-evening');
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
});
