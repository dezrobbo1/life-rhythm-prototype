import { DeterministicScheduler } from './scheduler';
import type {
  InternalPlacement,
  SchedulerChange,
  SchedulerPlan,
  SchedulerPlanChange,
  SchedulerPlanSnapshot,
  SchedulerRepairNow,
  SchedulerViolation,
  SchedulingDomainModel,
} from './schedulingModel';

export type RollingRepairStatus = 'gate4-rolling-repair-v1';
export const rollingRepairStatus: RollingRepairStatus = 'gate4-rolling-repair-v1';

function placementTargetKind(placement: InternalPlacement): 'intention' | 'rhythm' {
  return placement.targetKind ?? 'intention';
}

function placementTargetId(placement: InternalPlacement): string {
  return placementTargetKind(placement) === 'rhythm'
    ? placement.rhythmId ?? placement.intentionId
    : placement.intentionId;
}

function placementPoint(placement: InternalPlacement) {
  return {
    date: placement.date,
    start: placement.start,
    end: placement.end,
    ...(placement.variantKind ? { variantKind: placement.variantKind } : {}),
  };
}

function sortPlacements(placements: InternalPlacement[]): InternalPlacement[] {
  return [...placements].sort((left, right) =>
    `${left.date}:${left.start}:${left.id}`.localeCompare(`${right.date}:${right.start}:${right.id}`),
  );
}

function clonePlacement(placement: InternalPlacement): InternalPlacement {
  return {
    ...placement,
    provenance: [...placement.provenance],
  };
}

function snapshotPlan(plan: SchedulerPlan): SchedulerPlanSnapshot {
  return {
    placements: plan.placements.map(clonePlacement),
    unscheduledIntentionIds: [...plan.unscheduledIntentionIds],
    unscheduledRhythmIds: [...plan.unscheduledRhythmIds],
    rejectedExistingPlacements: plan.rejectedExistingPlacements.map((rejected) => ({
      placement: clonePlacement(rejected.placement),
      violations: rejected.violations.map((violation) => ({ ...violation })),
    })),
  };
}

function isValidNow(now: SchedulerRepairNow): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(now.date) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(now.time) &&
    now.timezone.trim().length > 0;
}

function isPastPlacement(placement: InternalPlacement, now?: SchedulerRepairNow): boolean {
  if (!now) return false;
  if (placement.date < now.date) return true;
  if (placement.date > now.date) return false;
  return placement.start < now.time;
}

function localDateOrdinal(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const epoch = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(epoch)) return null;
  const roundTrip = new Date(epoch);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() + 1 !== month ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(epoch / 86_400_000);
}

function placementInertiaRank(placement: InternalPlacement, change: SchedulerChange): number {
  if ((change.pinnedPlacementIds ?? []).includes(placement.id)) return 10_000;
  if ((change.surfacedPlacementIds ?? []).includes(placement.id)) return 2_000;
  if (!change.now) return 1_000;

  const placementDay = localDateOrdinal(placement.date);
  const nowDay = localDateOrdinal(change.now.date);
  if (placementDay === null || nowDay === null) return 1_000;

  const distance = placementDay - nowDay;
  if (distance <= 0) return 1_500;
  if (distance === 1) return 750;
  return 250;
}

function isPinnedPlacement(placement: InternalPlacement, change: SchedulerChange): boolean {
  return (change.pinnedPlacementIds ?? []).includes(placement.id);
}

function targetStillSchedulable(
  placement: InternalPlacement,
  input: SchedulingDomainModel,
): boolean {
  if (placementTargetKind(placement) === 'rhythm') {
    return input.rhythms.some((rhythm) => rhythm.id === placementTargetId(placement));
  }

  const intention = input.intentions.find((candidate) => candidate.id === placement.intentionId);
  return Boolean(intention?.eligibleForScheduling);
}

