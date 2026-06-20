import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import {
  createAuthLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  loadAllSoftPlacements,
  loadSoftPlacementsForDate,
  markSoftPlacementRemoved,
  saveSoftPlacement,
  updateSoftPlacementStatus,
  validateSoftPlacementWrite,
} from './softPlacementRepository';
import { softPlacementSchema, type SoftPlacement } from './schemas';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-soft-placement-test-${testDatabaseIndex}`);
}

function validSoftPlacement(overrides: Partial<SoftPlacement> = {}): SoftPlacement {
  return softPlacementSchema.parse({
    blockId: 'block-open-morning',
    blockLabelSnapshot: 'Open morning capacity',
    createdAt: '2026-06-18T00:00:00.000Z',
    date: '2026-06-18',
    end: '10:30',
    id: 'placement-kitchen-landing',
    placementSource: 'userConfirmed',
    start: '10:00',
    status: 'planned',
    taskId: 'active-kitchen-landing',
    taskTitleSnapshot: 'Kitchen landing',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  });
}

async function expectOnlySoftPlacementsWritten(
  database: ReturnType<typeof createTestDatabase>,
  softPlacementCount: number,
) {
  expect(await database.softPlacements.count()).toBe(softPlacementCount);
  expect(await database.activeTasks.count()).toBe(0);
  expect(await database.settings.count()).toBe(0);
  expect(await database.rhythmTemplates.count()).toBe(0);
  expect(await database.taskHistory.count()).toBe(0);
  expect(await database.completionLog.count()).toBe(0);
  expect(await database.resetLog.count()).toBe(0);
  expect(await database.startBoostLog.count()).toBe(0);
  expect(await database.devTickets.count()).toBe(0);
  expect(await database.migrationLog.count()).toBe(0);
  expect(await database.taskPoolItems.count()).toBe(0);
}

afterEach(() => {
  resetCurrentLocalDataNamespace();
  vi.restoreAllMocks();
});

describe('soft placement repository', () => {
  it('saves and loads a valid soft placement', async () => {
    const database = createTestDatabase();

    try {
      const result = await saveSoftPlacement(validSoftPlacement(), database);
      const loaded = await loadAllSoftPlacements(database);

      expect(result).toMatchObject({
        ok: true,
        placement: {
          id: 'placement-kitchen-landing',
          placementSource: 'userConfirmed',
          status: 'planned',
          taskId: 'active-kitchen-landing',
        },
      });
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({
        blockLabelSnapshot: 'Open morning capacity',
        taskTitleSnapshot: 'Kitchen landing',
      });
      await expectOnlySoftPlacementsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('rejects invalid date and time values', async () => {
    const database = createTestDatabase();

    try {
      const invalidDate = await saveSoftPlacement({
        ...validSoftPlacement({ id: 'placement-invalid-date' }),
        date: '2026-02-30',
      }, database);
      const invalidTime = await saveSoftPlacement({
        ...validSoftPlacement({ id: 'placement-invalid-time' }),
        start: '25:00',
      }, database);

      expect(invalidDate.ok).toBe(false);
      expect(invalidTime.ok).toBe(false);
      await expectOnlySoftPlacementsWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('rejects placements where start is not before end', async () => {
    const database = createTestDatabase();

    try {
      const backwards = await saveSoftPlacement({
        ...validSoftPlacement(),
        end: '10:00',
        start: '10:30',
      }, database);
      const sameTime = await saveSoftPlacement({
        ...validSoftPlacement({
          id: 'placement-same-time',
        }),
        end: '10:00',
        start: '10:00',
      }, database);

      expect(backwards.ok).toBe(false);
      expect(sameTime.ok).toBe(false);
      await expectOnlySoftPlacementsWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('rejects unsupported placement source and status values', async () => {
    const database = createTestDatabase();

    try {
      const badSource = validateSoftPlacementWrite({
        ...validSoftPlacement(),
        placementSource: 'scheduler',
      });
      const badStatus = await saveSoftPlacement({
        ...validSoftPlacement(),
        status: 'autoPlaced',
      }, database);

      expect(badSource.ok).toBe(false);
      expect(badStatus.ok).toBe(false);
      await expectOnlySoftPlacementsWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('loads placements for the matching date only', async () => {
    const database = createTestDatabase();

    try {
      await saveSoftPlacement(validSoftPlacement({
        id: 'placement-today',
        taskTitleSnapshot: 'Today task',
      }), database);
      await saveSoftPlacement(validSoftPlacement({
        date: '2026-06-19',
        id: 'placement-tomorrow',
        taskTitleSnapshot: 'Tomorrow task',
      }), database);

      const today = await loadSoftPlacementsForDate('2026-06-18', database);
      const invalidDate = await loadSoftPlacementsForDate('2026-02-30', database);

      expect(today.map((placement) => placement.taskTitleSnapshot)).toEqual(['Today task']);
      expect(invalidDate).toEqual([]);
      await expectOnlySoftPlacementsWritten(database, 2);
    } finally {
      await database.delete();
    }
  });

  it.each([
    ['moved'],
    ['removed'],
    ['completedFromToday'],
  ] as const)('updates status to %s and only changes the placement row', async (status) => {
    const database = createTestDatabase();

    try {
      await saveSoftPlacement(validSoftPlacement(), database);

      const result = await updateSoftPlacementStatus('placement-kitchen-landing', status, database);
      const loaded = await loadAllSoftPlacements(database);

      expect(result).toMatchObject({
        ok: true,
        placement: {
          status,
        },
      });
      expect(loaded[0].status).toBe(status);
      expect(loaded[0].taskId).toBe('active-kitchen-landing');
      await expectOnlySoftPlacementsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('marks a placement removed instead of deleting it', async () => {
    const database = createTestDatabase();

    try {
      await saveSoftPlacement(validSoftPlacement(), database);
      const result = await markSoftPlacementRemoved('placement-kitchen-landing', database);
      const loaded = await loadAllSoftPlacements(database);

      expect(result).toMatchObject({
        ok: true,
        placement: {
          status: 'removed',
        },
      });
      expect(loaded).toHaveLength(1);
      expect(loaded[0].status).toBe('removed');
      await expectOnlySoftPlacementsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('rejects unsupported status updates without overwriting the placement', async () => {
    const database = createTestDatabase();

    try {
      await saveSoftPlacement(validSoftPlacement(), database);

      const result = await updateSoftPlacementStatus(
        'placement-kitchen-landing',
        'scheduled' as never,
        database,
      );
      const loaded = await loadAllSoftPlacements(database);

      expect(result.ok).toBe(false);
      expect(loaded[0].status).toBe('planned');
      await expectOnlySoftPlacementsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('rejects duplicate IDs without silently overwriting', async () => {
    const database = createTestDatabase();

    try {
      await saveSoftPlacement(validSoftPlacement(), database);
      const duplicate = await saveSoftPlacement(validSoftPlacement({
        taskTitleSnapshot: 'Changed title',
      }), database);
      const loaded = await loadAllSoftPlacements(database);

      expect(duplicate.ok).toBe(false);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].taskTitleSnapshot).toBe('Kitchen landing');
      await expectOnlySoftPlacementsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('ignores invalid stored soft placements safely', async () => {
    const database = createTestDatabase();

    try {
      await database.softPlacements.put({
        id: 'broken-placement',
        placementSource: 'userConfirmed',
      } as SoftPlacement);

      await expect(loadAllSoftPlacements(database)).resolves.toEqual([]);
      expect(await database.softPlacements.count()).toBe(1);
      expect(await database.activeTasks.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('uses the current local namespace and keeps signed-in users separate', async () => {
    const userANamespace = createAuthLocalDataNamespace('soft-placement-user-a');
    const userBNamespace = createAuthLocalDataNamespace('soft-placement-user-b');
    const userADatabase = createLifeRhythmDatabase(userANamespace.databaseName);
    const userBDatabase = createLifeRhythmDatabase(userBNamespace.databaseName);

    try {
      setCurrentLocalDataNamespace(userANamespace);
      await saveSoftPlacement(validSoftPlacement({
        id: 'placement-user-a',
        taskTitleSnapshot: 'User A placement',
      }));

      setCurrentLocalDataNamespace(userBNamespace);
      expect(await loadAllSoftPlacements()).toEqual([]);
      await saveSoftPlacement(validSoftPlacement({
        id: 'placement-user-b',
        taskTitleSnapshot: 'User B placement',
      }));

      setCurrentLocalDataNamespace(userANamespace);
      expect((await loadAllSoftPlacements()).map((placement) => placement.taskTitleSnapshot)).toEqual([
        'User A placement',
      ]);

      setCurrentLocalDataNamespace(userBNamespace);
      expect((await loadAllSoftPlacements()).map((placement) => placement.taskTitleSnapshot)).toEqual([
        'User B placement',
      ]);
    } finally {
      resetCurrentLocalDataNamespace();
      await userADatabase.delete();
      await userBDatabase.delete();
    }
  });

  it('does not use fetch or localStorage', async () => {
    const database = createTestDatabase();
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const fetchSpy = vi.fn();
    const localStorage = {
      getItem: vi.fn(() => {
        throw new Error('localStorage must not be read');
      }),
      setItem: vi.fn(() => {
        throw new Error('localStorage must not be written');
      }),
    };

    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    try {
      await saveSoftPlacement(validSoftPlacement({
        id: 'placement-storage-boundary',
      }), database);
      await loadAllSoftPlacements(database);
      await updateSoftPlacementStatus('placement-storage-boundary', 'moved', database);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
      await expectOnlySoftPlacementsWritten(database, 1);
    } finally {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }

      if (originalLocalStorage) {
        Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
      } else {
        Reflect.deleteProperty(globalThis, 'localStorage');
      }

      await database.delete();
    }
  });
});
