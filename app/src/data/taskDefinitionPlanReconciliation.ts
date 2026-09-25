import { repairCurrentPrivatePlan } from './schedulerPlanCoordinator';
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';

/** The definition write has already marked any accepted plan for repair atomically. */
export async function reconcileTaskDefinitionAfterWrite(reason: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    const saved = await loadSchedulerPlanState();
    if (saved.status === 'missing') return { ok: true };
    if (saved.status !== 'ok') return {
      ok: false, message: 'The saved private plan needs attention before it can be updated.',
    };
    const result = await repairCurrentPrivatePlan({ reason, trigger: 'taskDefinitionChanged' });
    return result.ok ? { ok: true } : {
      ok: false, message: result.errors[0] ?? 'The private plan still needs updating.',
    };
  } catch {
    return { ok: false, message: 'The private plan still needs updating.' };
  }
}
