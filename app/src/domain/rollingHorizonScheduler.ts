import { ClockAwareScheduler } from './clockAwareScheduler';
import { clipSchedulingInputToNow } from './schedulingClock';
import type {
  InternalPlacement,
  RhythmRequirement,
  SchedulerChange,
  SchedulerPlan,
  SchedulerPlanChange,
  SchedulerPlacementPoint,
  SchedulingDomainModel,
} from './schedulingModel';

const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

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

function sortPlacements(placements: InternalPlacement[]): InternalPlacement[] {
  return [...placements].sort((left, right) =>
    `${left.date}:${left.start}:${left.id}`.localeCompare(`${right.date}:${right.start}:${right.id}`),
  );
}

function weekdayForDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function dateOrdinal(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function planningSpanDays(input: SchedulingDomainModel): number {
  const dates = [...new Set((input.candidateIntervals ?? []).map((candidate) => candidate.date))].sort();
  if (dates.length === 0) return 0;
  return Math.max(1, dateOrdinal(dates[dates.length - 1]) - dateOrdinal(dates[0]) + 1);
}

function weeklyOccurrenceLimit(rhythm: RhythmRequirement, input: SchedulingDomainModel): number {
  const spanDays = planningSpanDays(input);
  if (spanDays === 0) return 0;
  if (spanDays <= 7) return rhythm.frequency;
  return Math.ceil((rhythm.frequency * spanDays) / 7);
}

function placementPoint(placement: InternalPlacement): SchedulerPlacementPoint {
  return {
    date: placement.date,
    start: placement.start,
    end: placement.end,
    ...(placement.variantKind ? { variantKind: placement.variantKind } : {}),
  };
}

function samePosition(left: InternalPlacement, right: InternalPlacement): boolean {
  return left.date === right.date && left.start === right.start && left.end === right.end;
}

function sameVariant(left: InternalPlacement, right: InternalPlacement): boolean {
  return left.variantKind === right.variantKind;
}

function diffChanges(
  beforePlacements: InternalPlacement[],
  afterPlacements: InternalPlacement[],
  reason: string,
): SchedulerPlanChange[] {
  const beforeGroups = new Map<string, InternalPlacement[]>();
  const afterGroups = new Map<string, InternalPlacement[]>();

  for (const placement of sortPlacements(beforePlacements)) {
    const key = targetKey(placement);
    beforeGroups.set(key, [...(beforeGroups.get(key) ?? []), placement]);
  }
  for (const placement of sortPlacements(afterPlacements)) {
    const key = targetKey(placement);
    afterGroups.set(key, [...(afterGroups.get(key) ?? []), placement]);
  }

  const changes: SchedulerPlanChange[] = [];
  const keys = [...new Set([...beforeGroups.keys(), ...afterGroups.keys()])].sort();

  for (const key of keys) {
    const before = beforeGroups.get(key) ?? [];
    const after = afterGroups.get(key) ?? [];
    const pairs = Math.min(before.length, after.length);

    for (let index = 0; index < pairs; index += 1) {
      if (samePosition(before[index], after[index]) && sameVariant(before[index], after[index])) continue;
      changes.push({
        kind: samePosition(before[index], after[index]) ? 'variantChanged' : 'moved',
        targetKind: targetKind(after[index]),
        targetId: targetId(after[index]),
        from: placementPoint(before[index]),
        to: placementPoint(after[index]),
        reason,
      });
    }

    for (let index = pairs; index < before.length; index += 1) {
      changes.push({
        kind: 'removed',
        targetKind: targetKind(before[index]),
        targetId: targetId(before[index]),
        from: placementPoint(before[index]),
        reason,
      });
    }

    for (let index = pairs; index < after.length; index += 1) {
      changes.push({
        kind: 'added',
        targetKind: targetKind(after[index]),
        targetId: targetId(after[index]),
        to: placementPoint(after[index]),
        reason,
      });
    }
  }

  return changes;
}

function preferredPlacementOrder(rhythm: RhythmRequirement, placement: InternalPlacement): string {
  const preferredDay = rhythm.preferredDays.length === 0 ||
    rhythm.preferredDays.includes(weekdayForDate(placement.date));
  return `${preferredDay ? '0' : '1'}:${placement.date}:${placement.start}:${placement.id}`;
}

function enforceRollingWeeklyFrequency(
  plan: SchedulerPlan,
  input: SchedulingDomainModel,
  currentPlan?: SchedulerPlan,
): SchedulerPlan {
  const frozenIds = new Set(plan.repair?.frozenPastPlacementIds ?? []);
  const removeIds = new Set<string>();

  for (const rhythm of input.rhythms.filter((candidate) => candidate.period === 'week')) {
    const limit = weeklyOccurrenceLimit(rhythm, input);
    const placements = plan.placements.filter(
      (placement) => targetKind(placement) === 'rhythm' && targetId(placement) === rhythm.id,
    );
    const authoritative = placements.filter(
      (placement) => placement.origin === 'existingUserConfirmed' || frozenIds.has(placement.id),
    );
    const automatic = placements
      .filter((placement) => !authoritative.some((fixed) => fixed.id === placement.id))
      .sort((left, right) =>
        preferredPlacementOrder(rhythm, left).localeCompare(preferredPlacementOrder(rhythm, right)),
      );
    const automaticLimit = Math.max(0, limit - authoritative.length);

    for (const placement of automatic.slice(automaticLimit)) {
      removeIds.add(placement.id);
    }
  }

  if (removeIds.size === 0) return plan;

  const placements = sortPlacements(plan.placements.filter((placement) => !removeIds.has(placement.id)));
  const next: SchedulerPlan = {
    ...plan,
    placements,
    unscheduledRhythmIds: plan.unscheduledRhythmIds.filter((rhythmId) => {
      const rhythm = input.rhythms.find((candidate) => candidate.id === rhythmId);
      if (!rhythm || rhythm.period !== 'week') return true;
      const scheduled = placements.filter(
        (placement) => targetKind(placement) === 'rhythm' && targetId(placement) === rhythm.id,
      ).length;
      return scheduled < weeklyOccurrenceLimit(rhythm, input);
    }),
  };

  if (!plan.repair || !currentPlan) return next;

  return {
    ...next,
    repair: {
      ...plan.repair,
      preservedPlacementIds: plan.repair.preservedPlacementIds.filter((id) => !removeIds.has(id)),
      changes: diffChanges(currentPlan.placements, placements, plan.repair.reason),
    },
  };
}

/**
 * Prevents a rolling horizon from multiplying a weekly rhythm merely because
 * it crosses the Monday boundary used by the underlying calendar-week bucket.
 */
export class RollingHorizonScheduler extends ClockAwareScheduler {
  buildPlan(input: SchedulingDomainModel): SchedulerPlan {
    return enforceRollingWeeklyFrequency(super.buildPlan(input), input);
  }

  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    const effectiveInput = change.now
      ? clipSchedulingInputToNow(change.nextInput, change.now)
      : change.nextInput;
    const repaired = super.repairPlan(currentPlan, change);
    return enforceRollingWeeklyFrequency(repaired, effectiveInput, currentPlan);
  }
}
