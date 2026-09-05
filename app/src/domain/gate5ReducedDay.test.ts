import { describe, expect, it } from 'vitest';
import { Gate5ReducedDayScheduler } from './gate5ReducedDay';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  RhythmRequirement,
  SchedulingDomainModel,
} from './schedulingModel';

function intention(
  id: string,
  overrides: Partial<InternalIntention> = {},
): InternalIntention {
  return {
    id,
    title: id,
    area: 'admin',
    taskType: 'admin',
    priority: 'normal',
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 5 },
      { kind: 'normal', label: 'Normal', minutes: 20 },
      { kind: 'full', label: 'Full', minutes: 40 },
    ],
    timing: { timeConstraint: 'flexible' },
    lifecycle: { activeTaskStatus: 'active' },
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id }],
    ...overrides,
  };
}

function rhythm(id: string, overrides: Partial<RhythmRequirement> = {}): RhythmRequirement {
  return {
    id,
    templateId: id,
    title: id,
    area: 'movement',
    frequency: 2,
    period: 'week',
    preferredDays: ['Monday'],
    preferredTime: 'morning',
    maxPerDay: 2,
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 5 },
      { kind: 'normal', label: 'Normal', minutes: 20 },
      { kind: 'full', label: 'Full', minutes: 40 },
    ],
    sourceRecords: [{ kind: 'rhythmTemplate', id }],
    ...overrides,
  };
}

function candidate(
  id: string,
  start = '09:00',
  end = '12:00',
  date = '2026-09-07',
): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone: 'Australia/Perth',
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Gate 5 test candidate.'],
  };
}

function model(overrides: Partial<SchedulingDomainModel> = {}): SchedulingDomainModel {
  return {
    intentions: [intention('task-a')],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: [candidate('morning')],
    preferences: [],
    planningPolicy: { dayMode: 'normal' },
    ...overrides,
  };
}

function placementFor(
  plan: ReturnType<Gate5ReducedDayScheduler['buildPlan']>,
  targetId: string,
) {
  return plan.placements.find((placement) =>
    (placement.targetKind ?? 'intention') === 'rhythm'
      ? (placement.rhythmId ?? placement.intentionId) === targetId
      : placement.intentionId === targetId,
  );
}

describe('Gate 5 Reduced Day scheduling policy', () => {
  it('keeps normal mode on the normal task form', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model();

    const plan = scheduler.buildPlan(input);

    expect(placementFor(plan, 'task-a')).toMatchObject({
      start: '09:00',
      end: '09:20',
      variantKind: 'normal',
    });
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('uses the explicit minimum form for flexible private work on Reduced Day', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model({
      planningPolicy: { dayMode: 'reduced' },
    });

    const plan = scheduler.buildPlan(input);
    const placement = placementFor(plan, 'task-a');

    expect(placement).toMatchObject({
      start: '09:00',
      end: '09:05',
      variantKind: 'minimum',
      origin: 'scheduler',
    });
    expect(placement?.provenance).toContain(
      'Reduced Day used the explicit minimum form for flexible private work.',
    );
    expect(placement?.provenance).not.toContain(
      'Minimum Done was used only after no valid normal-sized placement fit.',
    );
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('does not silently right-size must-do or in-progress work', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model({
      intentions: [
        intention('must-task', { priority: 'must' }),
        intention('running-task', {
          lifecycle: { activeTaskStatus: 'inProgress' },
        }),
      ],
      planningPolicy: { dayMode: 'reduced' },
    });

    const plan = scheduler.buildPlan(input);

    expect(placementFor(plan, 'must-task')).toMatchObject({
      end: '09:20',
      variantKind: 'normal',
    });
    expect(placementFor(plan, 'running-task')).toMatchObject({
      end: '09:40',
      variantKind: 'normal',
    });
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('can use a stricter Reduced Day placement cap without inventing a global default', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model({
      intentions: [intention('task-a'), intention('task-b')],
      planningPolicy: {
        dayMode: 'reduced',
        reducedDay: {
          maxAutomaticPlacementsPerDay: 1,
        },
      },
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements).toHaveLength(1);
    expect(plan.placements[0]).toMatchObject({ variantKind: 'minimum' });
    expect(plan.unscheduledIntentionIds).toHaveLength(1);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('keeps rhythm frequency semantics while using the rhythm minimum form', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model({
      intentions: [],
      rhythms: [rhythm('exercise')],
      planningPolicy: { dayMode: 'reduced' },
    });

    const plan = scheduler.buildPlan(input);
    const rhythmPlacements = plan.placements.filter(
      (placement) => placement.targetKind === 'rhythm' && placement.rhythmId === 'exercise',
    );

    expect(rhythmPlacements).toHaveLength(2);
    expect(rhythmPlacements).toEqual([
      expect.objectContaining({ start: '09:00', end: '09:05', variantKind: 'minimum' }),
      expect.objectContaining({ start: '09:05', end: '09:10', variantKind: 'minimum' }),
    ]);
    expect(plan.unscheduledRhythmIds).toEqual([]);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('right-sizes preserved future work during rolling repair and keeps one-step undo', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const normalInput = model({
      intentions: [intention('task-a'), intention('task-b')],
      planningPolicy: { dayMode: 'normal' },
    });
    const before = scheduler.buildPlan(normalInput);

    const reducedInput = model({
      intentions: [intention('task-a'), intention('task-b')],
      planningPolicy: { dayMode: 'reduced' },
    });
    const repaired = scheduler.repairPlan(before, {
      reason: 'Reduced Day requested',
      trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      nextInput: reducedInput,
    });

    expect(placementFor(repaired, 'task-a')).toMatchObject({
      start: '09:00',
      end: '09:05',
      variantKind: 'minimum',
    });
    expect(placementFor(repaired, 'task-b')).toMatchObject({
      start: '09:20',
      end: '09:25',
      variantKind: 'minimum',
    });
    expect(repaired.repair?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'variantChanged', targetId: 'task-a' }),
        expect.objectContaining({ kind: 'variantChanged', targetId: 'task-b' }),
      ]),
    );
    expect(repaired.repair?.preservedPlacementIds).toEqual([]);
    expect(scheduler.undoRepair(repaired)).toEqual({
      placements: before.placements,
      unscheduledIntentionIds: before.unscheduledIntentionIds,
      unscheduledRhythmIds: before.unscheduledRhythmIds,
      rejectedExistingPlacements: before.rejectedExistingPlacements,
    });
    expect(scheduler.validatePlan(repaired, reducedInput)).toEqual([]);
  });

  it('does not emit repeated Reduced Day variant churn on the next unchanged repair', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const normalInput = model({ planningPolicy: { dayMode: 'normal' } });
    const before = scheduler.buildPlan(normalInput);
    const reducedInput = model({ planningPolicy: { dayMode: 'reduced' } });
    const first = scheduler.repairPlan(before, {
      reason: 'Reduced Day requested',
      trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      nextInput: reducedInput,
    });

    const second = scheduler.repairPlan(first, {
      reason: 'No new disruption',
      trigger: 'manualReplan',
      now: { date: '2026-09-07', time: '08:01', timezone: 'Australia/Perth' },
      nextInput: reducedInput,
    });

    expect(placementFor(second, 'task-a')).toMatchObject({
      start: '09:00',
      end: '09:05',
      variantKind: 'minimum',
    });
    expect(second.repair?.changes).toEqual([]);
    expect(scheduler.validatePlan(second, reducedInput)).toEqual([]);
  });
});
