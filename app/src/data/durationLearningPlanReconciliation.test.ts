import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { reconcileExistingPrivatePlanAfterDurationEvidenceChange } from './durationLearningPlanReconciliation';
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';

let namespaceIndex = 0;

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`duration-evidence-reconcile-${++namespaceIndex}`),
  );
});

describe('Gate 7E duration-evidence plan reconciliation', () => {
  it('does not create a private plan when behaviour history is deleted without an existing plan', async () => {
    expect((await loadSchedulerPlanState()).status).toBe('missing');

    const result = await reconcileExistingPrivatePlanAfterDurationEvidenceChange();

    expect(result).toEqual({ ok: true, action: 'none' });
    expect((await loadSchedulerPlanState()).status).toBe('missing');
  });
});
