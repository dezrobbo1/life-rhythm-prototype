import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import type { SettingsStore, SettingsWriteInput } from './settingsRepository';
import {
  DAY_PROFILE_FOUNDATION_ID,
  SETTINGS_ID,
  createDefaultSettings,
  loadSettings,
  loadSettingsResult,
  resetSettingsToDefaults,
  saveSettings,
} from './settingsRepository';
import {
  NON_WORKDAY_PROFILE_ID,
  WORKDAY_PROFILE_ID,
  activeTaskSchema,
  legacySettingsSchema,
  type Settings,
} from './schemas';

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

function createFakeStore(initialSettings?: unknown, options: { failPut?: boolean } = {}) {
  const rows = new Map<string, unknown>();

  if (initialSettings !== undefined) {
    rows.set(SETTINGS_ID, initialSettings);
  }

  const put = vi.fn(async (record: Settings) => {
    if (options.failPut) {
      throw new Error('put failed');
    }

    rows.set(record.id, record);
    return record.id;
  });
  const get = vi.fn(async (id: string) => rows.get(id));

  return {
    get,
    getRawSettings: () => rows.get(SETTINGS_ID),
    getStoredFoundation: () => rows.get(DAY_PROFILE_FOUNDATION_ID) as Record<string, unknown> | undefined,
    getStoredSettings: () => rows.get(SETTINGS_ID) as Settings | undefined,
    put,
    rowIds: () => [...rows.keys()].sort(),
    store: {
      settings: {
        get,
        put,
      },
    } as unknown as SettingsStore,
  };
}

/** Seeds the rollback-readable split shape: a legacy-shaped settings row plus its foundation record. */
function createSplitFakeStore(settings: Settings = createDefaultSettings()) {
  const fake = createFakeStore(withoutDayProfileFoundation(settings));

  fake.put({
    appVersion: settings.appVersion,
    dayProfileMigrationState: settings.dayProfileMigrationState,
    dayProfiles: settings.dayProfiles,
    id: DAY_PROFILE_FOUNDATION_ID,
    updatedAt: settings.updatedAt,
    weekdayProfileAssignments: settings.weekdayProfileAssignments,
  } as unknown as Settings);
  fake.put.mockClear();

  return fake;
}

