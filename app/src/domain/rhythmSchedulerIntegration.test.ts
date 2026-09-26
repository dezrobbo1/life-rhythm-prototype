import { describe, expect, it } from 'vitest';
import { scheduler } from './primaryScheduler';
import type { RhythmRequirement, SchedulingDomainModel } from './schedulingModel';

function rhythm(id: string): RhythmRequirement {
  return {
    id,
    templateId: 'template-a',
    planId: 'plan-a',
    recurrenceRevisionId: 'revision-a',
    rhythmInstanceId: id,
    title: 'Concrete rhythm occurrence',
    area: 'house',
    frequency: 1,
    period: 'week',
    preferredDays: ['Monday'],
    preferredTime: 'morning',
    maxPerDay: 2,
    eligibilityStartDate: '2026-09-07',
    eligibilityEndDate: '2026-09-13',
    lifecycleState: 'eligible',
    variants: [
      { kind: 'minimum', label: 'Small action', minutes: 5 },
      { kind: 'normal', label: 'Normal action', minutes: 15 },
      { kind: 'full', label: 'Full action', minutes: 30 },
    ],
    sourceRecords: [
      { kind: 'rhythmTemplate', id: 'template-a' },
      { kind: 'rhythmPlan', id: 'plan-a' },
      { kind: 'rhythmRecurrenceRevision', id: 'revision-a' },
      { kind: 'rhythmInstance', id },
    ],
  };
}

function model(rhythms: RhythmRequirement[] = [rhythm('instance-a')]): SchedulingDomainModel {
  return {
    intentions: [], rhythms, externalCommitments: [], capacityWindows: [], placements: [], dayProfiles: [],
    candidateIntervals: [{
      id: 'candidate', date: '2026-09-07', start: '09:00', end: '11:00', timezone: 'Australia/Perth',
      capacityMeaning: 'candidate-not-capacity', provenance: ['Test candidate.'],
    }],
    rhythmPlanningDates: ['2026-09-07'],
  };
}

describe('concrete rhythm occurrence scheduling', () => {
  it('retains template, plan, revision, and instance identity on placement', () => {
    const plan = scheduler.buildPlan(model());
    expect(plan.placements[0]).toMatchObject({
      targetKind: 'rhythm', rhythmId: 'instance-a', rhythmTemplateId: 'template-a', rhythmPlanId: 'plan-a',
      rhythmRecurrenceRevisionId: 'revision-a', rhythmInstanceId: 'instance-a', variantKind: 'normal',
    });
  });

  it('keeps distinct generated instances as distinct placements', () => {
    const plan = scheduler.buildPlan(model([rhythm('instance-a'), rhythm('instance-b')]));
    expect(plan.placements.map((placement) => placement.rhythmInstanceId)).toEqual(['instance-a', 'instance-b']);
    expect(new Set(plan.placements.map((placement) => placement.id)).size).toBe(2);
  });

  it('does not duplicate an instance that already has an accepted placement', () => {
    const input = model();
    const first = scheduler.buildPlan(input);
    const rebuilt = scheduler.buildPlan({ ...input, placements: first.placements });
    expect(rebuilt.placements).toHaveLength(1);
    expect(rebuilt.placements[0].rhythmInstanceId).toBe('instance-a');
  });

  it('keeps a generated occurrence inside hard and protected constraints', () => {
    const input = model();
    input.candidateIntervals![0] = { ...input.candidateIntervals![0], start: '10:00' };
    input.externalCommitments = [{
      id: 'meeting', title: 'Meeting', source: 'calendar', sourceId: 'meeting', hard: true,
      interval: { kind: 'datedLocal', date: '2026-09-07', start: '09:00', end: '10:00' },
      travelBeforeMinutes: 0, transitionAfterMinutes: 0,
    }];
    const plan = scheduler.buildPlan(input);
    expect(plan.placements[0]).toMatchObject({ start: '10:00', end: '10:15' });
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('uses preferred weekdays as placement guidance rather than quota debt', () => {
    const input = model();
    input.rhythms[0] = { ...input.rhythms[0], preferredDays: ['Tuesday'], preferredTime: 'anytime' };
    input.rhythmPlanningDates = ['2026-09-07', '2026-09-08'];
    input.candidateIntervals = [
      input.candidateIntervals![0],
      { ...input.candidateIntervals![0], id: 'candidate-tuesday', date: '2026-09-08' },
    ];
    const plan = scheduler.buildPlan(input);
    expect(plan.placements[0].date).toBe('2026-09-08');
    expect(plan.unscheduledRhythmIds).toEqual([]);
  });

  it('does not place outside the occurrence eligibility window', () => {
    const input = model();
    input.rhythms[0] = { ...input.rhythms[0], eligibilityStartDate: '2026-09-08' };
    const plan = scheduler.buildPlan(input);
    expect(plan.placements).toEqual([]);
    expect(plan.unscheduledRhythmIds).toEqual(['instance-a']);
  });

  it('does not turn an expired occurrence into overdue unscheduled debt', () => {
    const input = model();
    input.rhythms[0] = {
      ...input.rhythms[0],
      eligibilityStartDate: '2026-08-31',
      eligibilityEndDate: '2026-09-06',
    };
    const plan = scheduler.buildPlan(input);
    expect(plan.placements).toEqual([]);
    expect(plan.unscheduledRhythmIds).toEqual([]);
  });

  it('uses Minimum for one occurrence under exact Reduced Day permission', () => {
    const input = model();
    input.planningPolicy = {
      dayMode: 'reduced', dayModeDate: '2026-09-07',
      reducedDay: { minimumEligibleRhythmIds: ['instance-a'] },
    };
    const plan = scheduler.buildPlan(input);
    expect(plan.placements[0]).toMatchObject({ variantKind: 'minimum', end: '09:05', rhythmInstanceId: 'instance-a' });
    expect(input.rhythms[0].frequency).toBe(1);
    expect(input.rhythms[0].variants[1].minutes).toBe(15);
  });
});
