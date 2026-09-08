import { describe, expect, it } from 'vitest';
import { scheduler } from './primaryScheduler';
import type { InternalIntention, RhythmRequirement, SchedulingDomainModel } from './schedulingModel';

const timezone = 'Australia/Perth';

function intention(id: string): InternalIntention {
  return {
    id,
    title: id,
    area: 'admin',
    taskType: 'admin',
    priority: 'normal',
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 5 },
      { kind: 'normal', label: 'Normal', minutes: 20 },
    ],
    timing: { timeConstraint: 'flexible' },
    lifecycle: { activeTaskStatus: 'active' },
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'activeTask', id }],
  };
}

function rhythm(id: string, overrides: Partial<RhythmRequirement> = {}): RhythmRequirement {
  return {
    id, templateId: id, title: id, area: 'movement', frequency: 1, period: 'day',
    preferredDays: [], preferredTime: 'morning', maxPerDay: 1,
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 5 },
      { kind: 'normal', label: 'Normal', minutes: 20 },
    ],
    sourceRecords: [{ kind: 'rhythmTemplate', id }],
    ...overrides,
  };
}

function input(): SchedulingDomainModel {
  return {
    intentions: [intention('today-task'), intention('tomorrow-task')],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: [
      {
        id: 'today', date: '2026-09-07', start: '09:00', end: '09:20', timezone,
        capacityMeaning: 'candidate-not-capacity', provenance: ['Test capacity.'],
      },
      {
        id: 'tomorrow', date: '2026-09-08', start: '09:00', end: '10:00', timezone,
        capacityMeaning: 'candidate-not-capacity', provenance: ['Test capacity.'],
      },
    ],
    planningPolicy: {
      dayMode: 'reduced',
      // Deliberately cast so this test fails on behaviour at the current baseline,
      // rather than merely because the date-scoping field is not implemented yet.
      ...({ dayModeDate: '2026-09-07' } as Record<string, unknown>),
      reducedDay: { maxAutomaticPlacementsPerDay: 1 },
    },
  };
}

describe('date-scoped Reduced Day policy', () => {
  it('reduces only today while tomorrow retains normal sizing and normal caps', () => {
    const plan = scheduler.buildPlan(input());

    expect(plan.placements).toEqual([
      expect.objectContaining({ intentionId: 'today-task', date: '2026-09-07', end: '09:05', variantKind: 'minimum' }),
      expect.objectContaining({ intentionId: 'tomorrow-task', date: '2026-09-08', end: '09:20', variantKind: 'normal' }),
    ]);
    expect(plan.unscheduledIntentionIds).toEqual([]);
  });

  it('uses a minute cap only on the active date and schedules with the forced Minimum that fits it', () => {
    const scoped = input();
    scoped.intentions = [intention('a'), intention('b'), intention('c')];
    scoped.candidateIntervals![0].end = '09:10';
    scoped.planningPolicy!.reducedDay = { maxInternalScheduledMinutesPerDay: 10 };
    const plan = scheduler.buildPlan(scoped);
    expect(plan.placements.filter((placement) => placement.date === '2026-09-07')).toEqual([
      expect.objectContaining({ intentionId: 'a', variantKind: 'minimum', end: '09:05' }),
      expect.objectContaining({ intentionId: 'b', variantKind: 'minimum', end: '09:10' }),
    ]);
    expect(plan.placements.find((placement) => placement.intentionId === 'c')).toMatchObject({
      date: '2026-09-08', variantKind: 'normal', end: '09:20',
    });
  });

  it('applies explicit rhythm eligibility only to today without changing daily frequency', () => {
    const scoped = input();
    scoped.intentions = [];
    scoped.rhythms = [rhythm('daily')];
    scoped.rhythmPlanningDates = ['2026-09-07', '2026-09-08'];
    scoped.planningPolicy!.reducedDay = { minimumEligibleRhythmIds: ['daily'] };
    const plan = scheduler.buildPlan(scoped);
    expect(plan.placements).toEqual([
      expect.objectContaining({ rhythmId: 'daily', date: '2026-09-07', variantKind: 'minimum', end: '09:05' }),
      expect.objectContaining({ rhythmId: 'daily', date: '2026-09-08', variantKind: 'normal', end: '09:20' }),
    ]);
    expect(plan.unscheduledRhythmIds).toEqual([]);
    expect(scheduler.validatePlan(plan, scoped)).toEqual([]);
  });

  it('keeps one rolling weekly frequency across Monday while reducing only the active date', () => {
    const dates = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'];
    const scoped = input();
    scoped.intentions = [];
    scoped.rhythms = [rhythm('weekly', { period: 'week', frequency: 3, maxPerDay: 1 })];
    scoped.rhythmPlanningDates = dates;
    scoped.candidateIntervals = dates.map((date) => ({
      id: date, date, start: '09:00', end: '10:00', timezone,
      capacityMeaning: 'candidate-not-capacity' as const, provenance: ['Test capacity.'],
    }));
    scoped.planningPolicy = {
      dayMode: 'reduced', dayModeDate: dates[0],
      reducedDay: { minimumEligibleRhythmIds: ['weekly'] },
    };
    const plan = scheduler.buildPlan(scoped);
    expect(plan.placements).toHaveLength(3);
    expect(plan.placements[0]).toMatchObject({ date: dates[0], variantKind: 'minimum' });
    expect(plan.placements.slice(1).every((placement) => placement.variantKind === 'normal')).toBe(true);
    expect(plan.unscheduledRhythmIds).toEqual([]);
  });

  it('does not move monthly coverage across months when only today is reduced', () => {
    const scoped = input();
    scoped.intentions = [];
    scoped.rhythms = [rhythm('monthly', { period: 'month', frequency: 1, maxPerDay: 1 })];
    scoped.rhythmPlanningDates = ['2026-09-30', '2026-10-01'];
    scoped.candidateIntervals = ['2026-09-30', '2026-10-01'].map((date) => ({
      id: date, date, start: '09:00', end: '10:00', timezone,
      capacityMeaning: 'candidate-not-capacity' as const, provenance: ['Test capacity.'],
    }));
    scoped.planningPolicy = {
      dayMode: 'reduced', dayModeDate: '2026-09-30',
      reducedDay: { minimumEligibleRhythmIds: ['monthly'] },
    };
    const plan = scheduler.buildPlan(scoped);
    expect(plan.placements).toEqual([
      expect.objectContaining({ date: '2026-09-30', variantKind: 'minimum' }),
      expect.objectContaining({ date: '2026-10-01', variantKind: 'normal' }),
    ]);
  });
});
