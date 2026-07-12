import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { loadActiveTodayTasks, updateActiveTaskStatus } from './activeTaskRepository';
import {
  bringTaskPoolItemToToday,
  markTaskLifecycleNoLongerNeeded,
  updateTaskLifecycleStatus,
} from './taskLifecycleRepository';
import { confirmTaskPoolSoftPlacement } from './taskSoftPlacementRepository';
import { saveTaskPoolItem } from './taskPoolRepository';
import { taskPoolItemSchema, type TaskPoolItem } from './schemas';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-task-lifecycle-test-${testDatabaseIndex}`);
}

function validTaskPoolItem(overrides: Partial<TaskPoolItem> = {}): TaskPoolItem {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-07-12T00:00:00.000Z',
    full: {
      label: 'Complete the form and file the confirmation.',
      minutes: 20,
    },
    id: 'task-pool-form',
    minimum: {
      label: 'Open the form.',
      minutes: 5,
    },
    normal: {
      label: 'Fill in the first section.',
      minutes: 10,
    },
    purpose: 'Keep the form safely visible.',
    source: 'adhoc',
    status: 'captured',
    title: 'Complete form',
    updatedAt: '2026-07-12T00:00:00.000Z',
    ...overrides,
  });
}

async function addSoftPlacement(database: ReturnType<typeof createTestDatabase>) {
  return confirmTaskPoolSoftPlacement({
    blockEnd: '10:30',
    blockId: 'open-morning',
    blockLabel: 'Open morning capacity',
    blockStart: '10:00',
    date: '2026-07-13',
    id: 'placement-task-pool-form',
    taskId: 'task-pool-form',
  }, database);
}

describe('task lifecycle repository', () => {
  it('moves a captured Pool item into Today without changing its identity', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);

      const result = await bringTaskPoolItemToToday('task-pool-form', database);
      const storedPoolItem = await database.taskPoolItems.get('task-pool-form');
      const storedActiveTask = await database.activeTasks.get('task-pool-form');

      expect(result).toMatchObject({
        alreadyInToday: false,
        item: {
          id: 'task-pool-form',
          status: 'today',
        },
        ok: true,
        task: {
          id: 'task-pool-form',
          showToday: true,
          status: 'active',
          title: 'Complete form',
        },
      });
      expect(storedPoolItem).toMatchObject({
        id: 'task-pool-form',
        status: 'today',
      });
      expect(storedActiveTask).toMatchObject({
        id: 'task-pool-form',
        minimum: {
          label: 'Open the form.',
          minutes: 5,
        },
        showToday: true,
        status: 'active',
      });
      expect(await loadActiveTodayTasks(database)).toHaveLength(1);
      expect(await database.softPlacements.count()).toBe(0);
      expect(await database.taskHistory.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('is idempotent when the Pool item is already visible in Today', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);
      await bringTaskPoolItemToToday('task-pool-form', database);

      const secondResult = await bringTaskPoolItemToToday('task-pool-form', database);

      expect(secondResult).toMatchObject({
        alreadyInToday: true,
        ok: true,
      });
      expect(await database.activeTasks.count()).toBe(1);
      expect(await database.taskPoolItems.count()).toBe(1);
    } finally {
      await database.delete();
    }
  });

  it('returns parked and not-today tasks to the Holding Tray and can bring them back', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);
      await bringTaskPoolItemToToday('task-pool-form', database);

      const parked = await updateActiveTaskStatus('task-pool-form', 'parked', database);

      expect(parked).toMatchObject({
        ok: true,
        visibleToday: false,
      });
      expect(await database.taskPoolItems.get('task-pool-form')).toMatchObject({
        status: 'parked',
      });
      expect(await loadActiveTodayTasks(database)).toEqual([]);

      const returned = await bringTaskPoolItemToToday('task-pool-form', database);

      expect(returned).toMatchObject({
        alreadyInToday: false,
        ok: true,
        task: {
          showToday: true,
          status: 'active',
        },
      });
      expect(await database.taskPoolItems.get('task-pool-form')).toMatchObject({
        status: 'today',
      });

      await updateActiveTaskStatus('task-pool-form', 'notToday', database);

      expect(await database.taskPoolItems.get('task-pool-form')).toMatchObject({
        status: 'notToday',
      });
      expect(await loadActiveTodayTasks(database)).toEqual([]);
    } finally {
      await database.delete();
    }
  });

  it('removes a planned placement when a linked Today task is parked', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);
      await addSoftPlacement(database);
      await bringTaskPoolItemToToday('task-pool-form', database);

      const result = await updateTaskLifecycleStatus('task-pool-form', 'parked', database);

      expect(result).toMatchObject({
        item: { status: 'parked' },
        ok: true,
        placements: [{ status: 'removed' }],
        task: { showToday: false, status: 'parked' },
      });
      expect(await database.softPlacements.get('placement-task-pool-form')).toMatchObject({
        status: 'removed',
      });
    } finally {
      await database.delete();
    }
  });

  it('marks a planned placement completed when the linked Today task is done', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);
      await addSoftPlacement(database);
      await bringTaskPoolItemToToday('task-pool-form', database);

      const result = await updateTaskLifecycleStatus('task-pool-form', 'done', database);

      expect(result).toMatchObject({
        item: { status: 'noLongerNeeded' },
        ok: true,
        placements: [{ status: 'completedFromToday' }],
        task: { showToday: false, status: 'done' },
      });
      expect(await database.softPlacements.get('placement-task-pool-form')).toMatchObject({
        status: 'completedFromToday',
      });
    } finally {
      await database.delete();
    }
  });

  it('marks Pool, Today, and placement records consistently as no longer needed', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);
      await addSoftPlacement(database);
      await bringTaskPoolItemToToday('task-pool-form', database);

      const result = await markTaskLifecycleNoLongerNeeded('task-pool-form', database);

      expect(result).toMatchObject({
        item: { status: 'noLongerNeeded' },
        ok: true,
        placements: [{ status: 'removed' }],
        task: { showToday: false, status: 'skipped' },
      });
      expect(await database.taskPoolItems.get('task-pool-form')).toMatchObject({
        status: 'noLongerNeeded',
      });
      expect(await database.activeTasks.get('task-pool-form')).toMatchObject({
        showToday: false,
        status: 'skipped',
      });
      expect(await database.softPlacements.get('placement-task-pool-form')).toMatchObject({
        status: 'removed',
      });
    } finally {
      await database.delete();
    }
  });

  it('retains a completed row while removing it from active Pool and Today surfaces', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem(), database);
      await bringTaskPoolItemToToday('task-pool-form', database);
      await updateActiveTaskStatus('task-pool-form', 'done', database);

      expect(await database.activeTasks.get('task-pool-form')).toMatchObject({
        showToday: false,
        status: 'done',
      });
      expect(await database.taskPoolItems.get('task-pool-form')).toMatchObject({
        status: 'noLongerNeeded',
      });
      expect(await database.activeTasks.count()).toBe(1);
      expect(await database.taskPoolItems.count()).toBe(1);
    } finally {
      await database.delete();
    }
  });

  it('does not revive a Pool item already marked no longer needed', async () => {
    const database = createTestDatabase();

    try {
      await saveTaskPoolItem(validTaskPoolItem({ status: 'noLongerNeeded' }), database);

      const result = await bringTaskPoolItemToToday('task-pool-form', database);

      expect(result).toMatchObject({
        ok: false,
      });
      expect(await database.activeTasks.count()).toBe(0);
      expect(await database.taskPoolItems.get('task-pool-form')).toMatchObject({
        status: 'noLongerNeeded',
      });
    } finally {
      await database.delete();
    }
  });
});
