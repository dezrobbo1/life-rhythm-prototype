import { describe, expect, it, vi } from 'vitest';
import {
  buildLibraryRhythmBackupPayload,
  LIBRARY_RHYTHM_BACKUP_FORMAT,
  libraryRhythmBackupSchema,
  parseLibraryRhythmBackupJson,
  serializeLibraryRhythmBackup,
  validateLibraryRhythmBackup,
  type LibraryRhythmBackup,
} from './libraryRhythmBackup';
import { rhythmTemplateSchema, type RhythmTemplate } from './schemas';

const exportedAt = '2026-06-16T00:00:00.000Z';

function validRhythm(overrides: Partial<RhythmTemplate> = {}): RhythmTemplate {
  return rhythmTemplateSchema.parse({
    area: 'house',
    createdAt: '2026-06-15T00:00:00.000Z',
    full: {
      label: 'Clear the counter and one hidden cleanup edge.',
      minutes: 20,
    },
    id: 'custom-kitchen-landing',
    minimum: {
      label: 'Clear one counter.',
      minutes: 5,
    },
    normal: {
      label: 'Clear the counter and collect dishes.',
      minutes: 12,
    },
    purpose: 'Keep one household re-entry point visible.',
    source: 'custom',
    title: 'Kitchen landing',
    updatedAt: '2026-06-15T01:00:00.000Z',
    ...overrides,
  });
}

