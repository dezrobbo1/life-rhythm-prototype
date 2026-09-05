import { describe, expect, it } from 'vitest';
import { ClockAwareScheduler } from './clockAwareScheduler';
import { clipCandidateIntervalToNow } from './schedulingClock';
import type {
  InternalPlacement,
  SchedulerPlan,
  SchedulingDomainModel,
} from './schedulingModel';

const date = '2026-09-07';
const timezone = 'Australia/Perth';

function model(): SchedulingDomainModel {
  return {
    intentions: [
      {
        id: 'task-a',
        title: 'Task A',
        area: 'admin',
        priority: 'normal',
        variants: [
          { kind: 'normal', label: 'Do task A', minutes: 30 },
          { kind: 'minimum', label: 'Start task A', minutes: 10 },
        ],
        timing: { timeConstraint: 'flexible' },
        lifecycle: { taskPoolStatus: 'captured' },
        eligibleForScheduling: true,
        sourceRecords: [{ kind: 'taskPoolItem', id: 'task-a' }],
      },
    ],
    rhythms: [],
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
        provenance: ['Morning candidate.'],
      },
      {
        id: 'late-morning',
        date,
        start: '10:00',
        end: '11:00',
        timezone,
        capacityMeaning: 'candidate-not-capacity',
        provenance: ['Partially elapsed candidate.'],
      },
      {
        id: 'future',
        date,
        start: '11:00',
        end: '12:00',
        timezone,
        capacityMeaning: 'candidate-not-capacity',
        provenance: ['Future candidate.'],
      },
    ],
    preferences: [],
  };
}

function oldPlacement(): InternalPlacement {
  return {
    id: 'scheduler:intention:task-a:2026-09-07:09:00',
    intentionId: 'task-a',
    targetKind: 'intention',
    date,
    start: '09:00',
    end: '09:30',
    timezone,
    origin: 'scheduler',
    variantKind: 'normal',
    provenance: ['Earlier plan.'],
  };
}

function currentPlan(): SchedulerPlan {
  return {
    placements: [oldPlacement()],
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
    rejectedExistingPlacements: [],
  };
}

describe('clock-aware scheduler repair', () => {
  it('clips an interval that straddles now instead of leaving elapsed time available', () => {
    expect(clipCandidateIntervalToNow(
      {
        id: 'candidate',
        date,
        start: '10:00',
        end: '11:00',
        timezone,
        capacityMeaning: 'candidate-not-capacity',
        provenance: ['Original candidate.'],
      },
      { date, time: '10:30', timezone },
    )).toEqual(expect.objectContaining({
      start: '10:30',
      end: '11:00',
    }));
  });

  it('never repairs released private work into elapsed time', () => {
    const scheduler = new ClockAwareScheduler();
    const repaired = scheduler.repairPlan(currentPlan(), {
      reason: 'User changed the live plan after the morning slot elapsed.',
      trigger: 'userCorrection',
      now: { date, time: '10:45', timezone },
      releasePlacementIds: [oldPlacement().id],
      nextInput: model(),
    });

    const placement = repaired.placements.find((candidate) => candidate.intentionId === 'task-a');
    expect(placement).toBeDefined();
    expect(placement?.date).toBe(date);
    expect(placement?.start >= '10:45').toBe(true);
    expect(repaired.unscheduledIntentionIds).not.toContain('task-a');
    expect(repaired.repair?.changes).toEqual([
      expect.objectContaining({
        kind: 'moved',
        targetId: 'task-a',
        to: expect.objectContaining({ start: placement?.start }),
      }),
    ]);
  });
});
