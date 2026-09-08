import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activeTaskSchema } from './schemas';
import { saveSettings, createDefaultSettings } from './settingsRepository';
import {
  createAuthLocalDataNamespace,
  getLifeRhythmDatabaseForNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  applyReduceToday,
  loadTodayDayMode,
  previewReduceToday,
  returnTodayToNormal,
  undoTodayPlanChange,
} from './reducedDayCoordinator';
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';
import { ensureCurrentPrivatePlan, repairCurrentPrivatePlan } from './schedulerPlanCoordinator';

const timezone = 'Australia/Perth';
const today = new Date('2026-09-07T00:00:00.000Z'); // 08:00 Perth
let index = 0;
let database: ReturnType<typeof getLifeRhythmDatabaseForNamespace>;

function task(id: string, title = id) {
  return activeTaskSchema.parse({
    id, title, area: 'admin', purpose: 'Synthetic Reduced Day test task.', source: 'adhoc',
    status: 'active', showToday: true,
    minimum: { label: 'Open it.', minutes: 5 },
    normal: { label: 'Complete it.', minutes: 20 },
    full: { label: 'Complete and review it.', minutes: 40 },
    createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
  });
}

async function options(now = today) {
  return { now, startDate: '2026-09-07', horizonDays: 2, timezone };
}

beforeEach(async () => {
  const namespace = createAuthLocalDataNamespace(`reduced-day-${index += 1}`);
  setCurrentLocalDataNamespace(namespace);
  database = getLifeRhythmDatabaseForNamespace(namespace);
  await database.open();
  const defaults = createDefaultSettings('2026-09-07T00:00:00.000Z');
  await saveSettings({
    theme: defaults.theme,
    startBoostSafety: defaults.startBoostSafety,
    lifeShape: {
      ...defaults.lifeShape,
      timeBlocks: [{
        id: 'available', label: 'Synthetic available time', type: 'openCapacity',
        days: ['Monday', 'Tuesday'], start: '09:00', end: '12:00', schedulerUse: 'available',
      }],
    },
  }, database);
  await database.activeTasks.put(task('pay-bill', 'Pay water bill'));
});

afterEach(async () => {
  const name = database.name;
  database.close();
  await indexedDB.deleteDatabase(name);
  resetCurrentLocalDataNamespace();
});

describe('Reduce today coordinator', () => {
  it('previews through the real scheduler without writing, then recomputes live state on Apply', async () => {
    const preview = await previewReduceToday(await options());
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.plan.placements.find((placement) => placement.intentionId === 'pay-bill')).toMatchObject({
      date: '2026-09-07', variantKind: 'minimum', start: '09:00', end: '09:05',
    });
    expect(await database.schedulerPlanState.count()).toBe(0);

    await database.activeTasks.put(task('added-after-preview', 'Added after preview'));
    const applied = await applyReduceToday(await options());
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.plan.placements.some((placement) => placement.intentionId === 'added-after-preview')).toBe(true);
    expect(applied.plan.placements.filter((placement) => placement.date === '2026-09-07')
      .every((placement) => placement.variantKind === 'minimum')).toBe(true);
    expect((await loadSchedulerPlanState(database))).toMatchObject({
      status: 'ok', dayModeContext: { dayMode: 'reduced', date: '2026-09-07' },
    });
  });

  it('keeps the same-date mode on reload, starts the next local date Normal, and Undo restores plan plus mode', async () => {
    const first = await applyReduceToday(await options());
    expect(first.ok).toBe(true);
    expect(await loadTodayDayMode(await options())).toMatchObject({ ok: true, dayMode: 'reduced', date: '2026-09-07' });
    expect(await loadTodayDayMode({
      now: new Date('2026-09-08T00:00:00.000Z'), startDate: '2026-09-08', horizonDays: 1, timezone,
    })).toMatchObject({ ok: true, dayMode: 'normal', date: '2026-09-08' });

    const undone = await undoTodayPlanChange(await options());
    expect(undone.ok).toBe(false); // first-build invocation has no imaginary prior plan

    const normal = await returnTodayToNormal(await options());
    expect(normal.ok).toBe(true);
    if (!normal.ok) return;
    expect(normal.dayMode).toBe('normal');
    expect(normal.plan.placements.find((placement) => placement.intentionId === 'pay-bill')).toMatchObject({
      variantKind: 'normal', end: '09:20',
    });
    const undoReturn = await undoTodayPlanChange(await options());
    expect(undoReturn.ok).toBe(true);
    if (undoReturn.ok) expect(undoReturn.dayMode).toBe('reduced');
  });

  it('restores a real prior plan on immediate Undo and retains Reduced Day through later repair Undo', async () => {
    const before = await ensureCurrentPrivatePlan(await options());
    expect(before.ok).toBe(true);
    const applied = await applyReduceToday(await options());
    expect(applied.ok).toBe(true);
    if (!applied.ok || !before.ok) return;
    expect(applied.plan.repair?.changes).toEqual([
      expect.objectContaining({
        kind: 'variantChanged', targetId: 'pay-bill',
        from: expect.objectContaining({ variantKind: 'normal' }),
        to: expect.objectContaining({ variantKind: 'minimum' }),
        reason: expect.stringContaining('Reduced Day'),
      }),
    ]);
    const immediateUndo = await undoTodayPlanChange(await options());
    expect(immediateUndo.ok).toBe(true);
    if (!immediateUndo.ok) return;
    expect(immediateUndo.dayMode).toBe('normal');
    expect(immediateUndo.plan).toEqual(before.plan);

    await applyReduceToday(await options());
    const laterRepair = await repairCurrentPrivatePlan({
      ...(await options()), reason: 'Later same-day repair', trigger: 'manualReplan',
    });
    expect(laterRepair.ok).toBe(true);
    if (laterRepair.ok) {
      expect(laterRepair.plan.placements.find((placement) => placement.intentionId === 'pay-bill'))
        .toMatchObject({ variantKind: 'minimum' });
    }
    const undoRepair = await undoTodayPlanChange(await options());
    expect(undoRepair.ok).toBe(true);
    if (undoRepair.ok) expect(undoRepair.dayMode).toBe('reduced');
  });
});
