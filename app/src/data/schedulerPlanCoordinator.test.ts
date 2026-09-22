import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  buildCurrentLiveSchedulingContext,
  ensureCurrentPrivatePlan,
  repairCurrentPrivatePlan,
  undoCurrentPrivatePlan,
} from './schedulerPlanCoordinator';
import { saveSchedulerPlanState } from './schedulerPlanStateRepository';
import { taskPoolItemSchema } from './schemas';
import { createDefaultSettings, saveSettings } from './settingsRepository';
import { scheduler } from '../domain/primaryScheduler';

const timestamp = '2026-09-07T00:00:00.000Z';
const monday = '2026-09-07';
const testNow = new Date('2026-09-06T23:30:00.000Z');
const timezone = 'Australia/Perth';
let namespaceIndex = 0;

function version(label: string, minutes: number) {
  return { label, minutes };
}

function task(id: string, minutes = 30) {
  return taskPoolItemSchema.parse({
    id,
    source: 'adhoc',
    title: id === 'task-a' ? 'Send the form' : 'Second task',
    area: 'admin',
    status: 'captured',
    minimum: version('Open it', minutes),
    normal: version('Do it', minutes),
    full: version('Finish it fully', minutes),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function saveLifeShape({
  timeBlocks = [],
  fixedCommitments = [],
}: {
  timeBlocks?: unknown[];
  fixedCommitments?: unknown[];
} = {}) {
  const defaults = createDefaultSettings(timestamp);
  const result = await saveSettings({
    theme: defaults.theme,
    startBoostSafety: defaults.startBoostSafety,
    lifeShape: {
      ...defaults.lifeShape,
      fixedCommitments,
      timeBlocks,
    },
  });

  expect(result.ok).toBe(true);
}

function coordinatorOptions(horizonDays = 1) {
  return {
    horizonDays,
    now: testNow,
    startDate: monday,
    timezone,
  };
}

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`gate4-live-plan-${namespaceIndex}`),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('live scheduler plan coordinator', () => {
  it('builds and persists an automatic private plan inside explicit available time when usable-day is not configured', async () => {
    await saveLifeShape({
      timeBlocks: [
        {
          id: 'monday-available',
          label: 'Monday available',
          type: 'openCapacity',
          schedulerUse: 'available',
          days: ['Monday'],
          start: '09:00',
          end: '10:00',
        },
      ],
    });
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a'));

    const result = await ensureCurrentPrivatePlan(coordinatorOptions());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe('built');
    expect(result.plan.placements).toEqual([
      expect.objectContaining({
        date: monday,
        intentionId: 'task-a',
        origin: 'scheduler',
        start: '09:00',
      }),
    ]);
    expect(result.warnings.some((warning) => warning.includes('explicit available Life Shape blocks'))).toBe(true);
    expect(await database.schedulerPlanState.count()).toBe(1);
    expect(await database.softPlacements.count()).toBe(0);
  });

  it('does not manufacture automatic capacity from blank time', async () => {
    await saveLifeShape();
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a'));

    const result = await ensureCurrentPrivatePlan(coordinatorOptions());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.placements).toEqual([]);
    expect(result.plan.unscheduledIntentionIds).toContain('task-a');
  });

  it('subtracts ask-first and fixed commitment time from the explicit-available fallback', async () => {
    await saveLifeShape({
      fixedCommitments: [
        {
          id: 'appointment',
          label: 'Appointment',
          days: ['Monday'],
          start: '09:00',
          end: '10:00',
          travelMinutes: 0,
          bufferMinutes: 0,
        },
      ],
      timeBlocks: [
        {
          id: 'available-window',
          label: 'Available window',
          type: 'openCapacity',
          schedulerUse: 'available',
          days: ['Monday'],
          start: '09:00',
          end: '12:00',
        },
        {
          id: 'ask-first-window',
          label: 'Ask first',
          type: 'looseTime',
          schedulerUse: 'askFirst',
          days: ['Monday'],
          start: '10:00',
          end: '11:00',
        },
      ],
    });
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a', 45));

    const result = await ensureCurrentPrivatePlan(coordinatorOptions());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.placements).toEqual([
      expect.objectContaining({
        intentionId: 'task-a',
        start: '11:00',
        end: '11:45',
      }),
    ]);
  });

  it('persists Changed metadata for a completion repair and restores the prior plan with one-step undo', async () => {
    await saveLifeShape({
      timeBlocks: [
        {
          id: 'monday-available',
          label: 'Monday available',
          type: 'openCapacity',
          schedulerUse: 'available',
          days: ['Monday'],
          start: '09:00',
          end: '10:00',
        },
      ],
    });
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a'));
    const initial = await ensureCurrentPrivatePlan(coordinatorOptions());

    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.plan.placements).toHaveLength(1);

    await database.taskPoolItems.put(
      taskPoolItemSchema.parse({
        ...task('task-a'),
        status: 'noLongerNeeded',
        updatedAt: '2026-09-07T00:10:00.000Z',
      }),
    );

    const repaired = await repairCurrentPrivatePlan({
      ...coordinatorOptions(),
      reason: 'Task completed.',
      trigger: 'completionChanged',
    });

    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.mode).toBe('repaired');
    expect(repaired.plan.placements).toEqual([]);
    expect(repaired.plan.repair?.changes).toEqual([
      expect.objectContaining({
        kind: 'removed',
        targetId: 'task-a',
      }),
    ]);
    expect(repaired.plan.repair?.undo.placements).toHaveLength(1);

    const undone = await undoCurrentPrivatePlan(coordinatorOptions());

    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.mode).toBe('undone');
    expect(undone.plan.placements).toHaveLength(1);
    expect(undone.plan.repair).toBeUndefined();
  });

  it('rebuilds current live inputs once when the first semantic repair is stale', async () => {
    await saveLifeShape({
      timeBlocks: [{
        id: 'monday-available',
        label: 'Monday available',
        type: 'openCapacity',
        schedulerUse: 'available',
        days: ['Monday'],
        start: '09:00',
        end: '10:00',
      }],
    });
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a'));
    const initial = await ensureCurrentPrivatePlan(coordinatorOptions());
    expect(initial.ok).toBe(true);

    const originalGet = database.schedulerPlanState.get.bind(database.schedulerPlanState);
    let getCount = 0;
    vi.spyOn(database.schedulerPlanState, 'get').mockImplementation((async (key: string) => {
      getCount += 1;
      const current = await originalGet(key);
      if (getCount === 2) {
        await database.taskPoolItems.put(taskPoolItemSchema.parse({
          ...task('task-a'),
          status: 'noLongerNeeded',
          updatedAt: '2026-09-07T00:10:00.000Z',
        }));
      }
      return current;
    }) as never);
    const repairPlan = vi.spyOn(scheduler, 'repairPlan');
    const put = vi.spyOn(database.schedulerPlanState, 'put');

    const result = await repairCurrentPrivatePlan({
      ...coordinatorOptions(),
      reason: 'Use current task-pool truth.',
      trigger: 'userCorrection',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.placements).toEqual([]);
    expect(repairPlan).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('stops after one fresh semantic retry when canonical inputs change twice', async () => {
    await saveLifeShape({
      timeBlocks: [{
        id: 'monday-available',
        label: 'Monday available',
        type: 'openCapacity',
        schedulerUse: 'available',
        days: ['Monday'],
        start: '09:00',
        end: '10:00',
      }],
    });
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a'));
    const initial = await ensureCurrentPrivatePlan(coordinatorOptions());
    expect(initial.ok).toBe(true);

    const originalGet = database.schedulerPlanState.get.bind(database.schedulerPlanState);
    let getCount = 0;
    let mutationCount = 0;
    vi.spyOn(database.schedulerPlanState, 'get').mockImplementation((async (key: string) => {
      getCount += 1;
      const current = await originalGet(key);
      if (getCount === 2 || getCount === 5) {
        mutationCount += 1;
        await database.taskPoolItems.put(taskPoolItemSchema.parse({
          ...task('task-a'),
          title: `Changed while repairing ${mutationCount}`,
          updatedAt: `2026-09-07T00:${10 + mutationCount}:00.000Z`,
        }));
      }
      return current;
    }) as never);
    const repairPlan = vi.spyOn(scheduler, 'repairPlan');
    const put = vi.spyOn(database.schedulerPlanState, 'put');

    const result = await repairCurrentPrivatePlan({
      ...coordinatorOptions(),
      reason: 'Bound contention.',
      trigger: 'userCorrection',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict).toBe('stale');
    expect(repairPlan).toHaveBeenCalledTimes(2);
    expect(put).not.toHaveBeenCalled();
  });

  it('uses one repair calculation and one write without contention', async () => {
    await saveLifeShape({
      timeBlocks: [{
        id: 'monday-available',
        label: 'Monday available',
        type: 'openCapacity',
        schedulerUse: 'available',
        days: ['Monday'],
        start: '09:00',
        end: '10:00',
      }],
    });
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a'));
    const initial = await ensureCurrentPrivatePlan(coordinatorOptions());
    expect(initial.ok).toBe(true);
    const repairPlan = vi.spyOn(scheduler, 'repairPlan');
    const put = vi.spyOn(database.schedulerPlanState, 'put');

    const result = await repairCurrentPrivatePlan({
      ...coordinatorOptions(),
      reason: 'Ordinary repair.',
      trigger: 'userCorrection',
    });

    expect(result.ok).toBe(true);
    expect(repairPlan).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('loads a concurrently accepted initial plan instead of forcing an obsolete build', async () => {
    await saveLifeShape({
      timeBlocks: [{
        id: 'monday-available',
        label: 'Monday available',
        type: 'openCapacity',
        schedulerUse: 'available',
        days: ['Monday'],
        start: '09:00',
        end: '10:00',
      }],
    });
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a'));
    const live = await buildCurrentLiveSchedulingContext(coordinatorOptions());
    if (!live.ok) throw new Error(live.errors.join(' '));
    const acceptedPlan = scheduler.buildPlan(live.context.input);

    const originalGet = database.schedulerPlanState.get.bind(database.schedulerPlanState);
    let getCount = 0;
    const getSpy = vi.spyOn(database.schedulerPlanState, 'get');
    getSpy.mockImplementation((async (key: string) => {
      getCount += 1;
      const current = await originalGet(key);
      if (getCount === 3) {
        getSpy.mockRestore();
        const saved = await saveSchedulerPlanState(
          acceptedPlan,
          database,
          '2026-09-07T00:05:00.000Z',
        );
        expect(saved.ok).toBe(true);
      }
      return current;
    }) as never);

    const result = await ensureCurrentPrivatePlan(coordinatorOptions());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe('loaded');
    expect(result.updatedAt).toBe('2026-09-07T00:05:00.000Z');
    expect(result.plan).toEqual(acceptedPlan);
  });

  it('fails closed when persisted scheduler state is malformed', async () => {
    await saveLifeShape({
      timeBlocks: [
        {
          id: 'monday-available',
          label: 'Monday available',
          type: 'openCapacity',
          schedulerUse: 'available',
          days: ['Monday'],
          start: '09:00',
          end: '10:00',
        },
      ],
    });
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put(task('task-a'));
    await database.schedulerPlanState.put({
      id: 'current',
      version: 1,
      updatedAt: 'not-an-instant',
      plan: {},
    } as never);

    const result = await ensureCurrentPrivatePlan(coordinatorOptions());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(await database.schedulerPlanState.count()).toBe(1);
    expect(await database.softPlacements.count()).toBe(0);
  });
});
