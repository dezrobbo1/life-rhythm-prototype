// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { AppSnapshotProvider } from '../../data/AppSnapshotProvider';
import * as reducedDayCoordinator from '../../data/reducedDayCoordinator';
import * as planCoordinator from '../../data/schedulerPlanCoordinator';
import { loadSchedulerPlanState, saveSchedulerPlanState } from '../../data/schedulerPlanStateRepository';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';
import { scheduler } from '../../domain/primaryScheduler';
import type { SchedulerPlan } from '../../domain/schedulingModel';
import { TodayScreen } from '../../screens/TodayScreen';
import { emptyAppSnapshot } from '../../viewModels/fixtures';
import { ReducedDayControl } from './ReducedDayControl';

const realSetTimeout = globalThis.setTimeout;
let databaseIndex = 0;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function settleUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
    await act(async () => { await new Promise((resolve) => realSetTimeout(resolve, 10)); });
  }
  expect(predicate()).toBe(true);
}

async function seed(mode: 'normal' | 'reduced') {
  const database = getCurrentLifeRhythmDatabase();
  const defaults = createDefaultSettings('2026-09-15T00:00:00.000Z');
  expect((await saveSettings({
    theme: defaults.theme,
    startBoostSafety: defaults.startBoostSafety,
    lifeShape: defaults.lifeShape,
  }, database)).ok).toBe(true);
  const plan: SchedulerPlan = {
    placements: [{
      id: 'next-day-placement', intentionId: 'next-day-task', date: '2026-09-16',
      start: '09:00', end: '09:20', origin: 'scheduler', targetKind: 'intention',
      variantKind: 'normal', provenance: ['Synthetic accepted private plan.'],
    }],
    rejectedExistingPlacements: [], unscheduledIntentionIds: [], unscheduledRhythmIds: [],
  };
  expect((await saveSchedulerPlanState(plan, database, '2026-09-15T00:00:00.000Z', {
    ...(mode === 'reduced' ? { dayModeContext: { dayMode: 'reduced', date: '2026-09-15' } as const } : {}),
  })).ok).toBe(true);
  return database;
}

function watchWrites() {
  const database = getCurrentLifeRhythmDatabase();
  return [
    vi.spyOn(database.schedulerPlanState, 'put'),
    vi.spyOn(database.settings, 'put'),
    vi.spyOn(database.activeTasks, 'put'),
    vi.spyOn(scheduler, 'buildPlan'),
    vi.spyOn(scheduler, 'repairPlan'),
  ];
}

beforeEach(() => {
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`today-read-recovery-${databaseIndex += 1}`));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
});

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await getCurrentLifeRhythmDatabase().delete();
  resetCurrentLocalDataNamespace();
});

