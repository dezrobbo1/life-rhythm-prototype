import type {
  CapacityWindow,
  ExternalCommitment,
  InternalPlacement,
  PlacementExplanation,
  SchedulerChange,
  SchedulerPlan,
  SchedulerViolation,
  SchedulingDomainModel,
  SchedulingInterval,
} from './schedulingModel';

export type SchedulerStatus = 'gate1-domain-seam';
export const schedulerStatus: SchedulerStatus = 'gate1-domain-seam';

export interface SchedulerEngine {
  buildPlan(input: SchedulingDomainModel): SchedulerPlan;
  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan;
  validatePlan(plan: SchedulerPlan, input: SchedulingDomainModel): SchedulerViolation[];
  explainPlacement(placementId: string, plan: SchedulerPlan): PlacementExplanation | null;
}

const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

type MinuteRange = {
  start: number;
  end: number;
};

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function weekdayForLocalDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function intervalRangeForDate(interval: SchedulingInterval, date: string): MinuteRange | null {
  if (interval.kind === 'datedLocal') {
    if (interval.date !== date) return null;
    return {
      start: minutesFromTime(interval.start),
      end: minutesFromTime(interval.end),
    };
  }

  if (!interval.start || !interval.end || !interval.days.includes(weekdayForLocalDate(date))) {
    return null;
  }

  return {
    start: minutesFromTime(interval.start),
    end: minutesFromTime(interval.end),
  };
}

function placementRange(placement: InternalPlacement): MinuteRange {
  return {
    start: minutesFromTime(placement.start),
    end: minutesFromTime(placement.end),
  };
}

function overlaps(left: MinuteRange, right: MinuteRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function protectedRange(window: CapacityWindow, date: string): MinuteRange | null {
  if (window.schedulerUse !== 'unavailable') return null;
  return intervalRangeForDate(window.interval, date);
}

function commitmentRange(commitment: ExternalCommitment, date: string): MinuteRange | null {
  if (!commitment.hard) return null;
  const range = intervalRangeForDate(commitment.interval, date);
  if (!range) return null;

  return {
    start: Math.max(0, range.start - commitment.travelBeforeMinutes),
    end: Math.min(24 * 60, range.end + commitment.transitionAfterMinutes),
  };
}

function violationsForPlacement(
  placement: InternalPlacement,
  accepted: InternalPlacement[],
  input: SchedulingDomainModel,
): SchedulerViolation[] {
  const violations: SchedulerViolation[] = [];
  const intention = input.intentions.find((candidate) => candidate.id === placement.intentionId);

  if (!intention) {
    violations.push({
      code: 'unknown-intention',
      placementId: placement.id,
      message: `Placement ${placement.id} references unknown intention ${placement.intentionId}.`,
    });
    return violations;
  }

  const range = placementRange(placement);

  for (const other of accepted) {
    if (other.date !== placement.date || !overlaps(range, placementRange(other))) continue;
    violations.push({
      code: 'placement-overlap',
      placementId: placement.id,
      conflictingId: other.id,
      message: `Placement ${placement.id} overlaps private placement ${other.id}.`,
    });
  }

  for (const window of input.capacityWindows) {
    const blocked = protectedRange(window, placement.date);
    if (!blocked || !overlaps(range, blocked)) continue;
    violations.push({
      code: 'protected-window-overlap',
      placementId: placement.id,
      conflictingId: window.id,
      message: `Placement ${placement.id} overlaps protected window ${window.title}.`,
    });
  }

  for (const commitment of input.externalCommitments) {
    const blocked = commitmentRange(commitment, placement.date);
    if (!blocked || !overlaps(range, blocked)) continue;
    violations.push({
      code: 'external-commitment-overlap',
      placementId: placement.id,
      conflictingId: commitment.id,
      message: `Placement ${placement.id} overlaps commitment ${commitment.title}.`,
    });
  }

  return violations;
}

function sortPlacements(placements: InternalPlacement[]): InternalPlacement[] {
  return [...placements].sort((a, b) =>
    `${a.date}:${a.start}:${a.id}`.localeCompare(`${b.date}:${b.start}:${b.id}`),
  );
}

export class DeterministicScheduler implements SchedulerEngine {
  buildPlan(input: SchedulingDomainModel): SchedulerPlan {
    const accepted: InternalPlacement[] = [];
    const rejectedExistingPlacements: SchedulerPlan['rejectedExistingPlacements'] = [];

    for (const placement of sortPlacements(input.placements)) {
      const violations = violationsForPlacement(placement, accepted, input);
      if (violations.length > 0) {
        rejectedExistingPlacements.push({ placement, violations });
        continue;
      }
      accepted.push(placement);
    }

    const scheduledIds = new Set(accepted.map((placement) => placement.intentionId));
    const unscheduledIntentionIds = input.intentions
      .filter((intention) => intention.eligibleForScheduling && !scheduledIds.has(intention.id))
      .map((intention) => intention.id)
      .sort();

    return {
      placements: accepted,
      unscheduledIntentionIds,
      rejectedExistingPlacements,
    };
  }

  repairPlan(_currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    // Gate 1 deliberately rebuilds through the stable seam. Gate 4 will add partial repair and inertia.
    return this.buildPlan(change.nextInput);
  }

  validatePlan(plan: SchedulerPlan, input: SchedulingDomainModel): SchedulerViolation[] {
    const violations: SchedulerViolation[] = [];
    const accepted: InternalPlacement[] = [];

    for (const placement of sortPlacements(plan.placements)) {
      violations.push(...violationsForPlacement(placement, accepted, input));
      accepted.push(placement);
    }

    return violations;
  }

  explainPlacement(placementId: string, plan: SchedulerPlan): PlacementExplanation | null {
    const placement = plan.placements.find((candidate) => candidate.id === placementId);
    if (!placement) return null;

    return {
      placementId: placement.id,
      intentionId: placement.intentionId,
      provenance: [...placement.provenance],
    };
  }
}

export const scheduler: SchedulerEngine = new DeterministicScheduler();
