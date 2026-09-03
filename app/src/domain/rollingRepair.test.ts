import { describe, expect, it } from 'vitest';
import { changedView, RollingRepairScheduler } from './rollingRepair';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  SchedulerPlan,
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
    lifecycle: {},
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id }],
    ...overrides,
  };
}

function candidate(
  id: string,
  start: string,
  end: string,
  date = '2026-09-07',
): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone: 'Australia/Perth',
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Gate 2 candidate interval.'],
  };
}

function model(overrides: Partial<SchedulingDomainModel> = {}): SchedulingDomainModel {
  return {
    intentions: [intention('task-a'), intention('task-b')],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: [candidate('morning', '09:00', '12:00')],
    preferences: [],
    ...overrides,
  };
}

function currentPlan(scheduler: RollingRepairScheduler, input = model()): SchedulerPlan {
  return scheduler.buildPlan(input);
}

function placementFor(plan: SchedulerPlan, intentionId: string) {
  return plan.placements.find((placement) => placement.intentionId === intentionId);
}

describe('Gate 4 rolling repair and schedule inertia', () => {
  it('repairs only the placement invalidated by a calendar change while preserving unaffected future work', () => {
    const scheduler = new RollingRepairScheduler();
    const before = currentPlan(scheduler);
    const taskA = placementFor(before, 'task-a');
    const taskB = placementFor(before, 'task-b');

    expect(taskA).toMatchObject({ start: '09:00', end: '09:20' });
    expect(taskB).toMatchObject({ start: '09:20', end: '09:40' });

    const nextInput = model({
      candidateIntervals: [
        candidate('before-meeting', '09:00', '09:20'),
        candidate('after-meeting', '10:00', '12:00'),
      ],
      externalCommitments: [
        {
          id: 'calendar:meeting',
          title: 'Meeting',
          source: 'calendar',
          sourceId: 'meeting',
          interval: {
            kind: 'datedLocal',
            date: '2026-09-07',
            start: '09:20',
            end: '10:00',
            timezone: 'Australia/Perth',
          },
          hard: true,
          travelBeforeMinutes: 0,
          transitionAfterMinutes: 0,
        },
      ],
    });

    const repaired = scheduler.repairPlan(before, {
      reason: 'Calendar changed',
      trigger: 'calendarChanged',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      nextInput,
    });

    expect(placementFor(repaired, 'task-a')).toMatchObject({
      id: taskA?.id,
      start: '09:00',
      end: '09:20',
    });
    expect(placementFor(repaired, 'task-b')).toMatchObject({ start: '10:00', end: '10:20' });
    expect(repaired.repair?.preservedPlacementIds).toEqual([taskA?.id]);
    expect(changedView(repaired)).toEqual([
      expect.objectContaining({
        kind: 'moved',
        targetKind: 'intention',
        targetId: 'task-b',
        from: expect.objectContaining({ start: '09:20', end: '09:40' }),
        to: expect.objectContaining({ start: '10:00', end: '10:20' }),
      }),
    ]);
    expect(scheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it('freezes past placements and does not duplicate their intentions into the remaining day', () => {
    const scheduler = new RollingRepairScheduler();
    const before = currentPlan(scheduler, model({
      intentions: [intention('task-a'), intention('task-b'), intention('task-c')],
    }));
    const taskA = placementFor(before, 'task-a');

    expect(taskA).toMatchObject({ start: '09:00', end: '09:20' });

    const nextInput = model({
      intentions: [intention('task-a'), intention('task-b'), intention('task-c')],
      candidateIntervals: [candidate('remaining-day', '09:10', '12:00')],
    });

    const repaired = scheduler.repairPlan(before, {
      reason: 'Time advanced',
      trigger: 'manualReplan',
      now: { date: '2026-09-07', time: '09:10', timezone: 'Australia/Perth' },
      nextInput,
    });

    expect(repaired.repair?.frozenPastPlacementIds).toEqual([taskA?.id]);
    expect(placementFor(repaired, 'task-a')).toEqual(taskA);
    expect(repaired.placements.filter((placement) => placement.intentionId === 'task-a')).toHaveLength(1);
    expect(changedView(repaired)).toEqual([]);
    expect(scheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it('can release a missed-start placement so it moves instead of being frozen in the past', () => {
    const scheduler = new RollingRepairScheduler();
    const before = currentPlan(scheduler, model({ intentions: [intention('task-a')] }));
    const taskA = placementFor(before, 'task-a');

    const nextInput = model({
      intentions: [intention('task-a')],
      candidateIntervals: [candidate('later', '10:00', '12:00')],
    });

    const repaired = scheduler.repairPlan(before, {
      reason: 'Missed start',
      trigger: 'missedStart',
      now: { date: '2026-09-07', time: '09:10', timezone: 'Australia/Perth' },
      releasePlacementIds: taskA ? [taskA.id] : [],
      nextInput,
    });

    expect(repaired.repair?.frozenPastPlacementIds).toEqual([]);
    expect(placementFor(repaired, 'task-a')).toMatchObject({ start: '10:00', end: '10:20' });
    expect(changedView(repaired)).toEqual([
      expect.objectContaining({ kind: 'moved', targetId: 'task-a' }),
    ]);
  });

  it('removes completed work while preserving unrelated future placements', () => {
    const scheduler = new RollingRepairScheduler();
    const before = currentPlan(scheduler);
    const taskB = placementFor(before, 'task-b');

    const nextInput = model({
      intentions: [
        intention('task-a', { eligibleForScheduling: false }),
        intention('task-b'),
      ],
    });

    const repaired = scheduler.repairPlan(before, {
      reason: 'Task completed',
      trigger: 'completionChanged',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      nextInput,
    });

    expect(placementFor(repaired, 'task-a')).toBeUndefined();
    expect(placementFor(repaired, 'task-b')).toEqual(taskB);
    expect(repaired.repair?.preservedPlacementIds).toEqual([taskB?.id]);
    expect(changedView(repaired)).toEqual([
      expect.objectContaining({ kind: 'removed', targetId: 'task-a' }),
    ]);
  });

  it('uses an explicit correction to release one placement and preserve the rest', () => {
    const scheduler = new RollingRepairScheduler();
    const before = currentPlan(scheduler);
    const taskA = placementFor(before, 'task-a');
    const taskB = placementFor(before, 'task-b');

    const nextInput = model({
      candidateIntervals: [
        candidate('morning', '09:00', '10:00'),
        candidate('afternoon', '15:00', '16:00'),
      ],
      preferences: [
        {
          id: 'task-b-afternoon',
          targetKind: 'intention',
          targetValue: 'task-b',
          relation: 'prefer',
          start: '15:00',
          end: '16:00',
          provenance: 'User explicitly moved this type of work later.',
        },
      ],
    });

    const repaired = scheduler.repairPlan(before, {
      reason: 'User correction',
      trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      releasePlacementIds: taskB ? [taskB.id] : [],
      nextInput,
    });

    expect(placementFor(repaired, 'task-a')).toEqual(taskA);
    expect(placementFor(repaired, 'task-b')).toMatchObject({ start: '15:00', end: '15:20' });
    expect(repaired.repair?.preservedPlacementIds).toEqual([taskA?.id]);
    expect(changedView(repaired)).toEqual([
      expect.objectContaining({ kind: 'moved', targetId: 'task-b' }),
    ]);
  });

  it('keeps a one-step undo snapshot that restores the previous plan exactly', () => {
    const scheduler = new RollingRepairScheduler();
    const before = currentPlan(scheduler);
    const taskB = placementFor(before, 'task-b');
    const nextInput = model({
      candidateIntervals: [
        candidate('morning', '09:00', '09:20'),
        candidate('later', '11:00', '12:00'),
      ],
    });

    const repaired = scheduler.repairPlan(before, {
      reason: 'Move one item',
      trigger: 'manualReplan',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      releasePlacementIds: taskB ? [taskB.id] : [],
      nextInput,
    });
    const undone = scheduler.undoRepair(repaired);

    expect(undone).toEqual({
      placements: before.placements,
      unscheduledIntentionIds: before.unscheduledIntentionIds,
      unscheduledRhythmIds: before.unscheduledRhythmIds,
      rejectedExistingPlacements: before.rejectedExistingPlacements,
    });
  });

  it('rejects malformed repair clock context instead of guessing', () => {
    const scheduler = new RollingRepairScheduler();
    const before = currentPlan(scheduler);

    expect(() => scheduler.repairPlan(before, {
      reason: 'Bad clock',
      trigger: 'manualReplan',
      now: { date: '2026-09-07', time: '9:00', timezone: 'Australia/Perth' },
      nextInput: model(),
    })).toThrow('Gate 4 repair now must use YYYY-MM-DD, HH:MM and a non-empty timezone.');
  });
});
