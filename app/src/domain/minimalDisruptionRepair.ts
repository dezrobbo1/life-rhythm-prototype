import { ClockAwareScheduler } from './clockAwareScheduler';
import type {
  InternalPlacement,
  SchedulerChange,
  SchedulerPlan,
} from './schedulingModel';

function targetKind(placement: InternalPlacement): 'intention' | 'rhythm' {
  return placement.targetKind ?? 'intention';
}

function targetId(placement: InternalPlacement): string {
  return targetKind(placement) === 'rhythm'
    ? placement.rhythmId ?? placement.intentionId
    : placement.intentionId;
}

function targetKey(placement: InternalPlacement): string {
  return `${targetKind(placement)}:${targetId(placement)}`;
}

function pointKey(placement: InternalPlacement): string {
  return `${targetKey(placement)}:${placement.date}:${placement.start}:${placement.end}:${placement.variantKind ?? ''}`;
}

function targetKeys(plan: SchedulerPlan): Set<string> {
  return new Set(plan.placements.map(targetKey));
}

function retainsRequiredTargets(plan: SchedulerPlan, required: Set<string>): boolean {
  const scheduled = targetKeys(plan);
  return [...required].every((key) => scheduled.has(key));
}

function disruptionScore(currentPlan: SchedulerPlan, nextPlan: SchedulerPlan, change: SchedulerChange): number {
  const explicitlyReleased = new Set(change.releasePlacementIds ?? []);
  const nextPoints = new Set(nextPlan.placements.map(pointKey));

  return currentPlan.placements.reduce((score, placement) => {
    if (explicitlyReleased.has(placement.id)) return score;
    return score + (nextPoints.has(pointKey(placement)) ? 0 : 1);
  }, 0);
}

/**
 * Backtracks over automatic release choices made by the Gate 4 repair layer.
 * If pinning a current private intention keeps every target recovered by the
 * baseline repair while reducing visible disruption, the lower-disruption
 * repair wins. This prevents failed release attempts from becoming accidental
 * movement debt in the final plan.
 */
export class MinimalDisruptionRepairScheduler extends ClockAwareScheduler {
  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    let best = super.repairPlan(currentPlan, change);
    const requiredTargets = targetKeys(best);
    let bestScore = disruptionScore(currentPlan, best, change);
    const explicitlyReleased = new Set(change.releasePlacementIds ?? []);
    const pinnedIds = new Set(change.pinnedPlacementIds ?? []);

    const candidates = currentPlan.placements
      .filter(
        (placement) =>
          placement.origin === 'scheduler' &&
          targetKind(placement) === 'intention' &&
          !explicitlyReleased.has(placement.id) &&
          !pinnedIds.has(placement.id),
      )
      .filter((placement) => !best.placements.some((next) => pointKey(next) === pointKey(placement)))
      .sort((left, right) =>
        `${left.date}:${left.start}:${left.id}`.localeCompare(`${right.date}:${right.start}:${right.id}`),
      );

    for (const candidate of candidates) {
      const trialPinned = [...pinnedIds, candidate.id].sort();
      const trial = super.repairPlan(currentPlan, {
        ...change,
        pinnedPlacementIds: trialPinned,
      });
      const trialScore = disruptionScore(currentPlan, trial, change);

      if (!retainsRequiredTargets(trial, requiredTargets) || trialScore >= bestScore) {
        continue;
      }

      pinnedIds.add(candidate.id);
      best = trial;
      bestScore = trialScore;
    }

    return best;
  }
}
