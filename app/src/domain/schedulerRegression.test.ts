import { describe, expect, it } from 'vitest';
import { scheduler } from './primaryScheduler';
import type {
  CandidateSchedulingInterval,
  RhythmRequirement,
  SchedulingDomainModel,
} from './schedulingModel';

const timezone = 'Australia/Perth';

function candidate(date: string): CandidateSchedulingInterval {
  return {
    id: `candidate-${date}`,
    date,
    start: '09:00',
    end: '10:00',
    timezone,
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Scheduler regression fixture.'],
  };
}

function weeklyRhythm(): RhythmRequirement {
  return {
    id: 'walk-rhythm',
    templateId: 'walk-template',
    title: 'Walk',
    area: 'movement',
    frequency: 3,
    period: 'week',
    preferredDays: ['Friday', 'Monday', 'Wednesday'],
    preferredTime: 'morning',
    maxPerDay: 1,
    variants: [{ kind: 'normal', label: 'Walk', minutes: 20 }],
    sourceRecords: [{ kind: 'rhythmTemplate', id: 'walk-template' }],
  };
}

function model(dates: string[]): SchedulingDomainModel {
  return {
    intentions: [],
    rhythms: [weeklyRhythm()],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: dates.map(candidate),
    preferences: [],
  };
}

describe('scheduler regressions', () => {
  it('does not reset a weekly rhythm when a rolling horizon crosses Monday', () => {
    const input = model([
      '2026-09-11', // Friday
      '2026-09-12',
      '2026-09-13',
      '2026-09-14', // Monday
      '2026-09-15',
      '2026-09-16', // Wednesday
    ]);

    const plan = scheduler.buildPlan(input);
    const rhythmPlacements = plan.placements.filter(
      (placement) => placement.targetKind === 'rhythm' && placement.rhythmId === 'walk-rhythm',
    );

    expect(rhythmPlacements).toHaveLength(3);
    expect(rhythmPlacements.map((placement) => placement.date).sort()).toEqual([
      '2026-09-11',
      '2026-09-14',
      '2026-09-16',
    ]);
    expect(plan.unscheduledRhythmIds).toEqual([]);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('still permits the configured weekly frequency inside a short horizon', () => {
    const input = model(['2026-09-14', '2026-09-15', '2026-09-16']);
    input.rhythms = [{ ...weeklyRhythm(), frequency: 2 }];

    const plan = scheduler.buildPlan(input);
    const rhythmPlacements = plan.placements.filter(
      (placement) => placement.targetKind === 'rhythm' && placement.rhythmId === 'walk-rhythm',
    );

    expect(rhythmPlacements).toHaveLength(2);
    expect(plan.unscheduledRhythmIds).toEqual([]);
  });
});
