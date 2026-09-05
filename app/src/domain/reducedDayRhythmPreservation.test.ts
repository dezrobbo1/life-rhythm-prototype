import { describe, expect, it } from 'vitest';
import { Gate5ReducedDayScheduler } from './gate5ReducedDay';
import type { RhythmRequirement, SchedulingDomainModel } from './schedulingModel';

const date = '2026-09-07';
const timezone = 'Australia/Perth';

function rhythm(reducedDayBehavior?: RhythmRequirement['reducedDayBehavior']): RhythmRequirement {
  return {
    id: 'restore',
    templateId: 'restore-template',
    title: 'Restore',
    area: 'other',
    frequency: 1,
    period: 'day',
    preferredDays: [],
    preferredTime: 'morning',
    maxPerDay: 1,
    ...(reducedDayBehavior ? { reducedDayBehavior } : {}),
    variants: [
      { kind: 'minimum', label: 'Brief restore', minutes: 5 },
      { kind: 'normal', label: 'Restore', minutes: 20 },
      { kind: 'full', label: 'Long restore', minutes: 30 },
    ],
    sourceRecords: [{ kind: 'rhythmTemplate', id: 'restore-template' }],
  };
}

function model(reducedDayBehavior?: RhythmRequirement['reducedDayBehavior']): SchedulingDomainModel {
  return {
    intentions: [],
    rhythms: [rhythm(reducedDayBehavior)],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: [
      {
        id: 'morning',
        date,
        start: '09:00',
        end: '10:00',
        timezone,
        capacityMeaning: 'candidate-not-capacity',
        provenance: ['Reduced Day preservation test candidate.'],
      },
    ],
    preferences: [],
    planningPolicy: {
      dayMode: 'reduced',
    },
  };
}

describe('Reduced Day rhythm preservation', () => {
  it('keeps an explicitly preserved rhythm at its ordinary form', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const plan = scheduler.buildPlan(model('preserve'));
    const placement = plan.placements.find((candidate) => candidate.rhythmId === 'restore');

    expect(placement).toMatchObject({
      start: '09:00',
      end: '09:20',
      variantKind: 'normal',
    });
  });

  it('retains the existing minimum-form default when no preservation is requested', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const plan = scheduler.buildPlan(model());
    const placement = plan.placements.find((candidate) => candidate.rhythmId === 'restore');

    expect(placement).toMatchObject({
      start: '09:00',
      end: '09:05',
      variantKind: 'minimum',
    });
  });
});
