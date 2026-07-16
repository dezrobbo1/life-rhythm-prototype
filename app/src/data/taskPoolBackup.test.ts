import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { taskPoolItemSchema, type TaskPoolItem } from './schemas';
import {
  buildTaskPoolBackupPayload,
  exportTaskPoolBackup,
  parseTaskPoolBackupJson,
  serializeTaskPoolBackup,
  TASK_POOL_BACKUP_FORMAT,
  validateTaskPoolBackup,
} from './taskPoolBackup';

const exportedAt = '2026-07-16T01:00:00.000Z';

let databaseIndex = 0;

function createTestDatabase() {
  databaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-task-pool-backup-test-${databaseIndex}`);
}

function validTaskPoolItem(overrides: Partial<TaskPoolItem> = {}): TaskPoolItem {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-07-15T00:00:00.000Z',
    full: {
      label: 'Complete the whole form',
      minutes: 20,
    },
    id: 'pool-school-form',
    minimum: {
      label: 'Open the form',
      minutes: 5,
    },
    normal: {
      label: 'Fill the first page',
      minutes: 10,
    },
    source: 'adhoc',
    status: 'captured',
    title: 'Send school form',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...overrides,
  });
}

function validTaskPoolBackupJson() {
  return serializeTaskPoolBackup(buildTaskPoolBackupPayload([
    validTaskPoolItem(),
    validTaskPoolItem({
      bringBackAfter: '2026-07-18T09:00:00.000Z',
      id: 'pool-park-car',
      status: 'deferred',
      title: 'Park the car task',
    }),
  ], exportedAt));
}

describe('Task Pool backup', () => {
  it('builds a valid backup payload with Pool rows and deferral metadata', () => {
    const payload = buildTaskPoolBackupPayload([
      validTaskPoolItem({
        bringBackAfter: '2026-07-18T09:00:00.000Z',
        status: 'deferred',
      }),
    ], exportedAt);

    expect(Object.keys(payload).sort()).toEqual(['appVersion', 'exportedAt', 'format', 'items']);
    expect(payload.format).toBe(TASK_POOL_BACKUP_FORMAT);
    expect(payload.exportedAt).toBe(exportedAt);
    expect(payload.items[0]).toMatchObject({
      bringBackAfter: '2026-07-18T09:00:00.000Z',
      status: 'deferred',
      title: 'Send school form',
    });
  });

  it('preserves all supported Pool item fields without mixing in other data classes', () => {
    const payload = buildTaskPoolBackupPayload([
      validTaskPoolItem({
        dueAt: '2026-07-16T10:00:00.000Z',
        latestUsefulStartAt: '2026-07-16T09:00:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        missedPolicy: 'minimumOnly',
        notes: 'Bring the saved note.',
        notUsefulAfter: '2026-07-17T10:00:00.000Z',
        purpose: 'Keep the form moving.',
        timeConstraint: 'dueBy',
      }),
    ], exportedAt);

    expect(payload.items[0]).toMatchObject({
      dueAt: '2026-07-16T10:00:00.000Z',
      latestUsefulStartAt: '2026-07-16T09:00:00.000Z',
      minimumStillUsefulAfterDeadline: true,
      missedPolicy: 'minimumOnly',
      notes: 'Bring the saved note.',
      notUsefulAfter: '2026-07-17T10:00:00.000Z',
      purpose: 'Keep the form moving.',
      timeConstraint: 'dueBy',
    });
    expect(payload).not.toHaveProperty('activeTasks');
    expect(payload).not.toHaveProperty('settings');
    expect(payload).not.toHaveProperty('placements');
  });

  it('serializes a payload that parses through Task Pool backup validation', () => {
    const result = parseTaskPoolBackupJson(validTaskPoolBackupJson());

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.preview.itemCount).toBe(2);
      expect(result.preview.deferredCount).toBe(1);
      expect(result.preview.includesDeferralMetadata).toBe(true);
      expect(result.preview.statusSummary).toBe('1 captured, 1 deferred');
      expect(result.preview.itemTitles).toEqual(['Send school form', 'Park the car task']);
    }
  });

  it('validates a Task Pool backup and returns a read-only preview', () => {
    const result = validateTaskPoolBackup(JSON.parse(validTaskPoolBackupJson()) as unknown);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.payload.items).toHaveLength(2);
      expect(result.preview.exportedAt).toBe(exportedAt);
      expect(result.preview.statusSummary).toBe('1 captured, 1 deferred');
    }
  });

  it('rejects malformed JSON and invalid backup metadata', () => {
    expect(parseTaskPoolBackupJson('{ not json')).toEqual({
      errors: ['backup: Task Pool backup JSON is malformed.'],
      ok: false,
    });

    const invalid = validateTaskPoolBackup({
      appVersion: '1.4.6',
      exportedAt: '2026-02-31T00:00:00.000Z',
      format: 'life-rhythm-settings-backup',
      items: [],
    });

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors.join(' ')).toContain('format');
      expect(invalid.errors.join(' ')).toContain('exportedAt');
    }
  });

  it('rejects duplicate item IDs and mixed-data payloads', () => {
    const duplicate = validateTaskPoolBackup({
      appVersion: '1.4.6',
      exportedAt,
      format: TASK_POOL_BACKUP_FORMAT,
      items: [validTaskPoolItem(), validTaskPoolItem()],
    });
    const mixed = validateTaskPoolBackup({
      appVersion: '1.4.6',
      exportedAt,
      format: TASK_POOL_BACKUP_FORMAT,
      items: [],
      settings: {},
    });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.errors.join(' ')).toContain('Duplicate Pool item IDs');
    }
    expect(mixed.ok).toBe(false);
    if (!mixed.ok) {
      expect(mixed.errors[0]).toContain('settings');
    }
  });

  it('exports all saved Pool rows and returns an empty result when none exist', async () => {
    const database = createTestDatabase();

    try {
      expect(await exportTaskPoolBackup(database, exportedAt)).toBeNull();

      await database.taskPoolItems.bulkPut([
        validTaskPoolItem(),
        validTaskPoolItem({
          bringBackAfter: '2026-07-18T09:00:00.000Z',
          id: 'pool-park-car',
          status: 'deferred',
          title: 'Park the car task',
        }),
      ]);

      const backup = await exportTaskPoolBackup(database, exportedAt);

      expect(backup).not.toBeNull();
      expect(backup?.fileName).toBe('life-rhythm-task-pool-backup-2026-07-16.json');
      expect(backup?.itemCount).toBe(2);
      expect(backup?.payload.items.find((item) => item.id === 'pool-park-car')).toMatchObject({
        bringBackAfter: '2026-07-18T09:00:00.000Z',
        status: 'deferred',
      });
    } finally {
      await database.delete();
    }
  });

  it('does not write to the database while validating or serializing', async () => {
    const database = createTestDatabase();

    try {
      const putSpy = vi.spyOn(database.taskPoolItems, 'put');
      const payload = buildTaskPoolBackupPayload([validTaskPoolItem()], exportedAt);

      expect(validateTaskPoolBackup(payload).ok).toBe(true);
      serializeTaskPoolBackup(payload);
      expect(putSpy).not.toHaveBeenCalled();
      expect(await database.taskPoolItems.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });
});
