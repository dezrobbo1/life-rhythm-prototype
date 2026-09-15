// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveActiveTodayTask } from '../../data/activeTaskRepository';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import {
  loadSchedulerPlanState,
  saveSchedulerPlanState,
} from '../../data/schedulerPlanStateRepository';
import { applyReduceToday } from '../../data/reducedDayCoordinator';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';
import { activeTaskSchema } from '../../data/schemas';
import type { SchedulerPlan } from '../../domain/schedulingModel';
import { scheduler } from '../../domain/primaryScheduler';
import { TodayScreen } from '../../screens/TodayScreen';

let databaseIndex = 0;

function emptyPlan(): SchedulerPlan {
  return {
    placements: [],
    rejectedExistingPlacements: [],
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
  };
}

describe('Today Changed persistence boundary', () => {
  afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    await getCurrentLifeRhythmDatabase().delete();
    resetCurrentLocalDataNamespace();
  });

  it('rereads the persisted date-scoped mode at local midnight without plan work or writes', async () => {
    const shortlyBeforeLocalMidnight = new Date(2026, 8, 15, 23, 59, 30);
    const namespace = createAuthLocalDataNamespace(`today-midnight-${databaseIndex += 1}`);
    setCurrentLocalDataNamespace(namespace);
    const database = getCurrentLifeRhythmDatabase();
    const defaults = createDefaultSettings('2026-09-15T00:00:00.000Z');
    expect((await saveSettings({
      theme: defaults.theme,
      startBoostSafety: defaults.startBoostSafety,
      lifeShape: {
        ...defaults.lifeShape,
        timeBlocks: [{
          id: 'available', label: 'Synthetic available time', type: 'openCapacity',
          days: ['Tuesday', 'Wednesday'], start: '09:00', end: '12:00',
          schedulerUse: 'available',
        }],
      },
    }, database)).ok).toBe(true);
    const task = activeTaskSchema.parse({
      area: 'admin',
      createdAt: '2026-09-15T00:00:00.000Z',
      full: { label: 'Finish and file it.', minutes: 40 },
      id: 'midnight-task',
      minimum: { label: 'Open it.', minutes: 5 },
      normal: { label: 'Complete it.', minutes: 20 },
      purpose: 'Exercise date-scoped mode presentation.',
      showToday: true,
      source: 'adhoc',
      status: 'active',
      title: 'Midnight task',
      updatedAt: '2026-09-15T00:00:00.000Z',
    });
    expect((await saveActiveTodayTask(task, database)).ok).toBe(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const applied = await applyReduceToday({
      horizonDays: 2,
      now: shortlyBeforeLocalMidnight,
      startDate: '2026-09-15',
      timezone,
    });
    expect(applied.ok).toBe(true);
    const persistedBefore = await loadSchedulerPlanState(database);
    expect(persistedBefore).toMatchObject({
      status: 'ok',
      dayModeContext: { dayMode: 'reduced', date: '2026-09-15' },
    });

    const realSetTimeout = globalThis.setTimeout;
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(shortlyBeforeLocalMidnight);
    const buildSpy = vi.spyOn(scheduler, 'buildPlan');
    const repairSpy = vi.spyOn(scheduler, 'repairPlan');
    const putSpy = vi.spyOn(database.schedulerPlanState, 'put');
    const settingsPutSpy = vi.spyOn(database.settings, 'put');
    render(<TodayScreen />);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => realSetTimeout(resolve, 10));
      });
      if (!screen.queryByText('Reading today’s recorded plan...')) break;
    }
    expect(screen.getByText('Reduced Day active')).toBeTruthy();
    expect(screen.getByText('Tuesday, September 15')).toBeTruthy();
    expect(screen.queryByText('Reading today’s recorded plan...')).toBeNull();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    buildSpy.mockClear();
    repairSpy.mockClear();
    putSpy.mockClear();
    settingsPutSpy.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync((30 * 1000) + 1);
    });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => realSetTimeout(resolve, 10));
      });
      if (!screen.queryByText('Reading today’s day mode...') &&
          !screen.queryByText('Reading today’s recorded plan...')) break;
    }

    expect(screen.getByText('Wednesday, September 16')).toBeTruthy();
    expect(screen.queryByText('Reduced Day active')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reduce today' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Return to normal day' })).toBeNull();
    expect(await loadSchedulerPlanState(database)).toEqual(persistedBefore);
    expect(buildSpy).not.toHaveBeenCalled();
    expect(repairSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
    expect(settingsPutSpy).not.toHaveBeenCalled();
  });

  it('uses the existing one-step Undo authority for an atomic Reduced Day plan-and-mode change', async () => {
    const namespace = createAuthLocalDataNamespace(`today-changed-${databaseIndex += 1}`);
    setCurrentLocalDataNamespace(namespace);
    const database = getCurrentLifeRhythmDatabase();
    const task = activeTaskSchema.parse({
      area: 'money',
      createdAt: '2026-09-15T00:00:00.000Z',
      full: { label: 'Pay and file the receipt.', minutes: 20 },
      id: 'pay-water-bill',
      minimum: { label: 'Open the bill.', minutes: 5 },
      normal: { label: 'Check the amount.', minutes: 10 },
      purpose: 'Keep the payment visible.',
      showToday: true,
      source: 'adhoc',
      status: 'active',
      title: 'Pay water bill',
      updatedAt: '2026-09-15T00:00:00.000Z',
    });
    const before = emptyPlan();
    const repaired: SchedulerPlan = {
      ...emptyPlan(),
      repair: {
        changes: [{
          from: { date: '2026-09-15', start: '11:00', end: '11:10', variantKind: 'normal' },
          kind: 'removed',
          reason: 'Reduce today was applied to the current local date.',
          targetId: task.id,
          targetKind: 'intention',
        }],
        frozenPastPlacementIds: [],
        preservedPlacementIds: [],
        reason: 'Reduce today was applied to the current local date.',
        trigger: 'userCorrection',
        undo: before,
      },
    };

    expect((await saveActiveTodayTask(task, database)).ok).toBe(true);
    expect((await saveSchedulerPlanState(
      repaired,
      database,
      '2026-09-15T01:00:00.000Z',
      {
        dayModeContext: { dayMode: 'reduced', date: '2026-09-15' },
        undoDayModeContext: null,
      },
    )).ok).toBe(true);

    const user = userEvent.setup();
    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Changed' })).toBeTruthy();
    const changed = screen.getByRole('region', { name: 'Changed' });
    expect(within(changed).getByText('Pay water bill')).toBeTruthy();
    expect(within(changed).getByText('Reduced Day changed the private plan.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo last change' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Changed' })).toBeNull();
    });
    const reloaded = await loadSchedulerPlanState(database);
    expect(reloaded.status).toBe('ok');
    if (reloaded.status === 'ok') {
      expect(reloaded.plan).toEqual(before);
      expect(reloaded.dayModeContext).toBeUndefined();
    }
  });
});
