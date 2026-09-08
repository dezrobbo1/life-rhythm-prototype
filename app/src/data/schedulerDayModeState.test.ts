import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createLifeRhythmDatabase, type LifeRhythmDatabase } from './db';
import {
  buildAndPersistSchedulerPlan,
  loadSchedulerPlanState,
  repairAndPersistSchedulerPlan,
  undoPersistedSchedulerRepair,
} from './schedulerPlanStateRepository';
import type { InternalIntention, SchedulingDomainModel } from '../domain/schedulingModel';

const timezone = 'Australia/Perth';
let database: LifeRhythmDatabase | undefined;
let index = 0;

function intention(id: string): InternalIntention {
  return {
    id, title: id, area: 'admin', taskType: 'admin', priority: 'normal',
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 5 },
      { kind: 'normal', label: 'Normal', minutes: 20 },
    ],
    timing: { timeConstraint: 'flexible' }, lifecycle: { activeTaskStatus: 'active' },
    eligibleForScheduling: true, sourceRecords: [{ kind: 'activeTask', id }],
  };
}

function input(dayMode: 'normal' | 'reduced', dayModeDate?: string): SchedulingDomainModel {
  return {
    intentions: [intention('today-task'), intention('tomorrow-task')], rhythms: [],
    externalCommitments: [], capacityWindows: [], placements: [], dayProfiles: [],
    candidateIntervals: [
      { id: 'today', date: '2026-09-07', start: '09:00', end: '10:00', timezone,
        capacityMeaning: 'candidate-not-capacity', provenance: ['Test.'] },
      { id: 'tomorrow', date: '2026-09-08', start: '09:00', end: '10:00', timezone,
        capacityMeaning: 'candidate-not-capacity', provenance: ['Test.'] },
    ],
    planningPolicy: { dayMode, ...(dayModeDate ? { dayModeDate } : {}) },
  };
}

async function db() {
  database = createLifeRhythmDatabase(`day-mode-${index += 1}`);
  await database.open();
  return database;
}

afterEach(async () => {
  if (database) {
    const name = database.name;
    database.close();
    await indexedDB.deleteDatabase(name);
    database = undefined;
  }
});

describe('persisted date-scoped scheduler day mode', () => {
  it('stores Reduced Day with its date and Undo restores both the prior plan and mode', async () => {
    const store = await db();
    const before = await buildAndPersistSchedulerPlan(input('normal'), store, '2026-09-07T00:00:00.000Z');
    expect(before.ok).toBe(true);

    const applied = await repairAndPersistSchedulerPlan({
      reason: 'Reduce today', trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone },
      nextInput: input('reduced', '2026-09-07'),
    }, store, '2026-09-07T00:01:00.000Z', { dayMode: 'reduced', date: '2026-09-07' });
    expect(applied.ok).toBe(true);
    if (!applied.ok || !before.ok) return;
    expect(applied.dayModeContext).toEqual({ dayMode: 'reduced', date: '2026-09-07' });
    expect(applied.plan.placements.find((item) => item.intentionId === 'today-task')).toMatchObject({
      date: '2026-09-07', variantKind: 'minimum', end: '09:05',
    });
    expect(applied.plan.placements.find((item) => item.intentionId === 'tomorrow-task')).toMatchObject({
      date: '2026-09-07', variantKind: 'minimum', end: '09:25',
    });
    expect(applied.plan.repair?.changes.every((change) => change.to?.date !== '2026-09-08')).toBe(true);

    const undone = await undoPersistedSchedulerRepair(store, '2026-09-07T00:02:00.000Z');
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.plan).toEqual(before.plan);
    expect(undone.dayModeContext).toBeUndefined();
    expect((await loadSchedulerPlanState(store))).toMatchObject({ status: 'ok', plan: before.plan });
  });

  it('keeps Reduced Day through same-date repair and its Undo, then expires it on the next date', async () => {
    const store = await db();
    await buildAndPersistSchedulerPlan(input('reduced', '2026-09-07'), store, undefined, {
      dayMode: 'reduced', date: '2026-09-07',
    });
    const sameDay = await repairAndPersistSchedulerPlan({
      reason: 'Later repair', trigger: 'manualReplan',
      now: { date: '2026-09-07', time: '08:10', timezone }, nextInput: input('reduced', '2026-09-07'),
    }, store);
    expect(sameDay.ok && sameDay.dayModeContext).toEqual({ dayMode: 'reduced', date: '2026-09-07' });
    const undone = await undoPersistedSchedulerRepair(store);
    expect(undone.ok && undone.dayModeContext).toEqual({ dayMode: 'reduced', date: '2026-09-07' });

    const nextDay = await repairAndPersistSchedulerPlan({
      reason: 'Next local date', trigger: 'manualReplan',
      now: { date: '2026-09-08', time: '08:00', timezone }, nextInput: input('normal'),
    }, store);
    expect(nextDay.ok).toBe(true);
    if (nextDay.ok) expect(nextDay.dayModeContext).toBeUndefined();
  });

  it('rejects malformed stored mode context without replacing the saved row', async () => {
    const store = await db();
    const built = await buildAndPersistSchedulerPlan(input('normal'), store);
    expect(built.ok).toBe(true);
    const valid = await store.schedulerPlanState.get('current');
    await store.schedulerPlanState.put({ ...valid, dayModeContext: { dayMode: 'reduced', date: 'not-a-date' } } as never);
    const loaded = await loadSchedulerPlanState(store);
    expect(loaded.status).toBe('invalid');
    const repair = await repairAndPersistSchedulerPlan({
      reason: 'Unsafe', trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone }, nextInput: input('reduced', '2026-09-07'),
    }, store);
    expect(repair.ok).toBe(false);
  });

  it('leaves the previous plan and mode unchanged when the atomic record write fails', async () => {
    const store = await db();
    const built = await buildAndPersistSchedulerPlan(input('normal'), store);
    expect(built.ok).toBe(true);
    const before = await store.schedulerPlanState.get('current');
    const failingStore = {
      schedulerPlanState: {
        get: store.schedulerPlanState.get.bind(store.schedulerPlanState),
        delete: store.schedulerPlanState.delete.bind(store.schedulerPlanState),
        put: async () => { throw new Error('Synthetic write failure'); },
      },
    };
    const result = await repairAndPersistSchedulerPlan({
      reason: 'Reduce today', trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone },
      nextInput: input('reduced', '2026-09-07'),
    }, failingStore as never, undefined, { dayMode: 'reduced', date: '2026-09-07' });
    expect(result).toEqual({ ok: false, errors: ['schedulerPlanState: Saved scheduler state could not be written.'] });
    expect(await store.schedulerPlanState.get('current')).toEqual(before);
  });
});
