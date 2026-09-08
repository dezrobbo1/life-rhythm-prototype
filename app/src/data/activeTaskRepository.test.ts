import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import {
  createActiveTaskId,
  loadActiveTodayTasks,
  loadActiveTodayTasksResult,
  loadPersistedActiveTasks,
  loadPersistedActiveTasksResult,
  saveActiveTodayTask,
  updateActiveTaskStatus,
} from './activeTaskRepository';
import { activeTaskSchema, type ActiveTask } from './schemas';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-active-task-test-${testDatabaseIndex}`);
}

function validActiveTask(overrides: Partial<ActiveTask> = {}): ActiveTask {
  return activeTaskSchema.parse({
    area: 'house',
    createdAt: '2026-06-17T00:00:00.000Z',
    full: {
      label: 'Clear the counter and reset one hidden edge.',
      minutes: 20,
    },
    id: 'active-kitchen-landing',
    minimum: {
      label: 'Clear one counter.',
      minutes: 5,
    },
    normal: {
      label: 'Clear the counter and collect dishes.',
      minutes: 12,
    },
    purpose: 'Keep one household re-entry point visible.',
    showToday: true,
    source: 'adhoc',
    status: 'active',
    title: 'Kitchen landing',
    updatedAt: '2026-06-17T00:00:00.000Z',
    ...overrides,
  });
}

async function expectOnlyActiveTasksWritten(
  database: ReturnType<typeof createTestDatabase>,
  activeTaskCount: number,
) {
  expect(await database.activeTasks.count()).toBe(activeTaskCount);
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

describe('active task repository', () => {
  it('distinguishes empty, partial, and failed Today collection reads without changing stored rows', async () => {
    const database = createTestDatabase();

    try {
      await expect(loadActiveTodayTasksResult(database)).resolves.toEqual({
        invalidRecordCount: 0,
        items: [],
        status: 'ok',
      });

      await database.activeTasks.put(validActiveTask());
      await database.activeTasks.put({
        id: 'broken-active-task-result',
        showToday: true,
        source: 'adhoc',
      } as ActiveTask);

      const mixed = await loadActiveTodayTasksResult(database);
      expect(mixed).toMatchObject({
        invalidRecordCount: 1,
        status: 'partial',
      });
      expect(mixed.status === 'readFailed' ? [] : mixed.items.map((task) => task.id)).toEqual([
        'active-kitchen-landing',
      ]);
      expect(await database.activeTasks.count()).toBe(2);

      await expect(loadActiveTodayTasksResult({
        activeTasks: {
          toArray: vi.fn().mockRejectedValue(new Error('synthetic read failure')),
        },
      } as never)).resolves.toEqual({
        errors: ['activeTasks: Saved Today tasks could not be read.'],
        status: 'readFailed',
      });
    } finally {
      await database.delete();
    }
  });

  it('saves and reloads one Add one-off active Today task', async () => {
    const database = createTestDatabase();

    try {
      const result = await saveActiveTodayTask(validActiveTask({
        id: 'active-pay-water-bill',
        source: 'adhoc',
        title: 'Pay water bill',
      }), database);
      const loaded = await loadActiveTodayTasks(database);

      expect(result).toMatchObject({
        alreadyExists: false,
        ok: true,
      });
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({
        id: 'active-pay-water-bill',
        showToday: true,
        source: 'adhoc',
        status: 'active',
        title: 'Pay water bill',
      });
      await expectOnlyActiveTasksWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('saves and reloads one Add to Today task from a Library rhythm', async () => {
    const database = createTestDatabase();

    try {
      const result = await saveActiveTodayTask(validActiveTask({
        id: 'active-from-breakfast-reset',
        source: 'library',
        templateId: 'food-breakfast-reset',
        title: 'Breakfast reset',
      }), database);
      const loaded = await loadActiveTodayTasks(database);

      expect(result).toMatchObject({
        alreadyExists: false,
        ok: true,
      });
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({
        source: 'library',
        templateId: 'food-breakfast-reset',
        title: 'Breakfast reset',
      });
      await expectOnlyActiveTasksWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('reloads visible active Today task states and ignores re-entry or not-Today rows', async () => {
    const database = createTestDatabase();

    try {
      await database.activeTasks.bulkPut([
        validActiveTask({ id: 'active-visible' }),
        validActiveTask({ id: 'active-in-progress', status: 'inProgress' }),
        validActiveTask({ id: 'active-paused', status: 'paused' }),
        validActiveTask({ id: 'active-minimum-done', status: 'minimumDone' }),
        validActiveTask({ id: 'active-not-today', showToday: false }),
        validActiveTask({ id: 'active-parked', status: 'parked' }),
        validActiveTask({ id: 'active-done', status: 'done' }),
        validActiveTask({ id: 'active-skipped', status: 'skipped' }),
        validActiveTask({ id: 'active-not-today-status', status: 'notToday' }),
      ]);

      const loaded = await loadActiveTodayTasks(database);

      expect(loaded.map((task) => task.id).sort()).toEqual([
        'active-in-progress',
        'active-minimum-done',
        'active-paused',
        'active-visible',
      ].sort());
    } finally {
      await database.delete();
    }
  });

  it('loads persisted active tasks for backup without hiding re-entry states', async () => {
    const database = createTestDatabase();

    try {
      await database.activeTasks.bulkPut([
        validActiveTask({ id: 'active-visible' }),
        validActiveTask({ id: 'active-done', showToday: false, status: 'done' }),
        validActiveTask({ id: 'active-parked', showToday: false, status: 'parked' }),
        validActiveTask({ id: 'active-not-today', showToday: false, status: 'notToday' }),
        validActiveTask({ id: 'active-custom', source: 'custom' }),
        {
          id: 'broken-active-task',
          showToday: true,
          source: 'adhoc',
        } as ActiveTask,
      ]);

      const loaded = await loadPersistedActiveTasks(database);
      const result = await loadPersistedActiveTasksResult(database);

      expect(loaded.map((task) => task.id).sort()).toEqual([
        'active-done',
        'active-not-today',
        'active-parked',
        'active-visible',
      ].sort());
      expect(loaded.map((task) => task.status).sort()).toEqual([
        'active',
        'done',
        'notToday',
        'parked',
      ].sort());
      expect(result).toMatchObject({ invalidRecordCount: 2, status: 'partial' });
      expect(result.status === 'readFailed' ? [] : result.items.map((task) => task.id).sort()).toEqual(
        loaded.map((task) => task.id).sort(),
      );
      await expectOnlyActiveTasksWritten(database, 6);
    } finally {
      await database.delete();
    }
  });

  it('does not save invalid active task data', async () => {
    const database = createTestDatabase();

    try {
      const result = await saveActiveTodayTask({
        ...validActiveTask(),
        title: '',
      }, database);

      expect(result.ok).toBe(false);
      await expectOnlyActiveTasksWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('rejects custom source, not-Today, and non-active initial writes for this first persistence step', async () => {
    const database = createTestDatabase();

    try {
      const custom = await saveActiveTodayTask(validActiveTask({
        id: 'active-custom',
        source: 'custom',
      }), database);
      const notToday = await saveActiveTodayTask(validActiveTask({
        id: 'active-not-today',
        showToday: false,
      }), database);
      const inProgress = await saveActiveTodayTask(validActiveTask({
        id: 'active-in-progress',
        status: 'inProgress',
      }), database);

      expect(custom.ok).toBe(false);
      expect(notToday.ok).toBe(false);
      expect(inProgress.ok).toBe(false);
      await expectOnlyActiveTasksWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it.each([
    ['inProgress'],
    ['paused'],
    ['minimumDone'],
  ] as const)('persists visible status update %s without writing other tables', async (status) => {
    const database = createTestDatabase();

    try {
      await saveActiveTodayTask(validActiveTask(), database);

      const result = await updateActiveTaskStatus('active-kitchen-landing', status, database);
      const loaded = await loadActiveTodayTasks(database);

      expect(result).toMatchObject({
        ok: true,
        visibleToday: true,
      });
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({
        showToday: true,
        status,
      });
      await expectOnlyActiveTasksWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('preserves deadline and time-edge fields during status updates', async () => {
    const database = createTestDatabase();

    try {
      await saveActiveTodayTask(validActiveTask({
        dueAt: '2026-06-17T09:00:00.000Z',
        latestUsefulStartAt: '2026-06-17T08:45:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        missedPolicy: 'minimumOnly',
        notUsefulAfter: '2026-06-17T10:00:00.000Z',
        timeConstraint: 'dueBy',
      }), database);

      const result = await updateActiveTaskStatus('active-kitchen-landing', 'paused', database);
      const stored = await database.activeTasks.get('active-kitchen-landing');

      expect(result).toMatchObject({
        ok: true,
        visibleToday: true,
      });
      expect(stored).toMatchObject({
        dueAt: '2026-06-17T09:00:00.000Z',
        latestUsefulStartAt: '2026-06-17T08:45:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        missedPolicy: 'minimumOnly',
        notUsefulAfter: '2026-06-17T10:00:00.000Z',
        status: 'paused',
        timeConstraint: 'dueBy',
      });
      await expectOnlyActiveTasksWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it.each([
    ['done'],
    ['parked'],
    ['skipped'],
    ['notToday'],
  ] as const)('persists re-entry status update %s and removes it from Today loading', async (status) => {
    const database = createTestDatabase();

    try {
      await saveActiveTodayTask(validActiveTask(), database);

      const result = await updateActiveTaskStatus('active-kitchen-landing', status, database);
      const loaded = await loadActiveTodayTasks(database);
      const stored = await database.activeTasks.get('active-kitchen-landing');

      expect(result).toMatchObject({
        ok: true,
        visibleToday: false,
      });
      expect(stored).toMatchObject({
        showToday: false,
        status,
      });
      expect(loaded).toEqual([]);
      await expectOnlyActiveTasksWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('rejects invalid status updates without overwriting the existing task', async () => {
    const database = createTestDatabase();

    try {
      await saveActiveTodayTask(validActiveTask(), database);

      const result = await updateActiveTaskStatus(
        'active-kitchen-landing',
        'missed' as never,
        database,
      );
      const stored = await database.activeTasks.get('active-kitchen-landing');

      expect(result.ok).toBe(false);
      expect(stored).toMatchObject({
        showToday: true,
        status: 'active',
      });
      await expectOnlyActiveTasksWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('updates only the matching active task row', async () => {
    const database = createTestDatabase();

    try {
      await saveActiveTodayTask(validActiveTask({ id: 'active-first' }), database);
      await saveActiveTodayTask(validActiveTask({ id: 'active-second', title: 'Second task' }), database);

      await updateActiveTaskStatus('active-first', 'paused', database);
      const loaded = await loadActiveTodayTasks(database);

      expect(loaded).toHaveLength(2);
      expect(loaded.find((task) => task.id === 'active-first')).toMatchObject({
        status: 'paused',
      });
      expect(loaded.find((task) => task.id === 'active-second')).toMatchObject({
        status: 'active',
      });
      await expectOnlyActiveTasksWritten(database, 2);
    } finally {
      await database.delete();
    }
  });

  it('returns a calm failure when the active task row is missing', async () => {
    const database = createTestDatabase();

    try {
      const result = await updateActiveTaskStatus('missing-task', 'paused', database);

      expect(result).toMatchObject({
        ok: false,
      });
      await expectOnlyActiveTasksWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('ignores invalid stored active tasks safely', async () => {
    const database = createTestDatabase();

    try {
      await database.activeTasks.put({
        id: 'broken-active-task',
        showToday: true,
        source: 'adhoc',
      } as ActiveTask);

      await expect(loadActiveTodayTasks(database)).resolves.toEqual([]);
      expect(await database.activeTasks.count()).toBe(1);
      expect(await database.rhythmTemplates.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('rejects duplicate IDs without silently overwriting', async () => {
    const database = createTestDatabase();

    try {
      await saveActiveTodayTask(validActiveTask(), database);
      const duplicateResult = await saveActiveTodayTask(validActiveTask({
        title: 'Kitchen landing changed',
      }), database);
      const loaded = await loadActiveTodayTasks(database);

      expect(duplicateResult.ok).toBe(false);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe('Kitchen landing');
      await expectOnlyActiveTasksWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('does not create a second active task for the same Library template', async () => {
    const database = createTestDatabase();

    try {
      const first = await saveActiveTodayTask(validActiveTask({
        id: 'active-breakfast-reset',
        source: 'library',
        templateId: 'food-breakfast-reset',
        title: 'Breakfast reset',
      }), database);
      const second = await saveActiveTodayTask(validActiveTask({
        id: 'active-breakfast-reset-copy',
        source: 'library',
        templateId: 'food-breakfast-reset',
        title: 'Breakfast reset duplicate',
      }), database);
      const loaded = await loadActiveTodayTasks(database);

      expect(first).toMatchObject({ alreadyExists: false, ok: true });
      expect(second).toMatchObject({ alreadyExists: true, ok: true });
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe('Breakfast reset');
      await expectOnlyActiveTasksWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('does not read or write localStorage', async () => {
    const database = createTestDatabase();
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
      await saveActiveTodayTask(validActiveTask({
        id: createActiveTaskId('active-localstorage-check'),
      }), database);
      await loadActiveTodayTasks(database);
      await loadPersistedActiveTasks(database);

      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
      await database.delete();
    }
  });

  it('keeps legacy rows valid and rejects malformed Minimum achievement timestamps', () => {
    expect(activeTaskSchema.safeParse(validActiveTask()).success).toBe(true);
    expect(activeTaskSchema.safeParse({
      ...validActiveTask(),
      minimumAchievedAt: 'not-a-timestamp',
    }).success).toBe(false);
    expect(activeTaskSchema.safeParse({
      ...validActiveTask(),
      minimumAchievedAt: '2026-02-31T10:00:00.000Z',
    }).success).toBe(false);
  });

  it('persists Minimum achievement atomically through Keep going, pause, resume, and completion', async () => {
    const database = createTestDatabase();

    try {
      await saveActiveTodayTask(validActiveTask(), database);
      const minimumDone = await updateActiveTaskStatus('active-kitchen-landing', 'minimumDone', database);

      expect(minimumDone).toMatchObject({
        ok: true,
        task: {
          minimumAchievedAt: expect.any(String),
          status: 'minimumDone',
        },
      });
      if (!minimumDone.ok) throw new Error('Minimum transition failed');
      const achievedAt = minimumDone.task.minimumAchievedAt;

      for (const status of ['inProgress', 'paused', 'inProgress', 'done'] as const) {
        const result = await updateActiveTaskStatus('active-kitchen-landing', status, database);
        expect(result).toMatchObject({
          ok: true,
          task: { minimumAchievedAt: achievedAt, status },
        });
      }

      expect(await database.activeTasks.get('active-kitchen-landing')).toMatchObject({
        minimumAchievedAt: achievedAt,
        showToday: false,
        status: 'done',
      });
    } finally {
      await database.delete();
    }
  });

  it('backfills legacy minimumDone evidence but does not guess for legacy inProgress rows', async () => {
    const database = createTestDatabase();

    try {
      await database.activeTasks.bulkPut([
        validActiveTask({ id: 'legacy-minimum', status: 'minimumDone' }),
        validActiveTask({ id: 'legacy-progress', status: 'inProgress' }),
      ]);

      const continued = await updateActiveTaskStatus('legacy-minimum', 'inProgress', database);
      const paused = await updateActiveTaskStatus('legacy-progress', 'paused', database);

      expect(continued).toMatchObject({
        ok: true,
        task: { minimumAchievedAt: expect.any(String), status: 'inProgress' },
      });
      expect(paused).toMatchObject({ ok: true, task: { status: 'paused' } });
      if (paused.ok) expect(paused.task.minimumAchievedAt).toBeUndefined();
    } finally {
      await database.delete();
    }
  });
});
