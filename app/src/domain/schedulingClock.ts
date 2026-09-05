import type {
  CandidateSchedulingInterval,
  SchedulerRepairNow,
  SchedulingDomainModel,
} from './schedulingModel';

export function clipCandidateIntervalToNow(
  interval: CandidateSchedulingInterval,
  now: SchedulerRepairNow,
): CandidateSchedulingInterval | null {
  if (interval.date < now.date) return null;
  if (interval.date > now.date) return interval;
  if (interval.end <= now.time) return null;
  if (interval.start >= now.time) return interval;

  return {
    ...interval,
    start: now.time,
    provenance: [
      ...interval.provenance,
      'Elapsed time was removed before planning so private work is not placed back into the past.',
    ],
  };
}

export function clipSchedulingInputToNow(
  input: SchedulingDomainModel,
  now: SchedulerRepairNow,
): SchedulingDomainModel {
  if (!input.candidateIntervals) return input;

  return {
    ...input,
    candidateIntervals: input.candidateIntervals.flatMap((interval) => {
      const clipped = clipCandidateIntervalToNow(interval, now);
      return clipped ? [clipped] : [];
    }),
  };
}
