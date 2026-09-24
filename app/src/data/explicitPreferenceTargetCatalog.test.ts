import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  activeTaskSchema,
  rhythmTemplateSchema,
  taskPoolItemSchema,
} from './schemas';
import { loadExplicitPreferenceTargetCatalog } from './explicitPreferenceTargetCatalog';

let index = 0;
const timestamp = '2026-09-24T10:00:00.000Z';

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate7d2-targets-${++index}`));
});

function versions() {
  return {
    minimum: { label: 'Open it', minutes: 5 },
    normal: { label: 'Do it', minutes: 20 },
    full: { label: 'Finish it', minutes: 40 },
  };
}

describe('Gate 7D2 preference target catalog', () => {
  it('uses user-facing titles and excludes completed/no-longer-needed tasks', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.activeTasks.bulkPut([
      activeTaskSchema.parse({
        id: 'active-task',
        title: 'Call school',
        area: 'admin',
        source: 'adhoc',
        status: 'active',
        showToday: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...versions(),
      }),
      activeTaskSchema.parse({
        id: 'done-task',
        title: 'Finished thing',
        area: 'admin',
        source: 'adhoc',
        status: 'done',
        showToday: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...versions(),
      }),
    ]);
    await database.taskPoolItems.bulkPut([
      taskPoolItemSchema.parse({
        id: 'held-task',
        title: 'Send form',
        area: 'work',
        source: 'adhoc',
        status: 'captured',
        createdAt: timestamp,
        updatedAt: timestamp,
        ...versions(),
      }),
      taskPoolItemSchema.parse({
        id: 'gone-task',
        title: 'Gone',
        area: 'work',
        source: 'adhoc',
        status: 'noLongerNeeded',
        createdAt: timestamp,
        updatedAt: timestamp,
        ...versions(),
      }),
    ]);
    await database.rhythmTemplates.put(rhythmTemplateSchema.parse({
      id: 'rhythm-evening',
      title: 'Evening reset',
      area: 'house',
      source: 'custom',
      enabled: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...versions(),
    }));

    const result = await loadExplicitPreferenceTargetCatalog();

    expect(result.status).toBe('ok');
    expect(result.tasks.map((target) => [target.value, target.label])).toEqual([
      ['active-task', 'Call school'],
      ['held-task', 'Send form'],
    ]);
    expect(result.rhythms).toEqual([
      expect.objectContaining({ value: 'rhythm:rhythm-evening', label: 'Evening reset' }),
    ]);
    expect(result.areas).toContainEqual(expect.objectContaining({ value: 'admin', label: 'Admin' }));
    expect(result.taskTypes).toContainEqual(expect.objectContaining({ value: 'work', label: 'Work task' }));
  });

  it('returns readable targets with a partial warning when unrelated rows are malformed', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(taskPoolItemSchema.parse({
      id: 'valid',
      title: 'Valid held task',
      area: 'admin',
      source: 'adhoc',
      status: 'captured',
      createdAt: timestamp,
      updatedAt: timestamp,
      ...versions(),
    }));
    await database.rhythmTemplates.put({ id: 'broken' } as never);

    const result = await loadExplicitPreferenceTargetCatalog();

    expect(result.status).toBe('partial');
    if (result.status === 'readFailed') return;
    expect(result.invalidRecordCount).toBe(1);
    expect(result.tasks).toEqual([
      expect.objectContaining({ value: 'valid', label: 'Valid held task' }),
    ]);
  });
});
