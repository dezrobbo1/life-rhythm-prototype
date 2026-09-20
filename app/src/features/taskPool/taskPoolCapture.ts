import type { TaskPoolItem } from '../../data/schemas';
import {
  createTaskPoolItemId,
  loadTaskPoolItemsResult,
  saveTaskPoolItem,
  type TaskPoolStore,
} from '../../data/taskPoolRepository';

type TaskPoolArea = TaskPoolItem['area'];

export type TaskPoolCaptureInput = {
  area: TaskPoolArea;
  dueAt?: string;
  fullVersion: string;
  minimumStillUsefulAfterDeadline?: boolean;
  minimumVersion: string;
  normalVersion: string;
  notes?: string;
  notUsefulAfter?: string;
  purpose?: string;
  timeConstraint?: 'dueBy';
  title: string;
};

export type TaskPoolCaptureResult =
  | { item: TaskPoolItem; ok: true }
  | { errors: string[]; ok: false };

type CaptureTaskPoolItemOptions = {
  createId?: () => string;
  now?: () => Date;
  store?: TaskPoolStore;
};

export async function captureTaskPoolItem(
  input: TaskPoolCaptureInput,
  options: CaptureTaskPoolItemOptions = {},
): Promise<TaskPoolCaptureResult> {
  const readable = await loadTaskPoolItemsResult(options.store);

  if (readable.status === 'readFailed') {
    return {
      errors: ['Saved Held tasks could not be read, so nothing was captured. Retry when device storage is available.'],
      ok: false,
    };
  }

  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  const minimum = input.minimumVersion;
  const normal = input.normalVersion || minimum;
  const full = input.fullVersion || normal;

  try {
    return await saveTaskPoolItem({
      area: input.area,
      createdAt: timestamp,
      full: { label: full, minutes: 20 },
      id: (options.createId ?? (() => createTaskPoolItemId('captured')))(),
      minimum: { label: minimum, minutes: 5 },
      normal: { label: normal, minutes: 10 },
      ...(input.dueAt ? { dueAt: input.dueAt, timeConstraint: 'dueBy' as const } : {}),
      ...(input.minimumStillUsefulAfterDeadline ? { minimumStillUsefulAfterDeadline: true } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.notUsefulAfter ? { notUsefulAfter: input.notUsefulAfter } : {}),
      ...(input.purpose ? { purpose: input.purpose } : {}),
      source: 'adhoc',
      status: 'captured',
      title: input.title,
      updatedAt: timestamp,
    }, options.store);
  } catch {
    return {
      errors: ['Task was not captured because device storage could not be updated. Nothing else changed.'],
      ok: false,
    };
  }
}