function uniquePlacements(placements: InternalPlacement[]): InternalPlacement[] {
  const byId = new Map<string, InternalPlacement>();
  for (const placement of placements) {
    if (!byId.has(placement.id)) byId.set(placement.id, placement);
  }
  return sortPlacements([...byId.values()]);
}

function samePosition(left: InternalPlacement, right: InternalPlacement): boolean {
  return left.date === right.date && left.start === right.start && left.end === right.end;
}

function sameVariant(left: InternalPlacement, right: InternalPlacement): boolean {
  return left.variantKind === right.variantKind;
}

function targetKey(placement: InternalPlacement): string {
  return `${placementTargetKind(placement)}:${placementTargetId(placement)}`;
}

function planTargetKeys(plan: SchedulerPlan): Set<string> {
  return new Set(plan.placements.map(targetKey));
}

function changeForPair(
  before: InternalPlacement,
  after: InternalPlacement,
  reason: string,
): SchedulerPlanChange | null {
  if (samePosition(before, after) && sameVariant(before, after)) return null;

  return {
    kind: samePosition(before, after) ? 'variantChanged' : 'moved',
    targetKind: placementTargetKind(after),
    targetId: placementTargetId(after),
    from: placementPoint(before),
    to: placementPoint(after),
    reason,
  };
}

function buildChanges(
  beforePlacements: InternalPlacement[],
  afterPlacements: InternalPlacement[],
  reason: string,
): SchedulerPlanChange[] {
  const before = sortPlacements(beforePlacements).map(clonePlacement);
  const after = sortPlacements(afterPlacements).map(clonePlacement);
  const changes: SchedulerPlanChange[] = [];
  const matchedBefore = new Set<number>();
  const matchedAfter = new Set<number>();

  for (let beforeIndex = 0; beforeIndex < before.length; beforeIndex += 1) {
    const afterIndex = after.findIndex(
      (placement, index) => !matchedAfter.has(index) && placement.id === before[beforeIndex].id,
    );
    if (afterIndex < 0) continue;
    matchedBefore.add(beforeIndex);
    matchedAfter.add(afterIndex);
    const change = changeForPair(before[beforeIndex], after[afterIndex], reason);
    if (change) changes.push(change);
  }

  const beforeGroups = new Map<string, number[]>();
  const afterGroups = new Map<string, number[]>();

  before.forEach((placement, index) => {
    if (matchedBefore.has(index)) return;
    const key = targetKey(placement);
    beforeGroups.set(key, [...(beforeGroups.get(key) ?? []), index]);
  });

  after.forEach((placement, index) => {
    if (matchedAfter.has(index)) return;
    const key = targetKey(placement);
    afterGroups.set(key, [...(afterGroups.get(key) ?? []), index]);
  });

  const groupKeys = [...new Set([...beforeGroups.keys(), ...afterGroups.keys()])].sort();

  for (const key of groupKeys) {
    const beforeIndexes = beforeGroups.get(key) ?? [];
    const afterIndexes = afterGroups.get(key) ?? [];
    const pairs = Math.min(beforeIndexes.length, afterIndexes.length);

    for (let index = 0; index < pairs; index += 1) {
      const beforeIndex = beforeIndexes[index];
      const afterIndex = afterIndexes[index];
      matchedBefore.add(beforeIndex);
      matchedAfter.add(afterIndex);
      const change = changeForPair(before[beforeIndex], after[afterIndex], reason);
      if (change) changes.push(change);
    }
  }

  before.forEach((placement, index) => {
    if (matchedBefore.has(index)) return;
    changes.push({
      kind: 'removed',
      targetKind: placementTargetKind(placement),
      targetId: placementTargetId(placement),
      from: placementPoint(placement),
      reason,
    });
  });

  after.forEach((placement, index) => {
    if (matchedAfter.has(index)) return;
    changes.push({
      kind: 'added',
      targetKind: placementTargetKind(placement),
      targetId: placementTargetId(placement),
      to: placementPoint(placement),
      reason,
    });
  });

  return changes.sort((left, right) =>
    `${left.targetKind}:${left.targetId}:${left.kind}`.localeCompare(
      `${right.targetKind}:${right.targetId}:${right.kind}`,
    ),
  );
}

