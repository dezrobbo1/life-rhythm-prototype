import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import {
  loadCustomLibraryRhythms,
  saveCustomLibraryRhythm,
} from './libraryRhythmRepository';
import { rhythmTemplateSchema, type RhythmTemplate } from './schemas';
import { mockLibraryRhythms } from '../features/library/mockLibraryData';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;

  return createLifeRhythmDatabase(`life-rhythm-library-rhythm-test-${testDatabaseIndex}`);
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

async function expectOnlyRhythmTemplatesWritten(database: ReturnType<typeof createTestDatabase>, rhythmCount: number) {
  expect(await database.rhythmTemplates.count()).toBe(rhythmCount);
  expect(await database.settings.count()).toBe(0);
  expect(await database.activeTasks.count()).toBe(0);
  expect(await database.taskHistory.count()).toBe(0);
  expect(await database.completionLog.count()).toBe(0);
  expect(await database.resetLog.count()).toBe(0);
  expect(await database.startBoostLog.count()).toBe(0);
  expect(await database.devTickets.count()).toBe(0);
  expect(await database.migrationLog.count()).toBe(0);
}

describe('Library rhythm repository', () => {
  it('saves and reloads one user-created Library rhythm', async () => {
    const database = createTestDatabase();

    try {
      const result = await saveCustomLibraryRhythm(validRhythm(), database);
      const loaded = await loadCustomLibraryRhythms(database);

      expect(result.ok).toBe(true);
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({
        id: 'custom-kitchen-landing',
        source: 'custom',
        title: 'Kitchen landing',
      });
      expect(loaded[0].enabled).toBe(false);
      await expectOnlyRhythmTemplatesWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('loads an empty custom-rhythm list when none are stored', async () => {
    const database = createTestDatabase();

    try {
      await expect(loadCustomLibraryRhythms(database)).resolves.toEqual([]);
      await expectOnlyRhythmTemplatesWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('does not save invalid created rhythm data', async () => {
    const database = createTestDatabase();

    try {
      const result = await saveCustomLibraryRhythm({
        ...validRhythm(),
        title: '',
      }, database);

      expect(result.ok).toBe(false);
      await expectOnlyRhythmTemplatesWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('ignores invalid stored custom rhythms safely', async () => {
    const database = createTestDatabase();

    try {
      await database.rhythmTemplates.put({
        id: 'broken-custom-rhythm',
        source: 'custom',
      } as RhythmTemplate);

      await expect(loadCustomLibraryRhythms(database)).resolves.toEqual([]);
      expect(await database.rhythmTemplates.count()).toBe(1);
      expect(await database.activeTasks.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it('rejects built-in and mock rhythms', async () => {
    const database = createTestDatabase();

    try {
      const builtInResult = await saveCustomLibraryRhythm(validRhythm({
        id: 'built-in-kitchen-landing',
        source: 'built-in',
      }), database);
      const mockResult = await saveCustomLibraryRhythm(mockLibraryRhythms[0], database);

      expect(builtInResult.ok).toBe(false);
      expect(mockResult.ok).toBe(false);
      await expectOnlyRhythmTemplatesWritten(database, 0);
    } finally {
      await database.delete();
    }
  });

  it('rejects duplicate IDs without silently overwriting', async () => {
    const database = createTestDatabase();

    try {
      await saveCustomLibraryRhythm(validRhythm(), database);
      const duplicateResult = await saveCustomLibraryRhythm(validRhythm({
        title: 'Kitchen landing changed',
      }), database);
      const loaded = await loadCustomLibraryRhythms(database);

      expect(duplicateResult.ok).toBe(false);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe('Kitchen landing');
      await expectOnlyRhythmTemplatesWritten(database, 1);
    } finally {
      await database.delete();
    }
  });

  it('allows duplicate titles when IDs differ', async () => {
    const database = createTestDatabase();

    try {
      const first = await saveCustomLibraryRhythm(validRhythm(), database);
      const second = await saveCustomLibraryRhythm(validRhythm({
        id: 'custom-kitchen-landing-copy',
      }), database);
      const loaded = await loadCustomLibraryRhythms(database);

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(loaded.map((rhythm) => rhythm.title)).toEqual(['Kitchen landing', 'Kitchen landing']);
      await expectOnlyRhythmTemplatesWritten(database, 2);
    } finally {
      await database.delete();
    }
  });

  it('does not persist enablement state', async () => {
    const database = createTestDatabase();

    try {
      await saveCustomLibraryRhythm(validRhythm({ enabled: true }), database);
      const stored = await database.rhythmTemplates.get('custom-kitchen-landing');
      const loaded = await loadCustomLibraryRhythms(database);

      expect(stored?.enabled).toBe(false);
      expect(loaded[0].enabled).toBe(false);
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
      await loadCustomLibraryRhythms(database);

      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
      await database.delete();
    }
  });
});
