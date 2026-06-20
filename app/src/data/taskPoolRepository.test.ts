import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import {
  createTaskPoolItemId,
  getTaskPoolItem,
  loadTaskPoolItems,
  loadTaskPoolItemsByStatus,
  markTaskPoolItemNoLongerNeeded,
  saveTaskPoolItem,
  updateTaskPoolItemStatus,
} from './taskPoolRepository';
import { taskPoolItemSchema, type TaskPoolItem } from './schemas';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-task-pool-test-${testDatabaseIndex}`);
}

function validTaskPoolItem(overrides: Partial<TaskPoolItem> = {}): TaskPoolItem {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-06-20T00:00:00.000Z',
    full: {
      label: 'Complete the form and file the confirmation.',
      minutes: 30,
    },
    id: 'task-pool-pay-water-bill',
    minimum: {
      label: 'Open the water bill.',
      minutes: 5,
    },
    normal: {
      label: 'Pay the water bill.',
      minutes: 10,
    },
    source: 'adhoc',
    status: 'captured',
    title: 'Pay water bill',
    updatedAt: '2026-06-20T00:00:00.000Z',
    ...overrides,
  });
}

async function expectOnlyTaskPoolItemsWritten(
  database: ReturnType<typeof createTestDatabase>,
  taskPoolItemCount: number,
) {
  expect(await database.taskPoolItems.count()).toBe(taskPoolItemCount);
  expect(await database.activeTasks.count()).toBe(0);
  expect(await database.settings.count()).toBe(0);
  expect(await database.rhythmTemplates.count()).toBe(0);
  expect(await database.softPlacements.count()).toBe(0);
  expect(await database.taskHistory.count()).toBe(0);
  expect(await database.completionLog.count()).toBe(0);
  expect(await database.resetLog.count()).toBe(0);
  expect(await database.startBoostLog.count()).toBe(0);
  expect(await database.devTickets.count()).toBe(0);
  expect(await database.migrationLog.count()).toBe(0);
}

describe('task pool repository', () => {
  it('schema accepts a valid captured task pool item', () => {
    const result = taskPoolItemSchema.safeParse(validTaskPoolItem());

    expect(result.success).toBe(true);
  });

  it('schema rejects an invalid task pool status', () => {
    const result = taskPoolItemSchema.safeParse({
      ...validTaskPoolItem(),
      status: 'active',
    });

    expect(result.success).toBe(false);
  });

  it('saves and reloads a captured task pool item', async () => {
    const database = createTestDatabase();

    try {
      const result = await saveTaskPoolItem(validTaskPoolItem(), database);
      const loaded = await loadTaskPoolItems(database);

      expect(result).toMatchObject({
        ok: true,
        item: {
          id: 'task-pool-pay-water-bill',
          source: 'adhoc',
          status: 'captured',
          title: 'Pay water bill',
        },
      });
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({
        minimum: {
          label: 'Open the water bill.',
          minutes: 5,
        },
        normal: {
          label: 'Pay the water bill.',
          minutes: 10,
        },
      });
      await expectOnlyTaskPoolItemsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('loads task pool items by status', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem({
        id: 'task-pool-captured',
        status: 'captured',
        title: 'Captured task',
      }), database);
      await saveTaskPoolItem(validTaskPoolItem({
        id: 'task-pool-parked',
        status: 'parked',
        title: 'Parked task',
      }), database);

      const captured = await loadTaskPoolItemsByStatus('captured', database);
      const parked = await loadTaskPoolItemsByStatus('parked', database);
      const invalid = await loadTaskPoolItemsByStatus('active' as never, database);

      expect(captured.map((item) => item.title)).toEqual(['Captured task']);
      expect(parked.map((item) => item.title)).toEqual(['Parked task']);
      expect(invalid).toEqual([]);
      await expectOnlyTaskPoolItemsWritten(database, 2);
    } finally {
      await database.delete();
    }
  });

  it('gets one task pool item by ID', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);

      const found = await getTaskPoolItem('task-pool-pay-water-bill', database);
      const missing = await getTaskPoolItem('missing-task-pool-item', database);

      expect(found?.title).toBe('Pay water bill');
      expect(missing).toBeNull();
      await expectOnlyTaskPoolItemsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('updates task pool item status and updatedAt only on the item row', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);

      const result = await updateTaskPoolItemStatus('task-pool-pay-water-bill', 'deferred', database);
      const loaded = await loadTaskPoolItems(database);

      expect(result).toMatchObject({
        ok: true,
        item: {
          status: 'deferred',
        },
      });
      expect(loaded[0].status).toBe('deferred');
      expect(loaded[0].updatedAt).not.toBe('2026-06-20T00:00:00.000Z');
      await expectOnlyTaskPoolItemsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('marks a task pool item no longer needed without deleting it', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);

      const result = await markTaskPoolItemNoLongerNeeded('task-pool-pay-water-bill', database);
      const loaded = await loadTaskPoolItems(database);

      expect(result).toMatchObject({
        ok: true,
        item: {
          status: 'noLongerNeeded',
        },
      });
      expect(loaded).toHaveLength(1);
      expect(loaded[0].status).toBe('noLongerNeeded');
      await expectOnlyTaskPoolItemsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('rejects invalid writes and does not save them', async () => {
    const database = createTestDatabase();

    try {
      const result = await saveTaskPoolItem({
        ...validTaskPoolItem(),
        title: '',
      }, database);

      expect(result.ok).toBe(false);
      await expectOnlyTaskPoolItemsWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('rejects duplicate IDs without silently overwriting', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);
      const duplicate = await saveTaskPoolItem(validTaskPoolItem({
        title: 'Changed title',
      }), database);
      const loaded = await loadTaskPoolItems(database);

      expect(duplicate.ok).toBe(false);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe('Pay water bill');
      await expectOnlyTaskPoolItemsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('validates deadline and usefulness fields on task pool items', async () => {
    const database = createTestDatabase();

    try {
      const valid = await saveTaskPoolItem(validTaskPoolItem({
        dueAt: '2026-06-20T09:00:00.000Z',
        latestUsefulStartAt: '2026-06-20T08:30:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        missedPolicy: 'minimumOnly',
        notUsefulAfter: '2026-06-20T10:00:00.000Z',
        timeConstraint: 'dueBy',
      }), database);
      expect(valid.ok).toBe(true);
      const invalidResult = await saveTaskPoolItem({
        ...validTaskPoolItem({
          id: 'task-pool-invalid-time-edge',
        }),
        dueAt: '2026-06-20T09:00:00.000Z',
        timeConstraint: 'flexible',
      }, database);

      expect(invalidResult.ok).toBe(false);
      await expectOnlyTaskPoolItemsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('rejects invalid status updates without overwriting the item', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);

      const result = await updateTaskPoolItemStatus(
        'task-pool-pay-water-bill',
        'inProgress' as never,
        database,
      );
      const loaded = await loadTaskPoolItems(database);

      expect(result.ok).toBe(false);
      expect(loaded[0].status).toBe('captured');
      await expectOnlyTaskPoolItemsWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('ignores invalid stored task pool items safely', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.put({
        id: 'broken-task-pool-item',
        source: 'adhoc',
      } as TaskPoolItem);

      await expect(loadTaskPoolItems(database)).resolves.toEqual([]);
      expect(await database.taskPoolItems.count()).toBe(1);
      expect(await database.activeTasks.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('does not read localStorage or write other data tables', async () => {
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
      await saveTaskPoolItem(validTaskPoolItem({
        id: createTaskPoolItemId('task-pool-storage-check'),
      }), database);
      await loadTaskPoolItems(database);
      await updateTaskPoolItemStatus(
        (await loadTaskPoolItems(database))[0].id,
        'suggested',
        database,
      );

      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
      await expectOnlyTaskPoolItemsWritten(database, 1);
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
      await database.delete();
    }
  });
});
