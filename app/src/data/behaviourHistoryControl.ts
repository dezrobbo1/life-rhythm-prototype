import { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import type { TaskHistory } from './schemas';

export const BEHAVIOUR_HISTORY_DELETE_CONFIRMATION = 'DELETE BEHAVIOUR HISTORY';

export type BehaviourHistoryExport = {
  eventCount: number;
  fileName: string;
  json: string;
};

export type DeleteBehaviourHistoryResult =
  | { ok: true; deletedCount: number }
  | { ok: false; errors: string[] };

function isGate7ABehaviourRow(row: TaskHistory): boolean {
  return (row as { recordKind?: unknown }).recordKind === 'behaviourEvent';
}

export async function exportBehaviourHistory(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  exportedAt = new Date().toISOString(),
): Promise<BehaviourHistoryExport> {
  const events = (await database.taskHistory.toArray()).filter(isGate7ABehaviourRow);
  const payload = {
    recordKind: 'lifeRhythmBehaviourHistoryExport',
    version: 1,
    exportedAt,
    events,
  };

  return {
    eventCount: events.length,
    fileName: `life-rhythm-behaviour-history-${exportedAt.slice(0, 10)}.json`,
    json: `${JSON.stringify(payload, null, 2)}\n`,
  };
}

export async function deleteBehaviourHistory(
  confirmation: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<DeleteBehaviourHistoryResult> {
  if (confirmation !== BEHAVIOUR_HISTORY_DELETE_CONFIRMATION) {
    return {
      ok: false,
      errors: [`Type ${BEHAVIOUR_HISTORY_DELETE_CONFIRMATION} to delete behaviour history.`],
    };
  }

  try {
    return await database.transaction('rw', database.taskHistory, async () => {
      const rows = await database.taskHistory.toArray();
      const ids = rows.filter(isGate7ABehaviourRow).map((row) => row.id);
      await database.taskHistory.bulkDelete(ids);
      return { deletedCount: ids.length, ok: true as const };
    });
  } catch {
    return {
      ok: false,
      errors: ['Behaviour history could not be deleted. Nothing else was changed.'],
    };
  }
}