function suppressFrozenPastIntentions(
  input: SchedulingDomainModel,
  frozenPastPlacements: InternalPlacement[],
): SchedulingDomainModel {
  const frozenIntentionIds = new Set(
    frozenPastPlacements
      .filter((placement) => placementTargetKind(placement) === 'intention')
      .map((placement) => placement.intentionId),
  );

  if (frozenIntentionIds.size === 0) return input;

  return {
    ...input,
    intentions: input.intentions.map((intention) =>
      frozenIntentionIds.has(intention.id)
        ? { ...intention, eligibleForScheduling: false }
        : intention,
    ),
  };
}

function lostCurrentTargets(
  currentPlacements: InternalPlacement[],
  plan: SchedulerPlan,
  frozenIds: Set<string>,
  input: SchedulingDomainModel,
): InternalPlacement[] {
  const scheduledTargets = planTargetKeys(plan);
  return currentPlacements.filter(
    (placement) =>
      !frozenIds.has(placement.id) &&
      targetStillSchedulable(placement, input) &&
      !scheduledTargets.has(targetKey(placement)),
  );
}

export class RollingRepairScheduler extends DeterministicScheduler {
  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    if (change.now && !isValidNow(change.now)) {
      throw new Error('Gate 4 repair now must use YYYY-MM-DD, HH:MM and a non-empty timezone.');
    }

    const releaseIds = new Set(change.releasePlacementIds ?? []);
    const currentPlacements = sortPlacements(currentPlan.placements);
    const frozenPastPlacements = currentPlacements.filter(
      (placement) => !releaseIds.has(placement.id) && isPastPlacement(placement, change.now),
    );
    const futurePlacements = currentPlacements.filter(
      (placement) => !isPastPlacement(placement, change.now),
    );

    const preservedFuture = futurePlacements.filter(
      (placement) => !releaseIds.has(placement.id) && targetStillSchedulable(placement, change.nextInput),
    );

    const nextInputWithFrozenSuppressed = suppressFrozenPastIntentions(
      change.nextInput,
      frozenPastPlacements,
    );

    const frozenIds = new Set(frozenPastPlacements.map((placement) => placement.id));
    const autoReleasedIds = new Set<string>();

    const buildWithReleased = (additionalReleasedIds: Set<string>): SchedulerPlan => {
      const excludedIds = new Set([...releaseIds, ...additionalReleasedIds]);
      const seededInput: SchedulingDomainModel = {
        ...nextInputWithFrozenSuppressed,
        placements: uniquePlacements([
          ...change.nextInput.placements.map(clonePlacement),
          ...preservedFuture.map(clonePlacement),
        ]).filter((placement) => !excludedIds.has(placement.id)),
      };
      return super.buildPlan(seededInput);
    };

    let rebuilt = buildWithReleased(autoReleasedIds);

    const currentRankByTarget = new Map<string, number>();
    for (const placement of currentPlacements) {
      const key = targetKey(placement);
      currentRankByTarget.set(
        key,
        Math.max(currentRankByTarget.get(key) ?? 0, placementInertiaRank(placement, change)),
      );
    }

    const initialLostTargets = lostCurrentTargets(
      currentPlacements,
      rebuilt,
      frozenIds,
      change.nextInput,
    ).sort((left, right) => {
      const rankDifference =
        (currentRankByTarget.get(targetKey(right)) ?? 0) -
        (currentRankByTarget.get(targetKey(left)) ?? 0);
      if (rankDifference !== 0) return rankDifference;
      return targetKey(left).localeCompare(targetKey(right));
    });

