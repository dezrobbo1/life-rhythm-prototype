import type {
  InternalPlacement,
  SchedulerPlan,
  SchedulerRepairNow,
  SchedulingDomainModel,
} from '../domain/schedulingModel';
import { clipSchedulingInputToNow } from '../domain/elapsedTimeCapacity';
import {
  buildCurrentLiveSchedulingContext,
  type PrivatePlanCoordinatorOptions,
} from './schedulerPlanCoordinator';
import {
  loadSchedulerPlanState,
  repairAndPersistSchedulerPlan,
} from './schedulerPlanStateRepository';

export type TimeDisruptionTrigger = 'missedStart' | 'overrun';

export type TimeDisruptionMaintenanceResult =
  | {
      ok: true;
      action: 'none';
      warnings: string[];
    }
  | {
      ok: true;
      action: 'repaired';
      plan: SchedulerPlan;
      trigger: TimeDisruptionTrigger;
      releasedPlacementIds: string[];
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

function isIntentionPlacement(placement: InternalPlacement) {
  return (placement.targetKind ?? 'intention') === 'intention';
}

function statusByIntentionId(input: SchedulingDomainModel) {
  return new Map(
    input.intentions.map((intention) => [
      intention.id,
      {
        eligible: intention.eligibleForScheduling,
        status: intention.lifecycle.activeTaskStatus,
      },
    ]),
  );
}

function currentSchedulerTaskPlacements(
  plan: SchedulerPlan,
  input: SchedulingDomainModel,
  now: SchedulerRepairNow,
) {
  const states = statusByIntentionId(input);

  return plan.placements.filter((placement) => {
    if (placement.origin !== 'scheduler' || !isIntentionPlacement(placement)) return false;
    if (placement.date !== now.date) return false;
    return states.get(placement.intentionId)?.eligible === true;
  });
}

function isNotStartedStatus(status: string | undefined) {
  return status === undefined || status === 'active';
}

function detectTimeDisruption(
  plan: SchedulerPlan,
  input: SchedulingDomainModel,
  now: SchedulerRepairNow,
): { trigger: TimeDisruptionTrigger; releasePlacementIds: string[] } | null {
  const placements = currentSchedulerTaskPlacements(plan, input, now);
  const states = statusByIntentionId(input);
  const staleNotStarted = placements.filter((placement) => {
    const status = states.get(placement.intentionId)?.status;
    return isNotStartedStatus(status) && placement.start < now.time;
  });
  const elapsedNotStarted = staleNotStarted.filter((placement) => placement.end <= now.time);
  const overrunInProgress = placements.filter((placement) => {
    const status = states.get(placement.intentionId)?.status;
    return status === 'inProgress' && placement.end <= now.time;
  });

  // Do not chase an in-progress task minute by minute. A live overrun becomes
  // repairable once another private slot has actually elapsed. At that point
  // every not-started placement whose start is already behind the clock is
  // released together, so rolling repair can move the affected region once.
  if (overrunInProgress.length > 0 && elapsedNotStarted.length > 0) {
    return {
      trigger: 'overrun',
      releasePlacementIds: staleNotStarted.map((placement) => placement.id).sort(),
    };
  }

  // A missed start is treated conservatively: the slot has to have elapsed,
  // not merely be one minute late. This avoids creating a schedule that moves
  // continuously while the user is deciding whether to start.
  if (elapsedNotStarted.length > 0) {
    return {
      trigger: 'missedStart',
      releasePlacementIds: staleNotStarted.map((placement) => placement.id).sort(),
    };
  }

  return null;
}

export async function maintainCurrentPrivatePlanForTimeDisruption(
  options: PrivatePlanCoordinatorOptions = {},
): Promise<TimeDisruptionMaintenanceResult> {
  // Time disruption checks maintain an already-created private plan. They do
  // not create a new plan merely because the app shell mounted.
  const current = await loadSchedulerPlanState();
  if (current.status === 'missing') {
    return { ok: true, action: 'none', warnings: [] };
  }
  if (current.status === 'invalid' || current.status === 'error') {
    return { ok: false, errors: current.errors, warnings: [] };
  }

  const live = await buildCurrentLiveSchedulingContext(options);
  if (!live.ok) return live;

  const input = clipSchedulingInputToNow(live.context.input, live.now);
  const disruption = detectTimeDisruption(current.plan, input, live.now);
  if (!disruption) {
    return {
      ok: true,
      action: 'none',
      warnings: live.context.warnings,
    };
  }

  const reason = disruption.trigger === 'overrun'
    ? 'An in-progress private task ran beyond its planned slot and later elapsed private placements were repaired.'
    : 'A private scheduled slot elapsed without the task starting, so affected flexible placements were repaired.';
  const repaired = await repairAndPersistSchedulerPlan({
    nextInput: input,
    reason,
    trigger: disruption.trigger,
    now: live.now,
    releasePlacementIds: disruption.releasePlacementIds,
  });

  if (!repaired.ok) {
    return {
      ok: false,
      errors: repaired.errors,
      warnings: live.context.warnings,
    };
  }

  return {
    ok: true,
    action: 'repaired',
    plan: repaired.plan,
    trigger: disruption.trigger,
    releasedPlacementIds: disruption.releasePlacementIds,
    warnings: live.context.warnings,
  };
}
