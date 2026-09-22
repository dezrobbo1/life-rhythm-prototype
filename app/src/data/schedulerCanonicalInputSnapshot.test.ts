import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LifeRhythmDatabase } from './db';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  canonicalSchedulingInputSnapshot,
  readCanonicalSchedulingInputRows,
} from './schedulerCanonicalInputSnapshot';
import {
  activeTaskSchema,
  rhythmTemplateSchema,
  softPlacementSchema,
  taskPoolItemSchema,
} from './schemas';
import { createDefaultSettings, saveSettings } from './settingsRepository';

const timestamp = '2026-09-07T00:00:00.000Z';
let namespaceIndex = 0;

function versions() {
  return {
    minimum: { label: 'Open it', minutes: 5 },
    normal: { label: 'Do it', minutes: 20 },
    full: { label: 'Finish it', minutes: 40 },
  };
}

async function snapshot(database: LifeRhythmDatabase) {
  return canonicalSchedulingInputSnapshot(
    await readCanonicalSchedulingInputRows(database),
  );
}

beforeEach(async () => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`canonical-input-snapshot-${namespaceIndex}`),
  );
  const defaults = createDefaultSettings(timestamp);
  const saved = await saveSettings({
    lifeShape: defaults.lifeShape,
    startBoostSafety: defaults.startBoostSafety,
    theme: defaults.theme,
  });
  expect(saved.ok).toBe(true);
});

describe('canonical scheduling-input snapshot', () => {
  const changes: Array<{
    label: string;
    mutate: (database: LifeRhythmDatabase) => Promise<unknown>;
  }> = [
    {
      label: 'settings / Life Shape',
      mutate: async () => {
        const defaults = createDefaultSettings(timestamp);
        return saveSettings({
          lifeShape: {
            ...defaults.lifeShape,
            timeBlocks: [{
              days: ['Monday'],
              end: '10:00',
              id: 'available',
              label: 'Available',
              schedulerUse: 'available',
              start: '09:00',
              type: 'openCapacity',
            }],
          },
          startBoostSafety: defaults.startBoostSafety,
          theme: defaults.theme,
        });
      },
    },
    {
      label: 'active-task lifecycle',
      mutate: (database) => database.activeTasks.put(activeTaskSchema.parse({
        area: 'admin', id: 'active-task', source: 'adhoc', status: 'parked',
        title: 'Parked task', createdAt: timestamp, updatedAt: timestamp, ...versions(),
      })),
    },
    {
      label: 'task pool',
      mutate: (database) => database.taskPoolItems.put(taskPoolItemSchema.parse({
        area: 'admin', id: 'pool-task', source: 'adhoc', status: 'captured',
        title: 'Pool task', createdAt: timestamp, updatedAt: timestamp, ...versions(),
      })),
    },
    {
      label: 'rhythm template',
      mutate: (database) => database.rhythmTemplates.put(rhythmTemplateSchema.parse({
        area: 'movement', id: 'rhythm', enabled: true,
        title: 'Move', createdAt: timestamp, updatedAt: timestamp, ...versions(),
      })),
    },
    {
      label: 'soft placement',
      mutate: (database) => database.softPlacements.put(softPlacementSchema.parse({
        blockId: 'available', blockLabelSnapshot: 'Available', createdAt: timestamp,
        date: '2026-09-07', end: '09:20', id: 'soft-placement',
        placementSource: 'userConfirmed', start: '09:00', status: 'planned',
        taskId: 'pool-task', taskTitleSnapshot: 'Pool task', updatedAt: timestamp,
      })),
    },
  ];

  it.each(changes)('changes when $label changes', async ({ mutate }) => {
    const database = getCurrentLifeRhythmDatabase();
    const before = await snapshot(database);

    await mutate(database);

    expect(await snapshot(database)).not.toBe(before);
  });
});
