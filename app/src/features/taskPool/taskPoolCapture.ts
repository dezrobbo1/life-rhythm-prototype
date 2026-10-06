import { getCurrentLifeRhythmDatabase } from '../../data/localDataNamespace';
import { LifeRhythmDatabase } from '../../data/db';
import { captureProfileRecoveryGeneration, profileRecoveryErrorMessage } from '../../data/profileRecoveryGeneration';
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
  // Bind before the first await; namespace cleanup or account switch must never
  // redirect this operation to a different account or the protected legacy root.
  const store = options.store ?? getCurrentLifeRhythmDatabase();
  let recoveryGeneration: number | undefined;
  try {
    recoveryGeneration = store instanceof LifeRhythmDatabase
      ? await captureProfileRecoveryGeneration(store) : undefined;
  } catch {
    return { ok: false, errors: ['The local profile could not be verified. Try again.'] };
  }
  const readable = await loadTaskPoolItemsResult(store);

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
    }, store, recoveryGeneration);
  } catch (error) {
    return {
      errors: [profileRecoveryErrorMessage(error, 'Task was not captured because device storage could not be updated. Nothing else changed.')],
      ok: false,
    };
  }
}
