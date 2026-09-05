import { Gate5ReducedDayScheduler } from './gate5ReducedDay';
import type {
  CandidateSchedulingInterval,
  InternalPlacement,
  RhythmRequirement,
  SchedulerChange,
  SchedulerPlan,
  SchedulerPlanChange,
  SchedulerRepairNow,
  SchedulingDomainModel,
} from './schedulingModel';

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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

function clipCandidateToNow(
  candidate: CandidateSchedulingInterval,
  now: SchedulerRepairNow,
): CandidateSchedulingInterval | null {
  if (candidate.date < now.date) return null;
  if (candidate.date > now.date) return candidate;

  const candidateEnd = minutesFromTime(candidate.end);
  const nowMinutes = minutesFromTime(now.time);
  if (candidateEnd <= nowMinutes) return null;

  const candidateStart = minutesFromTime(candidate.start);
  if (candidateStart >= nowMinutes) return candidate;

  return {
    ...candidate,
    id: `${candidate.id}:clipped-now`,
    start: timeFromMinutes(nowMinutes),
    provenance: [
      ...candidate.provenance,
      `Clipped to the repair clock at ${now.time}; elapsed time was not treated as schedulable.`,
    ],
  };
}

export function clipSchedulingInputToNow(
  input: SchedulingDomainModel,
  now?: SchedulerRepairNow,
): SchedulingDomainModel {
  if (!now || !input.candidateIntervals) return input;

  return {
    ...input,
    candidateIntervals: input.candidateIntervals.flatMap((candidate) => {
      const clipped = clipCandidateToNow(candidate, now);
      return clipped ? [clipped] : [];
    }),
  };
}

function prepareReducedDayRhythms(input: SchedulingDomainModel): SchedulingDomainModel {
  if (input.planningPolicy?.dayMode !== 'reduced') return input;

  const eligible = new Set(input.planningPolicy.reducedDay?.minimumEligibleRhythmIds ?? []);
  if (eligible.size === 0) {
    return {
      ...input,
      rhythms: input.rhythms.map((rhythm) => ({
        ...rhythm,
        variants: rhythm.variants.filter((variant) => variant.kind !== 'minimum').length > 0
          ? rhythm.variants.filter((variant) => variant.kind !== 'minimum')
          : rhythm.variants,
      })),
    };
  }

  return {
    ...input,
    rhythms: input.rhythms.map((rhythm) => {
      if (eligible.has(rhythm.id)) return rhythm;
      const nonMinimum = rhythm.variants.filter((variant) => variant.kind !== 'minimum');
      return nonMinimum.length > 0 ? { ...rhythm, variants: nonMinimum } : rhythm;
    }),
  };
}

function placementRhythmId(placement: InternalPlacement): string | null {
  if ((placement.targetKind ?? 'intention') !== 'rhythm') return null;
  return placement.rhythmId ?? placement.intentionId;
}

function rollingWeekBucket(date: string, anchor: string): number | null {
  const dateOrdinal = localDateOrdinal(date);
  const anchorOrdinal = localDateOrdinal(anchor);
  if (dateOrdinal === null || anchorOrdinal === null) return null;
  return Math.floor((dateOrdinal - anchorOrdinal) / 7);
}

function sortedCandidateDates(input: SchedulingDomainModel): string[] {
  return [...new Set((input.candidateIntervals ?? []).map((candidate) => candidate.date))].sort();
}

function pruneRollingWeeklyRhythms(
  plan: SchedulerPlan,
  input: SchedulingDomainModel,
  beforePlan?: SchedulerPlan,
): SchedulerPlan {
  const dates = sortedCandidateDates(input);
  const anchor = dates[0];
  if (!anchor) return plan;

  const weeklyById = new Map<string, RhythmRequirement>();
  for (const rhythm of input.rhythms) {
    if (rhythm.period === 'week') weeklyById.set(rhythm.id, rhythm);
  }
  if (weeklyById.size === 0) return plan;

  const placements = [...plan.placements].sort((left, right) =>
    `${left.date}:${left.start}:${left.id}`.localeCompare(`${right.date}:${right.start}:${right.id}`),
  );
  const counts = new Map<string, number>();
  const removed: InternalPlacement[] = [];
  const kept = placements.filter((placement) => {
    const rhythmId = placementRhythmId(placement);
    if (!rhythmId) return true;
    const rhythm = weeklyById.get(rhythmId);
    if (!rhythm) return true;
    const bucket = rollingWeekBucket(placement.date, anchor);
    if (bucket === null || bucket < 0) return true;
    const key = `${rhythmId}:${bucket}`;
    const nextCount = (counts.get(key) ?? 0) + 1;
    counts.set(key, nextCount);
    if (nextCount <= rhythm.frequency) return true;
    removed.push(placement);
    return false;
  });

  if (removed.length === 0) return plan;

  if (!plan.repair) {
    return { ...plan, placements: kept };
  }

  const removedIds = new Set(removed.map((placement) => placement.id));
  const removedCurrentIds = new Set(
    (beforePlan?.placements ?? []).filter((placement) => removedIds.has(placement.id)).map((placement) => placement.id),
  );
  const removedTargets = new Set(removed.map((placement) => placementRhythmId(placement)).filter(Boolean));
  const changes = plan.repair.changes.filter((change) => {
    if (change.targetKind !== 'rhythm' || !removedTargets.has(change.targetId)) return true;
    if (change.kind === 'added' && change.to) {
      return !removed.some((placement) =>
        placementRhythmId(placement) === change.targetId &&
        placement.date === change.to?.date &&
        placement.start === change.to?.start &&
        placement.end === change.to?.end,
      );
    }
    if ((change.kind === 'moved' || change.kind === 'variantChanged') && change.to) {
      return !removed.some((placement) =>
        placementRhythmId(placement) === change.targetId &&
        placement.date === change.to?.date &&
        placement.start === change.to?.start &&
        placement.end === change.to?.end,
      );
    }
    return true;
  });

  const additionalRemovedChanges: SchedulerPlanChange[] = removed
    .filter((placement) => removedCurrentIds.has(placement.id))
    .map((placement) => ({
      kind: 'removed' as const,
      targetKind: 'rhythm' as const,
      targetId: placementRhythmId(placement) as string,
      from: {
        date: placement.date,
        start: placement.start,
        end: placement.end,
        ...(placement.variantKind ? { variantKind: placement.variantKind } : {}),
      },
      reason: 'Weekly rhythm frequency is enforced over rolling seven-day windows, not each partial calendar week.',
    }));

  return {
    ...plan,
    placements: kept,
    repair: {
      ...plan.repair,
      preservedPlacementIds: plan.repair.preservedPlacementIds.filter((id) => !removedIds.has(id)),
      changes: [...changes, ...additionalRemovedChanges],
    },
  };
}

function preparedInput(input: SchedulingDomainModel, now?: SchedulerRepairNow): SchedulingDomainModel {
  return prepareReducedDayRhythms(clipSchedulingInputToNow(input, now));
}

export class SchedulerReviewGuardScheduler extends Gate5ReducedDayScheduler {
  buildPlan(input: SchedulingDomainModel): SchedulerPlan {
    const prepared = prepareReducedDayRhythms(input);
    return pruneRollingWeeklyRhythms(super.buildPlan(prepared), prepared);
  }

  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    const prepared = preparedInput(change.nextInput, change.now);
    const repaired = super.repairPlan(currentPlan, {
      ...change,
      nextInput: prepared,
    });
    return pruneRollingWeeklyRhythms(repaired, prepared, currentPlan);
  }
}
