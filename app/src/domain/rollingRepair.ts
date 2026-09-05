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

export type RollingRepairStatus = 'gate4-rolling-repair-v0';
export const rollingRepairStatus: RollingRepairStatus = 'gate4-rolling-repair-v0';

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

    const seededInput: SchedulingDomainModel = {
      ...nextInputWithFrozenSuppressed,
      placements: uniquePlacements([
        ...change.nextInput.placements.map(clonePlacement),
        ...preservedFuture.map(clonePlacement),
      ]),
    };

    const rebuilt = super.buildPlan(seededInput);
    const rebuiltFuture = rebuilt.placements.filter(
      (placement) => !isPastPlacement(placement, change.now),
    );
    const repairedPlacements = sortPlacements([
      ...frozenPastPlacements.map(clonePlacement),
      ...rebuiltFuture.map(clonePlacement),
    ]);

    const frozenIds = new Set(frozenPastPlacements.map((placement) => placement.id));
    const beforeForChanges = currentPlacements.filter((placement) => !frozenIds.has(placement.id));
    const afterForChanges = repairedPlacements.filter((placement) => !frozenIds.has(placement.id));
    const repairedIds = new Set(repairedPlacements.map((placement) => placement.id));
    const preservedPlacementIds = preservedFuture
      .filter((placement) => repairedIds.has(placement.id))
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
