import { RollingRepairScheduler } from './rollingRepair';
import type {
  InternalPlacement,
  SchedulerChange,
  SchedulerPlan,
  SchedulerPlanChange,
  SchedulerPlacementPoint,
  SchedulerViolation,
  SchedulingDomainModel,
  TaskVariant,
} from './schedulingModel';
import {
  canUseReducedMinimum,
  eligibleRhythmMinimum,
  reducedDayAppliesToDate,
} from './reducedDayPolicy';

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

function validateRhythmEligibility(input: SchedulingDomainModel): void {
  const policy = input.planningPolicy;
  if (policy?.dayMode === 'reduced' && !policy.dayModeDate) {
    throw new Error('Reduced Day requires an explicit dayModeDate.');
  }
  if (policy?.dayModeDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(policy.dayModeDate)) {
    throw new Error('dayModeDate must be a local date in YYYY-MM-DD form.');
  }
  const reduced = policy?.reducedDay;
  if (reduced?.maxInternalScheduledMinutesPerDay !== undefined &&
      (!Number.isFinite(reduced.maxInternalScheduledMinutesPerDay) || reduced.maxInternalScheduledMinutesPerDay <= 0)) {
    throw new Error('Reduced Day maxInternalScheduledMinutesPerDay must be a finite positive number.');
  }
  if (reduced?.maxAutomaticPlacementsPerDay !== undefined &&
      (!Number.isInteger(reduced.maxAutomaticPlacementsPerDay) || reduced.maxAutomaticPlacementsPerDay <= 0)) {
    throw new Error('Reduced Day maxAutomaticPlacementsPerDay must be a positive integer.');
  }
  const ids = input.planningPolicy?.reducedDay?.minimumEligibleRhythmIds;
  if (ids === undefined) return;
  if (!Array.isArray(ids) || [...ids].some((id) => typeof id !== 'string' || id.trim().length === 0)) {
    throw new Error('minimumEligibleRhythmIds must be an array of non-empty strings.');
  }
}

function effectiveInput(input: SchedulingDomainModel): SchedulingDomainModel {
  validateRhythmEligibility(input);
  return input;
}

function reducedMinimumForPlacement(
  placement: InternalPlacement,
  input: SchedulingDomainModel,
): TaskVariant | undefined {
  if (placement.origin !== 'scheduler' ||
      input.planningPolicy?.dayMode !== 'reduced' ||
      !reducedDayAppliesToDate(input, placement.date)) return undefined;

  if (targetKind(placement) === 'rhythm') {
    const rhythm = input.rhythms.find((candidate) => candidate.id === targetId(placement));
    return rhythm ? eligibleRhythmMinimum(rhythm, input, placement.date) : undefined;
  }

  const intention = input.intentions.find((candidate) => candidate.id === placement.intentionId);
  if (!intention) return undefined;
  return canUseReducedMinimum(intention, input, placement.date);
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
  if (input.planningPolicy?.dayMode !== 'reduced') return plan;

  const frozenIds = new Set(plan.repair?.frozenPastPlacementIds ?? []);
  const changed = new Map<string, { before: InternalPlacement; after: InternalPlacement }>();

  const placements = plan.placements.map((placement) => {
    if (frozenIds.has(placement.id)) return placement;

    const minimum = reducedMinimumForPlacement(placement, input);
    if (!minimum) return placement;

    const currentMinutes = placementMinutes(placement);
    const alreadyMinimum = placement.variantKind === 'minimum' && currentMinutes === minimum.minutes;
    // A preserved valid Minimum may have historical capacity-fallback provenance.
    // A new policy opt-in alone is not a new sizing decision.
    if (targetKind(placement) === 'rhythm' && alreadyMinimum &&
        (plan.repair?.preservedPlacementIds.includes(placement.id) ||
         input.placements.some((existing) => existing.id === placement.id &&
           existing.variantKind === 'minimum' && placementMinutes(existing) === minimum.minutes))) return placement;
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
