import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import type { SettingsStore, SettingsWriteInput } from './settingsRepository';
import {
  SETTINGS_ID,
  createDefaultSettings,
  loadSettings,
  resetSettingsToDefaults,
  saveSettings,
} from './settingsRepository';
import { activeTaskSchema, type Settings } from './schemas';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-settings-test-${testDatabaseIndex}`);
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
      timeBlocks: [
        {
          days: ['Monday', 'Wednesday'],
          end: '12:00',
          id: 'protected-writing',
          label: 'Protected writing space',
          start: '10:00',
          type: 'protectedTime',
        },
      ],
      usualWorkHours: {
        start: '09:00',
        end: '17:00',
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

function createFakeStore(initialSettings?: unknown) {
  let storedSettings = initialSettings;
  const put = vi.fn(async (settings: Settings) => {
    storedSettings = settings;
    return settings.id;
  });
  const get = vi.fn(async (id: string) => (id === SETTINGS_ID ? storedSettings : undefined));

  return {
    get,
    getStoredSettings: () => storedSettings as Settings | undefined,
    put,
    store: {
      settings: {
        get,
        put,
      },
    } as unknown as SettingsStore,
  };
}

describe('settings repository', () => {
  it('saves and reloads settings through the Dexie settings table', async () => {
    const database = createTestDatabase();

    try {
      await saveSettings(validInput({ theme: 'grounded' }), database);
      const loaded = await loadSettings(database);

      expect(loaded.theme).toBe('grounded');
      expect(loaded.startBoostSafety.avoidFoodRewards).toBe(true);
      expect(loaded.lifeShape.commuteMinutes).toBe(25);
      expect(await database.settings.count()).toBe(1);
      expect(await database.activeTasks.count()).toBe(0);
      expect(await database.rhythmTemplates.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('loads safe defaults when settings are missing', async () => {
    const fake = createFakeStore();
    const settings = await loadSettings(fake.store);

    expect(settings.id).toBe(SETTINGS_ID);
    expect(settings.theme).toBe('exhale');
    expect(settings.lifeShape.transitionBufferMinutes).toBe(10);
  });

  it('saves and reloads theme settings', async () => {
    const fake = createFakeStore();
    const saveResult = await saveSettings(validInput({ theme: 'grounded' }), fake.store);
    const loaded = await loadSettings(fake.store);

    expect(saveResult.ok).toBe(true);
    expect(loaded.theme).toBe('grounded');
  });

  it('saves and reloads Start Boost safety settings', async () => {
    const fake = createFakeStore();
    await saveSettings(validInput(), fake.store);
    const loaded = await loadSettings(fake.store);

    expect(loaded.startBoostSafety.avoidFoodRewards).toBe(true);
    expect(loaded.startBoostSafety.avoidAccountabilityPrompts).toBe(true);
    expect(loaded.startBoostSafety.avoidUrgencyCountdowns).toBe(true);
  });

  it('saves and reloads validated Life Shape settings', async () => {
    const fake = createFakeStore();
    await saveSettings(validInput(), fake.store);
    const loaded = await loadSettings(fake.store);

    expect(loaded.lifeShape.commuteMinutes).toBe(25);
    expect(loaded.lifeShape.travelMinutes).toBe(25);
    expect(loaded.lifeShape.transitionBufferMinutes).toBe(20);
    expect(loaded.lifeShape.fixedCommitments[0].label).toBe('School run');
    expect(loaded.lifeShape.lowCapacityPreference).toBe('minimum-first');
    expect(loaded.lifeShape.timeBlocks[0]).toMatchObject({
      id: 'protected-writing',
      schedulerUse: 'unavailable',
      type: 'protectedTime',
    });
  });

  it('does not save invalid work hours', async () => {
    const existing = createDefaultSettings();
    const fake = createFakeStore(existing);
    const result = await saveSettings(
      validInput({
        lifeShape: {
          ...(validInput().lifeShape as Record<string, unknown>),
          usualWorkHours: {
            start: '18:00',
            end: '09:00',
          },
        },
        theme: 'clear',
      }),
      fake.store,
    );

    expect(result.ok).toBe(false);
    expect(fake.getStoredSettings()?.theme).toBe(existing.theme);
    expect(fake.put).not.toHaveBeenCalled();
  });

  it('does not save invalid travel or buffer values', async () => {
    const existing = createDefaultSettings();
    const fake = createFakeStore(existing);
    const result = await saveSettings(
      validInput({
        lifeShape: {
          ...(validInput().lifeShape as Record<string, unknown>),
          commuteMinutes: -1,
          transitionBufferMinutes: 181,
          travelMinutes: 481,
        },
        theme: 'clear',
      }),
      fake.store,
    );

    expect(result.ok).toBe(false);
    expect(fake.getStoredSettings()?.theme).toBe(existing.theme);
    expect(fake.put).not.toHaveBeenCalled();
  });

  it('does not save invalid Life Shape time blocks', async () => {
    const existing = createDefaultSettings();
    const fake = createFakeStore(existing);
    const result = await saveSettings(
      validInput({
        lifeShape: {
          ...(validInput().lifeShape as Record<string, unknown>),
          timeBlocks: [
            {
              days: ['Monday'],
              end: '09:00',
              id: 'invalid-range',
              label: 'Invalid range',
              start: '10:00',
              type: 'protectedTime',
            },
          ],
        },
        theme: 'clear',
      }),
      fake.store,
    );

    expect(result.ok).toBe(false);
    expect(fake.getStoredSettings()?.theme).toBe(existing.theme);
    expect(fake.put).not.toHaveBeenCalled();
  });

  it('resets only the settings row to defaults', async () => {
    const fake = createFakeStore();
    await saveSettings(validInput({ theme: 'clear' }), fake.store);

    const resetSettings = await resetSettingsToDefaults(fake.store);

    expect(resetSettings.theme).toBe('exhale');
    expect(resetSettings.lifeShape.timeBlocks).toEqual([]);
    expect(fake.getStoredSettings()?.theme).toBe('exhale');
    expect(fake.put).toHaveBeenCalledTimes(2);
  });

  it('resets only the Dexie settings table row to defaults', async () => {
    const database = createTestDatabase();

    try {
      await database.activeTasks.put(activeTaskSchema.parse({
        area: 'house',
        createdAt: '2026-06-15T00:00:00.000Z',
        full: {
          label: 'Finish the task',
          minutes: 15,
        },
        id: 'existing-task',
        minimum: {
          label: 'Open the task',
          minutes: 2,
        },
        normal: {
          label: 'Do the next part',
          minutes: 8,
        },
        showToday: true,
        source: 'adhoc',
        status: 'active',
        title: 'Existing task',
        updatedAt: '2026-06-15T00:00:00.000Z',
      }));
      await saveSettings(validInput({ theme: 'clear' }), database);

      const resetSettings = await resetSettingsToDefaults(database);

      expect(resetSettings.theme).toBe('exhale');
      expect(await database.settings.count()).toBe(1);
      expect(await database.activeTasks.count()).toBe(1);
      expect(await database.rhythmTemplates.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('does not write task or rhythm tables', async () => {
    const base = createFakeStore();
    const taskPut = vi.fn();
    const rhythmPut = vi.fn();
    const store = {
      ...base.store,
      activeTasks: { put: taskPut },
      rhythmTemplates: { put: rhythmPut },
    } as unknown as SettingsStore;

    await saveSettings(validInput(), store);

    expect(taskPut).not.toHaveBeenCalled();
    expect(rhythmPut).not.toHaveBeenCalled();
  });
});
