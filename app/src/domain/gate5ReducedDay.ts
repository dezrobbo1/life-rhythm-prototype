import { RollingRepairScheduler } from './rollingRepair';
import type {
  InternalIntention,
  InternalPlacement,
  SchedulerChange,
  SchedulerPlan,
  SchedulerPlanChange,
  SchedulerPlacementPoint,
  SchedulerViolation,
  SchedulingDomainModel,
  TaskVariant,
} from './schedulingModel';

export type Gate5ReducedDayStatus = 'gate5-reduced-day-policy-v0';
export const gate5ReducedDayStatus: Gate5ReducedDayStatus = 'gate5-reduced-day-policy-v0';

const reducedDayReason = 'Reduced Day used the explicit minimum form for flexible private work.';

function targetKind(placement: InternalPlacement): 'intention' | 'rhythm' {
  return placement.targetKind ?? 'intention';
}

function targetId(placement: InternalPlacement): string {
  return targetKind(placement) === 'rhythm'
    ? placement.rhythmId ?? placement.intentionId
    : placement.intentionId;
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function placementMinutes(placement: InternalPlacement): number {
  return Math.max(0, minutesFromTime(placement.end) - minutesFromTime(placement.start));
}

function stricterLimit(left?: number, right?: number): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.min(left, right);
}

function minimumVariant(variants: TaskVariant[]): TaskVariant | undefined {
  return variants.find((variant) => variant.kind === 'minimum');
}

function isInFlight(intention: InternalIntention): boolean {
  return intention.lifecycle.activeTaskStatus === 'inProgress' ||
    intention.lifecycle.activeTaskStatus === 'paused' ||
    intention.lifecycle.activeTaskStatus === 'minimumDone';
}

function isTimeCritical(intention: InternalIntention): boolean {
  return intention.priority === 'must' ||
    (intention.timing.timeConstraint !== undefined && intention.timing.timeConstraint !== 'flexible') ||
    Boolean(intention.timing.latestUsefulStartAt) ||
    Boolean(intention.timing.notUsefulAfter);
}

function canUseReducedMinimum(intention: InternalIntention): boolean {
  return intention.eligibleForScheduling &&
    !isInFlight(intention) &&
    !isTimeCritical(intention) &&
    Boolean(minimumVariant(intention.variants));
}

function minimumOnly(variants: TaskVariant[]): TaskVariant[] {
  const minimum = minimumVariant(variants);
  return minimum ? [minimum] : variants;
}

function reducedDayUsesMinimum(input: SchedulingDomainModel): boolean {
  return input.planningPolicy?.dayMode === 'reduced' &&
    (input.planningPolicy.reducedDay?.preferMinimumForFlexibleWork ?? true);
}

function effectiveInput(input: SchedulingDomainModel): SchedulingDomainModel {
  const policy = input.planningPolicy;
  if (policy?.dayMode !== 'reduced') return input;

  const reducedPolicy = policy.reducedDay;
  const preferMinimum = reducedPolicy?.preferMinimumForFlexibleWork ?? true;

  return {
    ...input,
    intentions: preferMinimum
      ? input.intentions.map((intention) =>
          canUseReducedMinimum(intention)
            ? { ...intention, variants: minimumOnly(intention.variants) }
            : intention,
        )
      : input.intentions,
    rhythms: preferMinimum
      ? input.rhythms.map((rhythm) => ({
          ...rhythm,
          variants: rhythm.reducedDayBehavior === 'preserve'
            ? rhythm.variants
            : minimumOnly(rhythm.variants),
        }))
      : input.rhythms,
    planningPolicy: {
      ...policy,
      maxInternalScheduledMinutesPerDay: stricterLimit(
        policy.maxInternalScheduledMinutesPerDay,
        reducedPolicy?.maxInternalScheduledMinutesPerDay,
      ),
      maxAutomaticPlacementsPerDay: stricterLimit(
        policy.maxAutomaticPlacementsPerDay,
        reducedPolicy?.maxAutomaticPlacementsPerDay,
      ),
    },
  };
}

