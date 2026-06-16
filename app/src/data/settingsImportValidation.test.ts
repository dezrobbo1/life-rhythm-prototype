import { describe, expect, it, vi } from 'vitest';
import { buildSettingsBackupPayload } from './settingsExport';
import {
  parseSettingsBackupImportJson,
  settingsBackupImportSchema,
  validateSettingsBackupImport,
  type SettingsBackupImportPayload,
} from './settingsImportValidation';
import { settingsSchema } from './schemas';

const exportedAt = '2026-06-16T00:00:00.000Z';

function validPayload(): SettingsBackupImportPayload {
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

  return settingsBackupImportSchema.parse(buildSettingsBackupPayload(settings, exportedAt));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('settings backup import validation', () => {
  it('parses a valid settings backup and returns a preview', () => {
    const result = validateSettingsBackupImport(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(settingsBackupImportSchema.parse(result.payload)).toEqual(validPayload());
      expect(result.preview.theme).toBe('clear');
      expect(result.preview.lifeShapeSummary).toContain('09:00-17:00');
      expect(result.preview.startBoostSafetySummary).toBe('6 safety choices on');
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

  it('rejects payloads containing task, rhythm, or legacy data', () => {
    const activeTasks = validateSettingsBackupImport({
      ...validPayload(),
      activeTasks: [],
    });
    const rhythmTemplates = validateSettingsBackupImport({
      ...validPayload(),
      settings: {
        ...validPayload().settings,
        rhythmTemplates: [],
      },
    });
    const legacyRootData = validateSettingsBackupImport({
      ...validPayload(),
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
      const result = parseSettingsBackupImportJson(JSON.stringify(validPayload()));

      expect(result.ok).toBe(true);
      expect(indexedDB.open).not.toHaveBeenCalled();
      expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
