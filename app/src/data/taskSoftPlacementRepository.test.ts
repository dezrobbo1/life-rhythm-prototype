import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { activeTaskSchema, taskPoolItemSchema, type TaskPoolItem } from './schemas';
import {
  confirmTaskPoolSoftPlacement,
  removeTaskPoolSoftPlacement,
} from './taskSoftPlacementRepository';

let databaseIndex = 0;

function createTestDatabase() {
  databaseIndex += 1;
  return createLifeRhythmDatabase(`life-rhythm-task-soft-placement-${databaseIndex}`);
}

function poolItem(overrides: Partial<TaskPoolItem> = {}): TaskPoolItem {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-07-01T00:00:00.000Z',
    full: { label: 'Complete the whole form', minutes: 20 },
    id: 'pool-school-form',
    minimum: { label: 'Open the form', minutes: 5 },
    normal: { label: 'Fill the first page', minutes: 10 },
    source: 'adhoc',
    status: 'captured',
    title: 'Send school form',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  });
}

const placementInput = {
  blockEnd: '10:30',
  blockId: 'open-morning',
  blockLabel: 'Open morning capacity',
  blockStart: '10:00',
  date: '2026-07-13',
  id: 'placement-school-form',
  taskId: 'pool-school-form',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('task soft placement repository', () => {
  it('saves a user-confirmed placement and marks the Pool item softly placed', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.put(poolItem());

      const result = await confirmTaskPoolSoftPlacement(placementInput, database);

      expect(result).toMatchObject({
        ok: true,
        item: { id: 'pool-school-form', status: 'softPlaced' },
        placement: {
          blockId: 'open-morning',
          placementSource: 'userConfirmed',
          status: 'planned',
          taskId: 'pool-school-form',
        },
      });
      expect(await database.softPlacements.count()).toBe(1);
      expect(await database.taskPoolItems.get('pool-school-form')).toMatchObject({ status: 'softPlaced' });
      expect(await database.activeTasks.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('prevents duplicate task and block placements for the same day', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.bulkPut([
        poolItem(),
        poolItem({ id: 'pool-second-task', title: 'Second task' }),
      ]);
      await confirmTaskPoolSoftPlacement(placementInput, database);

      const duplicateTask = await confirmTaskPoolSoftPlacement({
        ...placementInput,
        id: 'placement-school-form-2',
        blockId: 'open-afternoon',
      }, database);
      const duplicateBlock = await confirmTaskPoolSoftPlacement({
        ...placementInput,
        id: 'placement-second-task',
        taskId: 'pool-second-task',
      }, database);

      expect(duplicateTask.ok).toBe(false);
      expect(duplicateBlock.ok).toBe(false);
      expect(await database.softPlacements.count()).toBe(1);
    } finally {
      await database.delete();
    }
  });

  it('removes a placement without deleting the task and returns it to safely held', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.put(poolItem());
      await confirmTaskPoolSoftPlacement(placementInput, database);

      const result = await removeTaskPoolSoftPlacement('placement-school-form', database);

      expect(result).toMatchObject({
        ok: true,
        item: { status: 'captured' },
        placement: { status: 'removed' },
      });
      expect(await database.taskPoolItems.get('pool-school-form')).toMatchObject({ status: 'captured' });
      expect(await database.softPlacements.get('placement-school-form')).toMatchObject({ status: 'removed' });
      expect(await database.taskPoolItems.count()).toBe(1);
    } finally {
      await database.delete();
    }
  });

  it('restores a parked Pool state when removing its placement', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.put(poolItem({ status: 'parked' }));
      await database.activeTasks.put(activeTaskSchema.parse({
        area: 'admin',
        createdAt: '2026-07-01T00:00:00.000Z',
        full: { label: 'Complete the whole form', minutes: 20 },
        id: 'pool-school-form',
        minimum: { label: 'Open the form', minutes: 5 },
        normal: { label: 'Fill the first page', minutes: 10 },
        showToday: false,
        source: 'adhoc',
        status: 'parked',
        title: 'Send school form',
        updatedAt: '2026-07-01T00:00:00.000Z',
      }));
      await confirmTaskPoolSoftPlacement(placementInput, database);

      const result = await removeTaskPoolSoftPlacement('placement-school-form', database);

      expect(result).toMatchObject({
        ok: true,
        item: { status: 'parked' },
      });
      expect(await database.taskPoolItems.get('pool-school-form')).toMatchObject({ status: 'parked' });
    } finally {
      await database.delete();
    }
  });

  it('preserves a deferred Pool state when removing its placement', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.put(poolItem({
        bringBackAfter: '2026-07-14T09:00:00.000Z',
        status: 'deferred',
      }));
      await confirmTaskPoolSoftPlacement(placementInput, database);

      const result = await removeTaskPoolSoftPlacement('placement-school-form', database);

      expect(result).toMatchObject({
        ok: true,
        item: {
          bringBackAfter: '2026-07-14T09:00:00.000Z',
          status: 'deferred',
        },
      });
      expect(await database.taskPoolItems.get('pool-school-form')).toMatchObject({
        bringBackAfter: '2026-07-14T09:00:00.000Z',
        status: 'deferred',
      });
    } finally {
      await database.delete();
    }
  });

  it('allows a removed placement to be added again with the same deterministic ID', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.put(poolItem());
      await confirmTaskPoolSoftPlacement(placementInput, database);
      await removeTaskPoolSoftPlacement('placement-school-form', database);

      const result = await confirmTaskPoolSoftPlacement(placementInput, database);

      expect(result).toMatchObject({
        ok: true,
        item: { status: 'softPlaced' },
        placement: { status: 'planned' },
      });
      expect(await database.softPlacements.count()).toBe(1);
      expect(await database.softPlacements.get('placement-school-form')).toMatchObject({
        status: 'planned',
      });
      expect(await database.taskPoolItems.get('pool-school-form')).toMatchObject({
        status: 'softPlaced',
      });
    } finally {
      await database.delete();
    }
  });
});
