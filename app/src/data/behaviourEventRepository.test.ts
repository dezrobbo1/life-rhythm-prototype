import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT_CALENDAR_SOURCE_ID, calendarSourceRecordSchema } from './calendarSourceSchema';
import { createLifeRhythmDatabase } from './db';
import {
  appendBehaviourEvent,
  createBehaviourEvent,
  loadBehaviourEventsResult,
} from './behaviourEventRepository';
import {
  buildAndPersistSchedulerPlan,
  repairAndPersistSchedulerPlan,
  saveSchedulerPlanState,
  undoPersistedSchedulerRepair,
} from './schedulerPlanStateRepository';
import type { SchedulingDomainModel } from '../domain/schedulingModel';
import { activeTaskSchema, taskPoolItemSchema, type TaskPoolItem } from './schemas';
import { updateTaskLifecycleStatus } from './taskLifecycleRepository';
import { confirmTaskPoolSoftPlacement, removeTaskPoolSoftPlacement } from './taskSoftPlacementRepository';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;
  return createLifeRhythmDatabase(`life-rhythm-behaviour-event-test-${testDatabaseIndex}`);
}

function poolItem(overrides: Partial<TaskPoolItem> = {}) {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-09-22T09:00:00.000Z',
    full: { label: 'Finish filing', minutes: 30 },
    id: 'task-filing',
    minimum: { label: 'Open the folder', minutes: 5 },
    normal: { label: 'File one document', minutes: 15 },
    source: 'adhoc',
    status: 'today',
    title: 'File paperwork',
    updatedAt: '2026-09-22T09:00:00.000Z',
    ...overrides,
  });
}

async function seedTodayTask(database: ReturnType<typeof createTestDatabase>) {
  const item = poolItem();
  await database.taskPoolItems.put(item);
  await database.activeTasks.put(activeTaskSchema.parse({
    ...item,
    kind: 'adhoc',
    showToday: true,
    status: 'active',
  }));
}

function schedulingModel(start: string, end: string): SchedulingDomainModel {
  return {
    candidateIntervals: [{
      capacityMeaning: 'candidate-not-capacity',
      date: '2026-09-22',
      end,
      id: `capacity-${start}`,
      provenance: ['Behaviour ledger test capacity.'],
      start,
      timezone: 'Australia/Perth',
    }],
    capacityWindows: [],
    dayProfiles: [],
    externalCommitments: [],
    intentions: [{
      area: 'admin',
      eligibleForScheduling: true,
      id: 'task-filing',
      lifecycle: {},
      priority: 'normal',
      sourceRecords: [{ id: 'task-filing', kind: 'taskPoolItem' }],
      taskType: 'admin',
      timing: { timeConstraint: 'flexible' },
      title: 'File paperwork',
      variants: [{ kind: 'normal', label: 'File one document', minutes: 15 }],
    }],
    placements: [],
    preferences: [],
    rhythms: [],
  };
}

