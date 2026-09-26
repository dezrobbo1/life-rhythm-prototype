import type { LifeRhythmDatabase } from './db';

export type CanonicalSchedulingInputSnapshot = string;

export type CanonicalSchedulingInputRows = {
  activeTasks: unknown[];
  rhythmTemplates: unknown[];
  rhythmPlans: unknown[];
  rhythmRecurrenceRevisions: unknown[];
  rhythmInstances: unknown[];
  settings: unknown[];
  softPlacements: unknown[];
  taskPoolItems: unknown[];
};

type CanonicalSchedulingInputStore = Pick<
  LifeRhythmDatabase,
  | 'activeTasks'
  | 'rhythmTemplates'
  | 'rhythmPlans'
  | 'rhythmRecurrenceRevisions'
  | 'rhythmInstances'
  | 'settings'
  | 'softPlacements'
  | 'taskPoolItems'
>;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function stableRows(rows: unknown[]) {
  return [...rows]
    .sort((left, right) => {
      const leftId = typeof left === 'object' && left !== null && 'id' in left
        ? String((left as { id: unknown }).id)
        : JSON.stringify(stableValue(left));
      const rightId = typeof right === 'object' && right !== null && 'id' in right
        ? String((right as { id: unknown }).id)
        : JSON.stringify(stableValue(right));
      return leftId.localeCompare(rightId);
    })
    .map(stableValue);
}

export async function readCanonicalSchedulingInputRows(
  store: CanonicalSchedulingInputStore,
): Promise<CanonicalSchedulingInputRows> {
  const [
    settings,
    activeTasks,
    taskPoolItems,
    rhythmTemplates,
    rhythmPlans,
    rhythmRecurrenceRevisions,
    rhythmInstances,
    softPlacements,
  ] = await Promise.all([
    store.settings.toArray(),
    store.activeTasks.toArray(),
    store.taskPoolItems.toArray(),
    store.rhythmTemplates.toArray(),
    store.rhythmPlans.toArray(),
    store.rhythmRecurrenceRevisions.toArray(),
    store.rhythmInstances.toArray(),
    store.softPlacements.toArray(),
  ]);

  return {
    activeTasks,
    rhythmInstances,
    rhythmPlans,
    rhythmRecurrenceRevisions,
    rhythmTemplates,
    settings,
    softPlacements,
    taskPoolItems,
  };
}

export function canonicalSchedulingInputSnapshot(
  rows: CanonicalSchedulingInputRows,
): CanonicalSchedulingInputSnapshot {
  return JSON.stringify({
    activeTasks: stableRows(rows.activeTasks),
    rhythmTemplates: stableRows(rows.rhythmTemplates),
    rhythmPlans: stableRows(rows.rhythmPlans),
    rhythmRecurrenceRevisions: stableRows(rows.rhythmRecurrenceRevisions),
    rhythmInstances: stableRows(rows.rhythmInstances),
    settings: stableRows(rows.settings),
    softPlacements: stableRows(rows.softPlacements),
    taskPoolItems: stableRows(rows.taskPoolItems),
  });
}