function withoutDayProfileFoundation(settings: Settings = createDefaultSettings()) {
  const {
    dayProfileMigrationState: _migrationState,
    dayProfiles: _dayProfiles,
    weekdayProfileAssignments: _assignments,
    ...legacy
  } = settings;

  return legacy;
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
      expect(await database.settings.count()).toBe(2);
      expect(await database.activeTasks.count()).toBe(0);
      expect(await database.rhythmTemplates.count()).toBe(0);

      // The settings row keeps the shape the previous version validates, so a
      // rollback still reads real settings instead of falling back to defaults.
      const storedRow = (await database.settings.get(SETTINGS_ID)) as Record<string, unknown>;

      expect(legacySettingsSchema.safeParse(storedRow).success).toBe(true);
      expect(Object.keys(storedRow)).not.toContain('dayProfiles');
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
    expect(settings.dayProfiles.map((profile) => profile.id)).toEqual([
      WORKDAY_PROFILE_ID,
      NON_WORKDAY_PROFILE_ID,
    ]);
    expect(settings.weekdayProfileAssignments).toHaveLength(7);
    expect(settings.dayProfileMigrationState.reviewState).toBe('notStarted');
    expect(settings.dayProfiles.every((profile) => profile.usableDay === undefined)).toBe(true);
    expect(fake.put).not.toHaveBeenCalled();
  });

  it('migrates and persists legacy settings without resetting existing values', async () => {
    const current = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const legacy = withoutDayProfileFoundation({
      ...current,
      appVersion: 'dev',
      lifeShape: {
        ...current.lifeShape,
        commuteMinutes: 30,
        fixedCommitments: [
          {
            bufferMinutes: 5,
            days: ['Tuesday'],
            id: 'appointment',
            label: 'Appointment',
            travelMinutes: 10,
          },
        ],
        mealAnchors: {
          breakfast: '07:20',
          dinner: '18:40',
          lunch: '12:20',
        },
        timeBlocks: [
          {
            days: ['Thursday'],
            end: '15:00',
            id: 'open-thursday',
            label: 'Open Thursday',
            schedulerUse: 'available',
            start: '14:00',
            type: 'openCapacity',
          },
        ],
        usualWorkHours: {
          days: ['Tuesday', 'Thursday', 'Saturday'],
          end: '18:00',
          start: '10:00',
        },
      },
      theme: 'grounded',
    });
    const fake = createFakeStore(legacy);
    const result = await loadSettingsResult(fake.store);

    expect(result.status).toBe('migrated');
    expect(result.migrationPersisted).toBe(true);
    expect(result.settings.theme).toBe('grounded');
    expect(result.settings.lifeShape.fixedCommitments).toEqual(legacy.lifeShape.fixedCommitments);
    expect(result.settings.lifeShape.timeBlocks).toEqual(legacy.lifeShape.timeBlocks);
    expect(result.settings.dayProfileMigrationState.reviewState).toBe('needsReview');
    expect(result.settings.appVersion).toBe('dev');
    expect(result.settings.dayProfileMigrationState.sourceSettingsVersion).toBe(legacy.appVersion);
    expect(result.settings.dayProfiles[0].workPeriod).toEqual({ end: '18:00', start: '10:00' });
    expect(
      result.settings.weekdayProfileAssignments
        .filter((assignment) => assignment.profileId === WORKDAY_PROFILE_ID)
        .map((assignment) => assignment.weekday),
    ).toEqual(['Tuesday', 'Thursday', 'Saturday']);
    expect(fake.put).toHaveBeenCalledTimes(1);
    expect(fake.rowIds()).toEqual([DAY_PROFILE_FOUNDATION_ID, SETTINGS_ID]);
    expect(fake.getRawSettings()).toEqual(legacy);
    expect(legacySettingsSchema.safeParse(fake.getRawSettings()).success).toBe(true);
    expect(fake.getStoredFoundation()).toMatchObject({
      dayProfileMigrationState: result.settings.dayProfileMigrationState,
      dayProfiles: result.settings.dayProfiles,
      id: DAY_PROFILE_FOUNDATION_ID,
      weekdayProfileAssignments: result.settings.weekdayProfileAssignments,
    });

    const repeated = await loadSettingsResult(fake.store);

    expect(repeated.status).toBe('loaded');
    expect(repeated.settings).toEqual(result.settings);
    expect(fake.put).toHaveBeenCalledTimes(1);
  });

  it('returns a validated migrated representation without replacing the row when migration persistence fails', async () => {
    const legacy = withoutDayProfileFoundation(createDefaultSettings('2026-08-12T00:00:00.000Z'));
    const fake = createFakeStore(legacy, { failPut: true });
    const result = await loadSettingsResult(fake.store);

    expect(result.status).toBe('migrationPersistenceFailed');
    expect(result.migrationPersisted).toBe(false);
    expect(result.settings.dayProfileMigrationState.reviewState).toBe('needsReview');
    expect(result.errors.join(' ')).toContain('original row was left unchanged');
    expect(fake.getRawSettings()).toEqual(legacy);
    expect(fake.put).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite malformed profile-aware settings during load or a later save', async () => {
    const current = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const malformed = {
      ...current,
      weekdayProfileAssignments: current.weekdayProfileAssignments.map((assignment) =>
        assignment.weekday === 'Monday'
          ? { ...assignment, profileId: 'missing-profile' }
          : assignment,
      ),
    };
    const fake = createFakeStore(malformed);
    const loaded = await loadSettingsResult(fake.store);
    const saveResult = await saveSettings(validInput({ theme: 'grounded' }), fake.store);

    expect(loaded.status).toBe('invalid');
    expect(loaded.errors.join(' ')).toContain('existing day profile');
    expect(saveResult.ok).toBe(false);
    expect(fake.put).not.toHaveBeenCalled();
    expect(fake.getRawSettings()).toEqual(malformed);
  });

  it('rejects malformed migration compatibility state without default repair', async () => {
    const current = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const malformed = {
      ...current,
      dayProfileMigrationState: {
        ...current.dayProfileMigrationState,
        legacyMealAnchors: {},
        reviewedAt: 'tomorrow',
      },
    };
    const fake = createFakeStore(malformed);
    const loaded = await loadSettingsResult(fake.store);

    expect(loaded.status).toBe('invalid');
    expect(loaded.errors.join(' ')).toContain('dayProfileMigrationState.legacyMealAnchors.breakfast');
    expect(loaded.errors.join(' ')).toContain('dayProfileMigrationState.reviewedAt');
    expect(fake.getRawSettings()).toEqual(malformed);
    expect(fake.put).not.toHaveBeenCalled();
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

  it('preserves hidden profile fields during current Setup and theme saves', async () => {
    const current = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const profileAware = {
      ...current,
      dayProfileMigrationState: {
        ...current.dayProfileMigrationState,
        legacyMealAnchors: {
          breakfast: '06:50',
          dinner: '19:10',
          lunch: '12:10',
        },
        reviewState: 'needsReview' as const,
      },
      dayProfiles: current.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? {
              ...profile,
              name: 'My workday',
              workPeriod: {
                end: '18:30',
                start: '10:30',
              },
              workPlanningUse: 'askFirst' as const,
            }
          : profile,
      ),
      weekdayProfileAssignments: current.weekdayProfileAssignments.map((assignment) =>
        assignment.weekday === 'Friday'
          ? { ...assignment, profileId: NON_WORKDAY_PROFILE_ID }
          : assignment,
      ),
    };
    const fake = createFakeStore(profileAware);
    const result = await saveSettings(
      validInput({
        lifeShape: {
          ...(validInput().lifeShape as Record<string, unknown>),
          mealAnchors: {
            breakfast: '08:00',
            dinner: '20:00',
            lunch: '13:00',
          },
          usualWorkHours: {
            days: ['Monday', 'Tuesday', 'Wednesday'],
            end: '15:00',
            start: '07:00',
          },
        },
        theme: 'grounded',
      }),
      fake.store,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.theme).toBe('grounded');
    expect(result.settings.lifeShape.usualWorkHours).toEqual({
      days: ['Monday', 'Tuesday', 'Wednesday'],
      end: '15:00',
      start: '07:00',
    });
    expect(result.settings.dayProfiles).toEqual(profileAware.dayProfiles);
    expect(result.settings.weekdayProfileAssignments).toEqual(profileAware.weekdayProfileAssignments);
    expect(result.settings.dayProfileMigrationState).toEqual(profileAware.dayProfileMigrationState);
    expect(result.settings.dayProfiles[0].workPeriod).toEqual({ end: '18:30', start: '10:30' });
    expect(result.settings.dayProfileMigrationState.legacyMealAnchors.breakfast).toBe('06:50');
    expect(result.settings.dayProfiles.some((profile) => 'mealWindows' in profile)).toBe(false);
  });

  it('keeps the stored settings row readable by the previous application version', async () => {
    const legacy = withoutDayProfileFoundation(createDefaultSettings('2026-08-12T00:00:00.000Z'));
    const fake = createFakeStore({ ...legacy, theme: 'grounded', workStart: '09:30' });

    await loadSettingsResult(fake.store);
    await saveSettings(validInput({ theme: 'clear' }), fake.store);

    const storedRow = fake.getRawSettings() as Record<string, unknown>;

    // The previous version parses the settings row with a strict schema. If the
    // day-profile keys were written onto this row it would load defaults and the
    // next save would overwrite real user settings.
    expect(legacySettingsSchema.safeParse(storedRow).success).toBe(true);

    for (const key of ['dayProfiles', 'weekdayProfileAssignments', 'dayProfileMigrationState']) {
      expect(Object.prototype.hasOwnProperty.call(storedRow, key)).toBe(false);
    }

    expect(fake.getStoredFoundation()).toBeDefined();
  });

  it('moves an inline profile foundation written by an earlier build into its own record', async () => {
    const inline = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const fake = createFakeStore({ ...inline, theme: 'grounded' });

    const result = await loadSettingsResult(fake.store);

    expect(result.status).toBe('loaded');
    expect(result.migrationPersisted).toBe(true);
    expect(result.settings.theme).toBe('grounded');
    expect(legacySettingsSchema.safeParse(fake.getRawSettings()).success).toBe(true);
    expect(fake.getStoredFoundation()?.id).toBe(DAY_PROFILE_FOUNDATION_ID);

    // Healing is idempotent: a second load has nothing left to rewrite.
    fake.put.mockClear();

    const repeated = await loadSettingsResult(fake.store);

    expect(repeated.status).toBe('loaded');
    expect(repeated.migrationPersisted).toBe(false);
    expect(repeated.settings).toEqual(result.settings);
    expect(fake.put).not.toHaveBeenCalled();
  });

  it('rejects a stored row hiding another data class inside a day profile', async () => {
    const current = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const smuggled = {
      ...current,
      dayProfiles: current.dayProfiles.map((profile) =>
        profile.kind === 'workday' ? { ...profile, softPlacements: [{ id: 'leaked' }] } : profile,
      ),
    };
    const fake = createFakeStore(smuggled);

    const result = await loadSettingsResult(fake.store);

    expect(result.status).toBe('invalid');
    expect(result.errors.join(' ')).toContain('dayProfiles.0.softPlacements');
    expect(fake.put).not.toHaveBeenCalled();
  });

  it('surfaces duplicated legacy field conflicts for review instead of resolving them silently', async () => {
    const current = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const conflicted = {
      ...current,
      breakfastTime: '06:45',
      workStart: '07:30',
    };
    const fake = createFakeStore(conflicted);
    const loaded = await loadSettingsResult(fake.store);

    expect(loaded.conflicts).toEqual([
      {
        field: 'workStart',
        legacyRootValue: '07:30',
        lifeShapeValue: current.lifeShape.usualWorkHours.start,
      },
      {
        field: 'breakfastTime',
        legacyRootValue: '06:45',
        lifeShapeValue: current.lifeShape.mealAnchors.breakfast,
      },
    ]);
  });

  it('resolves a surfaced conflict towards Life Shape on save instead of discarding the edit', async () => {
    const current = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const conflicted = {
      ...current,
      breakfastTime: '06:45',
      workStart: '07:30',
    };
    const fake = createFakeStore(conflicted);
    const editedLifeShape = {
      ...current.lifeShape,
      usualWorkHours: {
        ...current.lifeShape.usualWorkHours,
        start: '10:00',
      },
    };
    const result = await saveSettings(
      {
        lifeShape: editedLifeShape,
        startBoostSafety: conflicted.startBoostSafety,
        theme: 'grounded',
      },
      fake.store,
    );

    expect(result.ok).toBe(true);
    // The value Setup shows and edits wins; the stale duplicate does not survive.
    expect(result.settings.workStart).toBe('10:00');
    expect(fake.getStoredSettings()?.workStart).toBe('10:00');
    expect(fake.getStoredSettings()?.breakfastTime).toBe(current.lifeShape.mealAnchors.breakfast);

    const reloaded = await loadSettingsResult(fake.store);

    // The conflict is resolved rather than recomputed on every later load.
    expect(reloaded.conflicts).toEqual([]);
  });

  it('preserves future-compatible profile-owned fields through load and save', async () => {
    const current = createDefaultSettings('2026-08-12T00:00:00.000Z');
    const futureAware = {
      ...current,
      dayProfiles: current.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? {
              ...profile,
              futureProfileContext: { mode: 'preserve-me' },
              workPeriod: {
                ...profile.workPeriod,
                futureRangeContext: 'preserve-me-too',
              },
            }
          : profile,
      ),
    };
    const fake = createFakeStore(futureAware);
    const loaded = await loadSettingsResult(fake.store);
    const saved = await saveSettings(
      {
        lifeShape: loaded.settings.lifeShape,
        startBoostSafety: loaded.settings.startBoostSafety,
        theme: 'clear',
      },
      fake.store,
    );
    const reloaded = await loadSettingsResult(fake.store);

    expect(loaded.status).toBe('loaded');
    expect(saved.ok).toBe(true);
    expect(reloaded.settings.dayProfiles[0]).toMatchObject({
      futureProfileContext: { mode: 'preserve-me' },
      workPeriod: { futureRangeContext: 'preserve-me-too' },
    });
  });

  it('does not save invalid work hours', async () => {
    const existing = createDefaultSettings();
    const fake = createSplitFakeStore(existing);
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
    const fake = createSplitFakeStore(existing);
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
    const fake = createSplitFakeStore(existing);
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
    expect(resetSettings.dayProfiles.map((profile) => profile.id)).toEqual([
      WORKDAY_PROFILE_ID,
      NON_WORKDAY_PROFILE_ID,
    ]);
    expect(resetSettings.dayProfiles[1].workPeriod).toBeUndefined();
    expect(resetSettings.dayProfiles.every((profile) => profile.usableDay === undefined)).toBe(true);
    expect(resetSettings.weekdayProfileAssignments).toHaveLength(7);
    expect(resetSettings.dayProfileMigrationState.reviewState).toBe('notStarted');
    expect(resetSettings.dayProfileMigrationState.reviewedAt).toBeUndefined();
    expect(fake.getStoredSettings()?.theme).toBe('exhale');
    expect(fake.put).toHaveBeenCalledTimes(4);
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
      expect(await database.settings.count()).toBe(2);
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
