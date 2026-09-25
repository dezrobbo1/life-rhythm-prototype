import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { activeTaskSchema, taskPoolItemSchema } from './schemas';
import {
  loadSchedulerPlanState, repairAndPersistSchedulerPlan, saveSchedulerPlanState,
  undoPersistedSchedulerRepair,
} from './schedulerPlanStateRepository';
import { canonicalSchedulingInputSnapshot, readCanonicalSchedulingInputRows } from './schedulerCanonicalInputSnapshot';
import { updateUserTaskDefinition, type UserTaskDefinition } from './taskDefinitionRepository';
import { saveActiveTodayTask } from './activeTaskRepository';
import { saveTaskPoolItem } from './taskPoolRepository';

const initial = '2026-09-20T00:00:00.000Z';
let serial = 0;

function versions() {
  return {
    minimum: { label: 'Open it', minutes: 5 },
    normal: { label: 'Do it', minutes: 10 },
    full: { label: 'Finish it', minutes: 20 },
  };
}

function definition(): UserTaskDefinition {
  return {
    title: 'Corrected title', area: 'admin',
    minimum: { label: 'Read it', minutes: 8 },
    normal: { label: 'Draft it', minutes: 27 },
    full: { label: 'Finish it', minutes: 49 },
    timeConstraint: 'dueBy', dueAt: '2026-10-02T04:30:00.000Z',
    minimumStillUsefulAfterDeadline: true,
  };
}

function database() {
  serial += 1;
  return createLifeRhythmDatabase(`gate8a1-task-definition-${serial}`);
}

async function linkedTask(db: ReturnType<typeof database>) {
  await db.taskPoolItems.put(taskPoolItemSchema.parse({
    id: 'task-1', title: 'Old title', area: 'admin', source: 'adhoc',
    status: 'today', createdAt: initial, updatedAt: initial, ...versions(), notes: 'Keep this note',
  }));
  await db.activeTasks.put(activeTaskSchema.parse({
    id: 'task-1', title: 'Old title', area: 'admin', source: 'adhoc',
    status: 'active', showToday: true, createdAt: initial, updatedAt: initial, ...versions(),
  }));
}

async function acceptedPlan(db: ReturnType<typeof database>) {
  const result = await saveSchedulerPlanState({
    placements: [], rejectedExistingPlacements: [],
    unscheduledIntentionIds: [], unscheduledRhythmIds: [],
  }, db, initial);
  expect(result.ok).toBe(true);
}

afterEach(() => vi.restoreAllMocks());