    for (const lostPlacement of initialLostTargets) {
      const lostKey = targetKey(lostPlacement);
      if (planTargetKeys(rebuilt).has(lostKey)) continue;
      const lostRank = currentRankByTarget.get(lostKey) ?? 0;

      const releaseCandidates = preservedFuture
        .filter(
          (placement) =>
            placement.origin === 'scheduler' &&
            targetKey(placement) !== lostKey &&
            !isPinnedPlacement(placement, change) &&
            placementInertiaRank(placement, change) < lostRank &&
            !autoReleasedIds.has(placement.id),
        )
        .sort((left, right) => {
          const rankDifference =
            placementInertiaRank(left, change) - placementInertiaRank(right, change);
          if (rankDifference !== 0) return rankDifference;
          return `${right.date}:${right.start}:${right.id}`.localeCompare(
            `${left.date}:${left.start}:${left.id}`,
          );
        });

      if (releaseCandidates.length === 0) continue;

      const trialReleasedIds = new Set(autoReleasedIds);
      let successfulPlan: SchedulerPlan | null = null;

      for (const candidate of releaseCandidates) {
        trialReleasedIds.add(candidate.id);
        const trial = buildWithReleased(trialReleasedIds);
        if (planTargetKeys(trial).has(lostKey)) {
          successfulPlan = trial;
          break;
        }
      }

      if (successfulPlan) {
        autoReleasedIds.clear();
        for (const id of trialReleasedIds) autoReleasedIds.add(id);
        rebuilt = successfulPlan;
      }
    }

    const rebuiltFuture = rebuilt.placements.filter(
      (placement) => !isPastPlacement(placement, change.now),
    );
    const repairedPlacements = sortPlacements([
      ...frozenPastPlacements.map(clonePlacement),
      ...rebuiltFuture.map(clonePlacement),
    ]);

    const beforeForChanges = currentPlacements.filter((placement) => !frozenIds.has(placement.id));
    const afterForChanges = repairedPlacements.filter((placement) => !frozenIds.has(placement.id));
    const repairedIds = new Set(repairedPlacements.map((placement) => placement.id));
    const preservedPlacementIds = preservedFuture
      .filter(
        (placement) =>
          repairedIds.has(placement.id) &&
          !autoReleasedIds.has(placement.id),
      )
      .map((placement) => placement.id)
      .sort();

    return {
      ...rebuilt,
      placements: repairedPlacements,
      repair: {
        ...(change.trigger ? { trigger: change.trigger } : {}),
        reason: change.reason,
        ...(change.now ? { now: { ...change.now } } : {}),
        frozenPastPlacementIds: [...frozenIds].sort(),
        preservedPlacementIds,
        changes: buildChanges(beforeForChanges, afterForChanges, change.reason),
        undo: snapshotPlan(currentPlan),
      },
    };
  }

  validatePlan(plan: SchedulerPlan, input: SchedulingDomainModel): SchedulerViolation[] {
    const frozenIds = new Set(plan.repair?.frozenPastPlacementIds ?? []);
    if (frozenIds.size === 0) return super.validatePlan(plan, input);

    return super.validatePlan(
      {
        ...plan,
        placements: plan.placements.filter((placement) => !frozenIds.has(placement.id)),
      },
      input,
    );
  }

  undoRepair(plan: SchedulerPlan): SchedulerPlan {
    const undo = plan.repair?.undo;
    if (!undo) return snapshotPlan(plan);

    return {
      placements: undo.placements.map(clonePlacement),
      unscheduledIntentionIds: [...undo.unscheduledIntentionIds],
      unscheduledRhythmIds: [...undo.unscheduledRhythmIds],
      rejectedExistingPlacements: undo.rejectedExistingPlacements.map((rejected) => ({
        placement: clonePlacement(rejected.placement),
        violations: rejected.violations.map((violation) => ({ ...violation })),
      })),
    };
  }
}

export function changedView(plan: SchedulerPlan): SchedulerPlanChange[] {
  return (plan.repair?.changes ?? []).map((change) => ({
    ...change,
    ...(change.from ? { from: { ...change.from } } : {}),
    ...(change.to ? { to: { ...change.to } } : {}),
  }));
}

export const rollingRepairScheduler = new RollingRepairScheduler();
