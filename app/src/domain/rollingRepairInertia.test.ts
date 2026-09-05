import { describe, expect, it } from 'vitest';
import { primarySchedulerStatus, scheduler as primaryScheduler } from './primaryScheduler';
import { RollingRepairScheduler } from './rollingRepair';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  InternalPlacement,
  SchedulerPlan,
  SchedulingDomainModel,
} from './schedulingModel';

const timezone = 'Australia/Perth';
const today = '2026-09-07';
const tomorrow = '2026-09-08';
const later = '2026-09-10';

function intention(id: string, priority: 'must' | 'normal' = 'normal'): InternalIntention {
  return {
    id,
    title: id,
    area: 'admin',
    taskType: 'admin',
    priority,
    variants: [{ kind: 'normal', label: 'Normal', minutes: 20 }],
    timing: { timeConstraint: 'flexible' },
    lifecycle: {},
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id }],
  };
}

function candidate(id: string, date: string, start = '09:00', end = '09:20'): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone,
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Test candidate.'],
  };
}

function placement(id: string, intentionId: string, date: string, start = '09:00', end = '09:20'): InternalPlacement {
  return {
    id,
    intentionId,
    date,
    start,
    end,
    timezone,
    origin: 'scheduler',
    targetKind: 'intention',
    variantKind: 'normal',
    provenance: ['Existing scheduler placement.'],
  };
}

function plan(placements: InternalPlacement[]): SchedulerPlan {
  return {
    placements,
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
    rejectedExistingPlacements: [],
  };
}

function model(
  intentions: InternalIntention[],
  candidates: CandidateSchedulingInterval[],
  placements: InternalPlacement[] = [],
): SchedulingDomainModel {
  return {
    intentions,
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements,
    dayProfiles: [],
    candidateIntervals: candidates,
    preferences: [],
  };
}

describe('Gate 4 graded schedule inertia', () => {
  it('moves lower-cost tomorrow work so disrupted same-day must-work can recover', () => {
    const scheduler = new RollingRepairScheduler();
    const before = plan([
      placement('p-urgent', 'urgent', today),
      placement('p-flex', 'flex', tomorrow),
    ]);
    const nextInput = model(
      [intention('urgent', 'must'), intention('flex')],
      [candidate('tomorrow-slot', tomorrow)],
    );

    const repaired = scheduler.repairPlan(before, {
      reason: 'Calendar removed the original slot',
      trigger: 'calendarChanged',
      now: { date: today, time: '08:00', timezone },
      nextInput,
    });

    expect(repaired.placements.find((item) => item.intentionId === 'urgent')).toMatchObject({
      date: tomorrow,
      start: '09:00',
      end: '09:20',
    });
    expect(repaired.placements.some((item) => item.intentionId === 'flex')).toBe(false);
    expect(repaired.unscheduledIntentionIds).toContain('flex');
    expect(repaired.unscheduledIntentionIds).not.toContain('urgent');
  });

  it('does not auto-release a pinned placement to recover another task', () => {
    const scheduler = new RollingRepairScheduler();
    const before = plan([
      placement('p-urgent', 'urgent', today),
      placement('p-flex', 'flex', tomorrow),
    ]);
    const nextInput = model(
      [intention('urgent', 'must'), intention('flex')],
      [candidate('tomorrow-slot', tomorrow)],
    );

    const repaired = scheduler.repairPlan(before, {
      reason: 'Calendar removed the original slot',
      trigger: 'calendarChanged',
      now: { date: today, time: '08:00', timezone },
      pinnedPlacementIds: ['p-flex'],
      nextInput,
    });

    expect(repaired.placements.find((item) => item.id === 'p-flex')).toMatchObject({
      intentionId: 'flex',
      date: tomorrow,
    });
    expect(repaired.unscheduledIntentionIds).toContain('urgent');
  });

  it('preserves surfaced work before releasing a more distant unsurfaced placement', () => {
    const scheduler = new RollingRepairScheduler();
    const before = plan([
      placement('p-urgent', 'urgent', today),
      placement('p-surfaced', 'surfaced', tomorrow),
      placement('p-distant', 'distant', later),
    ]);
    const nextInput = model(
      [intention('urgent', 'must'), intention('surfaced'), intention('distant')],
      [candidate('tomorrow-slot', tomorrow), candidate('later-slot', later)],
    );

    const repaired = scheduler.repairPlan(before, {
      reason: 'Calendar removed the original slot',
      trigger: 'calendarChanged',
      now: { date: today, time: '08:00', timezone },
      surfacedPlacementIds: ['p-surfaced'],
      nextInput,
    });

    expect(repaired.placements.find((item) => item.id === 'p-surfaced')).toMatchObject({
      intentionId: 'surfaced',
      date: tomorrow,
    });
    expect(repaired.placements.find((item) => item.intentionId === 'urgent')).toMatchObject({
      date: later,
      start: '09:00',
    });
    expect(repaired.placements.some((item) => item.intentionId === 'distant')).toBe(false);
  });

  it('removes explicitly released placements even when nextInput still contains the old seed', () => {
    const scheduler = new RollingRepairScheduler();
    const oldPlacement = placement('p-task', 'task', today);
    const before = plan([oldPlacement]);
    const nextInput = model(
      [intention('task')],
      [candidate('later-today', today, '10:00', '10:20')],
      [oldPlacement],
    );

    const repaired = scheduler.repairPlan(before, {
      reason: 'User moved the task',
      trigger: 'userCorrection',
      now: { date: today, time: '08:00', timezone },
      releasePlacementIds: ['p-task'],
      nextInput,
    });

    expect(repaired.placements).toHaveLength(1);
    expect(repaired.placements[0]).toMatchObject({
      intentionId: 'task',
      date: today,
      start: '10:00',
      end: '10:20',
    });
    expect(repaired.placements[0].id).not.toBe('p-task');
  });
});

describe('primary scheduler entry point', () => {
  it('uses the Gate 4 rolling-repair path rather than the Gate 3 rebuild-only singleton', () => {
    expect(primarySchedulerStatus).toBe('gate4-primary-rolling-repair');

    const input = model([intention('task')], [candidate('slot', today)]);
    const before = primaryScheduler.buildPlan(input);
    const repaired = primaryScheduler.repairPlan(before, {
      reason: 'Manual repair',
      trigger: 'manualReplan',
      now: { date: today, time: '08:00', timezone },
      nextInput: input,
    });

    expect(repaired.repair).toMatchObject({
      trigger: 'manualReplan',
      reason: 'Manual repair',
    });
  });
});
