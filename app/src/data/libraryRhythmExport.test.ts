import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { exportLibraryRhythmBackup } from './libraryRhythmExport';
import { libraryRhythmBackupSchema } from './libraryRhythmBackup';
import { saveCustomLibraryRhythm } from './libraryRhythmRepository';
import { rhythmTemplateSchema, type RhythmTemplate } from './schemas';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-library-rhythm-export-test-${testDatabaseIndex}`);
}

function validRhythm(overrides: Partial<RhythmTemplate> = {}): RhythmTemplate {
  return rhythmTemplateSchema.parse({
    area: 'house',
    createdAt: '2026-06-16T00:00:00.000Z',
    enabled: true,
    full: {
      label: 'Clear the counter and one hidden edge.',
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
    updatedAt: '2026-06-16T00:00:00.000Z',
    ...overrides,
  });
}

async function tableCounts(database: ReturnType<typeof createTestDatabase>) {
  return {
    activeTasks: await database.activeTasks.count(),
    completionLog: await database.completionLog.count(),
    devTickets: await database.devTickets.count(),
    migrationLog: await database.migrationLog.count(),
    resetLog: await database.resetLog.count(),
    rhythmTemplates: await database.rhythmTemplates.count(),
    settings: await database.settings.count(),
    startBoostLog: await database.startBoostLog.count(),
    taskHistory: await database.taskHistory.count(),
  };
}

describe('Library rhythm export backup', () => {
  it('exports saved custom Library rhythms as valid backup JSON', async () => {
    const database = createTestDatabase();

    try {
      await saveCustomLibraryRhythm(validRhythm(), database);
      const backup = await exportLibraryRhythmBackup(database, '2026-06-16T00:00:00.000Z');

      expect(backup).not.toBeNull();
      expect(backup?.fileName).toBe('life-rhythm-library-rhythms-backup-2026-06-16.json');
      expect(backup?.rhythmCount).toBe(1);
      expect(backup?.payload.rhythms[0]).toMatchObject({
        id: 'custom-kitchen-landing',
        source: 'custom',
        title: 'Kitchen landing',
      });
      expect(libraryRhythmBackupSchema.parse(JSON.parse(backup?.json ?? '{}'))).toEqual(backup?.payload);
    } finally {
      await database.delete();
    }
  });

  it('returns null when no saved custom rhythms exist', async () => {
    const database = createTestDatabase();

    try {
      await expect(exportLibraryRhythmBackup(database, '2026-06-16T00:00:00.000Z')).resolves.toBeNull();
    } finally {
      await database.delete();
    }
  });

  it('does not include settings, task, scheduler, migration, reset, future module, or legacy data', async () => {
    const database = createTestDatabase();

    try {
      await saveCustomLibraryRhythm(validRhythm(), database);
      const backup = await exportLibraryRhythmBackup(database, '2026-06-16T00:00:00.000Z');

      expect(backup?.json).not.toMatch(/settings|activeTasks|oneOff|taskHistory|completionLog|startBoostLogs/i);
      expect(backup?.json).not.toMatch(/scheduler|devTickets|migrationLog|resetLog|futureModules|imports|restore/i);
      expect(backup?.json).not.toContain('lifeRhythm_v146');
    } finally {
      await database.delete();
    }
  });

  it('does not include built-in or mock rhythms', async () => {
    const database = createTestDatabase();

    try {
      await saveCustomLibraryRhythm(validRhythm(), database);
      await database.rhythmTemplates.put(validRhythm({
        id: 'built-in-breakfast-reset',
        source: 'built-in',
        title: 'Breakfast reset',
      }));

      const backup = await exportLibraryRhythmBackup(database, '2026-06-16T00:00:00.000Z');

      expect(backup?.payload.rhythms).toHaveLength(1);
      expect(backup?.json).toContain('Kitchen landing');
      expect(backup?.json).not.toContain('Breakfast reset');
      expect(backup?.json).not.toContain('built-in');
    } finally {
      await database.delete();
    }
  });

  it('exports only approved Library rhythm backup fields', async () => {
    const database = createTestDatabase();

    try {
      await saveCustomLibraryRhythm(validRhythm(), database);
      const backup = await exportLibraryRhythmBackup(database, '2026-06-16T00:00:00.000Z');
      const rhythm = backup?.payload.rhythms[0];

      expect(Object.keys(backup?.payload ?? {}).sort()).toEqual(['appVersion', 'exportedAt', 'format', 'rhythms']);
      expect(Object.keys(rhythm ?? {}).sort()).toEqual([
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
      await saveCustomLibraryRhythm(validRhythm(), database);
      await exportLibraryRhythmBackup(database, '2026-06-16T00:00:00.000Z');

      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
      await database.delete();
    }
  });

  it('does not write Dexie tables while exporting', async () => {
    const database = createTestDatabase();

    try {
      await saveCustomLibraryRhythm(validRhythm(), database);
      const before = await tableCounts(database);
      await exportLibraryRhythmBackup(database, '2026-06-16T00:00:00.000Z');
      const after = await tableCounts(database);

      expect(after).toEqual(before);
    } finally {
      await database.delete();
    }
  });
});
