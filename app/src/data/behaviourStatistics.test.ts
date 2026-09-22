import { describe, expect, it, vi } from 'vitest';
import {
  deriveBehaviourStatistics,
  deriveBehaviourStatisticsResult,
  loadBehaviourStatisticsResult,
} from './behaviourStatistics';
import { createBehaviourEvent, type BehaviourEventStore } from './behaviourEventRepository';
import type { BehaviourEvent } from './schemas';

function taskEvent(
  id: string,
  eventType: 'taskStarted' | 'taskMinimumAchieved' | 'taskCompleted' | 'taskParked' | 'taskNotToday',
  occurredAt: string,
  options: { actualMinutes?: number; taskId?: string; templateId?: string; timezone?: string } = {},
) {
  const transitions = {
    taskStarted: ['start', 'active', 'inProgress', false, false],
    taskMinimumAchieved: ['minimumDone', 'inProgress', 'minimumDone', false, true],
    taskCompleted: ['complete', 'inProgress', 'done', false, false],
    taskParked: ['park', 'active', 'parked', false, false],
    taskNotToday: ['notToday', 'active', 'notToday', false, false],
  } as const;
  const [action, beforeStatus, afterStatus, beforeMinimum, afterMinimum] = transitions[eventType];

  return createBehaviourEvent({
    action,
    after: { minimumAchieved: afterMinimum, taskStatus: afterStatus },
    before: { minimumAchieved: beforeMinimum, taskStatus: beforeStatus },
    eventType,
    id,
    occurredAt,
    provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
    source: 'user',
    taskId: options.taskId ?? `task-${id}`,
    ...(options.actualMinutes === undefined ? {} : { actualMinutes: options.actualMinutes }),
    ...(options.templateId ? { templateId: options.templateId } : {}),
    ...(options.timezone ? { timezone: options.timezone } : {}),
  });
}

function deferredEvent() {
  return createBehaviourEvent({
    action: 'defer',
    after: { bringBackAfter: '2026-09-24T09:00:00.000Z', poolStatus: 'deferred' },
    before: { poolStatus: 'captured' },
    eventType: 'taskDeferred',
    id: 'deferred',
    occurredAt: '2026-09-22T09:00:00.000Z',
    provenance: { origin: 'userAction', mechanism: 'taskPoolDeferral' },
    source: 'user',
    taskId: 'task-deferred',
  });
}

const userPlacement = {
  date: '2026-09-22',
  end: '10:30',
  placementStatus: 'planned' as const,
  start: '10:00',
};

function userPlacementEvent(
  eventType: 'userPlacementCreated' | 'userPlacementMoved' | 'userPlacementRemoved',
) {
  const event = {
    userPlacementCreated: {
      action: 'createPlacement' as const,
      after: userPlacement,
    },
    userPlacementMoved: {
      action: 'movePlacement' as const,
      before: userPlacement,
      after: { ...userPlacement, end: '11:30', placementStatus: 'moved' as const, start: '11:00' },
    },
    userPlacementRemoved: {
      action: 'removePlacement' as const,
      before: userPlacement,
      after: { ...userPlacement, placementStatus: 'removed' as const },
    },
  }[eventType];

  return createBehaviourEvent({
    ...event,
    eventType,
    id: eventType,
    occurredAt: '2026-09-22T09:00:00.000Z',
    placementId: 'placement-user',
    provenance: { origin: 'userAction', mechanism: 'softPlacement' },
    source: 'user',
    taskId: 'task-placement',
  });
}

const automaticPlacement = {
  date: '2026-09-22',
  end: '10:30',
  placementStatus: 'automatic' as const,
  start: '10:00',
  variantKind: 'normal' as const,
};

function schedulerPlacementEvent(
  eventType:
    | 'schedulerPlacementAdded'
    | 'schedulerPlacementMoved'
    | 'schedulerPlacementRemoved'
    | 'schedulerPlacementVariantChanged',
) {
  const event = {
    schedulerPlacementAdded: {
      action: 'addAutomaticPlacement' as const,
      after: automaticPlacement,
    },
    schedulerPlacementMoved: {
      action: 'moveAutomaticPlacement' as const,
      before: automaticPlacement,
      after: { ...automaticPlacement, end: '11:30', start: '11:00' },
    },
    schedulerPlacementRemoved: {
      action: 'removeAutomaticPlacement' as const,
      before: automaticPlacement,
    },
    schedulerPlacementVariantChanged: {
      action: 'changeAutomaticPlacementVariant' as const,
      before: automaticPlacement,
      after: { ...automaticPlacement, variantKind: 'minimum' as const },
    },
  }[eventType];

  return createBehaviourEvent({
    ...event,
    eventType,
    id: eventType,
    occurredAt: '2026-09-22T09:00:00.000Z',
    provenance: { origin: 'automaticRepair', mechanism: 'schedulerRepair' },
    source: 'scheduler',
    taskId: 'task-automatic',
  });
}

