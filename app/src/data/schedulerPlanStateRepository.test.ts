import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DATABASE_VERSION,
  createLifeRhythmDatabase,
} from './db';
import { findBlockedDataClassKey } from './dataClassBoundary';
import {
  createAuthLocalDataNamespace,
  getLifeRhythmDatabaseForNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  buildAndPersistSchedulerPlan,
  loadSchedulerPlanState,
  repairAndPersistSchedulerPlan,
  undoPersistedSchedulerRepair,
} from './schedulerPlanStateRepository';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  RhythmRequirement,
  SchedulingDomainModel,
} from '../domain/schedulingModel';

const timezone = 'Australia/Perth';
const today = '2026-09-07';
let databaseIndex = 0;

const version3Stores = {
  settings: 'id, appVersion, updatedAt',
  rhythmTemplates: 'id, source, enabled, area, kind, updatedAt',
  activeTasks: 'id, templateId, source, status, showToday, area, updatedAt',
  taskHistory: 'id, taskId, eventType, occurredAt',
  completionLog: 'id, taskId, templateId, localDate, completedAt',
  resetLog: 'id, localDate, action, occurredAt',
  startBoostLog: 'id, taskId, templateId, barrier, supportId, usedAt',
  devTickets: 'id, status, priority, area, createdAt, updatedAt',
  migrationLog: 'id, sourceKey, status, inspectedAt',
  softPlacements: 'id, taskId, date, blockId, status, placementSource, updatedAt',
  taskPoolItems: 'id, status, source, createdAt, updatedAt, dueAt, notUsefulAfter, bringBackAfter, templateId',
};

const version4Stores = {
  ...version3Stores,
  schedulerPlanState: 'id, updatedAt',
};

function createTestDatabase() {
  databaseIndex += 1;
  return createLifeRhythmDatabase(`life-rhythm-scheduler-plan-state-test-${databaseIndex}`);
}

function intention(id = 'task-a'): InternalIntention {
  return {
    id,
    title: id,
    area: 'admin',
    taskType: 'admin',
    priority: 'normal',
    variants: [{ kind: 'normal', label: 'Normal', minutes: 20 }],
    timing: { timeConstraint: 'flexible' },
    lifecycle: {},
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id }],
  };
}

function rhythm(id = 'rhythm-a'): RhythmRequirement {
  return {
    id,
    templateId: id,
    title: id,
    area: 'admin',
    frequency: 1,
    period: 'day',
    preferredDays: [],
    preferredTime: 'anytime',
    maxPerDay: 1,
    variants: [{ kind: 'normal', label: 'Normal', minutes: 20 }],
    sourceRecords: [{ kind: 'rhythmTemplate', id }],
  };
}

function candidate(
  id: string,
  start: string,
  end: string,
  date = today,
): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone,
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Scheduler plan persistence test candidate.'],
  };
}

function model(
  candidateIntervals: CandidateSchedulingInterval[] = [candidate('morning', '09:00', '10:00')],
): SchedulingDomainModel {
  return {
    intentions: [intention()],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals,
    preferences: [],
  };
}

async function expectOnlySchedulerPlanStateWritten(
  database: ReturnType<typeof createTestDatabase>,
) {
  expect(await database.schedulerPlanState.count()).toBe(1);
  expect(await database.settings.count()).toBe(0);
  expect(await database.rhythmTemplates.count()).toBe(0);
  expect(await database.activeTasks.count()).toBe(0);
  expect(await database.taskHistory.count()).toBe(0);
  expect(await database.completionLog.count()).toBe(0);
  expect(await database.resetLog.count()).toBe(0);
  expect(await database.startBoostLog.count()).toBe(0);
  expect(await database.devTickets.count()).toBe(0);
  expect(await database.migrationLog.count()).toBe(0);
  expect(await database.softPlacements.count()).toBe(0);
  expect(await database.taskPoolItems.count()).toBe(0);
  expect(await database.calendarSources.count()).toBe(0);
}

afterEach(() => {
  resetCurrentLocalDataNamespace();
});

