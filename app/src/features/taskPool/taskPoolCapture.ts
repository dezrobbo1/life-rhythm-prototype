import type { TaskPoolItem } from '../../data/schemas';
import {
  createTaskPoolItemId,
  loadTaskPoolItemsResult,
  saveTaskPoolItem,
  type TaskPoolStore,
} from '../../data/taskPoolRepository';
import { resolveTaskVersions, type TaskVersionInput } from './taskVersionInput';

type TaskPoolArea = TaskPoolItem['area'];

export type TaskPoolCaptureInput = TaskVersionInput & {
  area: TaskPoolArea;
  dueAt?: string;
  fixedAt?: string;
  expiresAfter?: string;
  latestUsefulStartAt?: string;
  missedPolicy?: TaskPoolItem['missedPolicy'];
  minimumStillUsefulAfterDeadline?: boolean;
  notes?: string;
  notUsefulAfter?: string;
  purpose?: string;
  timeConstraint?: TaskPoolItem['timeConstraint'];
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
  const resolved = resolveTaskVersions(input);
  if (!resolved.ok) return { ok: false, errors: [resolved.error] };

  try {
    return await saveTaskPoolItem({
      area: input.area,
      createdAt: timestamp,
      full: resolved.versions.full,
      id: (options.createId ?? (() => createTaskPoolItemId('captured')))(),
      minimum: resolved.versions.minimum,
      normal: resolved.versions.normal,
      ...(input.timeConstraint ? { timeConstraint: input.timeConstraint } : {}),
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      ...(input.fixedAt ? { fixedAt: input.fixedAt } : {}),
      ...(input.expiresAfter ? { expiresAfter: input.expiresAfter } : {}),
      ...(input.latestUsefulStartAt ? { latestUsefulStartAt: input.latestUsefulStartAt } : {}),
      ...(input.missedPolicy ? { missedPolicy: input.missedPolicy } : {}),
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