function validPayload(): LibraryRhythmBackup {
  return buildLibraryRhythmBackupPayload([validRhythm()], exportedAt);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('Library rhythm backup scaffolding', () => {
  it('builds a valid Library rhythm backup payload from explicit custom rhythm data', () => {
    const payload = validPayload();

    expect(payload.format).toBe(LIBRARY_RHYTHM_BACKUP_FORMAT);
    expect(payload.appVersion).toBe('1.4.6');
    expect(payload.exportedAt).toBe(exportedAt);
    expect(payload.rhythms).toHaveLength(1);
    expect(payload.rhythms[0]).toMatchObject({
      id: 'custom-kitchen-landing',
      source: 'custom',
      title: 'Kitchen landing',
    });
    expect(payload.rhythms[0].schedule.bestTime).toBe('anytime');
  });

  it('includes only approved Library rhythm backup fields', () => {
    const payload = validPayload();
    const rhythm = payload.rhythms[0];

    expect(Object.keys(payload).sort()).toEqual(['appVersion', 'exportedAt', 'format', 'rhythms']);
    expect(Object.keys(rhythm).sort()).toEqual([
      'area',
      'completionStyle',
      'createdAt',
      'energy',
      'full',
      'id',
      'kind',
      'minimum',
      'normal',
      'priority',
      'purpose',
      'schedule',
      'source',
      'startBarrier',
      'taskType',
      'title',
      'updatedAt',
    ]);
    expect(rhythm).not.toHaveProperty('enabled');
    expect(rhythm).not.toHaveProperty('chips');
  });

  it('serializes a payload that parses through Library rhythm backup validation', () => {
    const payload = validPayload();
    const serialized = serializeLibraryRhythmBackup(payload);

    expect(libraryRhythmBackupSchema.parse(JSON.parse(serialized))).toEqual(payload);
  });

  it('validates a Library rhythm backup and returns a preview', () => {
    const result = validateLibraryRhythmBackup(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.rhythmCount).toBe(1);
      expect(result.preview.rhythmTitles).toEqual(['Kitchen landing']);
      expect(result.preview.exportedAt).toBe(exportedAt);
    }
  });

  it('rejects malformed JSON and non-object values safely', () => {
    const malformed = parseLibraryRhythmBackupJson('{ not json');
    const nonObject = validateLibraryRhythmBackup([]);

    expect(malformed.ok).toBe(false);
    expect(nonObject.ok).toBe(false);
    if (!malformed.ok && !nonObject.ok) {
      expect(malformed.errors[0]).toContain('malformed');
      expect(nonObject.errors[0]).toContain('Expected a Library rhythm backup object');
    }
  });

  it('rejects unknown top-level and rhythm fields', () => {
    const payload = clone(validPayload());
    const unknownTopLevel = validateLibraryRhythmBackup({
      ...payload,
      notes: 'extra',
    });
    const unknownRhythmField = validateLibraryRhythmBackup({
      ...payload,
      rhythms: [
        {
          ...payload.rhythms[0],
          enabled: true,
        },
      ],
    });

    expect(unknownTopLevel.ok).toBe(false);
    expect(unknownRhythmField.ok).toBe(false);
    if (!unknownTopLevel.ok && !unknownRhythmField.ok) {
      expect(unknownTopLevel.errors.join(' ')).toContain('Unrecognized key');
      expect(unknownRhythmField.errors.join(' ')).toContain('Unrecognized key');
    }
  });

  it('rejects invalid backup metadata', () => {
    const payload = clone(validPayload());
    const invalidFormat = validateLibraryRhythmBackup({
      ...payload,
      format: 'life-rhythm-settings-backup',
    });
    const invalidVersion = validateLibraryRhythmBackup({
      ...payload,
      appVersion: 'preview',
    });
    const invalidExportedAt = validateLibraryRhythmBackup({
      ...payload,
      exportedAt: '2026-02-31T00:00:00.000Z',
    });

    expect(invalidFormat.ok).toBe(false);
    expect(invalidVersion.ok).toBe(false);
    expect(invalidExportedAt.ok).toBe(false);
    if (!invalidFormat.ok && !invalidVersion.ok && !invalidExportedAt.ok) {
      const errors = [...invalidFormat.errors, ...invalidVersion.errors, ...invalidExportedAt.errors].join(' ');

      expect(errors).toContain('format');
      expect(errors).toContain('appVersion');
      expect(errors).toContain('exportedAt');
    }
  });

  it('rejects built-in rhythms and invalid rhythm data', () => {
    expect(() => buildLibraryRhythmBackupPayload([
      validRhythm({
        id: 'built-in-kitchen-landing',
        source: 'built-in',
      }),
    ], exportedAt)).toThrow();

    const payload = clone(validPayload());
    const invalidRhythm = validateLibraryRhythmBackup({
      ...payload,
      rhythms: [
        {
          ...payload.rhythms[0],
          source: 'built-in',
          title: '',
        },
      ],
    });

    expect(invalidRhythm.ok).toBe(false);
    if (!invalidRhythm.ok) {
      const errors = invalidRhythm.errors.join(' ');

      expect(errors).toContain('rhythms.0.source');
      expect(errors).toContain('rhythms.0.title');
    }
  });

  it('rejects invalid schedule hints without repairing them', () => {
    const payload = clone(validPayload());
    const result = validateLibraryRhythmBackup({
      ...payload,
      rhythms: [
        {
          ...payload.rhythms[0],
          schedule: {
            ...payload.rhythms[0].schedule,
            fixedTime: '25:00',
            maxPerDay: 0,
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const errors = result.errors.join(' ');

      expect(errors).toContain('rhythms.0.schedule.fixedTime');
      expect(errors).toContain('rhythms.0.schedule.maxPerDay');
    }
  });

  it('rejects duplicate rhythm IDs', () => {
    const payload = clone(validPayload());
    const result = validateLibraryRhythmBackup(payload);

    expect(result.ok).toBe(true);

    const duplicateResult = validateLibraryRhythmBackup({
      ...payload,
      rhythms: [
        payload.rhythms[0],
        {
          ...payload.rhythms[0],
          title: 'Kitchen landing copy',
        },
      ],
    });

    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.errors.join(' ')).toContain('Duplicate rhythm IDs');
    }
  });

  it('allows duplicate titles when IDs are distinct', () => {
    const payload = buildLibraryRhythmBackupPayload([
      validRhythm(),
      validRhythm({
        id: 'custom-kitchen-landing-2',
      }),
    ], exportedAt);
    const result = validateLibraryRhythmBackup(payload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.rhythmTitles).toEqual(['Kitchen landing', 'Kitchen landing']);
    }
  });

  it('rejects settings, task, scheduler, migration, and legacy payload data', () => {
    const payload = clone(validPayload());
    const withSettings = validateLibraryRhythmBackup({
      ...payload,
      settings: {},
    });
    const withTasks = validateLibraryRhythmBackup({
      ...payload,
      activeTasks: [],
    });
    const withLegacyData = validateLibraryRhythmBackup({
      ...payload,
      lifeRhythm_v146: {
        tasks: [],
      },
    });
    const withNestedSchedulerOutput = validateLibraryRhythmBackup({
      ...payload,
      rhythms: [
        {
          ...payload.rhythms[0],
          schedulerOutput: {},
        },
      ],
    });

    expect(withSettings.ok).toBe(false);
    expect(withTasks.ok).toBe(false);
    expect(withLegacyData.ok).toBe(false);
    expect(withNestedSchedulerOutput.ok).toBe(false);
    if (!withSettings.ok && !withTasks.ok && !withLegacyData.ok && !withNestedSchedulerOutput.ok) {
      const errors = [
        ...withSettings.errors,
        ...withTasks.errors,
        ...withLegacyData.errors,
        ...withNestedSchedulerOutput.errors,
      ].join(' ');

      expect(errors).toContain('settings');
      expect(errors).toContain('activeTasks');
      expect(errors).toContain('lifeRhythm_v146');
      expect(errors).toContain('rhythms.0.schedulerOutput');
      expect(errors).toContain('cannot include settings, task, legacy, migration, or scheduler data');
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
      const result = validateLibraryRhythmBackup(validPayload());

      expect(result.ok).toBe(true);
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('does not open or write IndexedDB while building or validating', () => {
    const indexedDB = {
      deleteDatabase: vi.fn(),
      open: vi.fn(),
    };
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: indexedDB,
    });

    try {
      const payload = buildLibraryRhythmBackupPayload([validRhythm()], exportedAt);
      const result = parseLibraryRhythmBackupJson(JSON.stringify(payload));

      expect(result.ok).toBe(true);
      expect(indexedDB.open).not.toHaveBeenCalled();
      expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