function reducedMinimumForPlacement(
  placement: InternalPlacement,
  input: SchedulingDomainModel,
): TaskVariant | undefined {
  if (placement.origin !== 'scheduler' || !reducedDayUsesMinimum(input)) return undefined;

  if (targetKind(placement) === 'rhythm') {
    const rhythm = input.rhythms.find((candidate) => candidate.id === targetId(placement));
    if (!rhythm || rhythm.reducedDayBehavior === 'preserve') return undefined;
    return minimumVariant(rhythm.variants);
  }

  const intention = input.intentions.find((candidate) => candidate.id === placement.intentionId);
  if (!intention || !canUseReducedMinimum(intention)) return undefined;
  return minimumVariant(intention.variants);
}

function reducedProvenance(placement: InternalPlacement, minimum: TaskVariant): string[] {
  let hasVariantLine = false;
  const next = placement.provenance.flatMap((line) => {
    if (line === 'Minimum Done was used only after no valid normal-sized placement fit.' ||
        line === 'Minimum Done was used only after no valid normal-sized rhythm placement fit.') {
      return [];
    }

    if (line.startsWith('Used the ') && line.includes(' form (')) {
      hasVariantLine = true;
      return [`Used the minimum form (${minimum.minutes} minutes).`];
    }

    return [line];
  });

  if (!hasVariantLine) {
    next.push(`Used the minimum form (${minimum.minutes} minutes).`);
  }
  if (!next.includes(reducedDayReason)) {
    next.push(reducedDayReason);
  }

  return next;
}

function placementPoint(placement: InternalPlacement): SchedulerPlacementPoint {
  return {
    date: placement.date,
    start: placement.start,
    end: placement.end,
    ...(placement.variantKind ? { variantKind: placement.variantKind } : {}),
  };
}

function applyReducedDay(plan: SchedulerPlan, input: SchedulingDomainModel): SchedulerPlan {
  if (!reducedDayUsesMinimum(input)) return plan;

  const frozenIds = new Set(plan.repair?.frozenPastPlacementIds ?? []);
  const changed = new Map<string, { before: InternalPlacement; after: InternalPlacement }>();

  const placements = plan.placements.map((placement) => {
    if (frozenIds.has(placement.id)) return placement;

    const minimum = reducedMinimumForPlacement(placement, input);
    if (!minimum) return placement;

    const currentMinutes = placementMinutes(placement);
    const alreadyMinimum = placement.variantKind === 'minimum' && currentMinutes === minimum.minutes;
    const canShrink = minimum.minutes > 0 && minimum.minutes <= currentMinutes;
    if (!alreadyMinimum && !canShrink) return placement;

    const start = minutesFromTime(placement.start);
    const end = timeFromMinutes(start + minimum.minutes);
    const after: InternalPlacement = {
      ...placement,
      end,
      variantKind: 'minimum',
      provenance: reducedProvenance(placement, minimum),
    };

    if (placement.end !== after.end || placement.variantKind !== after.variantKind) {
      changed.set(placement.id, { before: placement, after });
    }

    return after;
  });

  if (!plan.repair || changed.size === 0) {
    return { ...plan, placements };
  }

  const existingChanges = [...plan.repair.changes];
  const addedChanges: SchedulerPlanChange[] = [];

  for (const { before, after } of changed.values()) {
    addedChanges.push({
      kind: 'variantChanged',
      targetKind: targetKind(after),
      targetId: targetId(after),
      from: placementPoint(before),
      to: placementPoint(after),
      reason: reducedDayReason,
    });
  }

  return {
    ...plan,
    placements,
    repair: {
      ...plan.repair,
      preservedPlacementIds: plan.repair.preservedPlacementIds.filter((id) => !changed.has(id)),
      changes: [...existingChanges, ...addedChanges],
    },
  };
}

export class Gate5ReducedDayScheduler extends RollingRepairScheduler {
  buildPlan(input: SchedulingDomainModel): SchedulerPlan {
    const prepared = effectiveInput(input);
    return applyReducedDay(super.buildPlan(prepared), input);
  }

  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    const prepared = effectiveInput(change.nextInput);
    const repaired = super.repairPlan(currentPlan, {
      ...change,
      nextInput: prepared,
    });
    return applyReducedDay(repaired, change.nextInput);
  }

  validatePlan(plan: SchedulerPlan, input: SchedulingDomainModel): SchedulerViolation[] {
    return super.validatePlan(plan, effectiveInput(input));
  }
}