describe('behaviour event ledger', () => {
  it('records one factual start when a lifecycle request is repeated', async () => {
    const database = createTestDatabase();

    try {
      await seedTodayTask(database);

      await updateTaskLifecycleStatus('task-filing', 'inProgress', database);
      await updateTaskLifecycleStatus('task-filing', 'inProgress', database);

      const loaded = await loadBehaviourEventsResult(database);
      expect(loaded).toMatchObject({ status: 'ok' });
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items.map((event) => event.eventType)).toEqual(['taskStarted']);
      expect(loaded.items[0]).toMatchObject({
        action: 'start',
        provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
        source: 'user',
        taskId: 'task-filing',
      });
    } finally {
      await database.delete();
    }
  });

  it('does not append facts when the ledger is read again after a database reload', async () => {
    const database = createTestDatabase();
    const databaseName = database.name;
    let reopened: ReturnType<typeof createTestDatabase> | null = null;

    try {
      await seedTodayTask(database);
      await updateTaskLifecycleStatus('task-filing', 'inProgress', database);
      expect(await database.taskHistory.count()).toBe(1);
      database.close();

      reopened = createLifeRhythmDatabase(databaseName);
      const firstRead = await loadBehaviourEventsResult(reopened);
      const secondRead = await loadBehaviourEventsResult(reopened);
      expect(firstRead.status === 'readFailed' ? [] : firstRead.items).toHaveLength(1);
      expect(secondRead.status === 'readFailed' ? [] : secondRead.items).toHaveLength(1);
      expect(await reopened.taskHistory.count()).toBe(1);
    } finally {
      await (reopened ?? database).delete();
    }
  });

  it('records Minimum achieved once and preserves the factual transition', async () => {
    const database = createTestDatabase();

    try {
      await seedTodayTask(database);

      await updateTaskLifecycleStatus('task-filing', 'minimumDone', database);
      await updateTaskLifecycleStatus('task-filing', 'minimumDone', database);

      const loaded = await loadBehaviourEventsResult(database);
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0]).toMatchObject({
        action: 'minimumDone',
        after: { minimumAchieved: true, taskStatus: 'minimumDone' },
        before: { minimumAchieved: false, taskStatus: 'active' },
        eventType: 'taskMinimumAchieved',
      });
    } finally {
      await database.delete();
    }
  });

  it('records one completion fact with observed active duration when available', async () => {
    const database = createTestDatabase();

    try {
      await seedTodayTask(database);
      const completedAt = new Date();
      const startedAt = new Date(completedAt.getTime() - 12 * 60_000).toISOString();
      const task = await database.activeTasks.get('task-filing');
      await database.activeTasks.put(activeTaskSchema.parse({
        ...task,
        status: 'inProgress',
        updatedAt: startedAt,
      }));
      await appendBehaviourEvent(createBehaviourEvent({
        action: 'start',
        eventType: 'taskStarted',
        occurredAt: startedAt,
        provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
        source: 'user',
        taskId: 'task-filing',
      }), database);

      await updateTaskLifecycleStatus('task-filing', 'done', database);
      await updateTaskLifecycleStatus('task-filing', 'done', database);

      const loaded = await loadBehaviourEventsResult(database);
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      const completions = loaded.items.filter((event) => event.eventType === 'taskCompleted');
      expect(completions).toHaveLength(1);
      expect(completions[0]).toMatchObject({ actualMinutes: 12, action: 'complete' });
    } finally {
      await database.delete();
    }
  });

  it('excludes parked time when a later completion sums observed active sessions', async () => {
    const database = createTestDatabase();
    const completedAt = Date.now();

    try {
      await seedTodayTask(database);
      const facts = [
        { action: 'start' as const, eventType: 'taskStarted' as const, minutesAgo: 30 },
        { action: 'park' as const, eventType: 'taskParked' as const, minutesAgo: 20 },
        { action: 'start' as const, eventType: 'taskStarted' as const, minutesAgo: 5 },
      ];
      for (const fact of facts) {
        await appendBehaviourEvent(createBehaviourEvent({
          action: fact.action,
          eventType: fact.eventType,
          occurredAt: new Date(completedAt - fact.minutesAgo * 60_000).toISOString(),
          provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
          source: 'user',
          taskId: 'task-filing',
        }), database);
      }
      const task = await database.activeTasks.get('task-filing');
      await database.activeTasks.put(activeTaskSchema.parse({
        ...task,
        status: 'inProgress',
        updatedAt: new Date(completedAt - 5 * 60_000).toISOString(),
      }));

      await updateTaskLifecycleStatus('task-filing', 'done', database);

      const loaded = await loadBehaviourEventsResult(database);
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items.find((event) => event.eventType === 'taskCompleted')).toMatchObject({
        actualMinutes: 15,
      });
    } finally {
      await database.delete();
    }
  });

  it.each([
    ['parked', 'taskParked', 'park'],
    ['notToday', 'taskNotToday', 'notToday'],
  ] as const)('records the user lifecycle action %s', async (status, eventType, action) => {
    const database = createTestDatabase();

    try {
      await seedTodayTask(database);
      await updateTaskLifecycleStatus('task-filing', status, database);

      const loaded = await loadBehaviourEventsResult(database);
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0]).toMatchObject({ action, eventType, source: 'user' });
    } finally {
      await database.delete();
    }
  });

  it('records user-confirmed placement creation and removal as user facts', async () => {
    const database = createTestDatabase();

    try {
      await database.taskPoolItems.put(poolItem({ status: 'captured' }));
      const created = await confirmTaskPoolSoftPlacement({
        blockEnd: '10:30',
        blockId: 'open-morning',
        blockLabel: 'Open morning',
        blockStart: '10:00',
        date: '2026-09-23',
        id: 'placement-filing',
        taskId: 'task-filing',
      }, database);
      expect(created.ok).toBe(true);
      await removeTaskPoolSoftPlacement('placement-filing', database);

      const loaded = await loadBehaviourEventsResult(database);
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items.map((event) => [event.eventType, event.source])).toEqual([
        ['userPlacementCreated', 'user'],
        ['userPlacementRemoved', 'user'],
      ]);
      expect(loaded.items[0]).toMatchObject({
        after: { date: '2026-09-23', end: '10:30', placementStatus: 'planned', start: '10:00' },
        placementId: 'placement-filing',
      });
    } finally {
      await database.delete();
    }
  });

  it('excludes malformed and legacy rows from trusted behaviour facts', async () => {
    const database = createTestDatabase();

    try {
      await database.taskHistory.bulkPut([
        {
          id: 'legacy-row',
          taskId: 'task-filing',
          eventType: 'created',
          occurredAt: '2026-09-22T09:00:00.000Z',
          summary: 'Legacy history row',
          metadata: {},
        },
        { id: 'malformed-row', eventType: 'taskStarted' },
      ] as never[]);
      await appendBehaviourEvent(createBehaviourEvent({
        action: 'start',
        eventType: 'taskStarted',
        occurredAt: '2026-09-22T09:05:00.000Z',
        provenance: { origin: 'userAction', mechanism: 'test' },
        source: 'user',
        taskId: 'task-filing',
      }), database);

      const loaded = await loadBehaviourEventsResult(database);
      expect(loaded).toMatchObject({ invalidRecordCount: 2, status: 'partial' });
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0].recordKind).toBe('behaviourEvent');
    } finally {
      await database.delete();
    }
  });

  it('records automatic repair movement without claiming user intent and records Undo once', async () => {
    const database = createTestDatabase();

    try {
      const built = await buildAndPersistSchedulerPlan(
        schedulingModel('09:00', '10:00'),
        database,
        '2026-09-22T00:00:00.000Z',
      );
      expect(built.ok).toBe(true);

      const repaired = await repairAndPersistSchedulerPlan({
        nextInput: schedulingModel('10:00', '11:00'),
        now: { date: '2026-09-22', time: '08:00', timezone: 'Australia/Perth' },
        reason: 'Available capacity changed.',
        trigger: 'calendarChanged',
      }, database, '2026-09-22T00:05:00.000Z');
      expect(repaired.ok).toBe(true);

      const afterRepair = await loadBehaviourEventsResult(database);
      if (afterRepair.status === 'readFailed') throw new Error('Expected readable events.');
      expect(afterRepair.items).toEqual([
        expect.objectContaining({
          action: 'moveAutomaticPlacement',
          eventType: 'schedulerPlacementMoved',
          provenance: expect.objectContaining({
            mechanism: 'schedulerRepair',
            origin: 'automaticRepair',
            trigger: 'calendarChanged',
          }),
          source: 'scheduler',
          taskId: 'task-filing',
        }),
      ]);

      const undone = await undoPersistedSchedulerRepair(
        database,
        '2026-09-22T00:06:00.000Z',
      );
      expect(undone.ok).toBe(true);
      const afterUndo = await loadBehaviourEventsResult(database);
      if (afterUndo.status === 'readFailed') throw new Error('Expected readable events.');
      expect(afterUndo.items.filter((event) => event.eventType === 'schedulerRepairUndone')).toHaveLength(1);
      expect(afterUndo.items[afterUndo.items.length - 1]).toMatchObject({
        action: 'undoRepair',
        provenance: { mechanism: 'schedulerRepairUndo', origin: 'undo', trigger: 'calendarChanged' },
        source: 'user',
      });
    } finally {
      await database.delete();
    }
  });

  it('writes an event without changing scheduler or calendar authority', async () => {
    const database = createTestDatabase();
    const plan = {
      placements: [],
      rejectedExistingPlacements: [],
      unscheduledIntentionIds: [],
      unscheduledRhythmIds: [],
    };
    const calendar = calendarSourceRecordSchema.parse({
      adapterId: 'ics',
      id: CURRENT_CALENDAR_SOURCE_ID,
      importedAt: '2026-09-22T09:00:00.000Z',
      label: 'Private calendar',
      source: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',
      updatedAt: '2026-09-22T09:00:00.000Z',
      version: 1,
    });

    try {
      await saveSchedulerPlanState(plan, database, '2026-09-22T09:00:00.000Z');
      await database.calendarSources.put(calendar);
      const schedulerBefore = await database.schedulerPlanState.get('current');

      await appendBehaviourEvent(createBehaviourEvent({
        action: 'park',
        eventType: 'taskParked',
        occurredAt: '2026-09-22T09:05:00.000Z',
        provenance: { origin: 'userAction', mechanism: 'test' },
        source: 'user',
        taskId: 'task-filing',
      }), database);

      expect(await database.schedulerPlanState.get('current')).toEqual(schedulerBefore);
      expect(await database.calendarSources.get(CURRENT_CALENDAR_SOURCE_ID)).toEqual(calendar);
    } finally {
      await database.delete();
    }
  });

  it('fails closed so a lifecycle action is rolled back when its required fact cannot persist', async () => {
    const database = createTestDatabase();

    try {
      await seedTodayTask(database);
      vi.spyOn(database.taskHistory, 'put').mockRejectedValueOnce(new Error('storage unavailable'));

      await expect(
        updateTaskLifecycleStatus('task-filing', 'inProgress', database),
      ).rejects.toThrow('storage unavailable');

      expect(await database.activeTasks.get('task-filing')).toMatchObject({ status: 'active' });
      expect(await database.taskHistory.count()).toBe(0);
    } finally {
      vi.restoreAllMocks();
      await database.delete();
    }
  });
});
