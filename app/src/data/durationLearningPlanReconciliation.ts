import type { PrivatePlanCoordinatorOptions } from './schedulerPlanCoordinator';
import { ensureCurrentPrivatePlan } from './schedulerPlanCoordinator';
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';

export type DurationEvidencePlanReconciliationResult =
  | { ok: true; action: 'none' | 'reconciled' }
  | { ok: false; errors: string[] };

/**
 * Behaviour-history deletion must never create a private plan merely to clear
 * derived duration evidence. Existing plans are reconciled; a missing plan
 * remains missing.
 */
export async function reconcileExistingPrivatePlanAfterDurationEvidenceChange(
  options: PrivatePlanCoordinatorOptions = {},
): Promise<DurationEvidencePlanReconciliationResult> {
  const current = await loadSchedulerPlanState();
  if (current.status === 'missing') {
    return { ok: true, action: 'none' };
  }
  if (current.status === 'invalid' || current.status === 'error') {
    return { ok: false, errors: current.errors };
  }

  const reconciled = await ensureCurrentPrivatePlan(options);
  if (!reconciled.ok) {
    return { ok: false, errors: reconciled.errors };
  }
  return { ok: true, action: 'reconciled' };
}