describe('PR #139 review read recovery', () => {
  it.each([
    ['result', 'normal'], ['result', 'reduced'],
    ['rejection', 'normal'], ['rejection', 'reduced'],
  ] as const)('retries a failed %s mode read and restores %s controls without writes', async (failure, mode) => {
    const database = await seed(mode);
    const before = await loadSchedulerPlanState(database);
    const writes = watchWrites();
    const onPlanChanged = vi.fn();
    const originalRead = reducedDayCoordinator.loadTodayDayMode;
    const retryResult = deferred<Awaited<ReturnType<typeof originalRead>>>();
    const read = vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode');
    if (failure === 'result') read.mockResolvedValueOnce({ ok: false, errors: ['Saved day mode could not be read.'] });
    else read.mockRejectedValueOnce(new Error('Transient read failure'));
    read.mockReturnValueOnce(retryResult.promise);
    const user = userEvent.setup();
    render(<ReducedDayControl onPlanChanged={onPlanChanged} showUndo={false} />);
    const control = screen.getByLabelText('Reduced Day controls');
    await within(control).findByRole('alert');
    expect(within(control).queryByRole('button', { name: 'Reduce today' })).toBeNull();
    expect(within(control).queryByRole('button', { name: 'Return to normal day' })).toBeNull();

    const retry = within(control).getByRole('button', { name: 'Retry day mode' });
    retry.focus();
    await user.keyboard('{Enter}');
    expect(within(control).getByText('Reading today’s day mode...')).toBeTruthy();
    expect(within(control).queryByRole('alert')).toBeNull();
    expect(within(control).queryByRole('button', { name: 'Reduce today' })).toBeNull();
    expect(within(control).queryByRole('button', { name: 'Return to normal day' })).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls).toEqual([[{ readOnly: true }], [{ readOnly: true }]]);

    const recovered = await originalRead({ readOnly: true });
    await act(async () => { retryResult.resolve(recovered); });
    const action = await within(control).findByRole('button', {
      name: mode === 'normal' ? 'Reduce today' : 'Return to normal day',
    });
    expect(document.activeElement).toBe(action);
    expect(within(control).queryByRole('alert')).toBeNull();
    expect(await loadSchedulerPlanState(database)).toEqual(before);
    expect(onPlanChanged).not.toHaveBeenCalled();
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  it('retains a retry after repeated failures rather than claiming Normal', async () => {
    await seed('normal');
    const read = vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode')
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce({ ok: false, errors: ['Still unavailable.'] });
    const user = userEvent.setup();
    render(<ReducedDayControl showUndo={false} />);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Retry day mode' }));
    await screen.findByText('Still unavailable.');
    expect(screen.queryByRole('button', { name: 'Reduce today' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry day mode' }));
    await user.click(screen.getByRole('button', { name: 'Retry day mode' }));
    expect(await screen.findByRole('button', { name: 'Reduce today' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('ignores an obsolete mode response after a newer date refresh', async () => {
    await seed('normal');
    const old = deferred<Awaited<ReturnType<typeof reducedDayCoordinator.loadTodayDayMode>>>();
    vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode').mockReturnValueOnce(old.promise);
    const { rerender } = render(<ReducedDayControl refreshVersion={0} showUndo={false} />);
    rerender(<ReducedDayControl refreshVersion={1} showUndo={false} />);
    await screen.findByRole('button', { name: 'Reduce today' });
    await act(async () => { old.resolve({ ok: true, date: '2026-09-14', dayMode: 'reduced' }); });
    expect(screen.queryByText('Reduced Day active')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reduce today' })).toBeTruthy();
  });

  it('immediately refreshes a pre-midnight snapshot that resolves on the next local date', async () => {
    const database = await seed('reduced');
    const before = await loadSchedulerPlanState(database);
    const writes = watchWrites();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 30));
    const release = deferred<void>();
    const originalLiveRead = planCoordinator.buildCurrentLiveSchedulingContext;
    let delayed = false;
    const liveRead = vi.spyOn(planCoordinator, 'buildCurrentLiveSchedulingContext')
      .mockImplementation(async (options = {}) => {
        const result = await originalLiveRead(options);
        if (options.horizonDays === 1 && !delayed) {
          delayed = true;
          await release.promise;
        }
        return result;
      });
    const modeRead = vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode');
    render(<AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal"><TodayScreen /></AppSnapshotProvider>);
    await settleUntil(() => delayed && Boolean(screen.queryByText('Reduced Day active')));
    expect(screen.getByText('Reading today’s recorded plan...')).toBeTruthy();
    expect(modeRead).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    await act(async () => { release.resolve(); });
    await settleUntil(() => Boolean(screen.queryByRole('button', { name: 'Reduce today' })));
    expect(screen.getByText('Wednesday, September 16')).toBeTruthy();
    expect(screen.queryByText('Reduced Day active')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Return to normal day' })).toBeNull();
    // Let real IndexedDB callbacks settle without a Testing Library timer wait
    // while the local-date boundary clock itself remains frozen.
    await settleUntil(() => Boolean(within(screen.getByRole('region', { name: 'Later' })).queryByText('09:00–09:20')));
    expect(within(screen.getByRole('region', { name: 'Later' })).getByText('09:00–09:20')).toBeTruthy();
    expect(liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1)).toHaveLength(2);
    expect(modeRead).toHaveBeenCalledTimes(2);
    expect(await loadSchedulerPlanState(database)).toEqual(before);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });
});