describe('persisted Gate 4 scheduler plan state', () => {
  it('builds, validates and persists scheduler-generated plan state separately from soft placements', async () => {
    const database = createTestDatabase();

    try {
      const built = await buildAndPersistSchedulerPlan(
        model(),
        database,
        '2026-09-07T00:00:00.000Z',
      );

      expect(built.ok).toBe(true);
      if (!built.ok) throw new Error(built.errors.join('\n'));

      expect(built.mode).toBe('built');
      expect(built.plan.placements).toEqual([
        expect.objectContaining({
          intentionId: 'task-a',
          origin: 'scheduler',
          date: today,
          start: '09:00',
          end: '09:20',
        }),
      ]);

      const loaded = await loadSchedulerPlanState(database);
      expect(loaded).toMatchObject({
        status: 'ok',
        updatedAt: '2026-09-07T00:00:00.000Z',
      });
      if (loaded.status !== 'ok') throw new Error('Expected saved scheduler plan state.');
      expect(loaded.plan).toEqual(built.plan);
      await expectOnlySchedulerPlanStateWritten(database);
    } finally {
      await database.delete();
    }
  });

  it('persists rolling-repair Changed metadata and its one-step undo snapshot', async () => {
    const database = createTestDatabase();

    try {
      const built = await buildAndPersistSchedulerPlan(
        model(),
        database,
        '2026-09-07T00:00:00.000Z',
      );
      if (!built.ok) throw new Error(built.errors.join('\n'));

      const repaired = await repairAndPersistSchedulerPlan(
        {
          reason: 'Calendar changed',
          trigger: 'calendarChanged',
          now: { date: today, time: '08:00', timezone },
          nextInput: model([candidate('later', '10:00', '11:00')]),
        },
        database,
        '2026-09-07T00:05:00.000Z',
      );

      expect(repaired.ok).toBe(true);
      if (!repaired.ok) throw new Error(repaired.errors.join('\n'));
      expect(repaired.mode).toBe('repaired');
      expect(repaired.plan.placements[0]).toMatchObject({
        intentionId: 'task-a',
        start: '10:00',
        end: '10:20',
      });
      expect(repaired.plan.repair).toMatchObject({
        trigger: 'calendarChanged',
        reason: 'Calendar changed',
        changes: [
          expect.objectContaining({
            kind: 'moved',
            targetId: 'task-a',
          }),
        ],
      });
      expect(repaired.plan.repair?.undo.placements[0]).toMatchObject({
        start: '09:00',
        end: '09:20',
      });

      const loaded = await loadSchedulerPlanState(database);
      if (loaded.status !== 'ok') throw new Error('Expected repaired plan to reload.');
      expect(loaded.plan).toEqual(repaired.plan);
      await expectOnlySchedulerPlanStateWritten(database);
    } finally {
      await database.delete();
    }
  });

  it('does not use the elapsed part of a current-day interval as rolling-repair capacity', async () => {
    const database = createTestDatabase();

    try {
      const built = await buildAndPersistSchedulerPlan(
        model([]),
        database,
        '2026-09-07T00:00:00.000Z',
      );
      if (!built.ok) throw new Error(built.errors.join('\n'));

      const repaired = await repairAndPersistSchedulerPlan(
        {
          reason: 'Repair after time advanced',
          trigger: 'manualReplan',
          now: { date: today, time: '10:30', timezone },
          nextInput: model([candidate('partially-elapsed', '09:00', '12:00')]),
        },
        database,
        '2026-09-07T02:30:00.000Z',
      );

      expect(repaired.ok).toBe(true);
      if (!repaired.ok) throw new Error(repaired.errors.join('\n'));
      expect(repaired.mode).toBe('repaired');
      expect(repaired.plan.placements).toEqual([
        expect.objectContaining({
          intentionId: 'task-a',
          date: today,
          start: '10:30',
          end: '10:50',
        }),
      ]);
      expect(repaired.plan.placements.every((placement) =>
        placement.date > today || (placement.date === today && placement.start >= '10:30')
      )).toBe(true);
      expect(repaired.plan.unscheduledIntentionIds).toEqual([]);
    } finally {
      await database.delete();
    }
  });

  it('keeps an intention unscheduled when all candidate repair capacity has elapsed', async () => {
    const database = createTestDatabase();

    try {
      const built = await buildAndPersistSchedulerPlan(
        model([]),
        database,
        '2026-09-07T00:00:00.000Z',
      );
      if (!built.ok) throw new Error(built.errors.join('\n'));

      const repaired = await repairAndPersistSchedulerPlan(
        {
          reason: 'Repair after all candidate time elapsed',
          trigger: 'manualReplan',
          now: { date: today, time: '10:30', timezone },
          nextInput: model([candidate('completely-elapsed', '09:00', '10:00')]),
        },
        database,
        '2026-09-07T02:30:00.000Z',
      );

      expect(repaired.ok).toBe(true);
      if (!repaired.ok) throw new Error(repaired.errors.join('\n'));
      expect(repaired.mode).toBe('repaired');
      expect(repaired.plan.placements).toEqual([]);
      expect(repaired.plan.unscheduledIntentionIds).toEqual(['task-a']);
      expect(repaired.plan.unscheduledRhythmIds).toEqual([]);
    } finally {
      await database.delete();
    }
  });

  it('keeps an unmet rhythm unscheduled when its final candidate interval has elapsed', async () => {
    const database = createTestDatabase();
    const input: SchedulingDomainModel = {
      ...model([candidate('too-short', '09:00', '09:10')]),
      intentions: [],
      rhythms: [rhythm()],
    };

    try {
      const built = await buildAndPersistSchedulerPlan(
        input,
        database,
        '2026-09-07T00:00:00.000Z',
      );
      if (!built.ok) throw new Error(built.errors.join('\n'));
      expect(built.plan.placements).toEqual([]);
      expect(built.plan.unscheduledRhythmIds).toEqual(['rhythm-a']);

      const repaired = await repairAndPersistSchedulerPlan(
        {
          reason: 'Repair after all rhythm capacity elapsed',
          trigger: 'manualReplan',
          now: { date: today, time: '10:30', timezone },
          nextInput: input,
        },
        database,
        '2026-09-07T02:30:00.000Z',
      );

      expect(repaired.ok).toBe(true);
      if (!repaired.ok) throw new Error(repaired.errors.join('\n'));
      expect(repaired.plan.placements).toEqual([]);
      expect(repaired.plan.unscheduledIntentionIds).toEqual([]);
      expect(repaired.plan.unscheduledRhythmIds).toEqual(['rhythm-a']);

      const loaded = await loadSchedulerPlanState(database);
      if (loaded.status !== 'ok') throw new Error('Expected repaired plan to reload.');
      expect(loaded.plan.unscheduledRhythmIds).toEqual(['rhythm-a']);
    } finally {
      await database.delete();
    }
  });

  it('keeps future candidate repair capacity unchanged and schedulable', async () => {
    const database = createTestDatabase();

    try {
      const built = await buildAndPersistSchedulerPlan(
        model([]),
        database,
        '2026-09-07T00:00:00.000Z',
      );
      if (!built.ok) throw new Error(built.errors.join('\n'));

      const repaired = await repairAndPersistSchedulerPlan(
        {
          reason: 'Repair before future capacity',
          trigger: 'manualReplan',
          now: { date: today, time: '10:30', timezone },
          nextInput: model([candidate('future', '11:00', '12:00')]),
        },
        database,
        '2026-09-07T02:30:00.000Z',
      );

      expect(repaired.ok).toBe(true);
      if (!repaired.ok) throw new Error(repaired.errors.join('\n'));
      expect(repaired.mode).toBe('repaired');
      expect(repaired.plan.placements).toEqual([
        expect.objectContaining({
          intentionId: 'task-a',
          date: today,
          start: '11:00',
          end: '11:20',
        }),
      ]);
      expect(repaired.plan.unscheduledIntentionIds).toEqual([]);
    } finally {
      await database.delete();
    }
  });

  it('clips elapsed capacity on the missing-plan fallback build path', async () => {
    const database = createTestDatabase();

    try {
      const built = await repairAndPersistSchedulerPlan(
        {
          reason: 'Build after time advanced',
          trigger: 'manualReplan',
          now: { date: today, time: '10:30', timezone },
          nextInput: model([candidate('partially-elapsed', '09:00', '12:00')]),
        },
        database,
        '2026-09-07T02:30:00.000Z',
      );

      expect(built.ok).toBe(true);
      if (!built.ok) throw new Error(built.errors.join('\n'));
      expect(built.mode).toBe('built');
      expect(built.plan.placements[0]).toMatchObject({
        intentionId: 'task-a',
        date: today,
        start: '10:30',
        end: '10:50',
      });
    } finally {
      await database.delete();
    }
  });

  it('persists undo as the restored previous plan and removes repair metadata', async () => {
    const database = createTestDatabase();

    try {
      const built = await buildAndPersistSchedulerPlan(model(), database, '2026-09-07T00:00:00.000Z');
      if (!built.ok) throw new Error(built.errors.join('\n'));

      const repaired = await repairAndPersistSchedulerPlan(
        {
          reason: 'Calendar changed',
          trigger: 'calendarChanged',
          now: { date: today, time: '08:00', timezone },
          nextInput: model([candidate('later', '10:00', '11:00')]),
        },
        database,
        '2026-09-07T00:05:00.000Z',
      );
      if (!repaired.ok) throw new Error(repaired.errors.join('\n'));

      const undone = await undoPersistedSchedulerRepair(
        database,
        '2026-09-07T00:06:00.000Z',
      );

      expect(undone.ok).toBe(true);
      if (!undone.ok) throw new Error(undone.errors.join('\n'));
      expect(undone.mode).toBe('undone');
      expect(undone.plan).toEqual(built.plan);
      expect(undone.plan.repair).toBeUndefined();

      const loaded = await loadSchedulerPlanState(database);
      if (loaded.status !== 'ok') throw new Error('Expected undone plan to reload.');
      expect(loaded.plan).toEqual(built.plan);
      expect(loaded.updatedAt).toBe('2026-09-07T00:06:00.000Z');
    } finally {
      await database.delete();
    }
  });

  it('fails closed on malformed saved scheduler state instead of replacing it during repair', async () => {
    const database = createTestDatabase();

    try {
      const malformed = {
        id: 'current',
        version: 1,
        updatedAt: '2026-09-07T00:00:00.000Z',
        plan: {
          placements: [{ id: 'broken-placement' }],
          unscheduledIntentionIds: [],
          unscheduledRhythmIds: [],
          rejectedExistingPlacements: [],
        },
      };
      await database.schedulerPlanState.put(malformed as never);

      const loaded = await loadSchedulerPlanState(database);
      expect(loaded.status).toBe('invalid');

      const repaired = await repairAndPersistSchedulerPlan(
        {
          reason: 'Do not overwrite malformed state',
          trigger: 'manualReplan',
          now: { date: today, time: '08:00', timezone },
          nextInput: model(),
        },
        database,
        '2026-09-07T00:05:00.000Z',
      );

      expect(repaired.ok).toBe(false);
      expect(await database.schedulerPlanState.get('current')).toEqual(malformed);
      expect(await database.schedulerPlanState.count()).toBe(1);
    } finally {
      await database.delete();
    }
  });

  it('keeps persisted scheduler state inside the current local user namespace', async () => {
    const userANamespace = createAuthLocalDataNamespace('scheduler-plan-user-a');
    const userBNamespace = createAuthLocalDataNamespace('scheduler-plan-user-b');
    const userADatabase = getLifeRhythmDatabaseForNamespace(userANamespace);
    const userBDatabase = getLifeRhythmDatabaseForNamespace(userBNamespace);

    try {
      setCurrentLocalDataNamespace(userANamespace);
      const savedA = await buildAndPersistSchedulerPlan(
        model(),
        undefined,
        '2026-09-07T00:00:00.000Z',
      );
      expect(savedA.ok).toBe(true);

      setCurrentLocalDataNamespace(userBNamespace);
      expect(await loadSchedulerPlanState()).toEqual({ status: 'missing' });
      const savedB = await buildAndPersistSchedulerPlan(
        model([candidate('user-b-later', '11:00', '12:00')]),
        undefined,
        '2026-09-07T00:01:00.000Z',
      );
      expect(savedB.ok).toBe(true);

      setCurrentLocalDataNamespace(userANamespace);
      const loadedA = await loadSchedulerPlanState();
      if (loadedA.status !== 'ok') throw new Error('Expected user A scheduler state.');
      expect(loadedA.plan.placements[0].start).toBe('09:00');

      setCurrentLocalDataNamespace(userBNamespace);
      const loadedB = await loadSchedulerPlanState();
      if (loadedB.status !== 'ok') throw new Error('Expected user B scheduler state.');
      expect(loadedB.plan.placements[0].start).toBe('11:00');
    } finally {
      resetCurrentLocalDataNamespace();
      await userADatabase.delete();
      await userBDatabase.delete();
    }
  });

  it('upgrades a real version-3 IndexedDB without losing an existing row', async () => {
    databaseIndex += 1;
    const databaseName = `life-rhythm-scheduler-plan-upgrade-test-${databaseIndex}`;
    const legacy = new Dexie(databaseName);
    legacy.version(3).stores(version3Stores);

    try {
      await legacy.table('taskPoolItems').put({
        id: 'legacy-row',
        status: 'captured',
      });
      legacy.close();

      const upgraded = createLifeRhythmDatabase(databaseName);
      try {
        await upgraded.open();

        expect(DATABASE_VERSION).toBe(5);
        expect(upgraded.verno).toBe(5);
        expect(await upgraded.taskPoolItems.get('legacy-row')).toMatchObject({
          id: 'legacy-row',
          status: 'captured',
        });
        expect(upgraded.tables.map((table) => table.name)).toContain('schedulerPlanState');
        expect(upgraded.tables.map((table) => table.name)).toContain('calendarSources');
        expect(await upgraded.schedulerPlanState.count()).toBe(0);
        expect(await upgraded.calendarSources.count()).toBe(0);
      } finally {
        await upgraded.delete();
      }
    } finally {
      legacy.close();
    }
  });

  it('upgrades a real version-4 IndexedDB without losing scheduler plan state', async () => {
    databaseIndex += 1;
    const databaseName = `life-rhythm-calendar-source-upgrade-test-${databaseIndex}`;
    const version4 = new Dexie(databaseName);
    version4.version(4).stores(version4Stores);
    const storedPlan = {
      id: 'current',
      version: 1,
      updatedAt: '2026-09-07T00:00:00.000Z',
      plan: {
        placements: [],
        unscheduledIntentionIds: ['legacy-task'],
        unscheduledRhythmIds: [],
        rejectedExistingPlacements: [],
      },
    };

    try {
      await version4.table('schedulerPlanState').put(storedPlan);
      version4.close();

      const upgraded = createLifeRhythmDatabase(databaseName);
      try {
        await upgraded.open();

        expect(upgraded.verno).toBe(5);
        expect(upgraded.tables.map((table) => table.name)).toContain('calendarSources');
        expect(await upgraded.schedulerPlanState.get('current')).toEqual(storedPlan);
        expect(await upgraded.calendarSources.count()).toBe(0);
        const loaded = await loadSchedulerPlanState(upgraded);
        expect(loaded.status).toBe('ok');
        if (loaded.status === 'ok') {
          expect(loaded.plan.unscheduledIntentionIds).toEqual(['legacy-task']);
        }
      } finally {
        await upgraded.delete();
      }
    } finally {
      version4.close();
    }
  });

  it('keeps scheduler plan state blocked from settings/import passthrough data', () => {
    expect(findBlockedDataClassKey({ schedulerPlanState: { id: 'current' } })).toBe('schedulerPlanState');
    expect(findBlockedDataClassKey({ nested: { schedulerPlan: {} } })).toBe('nested.schedulerPlan');
  });
});
