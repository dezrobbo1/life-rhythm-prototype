import { describe, expect, it, vi } from 'vitest';
import { buildSettingsBackupPayload, type SettingsBackup } from './settingsExport';
import {
  parseSettingsBackupImportJson,
  settingsBackupImportSchema,
  settingsBackupV1ImportSchema,
  settingsBackupV2ImportSchema,
  validateSettingsBackupImport,
} from './settingsImportValidation';
import { settingsSchema } from './schemas';

const exportedAt = '2026-06-16T00:00:00.000Z';

function validPayload(): SettingsBackup {
  const settings = settingsSchema.parse({
    appVersion: '1.4.6',
    createdAt: '2026-06-15T00:00:00.000Z',
    id: 'settings',
    lifeShape: {
      commuteMinutes: 25,
      fixedCommitments: [
        {
          bufferMinutes: 5,
          days: ['Monday'],
          end: '08:45',
          id: 'school-run',
          label: 'School run',
          start: '08:00',
          travelMinutes: 10,
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
        {
          days: ['Saturday'],
          end: '16:00',
          id: 'loose-saturday',
          label: 'Loose Saturday time',
          schedulerUse: 'askFirst',
          start: '14:00',
          type: 'looseTime',
        },
      ],
      usualWorkHours: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
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
    updatedAt: '2026-06-15T01:00:00.000Z',
  });

  return settingsBackupV2ImportSchema.parse(buildSettingsBackupPayload(settings, exportedAt));
}

function validVersion1Payload() {
  return settingsBackupV1ImportSchema.parse({
    appVersion: '1.4.6',
    exportedAt,
    format: 'life-rhythm-settings-backup',
    settings: {
      appVersion: '1.4.6',
      createdAt: '2026-06-15T00:00:00.000Z',
      id: 'settings',
      lifeShape: {
        commuteMinutes: 25,
        fixedCommitments: [],
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
        timeBlocks: [],
        transitionBufferMinutes: 20,
        travelMinutes: 25,
        usualWorkHours: {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
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
      updatedAt: '2026-06-15T01:00:00.000Z',
    },
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('settings backup import validation', () => {
  it('parses a valid settings backup and returns a preview', () => {
    const payload = validPayload();
    const result = validateSettingsBackupImport(payload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(settingsBackupImportSchema.parse(result.payload)).toEqual(payload);
      expect(result.preview.theme).toBe('clear');
      expect(result.preview.formatVersion).toBe(2);
      expect(result.preview.profileFoundationSummary).toContain('Profile foundation present');
      expect(result.preview.profileFoundationSummary).toContain('does not activate derived availability');
      expect(result.preview.lifeShapeSummary).toContain('09:00-17:00');
      expect(result.preview.startBoostSafetySummary).toBe('6 safety choices on');
      expect(result.payload.settings.lifeShape.timeBlocks[0]).toMatchObject({
        id: 'protected-writing',
        schedulerUse: 'unavailable',
      });
    }
  });

  it('accepts a frozen legacy version-1 backup and reports future migration review without restoring', () => {
    const legacyPayload = validVersion1Payload();
    const result = validateSettingsBackupImport(legacyPayload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.formatVersion).toBe(1);
      expect(result.preview.profileFoundationSummary).toContain('Profile foundation absent');
      expect(result.preview.profileFoundationSummary).toContain('migration and user review');
      expect(result.preview.profileFoundationSummary).toContain('No restore occurred');
      expect('formatVersion' in result.payload).toBe(false);
    }
  });

  it('rejects explicit unknown settings-backup versions', () => {
    const result = validateSettingsBackupImport({
      ...validPayload(),
      formatVersion: 3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('formatVersion');
      expect(result.errors.join(' ')).toContain('legacy version-1');
    }
  });

  it('rejects malformed JSON safely', () => {
    const result = parseSettingsBackupImportJson('{ not json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('malformed');
    }
  });

  it('rejects non-object JSON values', () => {
    const results = [
      validateSettingsBackupImport(null),
      validateSettingsBackupImport([]),
      validateSettingsBackupImport('backup'),
    ];

    expect(results.every((result) => !result.ok)).toBe(true);
    expect(results.map((result) => (!result.ok ? result.errors[0] : '')).join(' ')).toContain(
      'Expected a settings backup object',
    );
  });

  it('rejects backups with unknown top-level fields', () => {
    const result = validateSettingsBackupImport({
      ...validPayload(),
      notes: 'extra data',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('Unrecognized key');
    }
  });

  it('rejects backups with unknown settings fields', () => {
    const payload = clone(validPayload());
    const result = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        workDays: ['Monday'],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('Unrecognized key');
    }
  });

  it('rejects invalid backup metadata', () => {
    const invalidFormat = validateSettingsBackupImport({
      ...validPayload(),
      format: 'life-rhythm-full-backup',
    });
    const invalidAppVersion = validateSettingsBackupImport({
      ...validPayload(),
      appVersion: 'latest',
    });
    const invalidExportedAt = validateSettingsBackupImport({
      ...validPayload(),
      exportedAt: '2026-02-31T00:00:00.000Z',
    });

    expect(invalidFormat.ok).toBe(false);
    expect(invalidAppVersion.ok).toBe(false);
    expect(invalidExportedAt.ok).toBe(false);
    if (!invalidFormat.ok && !invalidAppVersion.ok && !invalidExportedAt.ok) {
      expect(invalidFormat.errors.join(' ')).toContain('format');
      expect(invalidAppVersion.errors.join(' ')).toContain('appVersion');
      expect(invalidExportedAt.errors.join(' ')).toContain('exportedAt');
    }
  });

  it('rejects invalid settings metadata', () => {
    const payload = clone(validPayload());
    const invalidId = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        id: 'other-settings',
      },
    });
    const invalidSettingsAppVersion = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        appVersion: 'preview',
      },
    });
    const invalidCreatedAt = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        createdAt: 'yesterday',
      },
    });
    const invalidUpdatedAt = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        updatedAt: 'tomorrow',
      },
    });

    expect(invalidId.ok).toBe(false);
    expect(invalidSettingsAppVersion.ok).toBe(false);
    expect(invalidCreatedAt.ok).toBe(false);
    expect(invalidUpdatedAt.ok).toBe(false);
    if (!invalidId.ok && !invalidSettingsAppVersion.ok && !invalidCreatedAt.ok && !invalidUpdatedAt.ok) {
      const errors = [
        ...invalidId.errors,
        ...invalidSettingsAppVersion.errors,
        ...invalidCreatedAt.errors,
        ...invalidUpdatedAt.errors,
      ].join(' ');

      expect(errors).toContain('settings.id');
      expect(errors).toContain('settings.appVersion');
      expect(errors).toContain('settings.createdAt');
      expect(errors).toContain('settings.updatedAt');
    }
  });

  it('rejects invalid theme values', () => {
    const payload = clone(validPayload());
    const result = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        theme: 'warm-cream',
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('settings.theme');
    }
  });

  it('rejects invalid Start Boost safety values', () => {
    const payload = clone(validPayload());
    const result = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        startBoostSafety: {
          ...payload.settings.startBoostSafety,
          avoidFoodRewards: 'yes',
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('settings.startBoostSafety.avoidFoodRewards');
    }
  });

  it('rejects invalid Life Shape settings', () => {
    const payload = clone(validPayload());
    const result = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        lifeShape: {
          ...payload.settings.lifeShape,
          commuteMinutes: -1,
          usualWorkHours: {
            ...payload.settings.lifeShape.usualWorkHours,
            end: '09:00',
            start: '18:00',
          },
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const errors = result.errors.join(' ');
      expect(errors).toContain('settings.lifeShape.commuteMinutes');
      expect(errors).toContain('settings.lifeShape.usualWorkHours.end');
    }
  });

  it('rejects invalid Life Shape time blocks', () => {
    const payload = clone(validPayload());
    const invalidRange = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        lifeShape: {
          ...payload.settings.lifeShape,
          timeBlocks: [
            {
              days: ['Monday'],
              end: '09:00',
              id: 'bad-range',
              label: 'Bad range',
              schedulerUse: 'unavailable',
              start: '10:00',
              type: 'protectedTime',
            },
          ],
        },
      },
    });
    const invalidDay = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        lifeShape: {
          ...payload.settings.lifeShape,
          timeBlocks: [
            {
              days: ['Funday'],
              end: '12:00',
              id: 'bad-day',
              label: 'Bad day',
              schedulerUse: 'askFirst',
              start: '10:00',
              type: 'looseTime',
            },
          ],
        },
      },
    });
    const unknownField = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        lifeShape: {
          ...payload.settings.lifeShape,
          timeBlocks: [
            {
              days: ['Monday'],
              end: '12:00',
              id: 'unknown-field',
              label: 'Unknown field',
              scheduleIntoThis: true,
              schedulerUse: 'available',
              start: '10:00',
              type: 'openCapacity',
            },
          ],
        },
      },
    });

    expect(invalidRange.ok).toBe(false);
    expect(invalidDay.ok).toBe(false);
    expect(unknownField.ok).toBe(false);
    if (!invalidRange.ok && !invalidDay.ok && !unknownField.ok) {
      const errors = [...invalidRange.errors, ...invalidDay.errors, ...unknownField.errors].join(' ');

      expect(errors).toContain('settings.lifeShape.timeBlocks.0.end');
      expect(errors).toContain('settings.lifeShape.timeBlocks.0.days.0');
      expect(errors).toContain('scheduleIntoThis');
    }
  });

  it('accepts a non-semantic stored source-version label without broadening backup metadata', () => {
    const payload = clone(validPayload());
    const result = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        dayProfileMigrationState: {
          ...payload.settings.dayProfileMigrationState,
          sourceSettingsVersion: 'dev',
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok && 'formatVersion' in result.payload) {
      expect(result.payload.settings.dayProfileMigrationState.sourceSettingsVersion).toBe('dev');
    }
  });

  it('rejects duplicate profile identities and profile kinds in version 2', () => {
    const payload = clone(validPayload());
    const duplicate = payload.settings.dayProfiles[0];
    const result = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        dayProfiles: [duplicate, duplicate],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const errors = result.errors.join(' ');
      expect(errors).toContain('IDs must be unique');
      expect(errors).toContain('kinds must be unique');
    }
  });

  it('rejects duplicate or missing weekday assignments in version 2', () => {
    const payload = clone(validPayload());
    const duplicateWeekday = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        weekdayProfileAssignments: payload.settings.weekdayProfileAssignments.map((assignment) =>
          assignment.weekday === 'Sunday'
            ? { ...assignment, weekday: 'Saturday' }
            : assignment,
        ),
      },
    });
    const missingWeekday = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        weekdayProfileAssignments: payload.settings.weekdayProfileAssignments.slice(0, 6),
      },
    });

    expect(duplicateWeekday.ok).toBe(false);
    expect(missingWeekday.ok).toBe(false);
    if (!duplicateWeekday.ok && !missingWeekday.ok) {
      expect(duplicateWeekday.errors.join(' ')).toContain('assigned exactly once');
      expect(duplicateWeekday.errors.join(' ')).toContain('Sunday must have');
      expect(missingWeekday.errors.join(' ')).toContain('7');
    }
  });

  it('rejects unknown profile references and malformed profile values in version 2', () => {
    const payload = clone(validPayload());
    const unknownReference = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        weekdayProfileAssignments: payload.settings.weekdayProfileAssignments.map((assignment) =>
          assignment.weekday === 'Monday'
            ? { ...assignment, profileId: 'missing-profile' }
            : assignment,
        ),
      },
    });
    const unknownKind = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        dayProfiles: payload.settings.dayProfiles.map((profile) =>
          profile.kind === 'workday'
            ? { ...profile, kind: 'shiftDay' }
            : profile,
        ),
      },
    });
    const invalidWorkUse = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        dayProfiles: payload.settings.dayProfiles.map((profile) =>
          profile.kind === 'workday'
            ? { ...profile, workPlanningUse: 'automatic' }
            : profile,
        ),
      },
    });
    const invalidReviewState = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        dayProfileMigrationState: {
          ...payload.settings.dayProfileMigrationState,
          reviewState: 'activeWithoutReview',
        },
      },
    });

    expect(unknownReference.ok).toBe(false);
    expect(unknownKind.ok).toBe(false);
    expect(invalidWorkUse.ok).toBe(false);
    expect(invalidReviewState.ok).toBe(false);
    if (!unknownReference.ok && !unknownKind.ok && !invalidWorkUse.ok && !invalidReviewState.ok) {
      expect(unknownReference.errors.join(' ')).toContain('existing day profile');
      expect(unknownKind.errors.join(' ')).toContain('settings.dayProfiles.0.kind');
      expect(invalidWorkUse.errors.join(' ')).toContain('settings.dayProfiles.0.workPlanningUse');
      expect(invalidReviewState.errors.join(' ')).toContain('settings.dayProfileMigrationState.reviewState');
    }
  });

  it('rejects malformed migration compatibility state instead of repairing it', () => {
    const payload = clone(validPayload());
    const missingAnchors = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        dayProfileMigrationState: {
          ...payload.settings.dayProfileMigrationState,
          legacyMealAnchors: {},
        },
      },
    });
    const invalidReviewedAt = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        dayProfileMigrationState: {
          ...payload.settings.dayProfileMigrationState,
          reviewedAt: 'tomorrow',
        },
      },
    });

    expect(missingAnchors.ok).toBe(false);
    expect(invalidReviewedAt.ok).toBe(false);
    if (!missingAnchors.ok && !invalidReviewedAt.ok) {
      expect(missingAnchors.errors.join(' ')).toContain(
        'settings.dayProfileMigrationState.legacyMealAnchors.breakfast',
      );
      expect(invalidReviewedAt.errors.join(' ')).toContain(
        'settings.dayProfileMigrationState.reviewedAt',
      );
    }
  });

  it('rejects payloads containing task, rhythm, or legacy data', () => {
    const payload = validPayload();
    const activeTasks = validateSettingsBackupImport({
      ...payload,
      activeTasks: [],
    });
    const rhythmTemplates = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        rhythmTemplates: [],
      },
    });
    const legacyRootData = validateSettingsBackupImport({
      ...payload,
      lifeRhythm_v146: {
        tasks: [],
      },
    });

    expect(activeTasks.ok).toBe(false);
    expect(rhythmTemplates.ok).toBe(false);
    expect(legacyRootData.ok).toBe(false);
    if (!activeTasks.ok && !rhythmTemplates.ok && !legacyRootData.ok) {
      const errors = [...activeTasks.errors, ...rhythmTemplates.errors, ...legacyRootData.errors].join(' ');

      expect(errors).toContain('activeTasks');
      expect(errors).toContain('settings.rhythmTemplates');
      expect(errors).toContain('lifeRhythm_v146');
      expect(errors).toContain('cannot include app, legacy, task, rhythm, or migration data');
    }
  });

  it('rejects blocked Pool, placement, rhythm-instance, calendar, and telemetry data inside arrays', () => {
    const payload = validPayload();
    const result = validateSettingsBackupImport({
      ...payload,
      notes: [
        {
          nested: {
            taskPoolItems: [],
          },
        },
      ],
    });
    const blockedKeys = [
      'softPlacements',
      'rhythmPlans',
      'rhythmInstances',
      'calendarData',
      'analytics',
      'telemetry',
    ];

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('notes.0.nested.taskPoolItems');
    }

    for (const key of blockedKeys) {
      const blocked = validateSettingsBackupImport({
        ...payload,
        [key]: [],
      });

      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.errors.join(' ')).toContain(key);
      }
    }
  });

  it('does not repair invalid import payloads with defaults', () => {
    const payload = clone(validPayload());
    const result = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        lifeShape: {
          ...payload.settings.lifeShape,
          transitionBufferMinutes: undefined,
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('settings.lifeShape.transitionBufferMinutes');
    }
  });

  it('does not fill version-2 time blocks or scheduler-use defaults', () => {
    const payload = clone(validPayload());
    const missingBlocks = validateSettingsBackupImport({
      ...payload,
      settings: {
        ...payload.settings,
        lifeShape: {
          ...payload.settings.lifeShape,
          timeBlocks: undefined,
        },
      },
    });
    const blockWithoutSchedulerUse = clone(validPayload());
    delete (blockWithoutSchedulerUse.settings.lifeShape.timeBlocks[0] as {
      schedulerUse?: string;
    }).schedulerUse;
    const missingSchedulerUse = validateSettingsBackupImport(blockWithoutSchedulerUse);

    expect(missingBlocks.ok).toBe(false);
    expect(missingSchedulerUse.ok).toBe(false);
    if (!missingBlocks.ok && !missingSchedulerUse.ok) {
      expect(missingBlocks.errors.join(' ')).toContain('settings.lifeShape.timeBlocks');
      expect(missingSchedulerUse.errors.join(' ')).toContain(
        'settings.lifeShape.timeBlocks.0.schedulerUse',
      );
    }
  });

  it('does not read or write localStorage', () => {
    const localStorage = {
      getItem: vi.fn(() => {
        throw new Error('localStorage must not be read');
      }),
      setItem: vi.fn(() => {
        throw new Error('localStorage must not be written');
      }),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    try {
      const result = validateSettingsBackupImport(validPayload());

      expect(result.ok).toBe(true);
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('does not open or write IndexedDB while validating', () => {
    const indexedDB = {
      deleteDatabase: vi.fn(),
      open: vi.fn(),
    };
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: indexedDB,
    });

    try {
      const results = [
        parseSettingsBackupImportJson(JSON.stringify(validPayload())),
        parseSettingsBackupImportJson(JSON.stringify(validVersion1Payload())),
      ];

      expect(results.every((result) => result.ok)).toBe(true);
      expect(indexedDB.open).not.toHaveBeenCalled();
      expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