function undoEvent() {
  return createBehaviourEvent({
    action: 'undoRepair',
    eventType: 'schedulerRepairUndone',
    id: 'scheduler-undo',
    occurredAt: '2026-09-22T09:00:00.000Z',
    provenance: { origin: 'undo', mechanism: 'schedulerRepairUndo' },
    source: 'user',
  });
}

describe('Gate 7B descriptive behaviour statistics', () => {
  it('summarises observed completion durations and reports missing samples', () => {
    const events = [
      taskEvent('complete-a-1', 'taskCompleted', '2026-09-22T09:00:00.000Z', {
        actualMinutes: 5,
        taskId: 'task-a',
        templateId: 'template-a',
      }),
      taskEvent('complete-a-2', 'taskCompleted', '2026-09-23T09:00:00.000Z', {
        actualMinutes: 20,
        taskId: 'task-a',
        templateId: 'template-a',
      }),
      taskEvent('complete-b', 'taskCompleted', '2026-09-24T09:00:00.000Z', {
        actualMinutes: 10,
        taskId: 'task-b',
        templateId: 'template-b',
      }),
      taskEvent('complete-missing', 'taskCompleted', '2026-09-25T09:00:00.000Z'),
    ];

    expect(deriveBehaviourStatistics(events).duration).toEqual({
      byTaskId: [
        {
          id: 'task-a',
          maximumObservedMinutes: 20,
          medianActualMinutes: 12.5,
          minimumObservedMinutes: 5,
          sampleCount: 2,
        },
        {
          id: 'task-b',
          maximumObservedMinutes: 10,
          medianActualMinutes: 10,
          minimumObservedMinutes: 10,
          sampleCount: 1,
        },
      ],
      byTemplateId: [
        {
          id: 'template-a',
          maximumObservedMinutes: 20,
          medianActualMinutes: 12.5,
          minimumObservedMinutes: 5,
          sampleCount: 2,
        },
        {
          id: 'template-b',
          maximumObservedMinutes: 10,
          medianActualMinutes: 10,
          minimumObservedMinutes: 10,
          sampleCount: 1,
        },
      ],
      completionEventCount: 4,
      completionEventsWithoutActualMinutes: 1,
      overall: {
        maximumObservedMinutes: 20,
        medianActualMinutes: 10,
        minimumObservedMinutes: 5,
        sampleCount: 3,
      },
    });
  });

  it('counts exact factual event types without relabelling scheduler movement as rejection', () => {
    const events = [
      taskEvent('started', 'taskStarted', '2026-09-22T09:00:00.000Z'),
      taskEvent('minimum', 'taskMinimumAchieved', '2026-09-22T09:01:00.000Z'),
      taskEvent('completed', 'taskCompleted', '2026-09-22T09:02:00.000Z'),
      taskEvent('parked', 'taskParked', '2026-09-22T09:03:00.000Z'),
      taskEvent('not-today', 'taskNotToday', '2026-09-22T09:04:00.000Z'),
      deferredEvent(),
      userPlacementEvent('userPlacementCreated'),
      userPlacementEvent('userPlacementMoved'),
      userPlacementEvent('userPlacementRemoved'),
      schedulerPlacementEvent('schedulerPlacementAdded'),
      schedulerPlacementEvent('schedulerPlacementMoved'),
      schedulerPlacementEvent('schedulerPlacementRemoved'),
      schedulerPlacementEvent('schedulerPlacementVariantChanged'),
      undoEvent(),
    ];

    const statistics = deriveBehaviourStatistics(events);

    expect(statistics.eventCounts).toEqual({
      schedulerPlacementAdded: 1,
      schedulerPlacementMoved: 1,
      schedulerPlacementRemoved: 1,
      schedulerPlacementVariantChanged: 1,
      schedulerRepairUndone: 1,
      taskCompleted: 1,
      taskDeferred: 1,
      taskMinimumAchieved: 1,
      taskNotToday: 1,
      taskParked: 1,
      taskStarted: 1,
      userPlacementCreated: 1,
      userPlacementMoved: 1,
      userPlacementRemoved: 1,
    });
    expect(statistics.provenance).toEqual({
      byOrigin: { automaticRepair: 4, initialPlanBuild: 0, undo: 1, userAction: 9 },
      bySource: { scheduler: 4, user: 10 },
    });
    expect(statistics.eventCounts).not.toHaveProperty('userPlacementRejected');
  });

  it('derives local-time buckets from occurredAt in each event timezone', () => {
    const statistics = deriveBehaviourStatistics([
      taskEvent('brisbane-start', 'taskStarted', '2026-09-22T08:30:00+10:00', {
        timezone: 'Australia/Brisbane',
      }),
      taskEvent('new-york-start', 'taskStarted', '2026-09-22T12:30:00Z', {
        timezone: 'America/New_York',
      }),
      taskEvent('perth-complete', 'taskCompleted', '2026-09-22T13:30:00+08:00', {
        timezone: 'Australia/Perth',
      }),
      taskEvent('london-complete', 'taskCompleted', '2026-09-22T19:30:00+01:00', {
        timezone: 'Europe/London',
      }),
      taskEvent('tokyo-complete', 'taskCompleted', '2026-09-22T23:30:00+09:00', {
        timezone: 'Asia/Tokyo',
      }),
    ]);

    expect(statistics.timeOfDay.taskStarted).toEqual({
      afternoon: 0,
      evening: 0,
      midday: 0,
      morning: 2,
      night: 0,
      sampleCount: 2,
    });
    expect(statistics.timeOfDay.taskCompleted).toEqual({
      afternoon: 0,
      evening: 1,
      midday: 1,
      morning: 0,
      night: 1,
      sampleCount: 3,
    });
  });

  it('derives only from trusted events and preserves partial read health', async () => {
    const validEvent = taskEvent('partial-complete', 'taskCompleted', '2026-09-22T09:00:00.000Z', {
      actualMinutes: 15,
    });
    const store = {
      taskHistory: {
        toArray: vi.fn().mockResolvedValue([
          validEvent,
          {
            eventType: 'taskCompleted',
            id: 'invalid-behaviour-row',
            recordKind: 'behaviourEvent',
          },
        ]),
      },
    } as unknown as BehaviourEventStore;

    await expect(loadBehaviourStatisticsResult(store)).resolves.toMatchObject({
      invalidRecordCount: 1,
      statistics: {
        duration: {
          completionEventCount: 1,
          completionEventsWithoutActualMinutes: 0,
          overall: { medianActualMinutes: 15, sampleCount: 1 },
        },
      },
      status: 'partial',
      validEventCount: 1,
    });
  });

  it('returns read failure instead of manufacturing empty statistics', async () => {
    const store = {
      taskHistory: {
        toArray: vi.fn().mockRejectedValue(new Error('unavailable')),
      },
    } as unknown as BehaviourEventStore;

    await expect(loadBehaviourStatisticsResult(store)).resolves.toEqual({
      errors: ['taskHistory: Saved behaviour facts could not be read.'],
      status: 'readFailed',
    });
  });

  it('returns explicit zero-sample statistics for empty valid history', () => {
    const result = deriveBehaviourStatisticsResult({ invalidRecordCount: 0, items: [], status: 'ok' });

    expect(result).toMatchObject({
      invalidRecordCount: 0,
      statistics: {
        duration: {
          completionEventCount: 0,
          completionEventsWithoutActualMinutes: 0,
          overall: {
            maximumObservedMinutes: null,
            medianActualMinutes: null,
            minimumObservedMinutes: null,
            sampleCount: 0,
          },
        },
        timeOfDay: {
          taskCompleted: { sampleCount: 0 },
          taskStarted: { sampleCount: 0 },
        },
      },
      status: 'ok',
      validEventCount: 0,
    });
  });

  it('is deterministic regardless of trusted input order', () => {
    const events = [
      taskEvent('order-a', 'taskCompleted', '2026-09-22T09:00:00.000Z', {
        actualMinutes: 30,
        taskId: 'task-z',
        templateId: 'template-z',
      }),
      taskEvent('order-b', 'taskCompleted', '2026-09-21T09:00:00.000Z', {
        actualMinutes: 10,
        taskId: 'task-a',
        templateId: 'template-a',
      }),
      taskEvent('order-c', 'taskStarted', '2026-09-20T09:00:00.000Z'),
    ];

    expect(deriveBehaviourStatistics(events)).toEqual(
      deriveBehaviourStatistics([...events].reverse()),
    );
  });
});
