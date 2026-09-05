import type {
  CandidateSchedulingInterval,
  SchedulerRepairNow,
  SchedulingDomainModel,
} from './schedulingModel';

const ELAPSED_TIME_REMOVED_PROVENANCE =
  'Elapsed time was removed from scheduler repair capacity.';

export function clipCandidateIntervalsToNow(
  intervals: CandidateSchedulingInterval[],
  now: SchedulerRepairNow,
): CandidateSchedulingInterval[] {
  return intervals.flatMap((interval) => {
    if (interval.date < now.date) return [];
    if (interval.date > now.date) return [interval];
    if (interval.end <= now.time) return [];
    if (interval.start >= now.time) return [interval];

    return [{
      ...interval,
      start: now.time,
      provenance: [
        ...interval.provenance,
        ELAPSED_TIME_REMOVED_PROVENANCE,
      ],
    }];
  });
}

export function clipSchedulingInputToNow(
  input: SchedulingDomainModel,
  now: SchedulerRepairNow,
): SchedulingDomainModel {
  if (!input.candidateIntervals) return input;

  return {
    ...input,
    candidateIntervals: clipCandidateIntervalsToNow(input.candidateIntervals, now),
  };
}
