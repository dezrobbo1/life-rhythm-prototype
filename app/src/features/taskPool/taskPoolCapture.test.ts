import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from '../../data/db';
import { captureTaskPoolItem, type TaskPoolCaptureInput } from './taskPoolCapture';

let databaseIndex = 0;

function createTestDatabase() {
  databaseIndex += 1;
  return createLifeRhythmDatabase(`task-pool-capture-${databaseIndex}`);
}

function input(overrides: Partial<TaskPoolCaptureInput> = {}): TaskPoolCaptureInput {
  return {
    area: 'admin',
    fullVersion: '',
    fullMinutes: '',
    minimumVersion: 'Write one line',
    minimumMinutes: '7',
    normalVersion: '',
    normalMinutes: '',
    title: 'Capture this safely',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shared Task Pool capture authority', () => {
  it('writes one captured item without creating Today work or a placement', async () => {
    const database = createTestDatabase();

    try {
      await expect(captureTaskPoolItem(input(), {
        createId: () => 'captured-once',
        now: () => new Date('2026-09-20T10:00:00.000Z'),
        store: database,
      })).resolves.toMatchObject({ ok: true });

      expect(await database.taskPoolItems.toArray()).toEqual([
        expect.objectContaining({
          id: 'captured-once', status: 'captured', title: 'Capture this safely',
          minimum: { label: 'Write one line', minutes: 7 },
          normal: { label: 'Write one line', minutes: 7 },
          full: { label: 'Write one line', minutes: 7 },
        }),
      ]);
      expect(await database.activeTasks.count()).toBe(0);
      expect(await database.softPlacements.count()).toBe(0);
      expect(await database.schedulerPlanState.count()).toBe(0);
      expect(await database.rhythmTemplates.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('permits a non-destructive single-item write after a partial read and leaves invalid rows unchanged', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.put({ id: 'unreadable-held-row' } as never);

      await expect(captureTaskPoolItem(input(), {
        createId: () => 'captured-beside-invalid',
        store: database,
      })).resolves.toMatchObject({ ok: true });

      expect(await database.taskPoolItems.count()).toBe(2);
      expect(await database.taskPoolItems.get('unreadable-held-row')).toEqual({ id: 'unreadable-held-row' });
    } finally {
      await database.delete();
    }
  });

  it('fails closed without writing when the saved collection cannot be read', async () => {
    const database = createTestDatabase();
    const putSpy = vi.spyOn(database.taskPoolItems, 'put');
    vi.spyOn(database.taskPoolItems, 'toArray').mockRejectedValueOnce(new Error('storage unavailable'));

    try {
      await expect(captureTaskPoolItem(input(), { store: database })).resolves.toEqual({
        errors: ['Saved Held tasks could not be read, so nothing was captured. Retry when device storage is available.'],
        ok: false,
      });
      expect(putSpy).not.toHaveBeenCalled();
    } finally {
      await database.delete();
    }
  });
});
