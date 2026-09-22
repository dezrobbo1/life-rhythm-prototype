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
import {
  activeTaskSchema,
  behaviourEventSchema,
  taskPoolItemSchema,
  type BehaviourEvent,
  type TaskPoolItem,
} from './schemas';
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

function lifecycleEvent(
  eventType: BehaviourEvent['eventType'],
  action: BehaviourEvent['action'],
  occurredAt: string,
  beforeStatus: 'active' | 'inProgress' | 'paused' | 'minimumDone' | 'done' | 'parked',
  afterStatus: 'inProgress' | 'paused' | 'minimumDone' | 'done' | 'parked',
) {
  const minimumWasAchieved = beforeStatus === 'minimumDone';
  return createBehaviourEvent({
    action,
    after: {
      minimumAchieved: minimumWasAchieved || afterStatus === 'minimumDone',
      taskStatus: afterStatus,
    },
    before: { minimumAchieved: minimumWasAchieved, taskStatus: beforeStatus },
    eventType,
    occurredAt,
    provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
    source: 'user',
    taskId: 'task-filing',
  });
}

describe('behaviour event ledger', () => {
  it('accepts the canonical event-variant matrix', () => {
    const taskBefore = { minimumAchieved: false, taskStatus: 'active' as const };
    const taskAfter = { minimumAchieved: false, taskStatus: 'inProgress' as const };
    const createdTaskAfter = { taskStatus: 'active' as const };
    const poolBefore = { poolStatus: 'captured' as const };
    const poolAfter = { poolStatus: 'today' as const, taskStatus: 'active' as const };
    const placement = {
      date: '2026-09-22',
      end: '10:15',
      placementStatus: 'automatic' as const,
      start: '10:00',
    };
    const userPlacement = { ...placement, placementStatus: 'planned' as const };
    const movedUserPlacement = {
      ...userPlacement,
      end: '10:45',
      placementStatus: 'moved' as const,
      start: '10:30',
    };
    const movedAutomaticPlacement = { ...placement, end: '10:45', start: '10:30' };
    const minimumAutomaticPlacement = {
      ...placement,
      end: '10:05',
      variantKind: 'minimum' as const,
    };
    const common = {
      occurredAt: '2026-09-22T09:00:00.000Z',
      recordKind: 'behaviourEvent' as const,
      timezone: 'UTC',
      localDate: '2026-09-22',
      version: 1 as const,
    };
    const variants = [
      { eventType: 'taskCaptured', action: 'capture', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskPoolCapture' }, taskId: 'task', after: poolBefore },
      { eventType: 'taskCreated', action: 'create', source: 'user', provenance: { origin: 'userAction', mechanism: 'todayCapture' }, taskId: 'task', after: createdTaskAfter },
      { eventType: 'taskAddedToToday', action: 'addToToday', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: poolBefore, after: poolAfter },
      { eventType: 'taskAddedToToday', action: 'addToToday', source: 'user', provenance: { origin: 'userAction', mechanism: 'todayCapture' }, taskId: 'task', after: createdTaskAfter },
      { eventType: 'taskStarted', action: 'start', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: taskBefore, after: taskAfter },
      { eventType: 'taskPaused', action: 'pause', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: taskAfter, after: { minimumAchieved: false, taskStatus: 'paused' } },
      { eventType: 'taskResumed', action: 'resume', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: { minimumAchieved: false, taskStatus: 'paused' }, after: taskAfter },
      { eventType: 'taskContinued', action: 'continue', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: { minimumAchieved: true, taskStatus: 'minimumDone' }, after: { minimumAchieved: true, taskStatus: 'inProgress' } },
      { eventType: 'taskMinimumAchieved', action: 'minimumDone', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: taskAfter, after: { taskStatus: 'minimumDone', minimumAchieved: true } },
      { eventType: 'taskCompleted', action: 'complete', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: taskAfter, after: { minimumAchieved: false, taskStatus: 'done' }, actualMinutes: 10 },
      { eventType: 'taskParked', action: 'park', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: taskBefore, after: { minimumAchieved: false, taskStatus: 'parked' } },
      { eventType: 'taskNotToday', action: 'notToday', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: taskBefore, after: { minimumAchieved: false, taskStatus: 'notToday' } },
      { eventType: 'taskDeferred', action: 'defer', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskPoolDeferral' }, taskId: 'task', before: poolBefore, after: { bringBackAfter: '2026-09-23T09:00:00.000Z', poolStatus: 'deferred' } },
      { eventType: 'taskNoLongerNeeded', action: 'noLongerNeeded', source: 'user', provenance: { origin: 'userAction', mechanism: 'taskLifecycle' }, taskId: 'task', before: poolBefore, after: { poolStatus: 'noLongerNeeded' } },
      { eventType: 'userPlacementCreated', action: 'createPlacement', source: 'user', provenance: { origin: 'userAction', mechanism: 'softPlacement' }, taskId: 'task', placementId: 'placement', after: userPlacement },
      { eventType: 'userPlacementMoved', action: 'movePlacement', source: 'user', provenance: { origin: 'userAction', mechanism: 'softPlacement' }, taskId: 'task', placementId: 'placement', before: userPlacement, after: movedUserPlacement },
      { eventType: 'userPlacementRemoved', action: 'removePlacement', source: 'user', provenance: { origin: 'userAction', mechanism: 'softPlacement' }, taskId: 'task', placementId: 'placement', before: userPlacement, after: { ...userPlacement, placementStatus: 'removed' } },
      { eventType: 'schedulerPlacementAdded', action: 'addAutomaticPlacement', source: 'scheduler', provenance: { origin: 'initialPlanBuild', mechanism: 'schedulerInitialBuild' }, taskId: 'task', placementId: 'automatic-placement', after: placement },
      { eventType: 'schedulerPlacementAdded', action: 'addAutomaticPlacement', source: 'scheduler', provenance: { origin: 'automaticRepair', mechanism: 'schedulerRepair' }, taskId: 'task', after: placement },
      { eventType: 'schedulerPlacementMoved', action: 'moveAutomaticPlacement', source: 'scheduler', provenance: { origin: 'automaticRepair', mechanism: 'schedulerRepair' }, taskId: 'task', before: placement, after: movedAutomaticPlacement },
      { eventType: 'schedulerPlacementRemoved', action: 'removeAutomaticPlacement', source: 'scheduler', provenance: { origin: 'automaticRepair', mechanism: 'schedulerRepair' }, rhythmId: 'rhythm', before: placement },
      { eventType: 'schedulerPlacementVariantChanged', action: 'changeAutomaticPlacementVariant', source: 'scheduler', provenance: { origin: 'automaticRepair', mechanism: 'schedulerRepair' }, rhythmId: 'rhythm', before: { ...placement, variantKind: 'normal' }, after: minimumAutomaticPlacement },
      { eventType: 'schedulerRepairUndone', action: 'undoRepair', source: 'user', provenance: { origin: 'undo', mechanism: 'schedulerRepairUndo' } },
    ];

    variants.forEach((variant, index) => {
      expect(behaviourEventSchema.safeParse({ ...common, ...variant, id: `valid-${index}` }).success).toBe(true);
    });
  });

  it.each([
    ['taskStarted', 'start', 'paused', 'inProgress'],
    ['taskPaused', 'pause', 'active', 'paused'],
    ['taskResumed', 'resume', 'active', 'inProgress'],
    ['taskContinued', 'continue', 'paused', 'inProgress'],
    ['taskCompleted', 'complete', 'done', 'done'],
  ] as const)('rejects the impossible task transition %s', (eventType, action, beforeStatus, afterStatus) => {
    const event = {
      action,
      after: { minimumAchieved: false, taskStatus: afterStatus },
      before: { minimumAchieved: false, taskStatus: beforeStatus },
      eventType,
      id: `invalid-${eventType}`,
      localDate: '2026-09-22',
      occurredAt: '2026-09-22T09:00:00.000Z',
      provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
      recordKind: 'behaviourEvent',
      source: 'user',
      taskId: 'task',
      timezone: 'UTC',
      version: 1,
    };

    expect(behaviourEventSchema.safeParse(event).success).toBe(false);
  });

  it('rejects unrelated task status facts smuggled into add-to-Today events', () => {
    const valid = createBehaviourEvent({
      action: 'addToToday',
      after: { poolStatus: 'today', taskStatus: 'active' },
      before: { poolStatus: 'captured' },
      eventType: 'taskAddedToToday',
      occurredAt: '2026-09-22T09:00:00.000Z',
      provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
      source: 'user',
      taskId: 'task',
    });

    expect(behaviourEventSchema.safeParse({
      ...valid,
      after: { poolStatus: 'today', taskStatus: 'done' },
    }).success).toBe(false);
  });

  it.each([
    ['userPlacementRemoved', 'removePlacement', 'removed', 'planned', '10:00', '10:30'],
    ['userPlacementMoved', 'movePlacement', 'planned', 'moved', '10:00', '10:00'],
    ['schedulerPlacementMoved', 'moveAutomaticPlacement', 'automatic', 'automatic', '10:00', '10:00'],
  ] as const)(
    'rejects the impossible placement transition %s',
    (eventType, action, beforeStatus, afterStatus, beforeStart, afterStart) => {
      const schedulerEvent = eventType.startsWith('scheduler');
      const placement = (
        placementStatus: 'planned' | 'moved' | 'removed' | 'completedFromToday' | 'automatic',
        start: string,
      ) => ({
        date: '2026-09-22',
        end: start === '10:00' ? '10:15' : '10:45',
        placementStatus,
        start,
      });
      const candidate = {
        action,
        after: placement(afterStatus, afterStart),
        before: placement(beforeStatus, beforeStart),
        eventType,
        id: `invalid-${eventType}`,
        localDate: '2026-09-22',
        occurredAt: '2026-09-22T09:00:00.000Z',
        provenance: schedulerEvent
          ? { origin: 'automaticRepair', mechanism: 'schedulerRepair' }
          : { origin: 'userAction', mechanism: 'softPlacement' },
        recordKind: 'behaviourEvent',
        source: schedulerEvent ? 'scheduler' : 'user',
        taskId: 'task',
        ...(schedulerEvent ? {} : { placementId: 'placement' }),
        timezone: 'UTC',
        version: 1,
      };

      expect(behaviourEventSchema.safeParse(candidate).success).toBe(false);
    },
  );

  it('requires placement moves and variant changes to describe the claimed factual change', () => {
    const automaticPlacement = {
      date: '2026-09-22',
      end: '10:15',
      placementStatus: 'automatic' as const,
      start: '10:00',
      variantKind: 'normal' as const,
    };
    const common = {
      id: 'invalid-automatic-change',
      localDate: '2026-09-22',
      occurredAt: '2026-09-22T09:00:00.000Z',
      provenance: { origin: 'automaticRepair' as const, mechanism: 'schedulerRepair' },
      recordKind: 'behaviourEvent' as const,
      source: 'scheduler' as const,
      taskId: 'task',
      timezone: 'UTC',
      version: 1 as const,
    };

    expect(behaviourEventSchema.safeParse({
      ...common,
      action: 'moveAutomaticPlacement',
      after: automaticPlacement,
      before: automaticPlacement,
      eventType: 'schedulerPlacementMoved',
    }).success).toBe(false);
    expect(behaviourEventSchema.safeParse({
      ...common,
      action: 'changeAutomaticPlacementVariant',
      after: automaticPlacement,
      before: automaticPlacement,
      eventType: 'schedulerPlacementVariantChanged',
    }).success).toBe(false);
  });

  it('rejects before facts on placement additions and after facts on placement removals', () => {
    const placement = {
      date: '2026-09-22',
      end: '10:15',
      placementStatus: 'automatic' as const,
      start: '10:00',
    };
    const common = {
      id: 'invalid-placement-snapshot-direction',
      localDate: '2026-09-22',
      occurredAt: '2026-09-22T09:00:00.000Z',
      provenance: { origin: 'automaticRepair' as const, mechanism: 'schedulerRepair' },
      recordKind: 'behaviourEvent' as const,
      source: 'scheduler' as const,
      taskId: 'task',
      timezone: 'UTC',
      version: 1 as const,
    };

    expect(behaviourEventSchema.safeParse({
      ...common,
      action: 'addAutomaticPlacement',
      after: placement,
      before: placement,
      eventType: 'schedulerPlacementAdded',
    }).success).toBe(false);
    expect(behaviourEventSchema.safeParse({
      ...common,
      action: 'removeAutomaticPlacement',
      after: placement,
      before: placement,
      eventType: 'schedulerPlacementRemoved',
    }).success).toBe(false);
  });

  it('rejects contradictory event variants and incoherent temporal tuples', () => {
    const valid = lifecycleEvent(
      'taskCompleted',
      'complete',
      '2026-09-22T09:00:00.000Z',
      'inProgress',
      'done',
    );

    expect(behaviourEventSchema.safeParse({ ...valid, action: 'defer' }).success).toBe(false);
    expect(behaviourEventSchema.safeParse({ ...valid, source: 'scheduler' }).success).toBe(false);
    expect(behaviourEventSchema.safeParse({ ...valid, taskId: undefined }).success).toBe(false);
    expect(behaviourEventSchema.safeParse({ ...valid, after: { taskStatus: 'active' } }).success).toBe(false);
    expect(behaviourEventSchema.safeParse({ ...valid, localDate: '2026-02-30' }).success).toBe(false);
    expect(behaviourEventSchema.safeParse({ ...valid, timezone: 'Not/AZone' }).success).toBe(false);
    expect(behaviourEventSchema.safeParse({ ...valid, localDate: '2026-09-21' }).success).toBe(false);
  });

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
      await appendBehaviourEvent(lifecycleEvent(
        'taskStarted',
        'start',
        startedAt,
        'active',
        'inProgress',
      ), database);

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

  it('excludes the inactive gap between Minimum Done and Continue from actual minutes', async () => {
    const database = createTestDatabase();
    const completedAt = Date.now();

    try {
      await seedTodayTask(database);
      await appendBehaviourEvent(lifecycleEvent(
        'taskStarted',
        'start',
        new Date(completedAt - 30 * 60_000).toISOString(),
        'active',
        'inProgress',
      ), database);
      await appendBehaviourEvent(lifecycleEvent(
        'taskMinimumAchieved',
        'minimumDone',
        new Date(completedAt - 20 * 60_000).toISOString(),
        'inProgress',
        'minimumDone',
      ), database);
      await appendBehaviourEvent(lifecycleEvent(
        'taskContinued',
        'continue',
        new Date(completedAt - 5 * 60_000).toISOString(),
        'minimumDone',
        'inProgress',
      ), database);
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

  it('excludes parked time when a later completion sums observed active sessions', async () => {
    const database = createTestDatabase();
    const completedAt = Date.now();

    try {
      await seedTodayTask(database);
      const facts = [
        { action: 'start' as const, after: 'inProgress' as const, before: 'active' as const, eventType: 'taskStarted' as const, minutesAgo: 30 },
        { action: 'park' as const, after: 'parked' as const, before: 'inProgress' as const, eventType: 'taskParked' as const, minutesAgo: 20 },
        { action: 'start' as const, after: 'inProgress' as const, before: 'parked' as const, eventType: 'taskStarted' as const, minutesAgo: 5 },
      ];
      for (const fact of facts) {
        await appendBehaviourEvent(lifecycleEvent(
          fact.eventType,
          fact.action,
          new Date(completedAt - fact.minutesAgo * 60_000).toISOString(),
          fact.before,
          fact.after,
        ), database);
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
        {
          action: 'addToToday',
          after: { poolStatus: 'today', taskStatus: 'done' },
          before: { poolStatus: 'captured' },
          eventType: 'taskAddedToToday',
          id: 'contradictory-task-transition-row',
          localDate: '2026-09-22',
          occurredAt: '2026-09-22T09:03:00.000Z',
          provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
          recordKind: 'behaviourEvent',
          source: 'user',
          taskId: 'task-filing',
          timezone: 'UTC',
          version: 1,
        },
        {
          action: 'removePlacement',
          after: {
            date: '2026-09-22',
            end: '10:15',
            placementStatus: 'planned',
            start: '10:00',
          },
          before: {
            date: '2026-09-22',
            end: '10:15',
            placementStatus: 'removed',
            start: '10:00',
          },
          eventType: 'userPlacementRemoved',
          id: 'contradictory-placement-transition-row',
          localDate: '2026-09-22',
          occurredAt: '2026-09-22T09:04:00.000Z',
          placementId: 'placement-filing',
          provenance: { origin: 'userAction', mechanism: 'softPlacement' },
          recordKind: 'behaviourEvent',
          source: 'user',
          taskId: 'task-filing',
          timezone: 'UTC',
          version: 1,
        },
      ] as never[]);
      await appendBehaviourEvent(lifecycleEvent(
        'taskStarted',
        'start',
        '2026-09-22T09:05:00.000Z',
        'active',
        'inProgress',
      ), database);

      const loaded = await loadBehaviourEventsResult(database);
      expect(loaded).toMatchObject({ invalidRecordCount: 4, status: 'partial' });
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0].recordKind).toBe('behaviourEvent');
    } finally {
      await database.delete();
    }
  });

  it('sorts trusted events by epoch time across numeric offsets', async () => {
    const database = createTestDatabase();

    try {
      const later = lifecycleEvent(
        'taskPaused',
        'pause',
        '2026-09-22T01:00:00.000Z',
        'inProgress',
        'paused',
      );
      const earlier = lifecycleEvent(
        'taskStarted',
        'start',
        '2026-09-22T10:00:00.000+10:00',
        'active',
        'inProgress',
      );
      await appendBehaviourEvent(later, database);
      await appendBehaviourEvent(earlier, database);

      const loaded = await loadBehaviourEventsResult(database);
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items.map((event) => event.eventType)).toEqual(['taskStarted', 'taskPaused']);
    } finally {
      await database.delete();
    }
  });

  it('treats an identical duplicate ID as a no-op and rejects conflicting content', async () => {
    const database = createTestDatabase();

    try {
      const original = lifecycleEvent(
        'taskStarted',
        'start',
        '2026-09-22T09:00:00.000Z',
        'active',
        'inProgress',
      );
      const fixedId = { ...original, id: 'stable-event-id' };
      await appendBehaviourEvent(fixedId, database);
      await appendBehaviourEvent(fixedId, database);
      expect(await database.taskHistory.count()).toBe(1);

      await expect(appendBehaviourEvent({
        ...lifecycleEvent(
          'taskPaused',
          'pause',
          '2026-09-22T09:05:00.000Z',
          'inProgress',
          'paused',
        ),
        id: 'stable-event-id',
      }, database)).rejects.toThrow(/different behaviour event/i);
      expect(await database.taskHistory.get('stable-event-id')).toEqual(fixedId);
    } finally {
      await database.delete();
    }
  });

  it('records scheduler-owned initial placements exactly once with build provenance', async () => {
    const database = createTestDatabase();

    try {
      const built = await buildAndPersistSchedulerPlan(
        schedulingModel('09:00', '10:00'),
        database,
        '2026-09-22T00:00:00.000Z',
      );
      expect(built.ok).toBe(true);

      const loaded = await loadBehaviourEventsResult(database);
      if (loaded.status === 'readFailed') throw new Error('Expected readable events.');
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0]).toMatchObject({
        action: 'addAutomaticPlacement',
        eventType: 'schedulerPlacementAdded',
        placementId: expect.any(String),
        provenance: {
          mechanism: 'schedulerInitialBuild',
          origin: 'initialPlanBuild',
        },
        source: 'scheduler',
        taskId: 'task-filing',
      });

      const staleBuild = await buildAndPersistSchedulerPlan(
        schedulingModel('10:00', '11:00'),
        database,
        '2026-09-22T00:05:00.000Z',
        undefined,
        undefined,
        undefined,
        { status: 'missing' },
      );
      expect(staleBuild).toMatchObject({ conflict: 'stale', ok: false });
      expect(await database.taskHistory.count()).toBe(1);
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
      expect(afterRepair.items.filter((event) => event.provenance.origin === 'automaticRepair')).toEqual([
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

      await appendBehaviourEvent(lifecycleEvent(
        'taskParked',
        'park',
        '2026-09-22T09:05:00.000Z',
        'active',
        'parked',
      ), database);

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
      vi.spyOn(database.taskHistory, 'add').mockRejectedValueOnce(new Error('storage unavailable'));

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