describe('user-created task definition correction', () => {
  it('marks an accepted plan within the same transaction as new Capture and Add one-off writes', async () => {
    const db = database();
    try {
      await acceptedPlan(db);
      const pool = taskPoolItemSchema.parse({
        id: 'captured-task', title: 'Captured task', area: 'admin', source: 'adhoc',
        status: 'captured', createdAt: initial, updatedAt: initial, ...versions(),
      });
      expect(await saveTaskPoolItem(pool, db)).toMatchObject({ ok: true });
      expect(await loadSchedulerPlanState(db)).toMatchObject({
        status: 'ok', taskInputRepairTargetIds: ['captured-task'],
      });
      const active = activeTaskSchema.parse({
        id: 'today-task', title: 'Today task', area: 'admin', source: 'adhoc',
        status: 'active', showToday: true, createdAt: initial, updatedAt: initial, ...versions(),
      });
      expect(await saveActiveTodayTask(active, db)).toMatchObject({ ok: true });
      expect(await loadSchedulerPlanState(db)).toMatchObject({
        status: 'ok', taskInputRepairTargetIds: ['captured-task', 'today-task'],
      });
    } finally { await db.delete(); }
  });

  it('edits linked Held and Today rows atomically, preserves identity/status/history, and marks the plan pending', async () => {
    const db = database();
    try {
      await linkedTask(db);
      await acceptedPlan(db);
      const result = await updateUserTaskDefinition('task-1', initial, 'today', definition(), db);
      expect(result.ok).toBe(true);
      expect(await db.taskPoolItems.get('task-1')).toMatchObject({
        id: 'task-1', status: 'today', createdAt: initial, title: 'Corrected title',
        notes: 'Keep this note', normal: { label: 'Draft it', minutes: 27 },
      });
      expect(await db.activeTasks.get('task-1')).toMatchObject({
        id: 'task-1', status: 'active', createdAt: initial, title: 'Corrected title',
        minimum: { minutes: 8 }, full: { minutes: 49 },
        timeConstraint: 'dueBy', dueAt: '2026-10-02T04:30:00.000Z',
      });
      expect(await db.taskHistory.count()).toBe(0);
      expect(await loadSchedulerPlanState(db)).toMatchObject({
        status: 'ok', taskInputRepairTargetIds: ['task-1'],
        taskInputRepairPendingAt: expect.any(String),
      });
      expect(await updateUserTaskDefinition('task-1', initial, 'today', definition(), db))
        .toMatchObject({ ok: false, errors: [expect.stringContaining('changed elsewhere')] });
    } finally { await db.delete(); }
  });

  it('clears pending attention only after a repair against current canonical inputs', async () => {
    const db = database();
    try {
      await linkedTask(db);
      await acceptedPlan(db);
      expect(await updateUserTaskDefinition('task-1', initial, 'today', definition(), db))
        .toMatchObject({ ok: true });
      const nextInput = {
        intentions: [{
          id: 'task-1', title: 'Corrected title', area: 'admin',
          variants: [{ kind: 'normal' as const, label: 'Draft it', minutes: 27 }],
          timing: { timeConstraint: 'dueBy' as const, dueAt: '2026-10-02T04:30:00.000Z' },
          lifecycle: {}, eligibleForScheduling: true,
          sourceRecords: [{ kind: 'activeTask' as const, id: 'task-1' }],
        }],
        rhythms: [], externalCommitments: [], capacityWindows: [],
        placements: [], dayProfiles: [], candidateIntervals: [], preferences: [],
      };
      const repaired = await repairAndPersistSchedulerPlan({
        nextInput, reason: 'Corrected task definition', trigger: 'taskDefinitionChanged',
        now: { date: '2026-09-25', time: '09:00', timezone: 'Australia/Perth' },
      }, db, '2026-09-25T01:00:00.000Z', undefined, undefined,
      canonicalSchedulingInputSnapshot(await readCanonicalSchedulingInputRows(db)));
      expect(repaired.ok).toBe(true);
      expect(await loadSchedulerPlanState(db)).toMatchObject({ status: 'ok' });
      expect((await loadSchedulerPlanState(db))).not.toHaveProperty('taskInputRepairPendingAt');
      expect(await undoPersistedSchedulerRepair(db)).toMatchObject({
        ok: false, errors: [expect.stringContaining('Edit the task again')],
      });
    } finally { await db.delete(); }
  });

  it('leaves both rows unchanged if plan attention cannot be saved', async () => {
    const db = database();
    try {
      await linkedTask(db);
      await acceptedPlan(db);
      vi.spyOn(db.schedulerPlanState, 'update').mockRejectedValueOnce(new Error('disk full'));
      expect(await updateUserTaskDefinition('task-1', initial, 'today', definition(), db))
        .toMatchObject({ ok: false });
      expect(await db.taskPoolItems.get('task-1')).toMatchObject({ title: 'Old title', ...versions() });
      expect(await db.activeTasks.get('task-1')).toMatchObject({ title: 'Old title', ...versions() });
      expect(await loadSchedulerPlanState(db)).toMatchObject({ status: 'ok' });
    } finally { await db.delete(); }
  });

  it('does not replace malformed or reusable linked records while editing a user-created task', async () => {
    const db = database();
    try {
      await linkedTask(db);
      await db.activeTasks.put({ id: 'task-1', source: 'adhoc' } as never);
      expect(await updateUserTaskDefinition('task-1', initial, 'held', definition(), db))
        .toMatchObject({ ok: false, errors: [expect.stringContaining('read safely')] });
      expect(await db.taskPoolItems.get('task-1')).toMatchObject({ title: 'Old title' });
      expect(await db.activeTasks.get('task-1')).toEqual({ id: 'task-1', source: 'adhoc' });
    } finally { await db.delete(); }
  });
});
