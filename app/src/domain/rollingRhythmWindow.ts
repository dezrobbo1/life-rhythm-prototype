import { Gate5ReducedDayScheduler } from './gate5ReducedDay';
import type {
  InternalPlacement,
  RhythmRequirement,
  SchedulerChange,
  SchedulerPlan,
  SchedulerPlanChange,
  SchedulerPlacementPoint,
  SchedulingDomainModel,
} from './schedulingModel';

export type RollingRhythmWindowStatus = 'rolling-rhythm-window-v1';
export const rollingRhythmWindowStatus: RollingRhythmWindowStatus = 'rolling-rhythm-window-v1';

const cadenceReason =
  'Weekly rhythm frequency was applied across the rolling seven-day planning window instead of restarting at a Monday boundary.';

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

function placementPoint(placement: InternalPlacement): SchedulerPlacementPoint {
  return {
    date: placement.date,
    start: placement.start,
    end: placement.end,
    ...(placement.variantKind ? { variantKind: placement.variantKind } : {}),
  };
}

function dateOrdinal(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const epoch = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(epoch);

  if (
    !Number.isFinite(epoch) ||
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() + 1 !== month ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(epoch / 86_400_000);
}

function rollingWeekIndex(anchorDate: string, date: string): number | null {
  const anchor = dateOrdinal(anchorDate);
  const candidate = dateOrdinal(date);
  if (anchor === null || candidate === null || candidate < anchor) return null;
  return Math.floor((candidate - anchor) / 7);
}

function weekdayForDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function preferredTimePenalty(placement: InternalPlacement, rhythm: RhythmRequirement): number {
  const start = minutesFromTime(placement.start);
  const end = minutesFromTime(placement.end);

  switch (rhythm.preferredTime) {
    case 'morning':
      return start >= 6 * 60 && end <= 12 * 60 ? 0 : 1;
    case 'midday':
      return start >= 11 * 60 && end <= 14 * 60 ? 0 : 1;
    case 'afternoon':
      return start >= 12 * 60 && end <= 17 * 60 ? 0 : 1;
    case 'evening':
      return start >= 17 * 60 && end <= 22 * 60 ? 0 : 1;
    default:
      return 0;
  }
}

function schedulerPlacementRank(
  placement: InternalPlacement,
  rhythm: RhythmRequirement,
): string {
  const explicitPreferencePenalty = placement.provenance.some((line) =>
    line.startsWith('Matched explicit preference '),
  )
    ? 0
    : 1;
  const preferredDayPenalty =
    rhythm.preferredDays.length === 0 || rhythm.preferredDays.includes(weekdayForDate(placement.date))
      ? 0
      : 1;

  return [
    explicitPreferencePenalty,
    preferredDayPenalty,
    preferredTimePenalty(placement, rhythm),
    placement.date,
    placement.start,
    placement.id,
  ].join(':');
}

function pointKey(
  targetKindValue: 'intention' | 'rhythm',
  targetIdValue: string,
  point: SchedulerPlacementPoint,
): string {
  return [
    targetKindValue,
    targetIdValue,
    point.date,
    point.start,
    point.end,
    point.variantKind ?? '',
  ].join('|');
}

function repairChangesAfterRemoval(
  changes: SchedulerPlanChange[],
  removed: InternalPlacement[],
): SchedulerPlanChange[] {
  const removedByToPoint = new Map(
    removed.map((placement) => [
      pointKey(targetKind(placement), targetId(placement), placementPoint(placement)),
      placement,
    ]),
  );
  const representedRemovedIds = new Set<string>();
  const next: SchedulerPlanChange[] = [];

  for (const change of changes) {
    if (!change.to) {
      next.push(change);
      continue;
    }

    const removedPlacement = removedByToPoint.get(
      pointKey(change.targetKind, change.targetId, change.to),
    );
    if (!removedPlacement) {
      next.push(change);
      continue;
    }

    representedRemovedIds.add(removedPlacement.id);

    if (change.kind === 'added') {
      continue;
    }

    if ((change.kind === 'moved' || change.kind === 'variantChanged') && change.from) {
      next.push({
        kind: 'removed',
        targetKind: change.targetKind,
        targetId: change.targetId,
        from: change.from,
        reason: cadenceReason,
      });
      continue;
    }

    next.push(change);
  }

  for (const placement of removed) {
    if (representedRemovedIds.has(placement.id)) continue;
    next.push({
      kind: 'removed',
      targetKind: targetKind(placement),
      targetId: targetId(placement),
      from: placementPoint(placement),
      reason: cadenceReason,
    });
  }

  return next.sort((left, right) =>
    `${left.targetKind}:${left.targetId}:${left.kind}:${left.from?.date ?? left.to?.date ?? ''}:${left.from?.start ?? left.to?.start ?? ''}`.localeCompare(
      `${right.targetKind}:${right.targetId}:${right.kind}:${right.from?.date ?? right.to?.date ?? ''}:${right.from?.start ?? right.to?.start ?? ''}`,
    ),
  );
}

export function enforceRollingWeeklyRhythmFrequency(
  plan: SchedulerPlan,
  input: SchedulingDomainModel,
): SchedulerPlan {
  const candidateDates = [
    ...new Set((input.candidateIntervals ?? []).map((candidate) => candidate.date)),
  ].sort();
  const anchorDate = candidateDates[0];
  if (!anchorDate) return plan;

  const removeIds = new Set<string>();

  for (const rhythm of input.rhythms.filter((candidate) => candidate.period === 'week')) {
    const placements = plan.placements.filter(
      (placement) => targetKind(placement) === 'rhythm' && targetId(placement) === rhythm.id,
    );
    const byRollingWeek = new Map<number, InternalPlacement[]>();

    for (const placement of placements) {
      const bucket = rollingWeekIndex(anchorDate, placement.date);
      if (bucket === null) continue;
      byRollingWeek.set(bucket, [...(byRollingWeek.get(bucket) ?? []), placement]);
    }

    for (const bucketPlacements of byRollingWeek.values()) {
      const authoritativeCount = bucketPlacements.filter(
        (placement) => placement.origin !== 'scheduler',
      ).length;
      const allowedSchedulerPlacements = Math.max(0, rhythm.frequency - authoritativeCount);
      const schedulerPlacements = bucketPlacements
        .filter((placement) => placement.origin === 'scheduler')
        .sort((left, right) =>
          schedulerPlacementRank(left, rhythm).localeCompare(schedulerPlacementRank(right, rhythm)),
        );

      for (const placement of schedulerPlacements.slice(allowedSchedulerPlacements)) {
        removeIds.add(placement.id);
      }
    }
  }

  if (removeIds.size === 0) return plan;

  const removed = plan.placements.filter((placement) => removeIds.has(placement.id));
  const placements = plan.placements.filter((placement) => !removeIds.has(placement.id));

  if (!plan.repair) {
    return {
      ...plan,
      placements,
    };
  }

  return {
    ...plan,
    placements,
    repair: {
      ...plan.repair,
      preservedPlacementIds: plan.repair.preservedPlacementIds.filter((id) => !removeIds.has(id)),
      changes: repairChangesAfterRemoval(plan.repair.changes, removed),
    },
  };
}

export class RollingRhythmWindowScheduler extends Gate5ReducedDayScheduler {
  buildPlan(input: SchedulingDomainModel): SchedulerPlan {
    return enforceRollingWeeklyRhythmFrequency(super.buildPlan(input), input);
  }

  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    return enforceRollingWeeklyRhythmFrequency(
      super.repairPlan(currentPlan, change),
      change.nextInput,
    );
  }
}
