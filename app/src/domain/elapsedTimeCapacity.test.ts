import { describe, expect, it } from 'vitest';
import {
  clipCandidateIntervalsToNow,
  clipSchedulingInputToNow,
} from './elapsedTimeCapacity';
import type {
  CandidateSchedulingInterval,
  SchedulingDomainModel,
} from './schedulingModel';

const now = {
  date: '2026-09-07',
  time: '10:30',
  timezone: 'Australia/Perth',
};

function candidate(
  id: string,
  date: string,
  start: string,
  end: string,
): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone: now.timezone,
    capacityMeaning: 'candidate-not-capacity',
    provenance: [`Original provenance for ${id}.`],
  };
}

function model(candidateIntervals: CandidateSchedulingInterval[]): SchedulingDomainModel {
  return {
    intentions: [],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals,
  };
}

describe('elapsed scheduling-capacity clipping', () => {
  it('clips a partially elapsed current-day interval and preserves its metadata and provenance', () => {
    const original = candidate('partially-elapsed', now.date, '09:00', '12:00');

    expect(clipCandidateIntervalsToNow([original], now)).toEqual([{
      ...original,
      start: '10:30',
      provenance: [
        'Original provenance for partially-elapsed.',
        'Elapsed time was removed from scheduler repair capacity.',
      ],
    }]);
  });

  it('removes completely elapsed current-day intervals, including one ending at now', () => {
    const currentDayElapsed = candidate('elapsed', now.date, '09:00', '10:00');
    const endsNow = candidate('ends-now', now.date, '10:00', '10:30');

    expect(clipCandidateIntervalsToNow([currentDayElapsed, endsNow], now)).toEqual([]);
    expect(clipSchedulingInputToNow(model([currentDayElapsed, endsNow]), now)).toMatchObject({
      candidateIntervals: [],
      rhythmPlanningDates: [now.date],
    });
  });

  it('discards candidate intervals from a prior day', () => {
    const priorDay = candidate('prior-day', '2026-09-06', '11:00', '12:00');

    expect(clipCandidateIntervalsToNow([priorDay], now)).toEqual([]);
    expect(clipSchedulingInputToNow(model([priorDay]), now)).toMatchObject({
      candidateIntervals: [],
      rhythmPlanningDates: [],
    });
  });

  it('leaves current-day intervals starting at now and future intervals unchanged', () => {
    const startsNow = candidate('starts-now', now.date, '10:30', '11:00');
    const laterToday = candidate('later-today', now.date, '11:00', '12:00');
    const futureDay = candidate('future-day', '2026-09-08', '09:00', '10:00');

    expect(clipCandidateIntervalsToNow([startsNow, laterToday, futureDay], now)).toEqual([
      startsNow,
      laterToday,
      futureDay,
    ]);
  });

  it('preserves an input that has no derived candidate intervals', () => {
    const input = model([]);
    delete input.candidateIntervals;

    expect(clipSchedulingInputToNow(input, now)).toBe(input);
  });
});
