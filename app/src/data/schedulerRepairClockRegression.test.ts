import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import {
  repairAndPersistSchedulerPlan,
  saveSchedulerPlanState,
} from './schedulerPlanStateRepository';
import type {
  InternalPlacement,
  SchedulingDomainModel,
} from '../domain/schedulingModel';

const date = '2026-09-07';
const timezone = 'Australia/Perth';

function model(): SchedulingDomainModel {
  return {
    intentions: [
      {
        id: 'task-a',
        title: 'Send the form',
        area: 'admin',
        taskType: 'admin',
        priority: 'normal',
        variants: [{ kind: 'normal', label: 'Send the form', minutes: 30 }],
        timing: { timeConstraint: 'flexible' },
        lifecycle: {},
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
        id: 'whole-day-window',
        date,
        start: '09:00',
        end: '17:00',
        timezone,
        capacityMeaning: 'candidate-not-capacity',
        provenance: ['Regression fixture intentionally starts before the repair clock.'],
      },
    ],
    preferences: [],
  };
}

function futurePlacement(): InternalPlacement {
  return {
    id: 'scheduler:intention:task-a:2026-09-07:15:00',
    intentionId: 'task-a',
    targetKind: 'intention',
    date,
    start: '15:00',
    end: '15:30',
    timezone,
    origin: 'scheduler',
    variantKind: 'normal',
    provenance: ['Existing future scheduler placement.'],
  };
}

describe('user-triggered repair clock regression', () => {
  it('cannot rebuild released private work into elapsed time and silently drop it', async () => {
    const database = createLifeRhythmDatabase(`life-rhythm-repair-clock-${Date.now()}`);

    try {
      const placement = futurePlacement();
      const saved = await saveSchedulerPlanState(
        {
          placements: [placement],
          unscheduledIntentionIds: [],
          unscheduledRhythmIds: [],
          rejectedExistingPlacements: [],
        },
        database,
        '2026-09-07T03:00:00.000Z',
      );
      expect(saved.ok).toBe(true);

      const repaired = await repairAndPersistSchedulerPlan(
        {
          reason: 'The user changed a private placement.',
          trigger: 'userCorrection',
          now: { date, time: '12:00', timezone },
          nextInput: model(),
          releasePlacementIds: [placement.id],
        },
        database,
        '2026-09-07T04:00:00.000Z',
      );

      expect(repaired.ok).toBe(true);
      if (!repaired.ok) return;

      const taskPlacement = repaired.plan.placements.find(
        (candidate) => candidate.intentionId === 'task-a',
      );
      expect(taskPlacement).toMatchObject({
        date,
        start: '12:00',
        end: '12:30',
      });
      expect(repaired.plan.unscheduledIntentionIds).not.toContain('task-a');
      expect(repaired.plan.repair?.changes).toEqual([
        expect.objectContaining({
          kind: 'moved',
          targetId: 'task-a',
          from: expect.objectContaining({ start: '15:00' }),
          to: expect.objectContaining({ start: '12:00' }),
        }),
      ]);
    } finally {
      await database.delete();
    }
  });
});
