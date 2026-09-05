import { describe, expect, it } from 'vitest';
import { scheduler } from './primaryScheduler';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  RhythmRequirement,
  SchedulingDomainModel,
} from './schedulingModel';

const timezone = 'Australia/Perth';

function candidate(date: string, start = '09:00', end = '17:00'): CandidateSchedulingInterval {
  return {
    id: `candidate:${date}:${start}`,
    date,
    start,
    end,
    timezone,
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Scheduler review regression fixture.'],
  };
}

function intention(): InternalIntention {
  return {
    id: 'task-a',
    title: 'Task A',
    area: 'admin',
    priority: 'normal',
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 10 },
      { kind: 'normal', label: 'Normal', minutes: 30 },
    ],
    timing: { timeConstraint: 'flexible' },
    lifecycle: {},
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id: 'task-a' }],
  };
}

function rhythm(): RhythmRequirement {
  return {
    id: 'rhythm-a',
    templateId: 'template-a',
    title: 'Restorative rhythm',
    area: 'health',
    frequency: 3,
    period: 'week',
    preferredDays: [],
    preferredTime: 'anytime',
    maxPerDay: 1,
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 5 },
      { kind: 'normal', label: 'Normal', minutes: 20 },
    ],
    sourceRecords: [{ kind: 'rhythmTemplate', id: 'template-a' }],
  };
}

function model(overrides: Partial<SchedulingDomainModel> = {}): SchedulingDomainModel {
  return {
    intentions: [],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: [],
    preferences: [],
    ...overrides,
  };
}

describe('scheduler review regressions', () => {
  it('never reschedules released work into elapsed time during a user repair', () => {
    const input = model({
      intentions: [intention()],
      candidateIntervals: [candidate('2026-09-07')],
    });
    const initial = scheduler.buildPlan(input);
    expect(initial.placements[0]?.start).toBe('09:00');

    const repaired = scheduler.repairPlan(initial, {
      reason: 'User changed the plan after lunch.',
      trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '14:00', timezone },
      releasePlacementIds: initial.placements.map((placement) => placement.id),
      nextInput: input,
    });

    expect(repaired.placements).toHaveLength(1);
    expect(repaired.placements[0].start >= '14:00').toBe(true);
    expect(repaired.repair?.changes.length).toBeGreaterThan(0);
  });

  it('enforces weekly frequency once across a rolling seven-day horizon', () => {
    const dates = [
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
    ];
    const plan = scheduler.buildPlan(model({
      rhythms: [rhythm()],
      candidateIntervals: dates.map((date) => candidate(date, '09:00', '10:00')),
    }));

    const placements = plan.placements.filter((placement) => placement.rhythmId === 'rhythm-a');
    expect(placements).toHaveLength(3);
  });

  it('preserves rhythm size on Reduced Day unless the rhythm explicitly opts in', () => {
    const base = model({
      rhythms: [{ ...rhythm(), frequency: 1 }],
      candidateIntervals: [candidate('2026-09-07', '09:00', '10:00')],
      planningPolicy: {
        dayMode: 'reduced',
        reducedDay: { preferMinimumForFlexibleWork: true },
      },
    });

    const preserved = scheduler.buildPlan(base);
    expect(preserved.placements[0]).toMatchObject({
      rhythmId: 'rhythm-a',
      variantKind: 'normal',
      start: '09:00',
      end: '09:20',
    });

    const optedIn = scheduler.buildPlan({
      ...base,
      planningPolicy: {
        dayMode: 'reduced',
        reducedDay: {
          preferMinimumForFlexibleWork: true,
          minimumEligibleRhythmIds: ['rhythm-a'],
        },
      },
    });
    expect(optedIn.placements[0]).toMatchObject({
      rhythmId: 'rhythm-a',
      variantKind: 'minimum',
      start: '09:00',
      end: '09:05',
    });
  });
});
