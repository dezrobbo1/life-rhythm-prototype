import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { activeTaskSchema } from './schemas';
import { ensureCurrentPrivatePlan } from './schedulerPlanCoordinator';
import { createDefaultSettings, saveSettings } from './settingsRepository';
import { maintainCurrentPrivatePlanForTimeDisruption } from './schedulerTimeDisruption';

const monday = '2026-09-07';
const timezone = 'Australia/Perth';
let namespaceIndex = 0;

function localTime(hour: number, minute: number) {
  return new Date(Date.UTC(2026, 8, 7, hour - 8, minute, 0));
}

function options(hour: number, minute: number) {
  return {
    horizonDays: 1,
    now: localTime(hour, minute),
    startDate: monday,
    timezone,
  };
}

function activeTask(id: string, status: 'active' | 'inProgress') {
  return activeTaskSchema.parse({
    id,
    source: 'adhoc',
    title: id === 'task-a' ? 'First private task' : 'Second private task',
    area: 'admin',
    status,
    minimum: { label: 'Open it', minutes: 5 },
    normal: { label: 'Do it', minutes: 20 },
    full: { label: 'Finish it', minutes: 40 },
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  });
}

async function configureMondayCapacity() {
  const defaults = createDefaultSettings('2026-09-05T00:00:00.000Z');
  const saved = await saveSettings({
    theme: defaults.theme,
    startBoostSafety: defaults.startBoostSafety,
    lifeShape: {
      ...defaults.lifeShape,
      timeBlocks: [
        {
          id: 'monday-available',
          label: 'Monday available',
          type: 'openCapacity',
          schedulerUse: 'available',
          days: ['Monday'],
          start: '09:00',
          end: '12:00',
        },
      ],
    },
  });
  expect(saved.ok).toBe(true);
}

function placementFor(
  plan: { placements: Array<{ intentionId: string; start: string; end: string; id: string }> },
  intentionId: string,
) {
  return plan.placements.find((placement) => placement.intentionId === intentionId);
}

async function createInitialPlan() {
  const built = await ensureCurrentPrivatePlan(options(8, 0));
  expect(built.ok).toBe(true);
  if (!built.ok) throw new Error(built.errors.join(' '));
  return built.plan;
}

beforeEach(async () => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`scheduler-time-disruption-${namespaceIndex}`),
  );
  await configureMondayCapacity();
});

describe('live Gate 4 time disruption maintenance', () => {
  it('does not create a scheduler plan merely because the app-level watcher runs', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.activeTasks.put(activeTask('task-a', 'active'));

    const result = await maintainCurrentPrivatePlanForTimeDisruption(options(9, 21));

    expect(result).toMatchObject({ ok: true, action: 'none' });
    expect(await database.schedulerPlanState.count()).toBe(0);
  });

  it('repairs elapsed not-started placements as a missed start without minute-by-minute churn', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.activeTasks.put(activeTask('task-a', 'active'));
    await database.activeTasks.put(activeTask('task-b', 'active'));

    const before = await createInitialPlan();
    expect(placementFor(before, 'task-a')).toMatchObject({ start: '09:00', end: '09:20' });
    expect(placementFor(before, 'task-b')).toMatchObject({ start: '09:20', end: '09:40' });

    const repaired = await maintainCurrentPrivatePlanForTimeDisruption(options(9, 21));
    expect(repaired.ok).toBe(true);
    if (!repaired.ok || repaired.action !== 'repaired') return;
    expect(repaired.trigger).toBe('missedStart');
    expect(repaired.releasedPlacementIds).toHaveLength(2);
    expect(placementFor(repaired.plan, 'task-a')).toMatchObject({ start: '09:21', end: '09:41' });
    expect(placementFor(repaired.plan, 'task-b')).toMatchObject({ start: '09:41', end: '10:01' });
    expect(repaired.plan.repair?.trigger).toBe('missedStart');

    const oneMinuteLater = await maintainCurrentPrivatePlanForTimeDisruption(options(9, 22));
    expect(oneMinuteLater).toMatchObject({ ok: true, action: 'none' });
  });

  it('uses an in-progress overrun to repair later elapsed private work while preserving the running task', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.activeTasks.put(activeTask('task-a', 'inProgress'));
    await database.activeTasks.put(activeTask('task-b', 'active'));

    const before = await createInitialPlan();
    const runningBefore = placementFor(before, 'task-a');
    const secondBefore = placementFor(before, 'task-b');
    expect(runningBefore).toMatchObject({ start: '09:00', end: '09:20' });
    expect(secondBefore).toMatchObject({ start: '09:20', end: '09:40' });

    const repaired = await maintainCurrentPrivatePlanForTimeDisruption(options(9, 41));
    expect(repaired.ok).toBe(true);
    if (!repaired.ok || repaired.action !== 'repaired') return;
    expect(repaired.trigger).toBe('overrun');
    expect(placementFor(repaired.plan, 'task-a')).toEqual(runningBefore);
    expect(placementFor(repaired.plan, 'task-b')).toMatchObject({ start: '09:41', end: '10:01' });
    expect(repaired.plan.repair?.trigger).toBe('overrun');

    const oneMinuteLater = await maintainCurrentPrivatePlanForTimeDisruption(options(9, 42));
    expect(oneMinuteLater).toMatchObject({ ok: true, action: 'none' });
  });

  it('does not call a one-minute-late task a missed start before its planned slot has elapsed', async () => {
    await getCurrentLifeRhythmDatabase().activeTasks.put(activeTask('task-a', 'active'));
    await createInitialPlan();

    const check = await maintainCurrentPrivatePlanForTimeDisruption(options(9, 1));
    expect(check).toMatchObject({ ok: true, action: 'none' });
  });
});
