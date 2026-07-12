import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { taskPoolItemSchema, type TaskPoolItem } from './schemas';
import { bringTaskPoolItemToToday } from './taskLifecycleRepository';
import { deferTaskPoolItem } from './taskPoolDeferralRepository';

let databaseIndex = 0;

function createTestDatabase() {
  databaseIndex += 1;
  return createLifeRhythmDatabase(`life-rhythm-task-deferral-${databaseIndex}`);
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

describe('task Pool deferral repository', () => {
  it('holds a task until a user-chosen future time', async () => {
    const database = createTestDatabase();
    const now = new Date('2026-07-12T08:00:00.000Z');

    try {
      await database.taskPoolItems.put(poolItem());

      const result = await deferTaskPoolItem(
        'pool-school-form',
        '2026-07-13T09:00:00.000Z',
        database,
        now,
      );

      expect(result).toMatchObject({
        ok: true,
        item: {
          bringBackAfter: '2026-07-13T09:00:00.000Z',
          status: 'deferred',
        },
      });
      expect(await database.taskPoolItems.get('pool-school-form')).toMatchObject({
        bringBackAfter: '2026-07-13T09:00:00.000Z',
        status: 'deferred',
      });
    } finally {
      await database.delete();
    }
  });

  it('rejects invalid, past, and incompatible deferral requests', async () => {
    const database = createTestDatabase();
    const now = new Date('2026-07-12T08:00:00.000Z');

    try {
      await database.taskPoolItems.bulkPut([
        poolItem(),
        poolItem({ id: 'softly-placed', status: 'softPlaced' }),
      ]);

      expect((await deferTaskPoolItem('pool-school-form', 'not-a-date', database, now)).ok).toBe(false);
      expect((await deferTaskPoolItem(
        'pool-school-form',
        '2026-07-12T07:00:00.000Z',
        database,
        now,
      )).ok).toBe(false);
      expect((await deferTaskPoolItem(
        'softly-placed',
        '2026-07-13T09:00:00.000Z',
        database,
        now,
      )).ok).toBe(false);

      expect(await database.taskPoolItems.get('pool-school-form')).toMatchObject({ status: 'captured' });
      expect(await database.taskPoolItems.get('softly-placed')).toMatchObject({ status: 'softPlaced' });
    } finally {
      await database.delete();
    }
  });

  it('clears the old bring-back time when the task moves into Today', async () => {
    const database = createTestDatabase();
    const now = new Date('2026-07-12T08:00:00.000Z');

    try {
      await database.taskPoolItems.put(poolItem());
      await deferTaskPoolItem(
        'pool-school-form',
        '2026-07-13T09:00:00.000Z',
        database,
        now,
      );

      const result = await bringTaskPoolItemToToday('pool-school-form', database);

      expect(result).toMatchObject({
        ok: true,
        item: { status: 'today' },
      });
      expect(await database.taskPoolItems.get('pool-school-form')).toMatchObject({
        status: 'today',
      });
      expect((await database.taskPoolItems.get('pool-school-form'))?.bringBackAfter).toBeUndefined();
    } finally {
      await database.delete();
    }
  });
});
