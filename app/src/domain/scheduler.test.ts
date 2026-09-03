import { describe, expect, it } from 'vitest';
import { DeterministicScheduler } from './scheduler';
import type {
  InternalIntention,
  InternalPlacement,
  SchedulingDomainModel,
} from './schedulingModel';

function intention(id: string): InternalIntention {
  return {
    id,
    title: id,
    area: 'admin',
    variants: [
      { kind: 'minimum', label: 'Open it', minutes: 5 },
      { kind: 'normal', label: 'Do it', minutes: 20 },
      { kind: 'full', label: 'Finish it', minutes: 40 },
    ],
    timing: {},
    lifecycle: {},
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id }],
  };
}

function placement(
  id: string,
  intentionId: string,
  start: string,
  end: string,
  date = '2026-09-07',
): InternalPlacement {
  return {
    id,
    intentionId,
    date,
    start,
    end,
    origin: 'existingUserConfirmed',
    provenance: [`Existing placement ${id}`],
  };
}

function model(overrides: Partial<SchedulingDomainModel> = {}): SchedulingDomainModel {
  return {
    intentions: [intention('task-one'), intention('task-two')],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    ...overrides,
  };
}

describe('deterministic scheduler seam', () => {
  it('preserves a valid existing placement and reports remaining eligible intentions as unscheduled', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      placements: [placement('placement-one', 'task-one', '10:00', '10:20')],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements.map((candidate) => candidate.id)).toEqual(['placement-one']);
    expect(plan.unscheduledIntentionIds).toEqual(['task-two']);
    expect(plan.rejectedExistingPlacements).toEqual([]);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('rejects a placement that overlaps a protected recurring window', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      capacityWindows: [
        {
          id: 'window-family',
          title: 'Family time',
          category: 'familyTime',
          interval: {
            kind: 'recurringLocal',
            days: ['Monday'],
            start: '18:00',
            end: '20:00',
          },
          schedulerUse: 'unavailable',
          sourceId: 'family-evening',
        },
      ],
      placements: [placement('placement-one', 'task-one', '18:30', '18:50')],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements).toEqual([]);
    expect(plan.unscheduledIntentionIds).toEqual(['task-one', 'task-two']);
    expect(plan.rejectedExistingPlacements[0].violations).toEqual([
      expect.objectContaining({
        code: 'protected-window-overlap',
        conflictingId: 'window-family',
      }),
    ]);
  });

  it('includes travel and transition edges when protecting a hard external commitment', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      externalCommitments: [
        {
          id: 'commitment-school',
          title: 'School run',
          source: 'settingsFixedCommitment',
          sourceId: 'school-run',
          interval: {
            kind: 'recurringLocal',
            days: ['Monday'],
            start: '08:00',
            end: '08:30',
          },
          hard: true,
          travelBeforeMinutes: 10,
          transitionAfterMinutes: 5,
        },
      ],
      placements: [placement('placement-one', 'task-one', '07:55', '08:05')],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements).toEqual([]);
    expect(plan.rejectedExistingPlacements[0].violations).toEqual([
      expect.objectContaining({
        code: 'external-commitment-overlap',
        conflictingId: 'commitment-school',
      }),
    ]);
  });

  it('rejects overlapping private placements deterministically', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      placements: [
        placement('placement-b', 'task-two', '10:10', '10:30'),
        placement('placement-a', 'task-one', '10:00', '10:20'),
      ],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements.map((candidate) => candidate.id)).toEqual(['placement-a']);
    expect(plan.rejectedExistingPlacements).toHaveLength(1);
    expect(plan.rejectedExistingPlacements[0]).toMatchObject({
      placement: { id: 'placement-b' },
      violations: [
        {
          code: 'placement-overlap',
          placementId: 'placement-b',
          conflictingId: 'placement-a',
        },
      ],
    });
  });

  it('rejects a placement that references an unknown intention', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      placements: [placement('placement-orphan', 'missing-task', '10:00', '10:20')],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements).toEqual([]);
    expect(plan.rejectedExistingPlacements[0].violations[0]).toMatchObject({
      code: 'unknown-intention',
      placementId: 'placement-orphan',
    });
  });

  it('returns placement provenance through the explanation seam', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      placements: [placement('placement-one', 'task-one', '10:00', '10:20')],
    });
    const plan = scheduler.buildPlan(input);

    expect(scheduler.explainPlacement('placement-one', plan)).toEqual({
      placementId: 'placement-one',
      intentionId: 'task-one',
      provenance: ['Existing placement placement-one'],
    });
    expect(scheduler.explainPlacement('missing', plan)).toBeNull();
  });

  it('repairs through the same deterministic seam until Gate 4 adds partial repair', () => {
    const scheduler = new DeterministicScheduler();
    const currentInput = model({
      placements: [placement('placement-one', 'task-one', '10:00', '10:20')],
    });
    const currentPlan = scheduler.buildPlan(currentInput);
    const nextInput = model({ placements: [] });

    const repaired = scheduler.repairPlan(currentPlan, {
      reason: 'Existing placement removed',
      nextInput,
    });

    expect(repaired.placements).toEqual([]);
    expect(repaired.unscheduledIntentionIds).toEqual(['task-one', 'task-two']);
  });
});
