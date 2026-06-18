import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import {
  createAuthLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { saveSoftPlacement } from './softPlacementRepository';
import {
  buildSoftPlacementBackupPayload,
  exportSoftPlacementBackup,
  parseSoftPlacementBackupJson,
  serializeSoftPlacementBackup,
  SOFT_PLACEMENT_BACKUP_FORMAT,
  softPlacementBackupSchema,
  validateSoftPlacementBackup,
  type SoftPlacementBackup,
} from './softPlacementBackup';
import { softPlacementSchema, type SoftPlacement } from './schemas';

const exportedAt = '2026-06-18T00:00:00.000Z';

function validSoftPlacement(overrides: Partial<SoftPlacement> = {}): SoftPlacement {
  return softPlacementSchema.parse({
    blockId: 'monday-open-capacity',
    blockLabelSnapshot: 'Monday open capacity',
    createdAt: '2026-06-18T00:00:00.000Z',
    date: '2026-06-18',
    end: '12:00',
    id: 'soft-placement-send-form',
    placementSource: 'userConfirmed',
    start: '11:00',
    status: 'planned',
    taskId: 'send-form',
    taskTitleSnapshot: 'Send the form',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  });
}

function validPayload(): SoftPlacementBackup {
  return buildSoftPlacementBackupPayload([validSoftPlacement()], exportedAt);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let backupDatabaseIndex = 0;

function createTestDatabase() {
  backupDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-soft-placement-backup-test-${backupDatabaseIndex}`);
}

async function expectNoNonPlacementRows(database: ReturnType<typeof createTestDatabase>) {
  expect(await database.activeTasks.count()).toBe(0);
  expect(await database.settings.count()).toBe(0);
  expect(await database.rhythmTemplates.count()).toBe(0);
  expect(await database.taskHistory.count()).toBe(0);
  expect(await database.completionLog.count()).toBe(0);
  expect(await database.resetLog.count()).toBe(0);
  expect(await database.startBoostLog.count()).toBe(0);
  expect(await database.devTickets.count()).toBe(0);
  expect(await database.migrationLog.count()).toBe(0);
}

afterEach(() => {
  resetCurrentLocalDataNamespace();
  vi.restoreAllMocks();
});

describe('soft placement backup', () => {
  it('builds a valid soft placement backup payload from explicit placement data', () => {
    const payload = validPayload();

    expect(payload.format).toBe(SOFT_PLACEMENT_BACKUP_FORMAT);
    expect(payload.appVersion).toBe('1.4.6');
    expect(payload.exportedAt).toBe(exportedAt);
    expect(payload.placements).toHaveLength(1);
    expect(payload.placements[0]).toMatchObject({
      blockLabelSnapshot: 'Monday open capacity',
      placementSource: 'userConfirmed',
      status: 'planned',
      taskTitleSnapshot: 'Send the form',
    });
  });

  it('includes only approved soft placement backup fields', () => {
    const payload = validPayload();
    const placement = payload.placements[0];

    expect(Object.keys(payload).sort()).toEqual(['appVersion', 'exportedAt', 'format', 'placements']);
    expect(Object.keys(placement).sort()).toEqual([
      'blockId',
      'blockLabelSnapshot',
      'createdAt',
      'date',
      'end',
      'id',
      'placementSource',
      'start',
      'status',
      'taskId',
      'taskTitleSnapshot',
      'updatedAt',
    ]);
    expect(placement).not.toHaveProperty('calendarEventId');
    expect(placement).not.toHaveProperty('schedulerOutput');
    expect(placement).not.toHaveProperty('score');
    expect(placement).not.toHaveProperty('streak');
    expect(placement).not.toHaveProperty('compliance');
  });

  it('includes removed placement records with their removed status', () => {
    const payload = buildSoftPlacementBackupPayload([
      validSoftPlacement(),
      validSoftPlacement({
        id: 'soft-placement-removed',
        status: 'removed',
        taskTitleSnapshot: 'Removed placement',
      }),
    ], exportedAt);
    const result = validateSoftPlacementBackup(payload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.placements).toHaveLength(2);
      expect(result.payload.placements[1]).toMatchObject({
        status: 'removed',
        taskTitleSnapshot: 'Removed placement',
      });
      expect(result.preview.includesRemovedPlacements).toBe(true);
      expect(result.preview.statusSummary).toContain('1 planned');
      expect(result.preview.statusSummary).toContain('1 removed');
    }
  });

  it('serializes a payload that parses through soft placement backup validation', () => {
    const payload = validPayload();
    const serialized = serializeSoftPlacementBackup(payload);
    const parsed = parseSoftPlacementBackupJson(serialized);

    expect(softPlacementBackupSchema.parse(JSON.parse(serialized))).toEqual(payload);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload).toEqual(payload);
      expect(parsed.preview.placementTitles).toEqual(['Send the form']);
    }
  });

  it('exports current namespace soft placements only', async () => {
    const userANamespace = createAuthLocalDataNamespace('soft-placement-backup-user-a');
    const userBNamespace = createAuthLocalDataNamespace('soft-placement-backup-user-b');
    const userADatabase = createLifeRhythmDatabase(userANamespace.databaseName);
    const userBDatabase = createLifeRhythmDatabase(userBNamespace.databaseName);

    try {
      setCurrentLocalDataNamespace(userANamespace);
      await saveSoftPlacement(validSoftPlacement({
        taskTitleSnapshot: 'User A placement',
      }));

      setCurrentLocalDataNamespace(userBNamespace);
      await saveSoftPlacement(validSoftPlacement({
        id: 'soft-placement-user-b',
        taskTitleSnapshot: 'User B placement',
      }));

      setCurrentLocalDataNamespace(userANamespace);

      const backup = await exportSoftPlacementBackup(undefined, exportedAt);

      expect(backup).not.toBeNull();
      expect(backup?.fileName).toBe('life-rhythm-soft-placements-backup-2026-06-18.json');
      expect(backup?.placementCount).toBe(1);
      expect(backup?.payload.placements[0].taskTitleSnapshot).toBe('User A placement');
      expect(backup?.json).toContain('life-rhythm-soft-placement-backup');
      await expectNoNonPlacementRows(userADatabase);
      await expectNoNonPlacementRows(userBDatabase);
    } finally {
      resetCurrentLocalDataNamespace();
      await userADatabase.delete();
      await userBDatabase.delete();
    }
  });

  it('returns null when there are no soft placements to export', async () => {
    const database = createTestDatabase();

    try {
      await expect(exportSoftPlacementBackup(database, exportedAt)).resolves.toBeNull();
      expect(await database.softPlacements.count()).toBe(0);
      await expectNoNonPlacementRows(database);
    } finally {
      await database.delete();
    }
  });

  it('rejects malformed JSON and non-object values safely', () => {
    const malformed = parseSoftPlacementBackupJson('{ not json');
    const nonObject = validateSoftPlacementBackup([]);

    expect(malformed.ok).toBe(false);
    expect(nonObject.ok).toBe(false);
    if (!malformed.ok && !nonObject.ok) {
      expect(malformed.errors[0]).toContain('malformed');
      expect(nonObject.errors[0]).toContain('Expected a soft placement backup object');
    }
  });

  it('rejects unknown top-level and placement fields', () => {
    const payload = clone(validPayload());
    const unknownTopLevel = validateSoftPlacementBackup({
      ...payload,
      notes: 'extra',
    });
    const unknownPlacementField = validateSoftPlacementBackup({
      ...payload,
      placements: [
        {
          ...payload.placements[0],
          notes: 'extra',
        },
      ],
    });

    expect(unknownTopLevel.ok).toBe(false);
    expect(unknownPlacementField.ok).toBe(false);
    if (!unknownTopLevel.ok && !unknownPlacementField.ok) {
      expect(unknownTopLevel.errors.join(' ')).toContain('Unrecognized key');
      expect(unknownPlacementField.errors.join(' ')).toContain('Unrecognized key');
    }
  });

  it('rejects invalid metadata, placement date, source, and status', () => {
    const payload = clone(validPayload());
    const invalid = validateSoftPlacementBackup({
      ...payload,
      appVersion: 'preview',
      exportedAt: '2026-02-31T00:00:00.000Z',
      format: 'life-rhythm-active-task-backup',
      placements: [
        {
          ...payload.placements[0],
          date: '2026-02-30',
          placementSource: 'scheduler',
          status: 'autoPlaced',
        },
      ],
    });

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      const errors = invalid.errors.join(' ');

      expect(errors).toContain('appVersion');
      expect(errors).toContain('exportedAt');
      expect(errors).toContain('format');
      expect(errors).toContain('placements.0.date');
      expect(errors).toContain('placements.0.placementSource');
      expect(errors).toContain('placements.0.status');
    }
  });

  it('rejects invalid soft placement time ranges', () => {
    const payload = clone(validPayload());
    const invalidTime = validateSoftPlacementBackup({
      ...payload,
      placements: [
        {
          ...payload.placements[0],
          end: '10:00',
          start: '10:30',
        },
      ],
    });

    expect(invalidTime.ok).toBe(false);
    if (!invalidTime.ok) {
      expect(invalidTime.errors.join(' ')).toContain('placements.0.end');
    }
  });

  it('rejects duplicate placement IDs', () => {
    const payload = clone(validPayload());
    const duplicate = validateSoftPlacementBackup({
      ...payload,
      placements: [
        payload.placements[0],
        {
          ...payload.placements[0],
          taskTitleSnapshot: 'Duplicate copy',
        },
      ],
    });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.errors.join(' ')).toContain('Duplicate soft placement IDs');
    }
  });

  it('rejects scheduler, calendar, AI, backend, score, streak, compliance, and legacy fields', () => {
    const payload = clone(validPayload());
    const blockedPayloads = [
      { key: 'settings', value: { ...payload, settings: {} } },
      { key: 'activeTasks', value: { ...payload, activeTasks: [] } },
      { key: 'rhythmTemplates', value: { ...payload, rhythmTemplates: [] } },
      { key: 'schedulerOutput', value: { ...payload, schedulerOutput: {} } },
      { key: 'calendarEventId', value: { ...payload, placements: [{ ...payload.placements[0], calendarEventId: 'cal-1' }] } },
      { key: 'aiSuggestions', value: { ...payload, aiSuggestions: [] } },
      { key: 'backend', value: { ...payload, backend: {} } },
      { key: 'sync', value: { ...payload, sync: {} } },
      { key: 'score', value: { ...payload, placements: [{ ...payload.placements[0], score: 5 }] } },
      { key: 'streak', value: { ...payload, placements: [{ ...payload.placements[0], streak: 3 }] } },
      { key: 'compliance', value: { ...payload, placements: [{ ...payload.placements[0], compliance: true }] } },
      { key: 'lifeRhythm_v146', value: { ...payload, lifeRhythm_v146: { tasks: [] } } },
    ];

    blockedPayloads.forEach(({ key, value }) => {
      const result = validateSoftPlacementBackup(value);

      expect(result.ok, key).toBe(false);
      if (!result.ok) {
        expect(result.errors.join(' ')).toContain(key);
        expect(result.errors.join(' ')).toContain('Soft placement backup cannot include');
      }
    });
  });

  it('does not read or write localStorage while building or validating', () => {
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
      const payload = buildSoftPlacementBackupPayload([validSoftPlacement()], exportedAt);
      const result = parseSoftPlacementBackupJson(JSON.stringify(payload));

      expect(result.ok).toBe(true);
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('does not open, write, or delete IndexedDB while building or validating', () => {
    const indexedDB = {
      deleteDatabase: vi.fn(),
      open: vi.fn(),
    };
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: indexedDB,
    });

    try {
      const payload = buildSoftPlacementBackupPayload([validSoftPlacement()], exportedAt);
      const result = parseSoftPlacementBackupJson(JSON.stringify(payload));

      expect(result.ok).toBe(true);
      expect(indexedDB.open).not.toHaveBeenCalled();
      expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
