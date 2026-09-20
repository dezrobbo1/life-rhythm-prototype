// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSnapshotProvider } from '../../data/AppSnapshotProvider';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import * as reducedDayCoordinator from '../../data/reducedDayCoordinator';
import * as planCoordinator from '../../data/schedulerPlanCoordinator';
import * as planRepository from '../../data/schedulerPlanStateRepository';
import { activeTaskSchema } from '../../data/schemas';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';
import { scheduler } from '../../domain/primaryScheduler';
import { TodayScreen } from '../../screens/TodayScreen';
import { emptyAppSnapshot } from '../../viewModels/fixtures';
import * as calmSurface from './todayCalmSurface';

const realSetTimeout = globalThis.setTimeout;
let databaseIndex = 0;

async function settleUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
    await act(async () => { await new Promise((resolve) => realSetTimeout(resolve, 10)); });
  }
  expect(predicate()).toBe(true);
}

async function seedBoundaryDay() {
  const database = getCurrentLifeRhythmDatabase();
  const timestamp = new Date().toISOString();
  const defaults = createDefaultSettings(timestamp);
  expect((await saveSettings({
    theme: defaults.theme, startBoostSafety: defaults.startBoostSafety, lifeShape: defaults.lifeShape,
  }, database)).ok).toBe(true);
  for (const [id, title] of [['a-now', 'Selected task A'], ['b-scheduled', 'Scheduled task B']]) {
    await database.activeTasks.put(activeTaskSchema.parse({
      id, title, area: 'admin', source: 'adhoc', status: 'active', showToday: true,
      createdAt: timestamp, updatedAt: timestamp,
      minimum: { label: 'Do the first step.', minutes: 5 },
      normal: { label: 'Do the ordinary version.', minutes: 30 },
      full: { label: 'Do the fuller version.', minutes: 40 },
    }));
  }
  const placement = {
    id: 'today-b', intentionId: 'b-scheduled', date: '2026-09-15',
    start: '12:00', end: '12:30', origin: 'scheduler' as const,
    targetKind: 'intention' as const, variantKind: 'normal' as const,
    provenance: ['Synthetic accepted private plan.'],
  };
  expect((await planRepository.saveSchedulerPlanState({
    placements: [placement, { ...placement, id: 'tomorrow-b', date: '2026-09-16', start: '09:00', end: '09:30' }],
    rejectedExistingPlacements: [], unscheduledIntentionIds: [], unscheduledRhythmIds: [],
  }, database, timestamp, {
    dayModeContext: { dayMode: 'reduced', date: '2026-09-15' },
  })).ok).toBe(true);
}

async function storedState() {
  const database = getCurrentLifeRhythmDatabase();
  return Promise.all([
    database.settings.toArray(), database.activeTasks.toArray(),
    database.schedulerPlanState.toArray(), database.softPlacements.toArray(), database.taskPoolItems.toArray(),
  ]);
}

function watchWrites() {
  const database = getCurrentLifeRhythmDatabase();
  return [
    ...[database.settings, database.activeTasks, database.schedulerPlanState, database.softPlacements, database.taskPoolItems]
      .map((table) => vi.spyOn(table, 'put')),
    vi.spyOn(scheduler, 'buildPlan'), vi.spyOn(scheduler, 'repairPlan'),
  ];
}

function renderToday(planRevision = 0) {
  return <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal"><TodayScreen planRevision={planRevision} /></AppSnapshotProvider>;
}

function planReady() {
  return !screen.queryByText('Reading today’s recorded plan...');
}

function scheduledContextHasB() {
  const context = screen.queryByRole('region', { name: 'Scheduled for this time' });
  return Boolean(context && within(context).queryByText('Scheduled task B'));
}

function laterHasB() {
  return Boolean(within(screen.getByRole('region', { name: 'Later' })).queryByText('Scheduled task B'));
}

function expectNowUnchanged() {
  expect(within(screen.getByRole('region', { name: 'Now' })).getByRole('heading', { name: 'Selected task A' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start task' })).toBeTruthy();
}

beforeEach(() => {
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`today-boundary-recovery-${databaseIndex += 1}`));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 11, 59, 30));
});

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await getCurrentLifeRhythmDatabase().delete();
  resetCurrentLocalDataNamespace();
});

describe('Today delayed timer and read boundaries', () => {
  it.each([false, true])('uses the actual callback date after suspension (next day: %s)', async (nextDay) => {
    await seedBoundaryDay();
    const before = await storedState();
    const writes = watchWrites();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const modeRead = vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode');
    const liveRead = vi.spyOn(planCoordinator, 'buildCurrentLiveSchedulingContext');
    render(renderToday());
    await settleUntil(() => planReady() && laterHasB() && Boolean(screen.queryByText('Reduced Day active')));
    expectNowUnchanged();
    const planReadsBefore = liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length;
    const modeReadsBefore = modeRead.mock.calls.length;

    // Jump the wall clock without delivering timers, then deliver the pending
    // 12:00 callback after its original deadline, as a suspended tab can do.
    vi.setSystemTime(nextDay ? new Date(2026, 8, 16, 8, 0, 0) : new Date(2026, 8, 15, 12, 15, 0));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await settleUntil(() => planReady() && (nextDay
      ? Boolean(screen.queryByRole('button', { name: 'Reduce today' })) && laterHasB()
      : scheduledContextHasB()));
    expectNowUnchanged();
    expect(modeRead.mock.calls.length - modeReadsBefore).toBe(nextDay ? 1 : 0);
    expect(liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length - planReadsBefore).toBe(1);
    if (nextDay) {
      expect(screen.getByText('Wednesday, September 16')).toBeTruthy();
      expect(screen.queryByText('Reduced Day active')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Return to normal day' })).toBeNull();
      expect(within(screen.getByRole('region', { name: 'Later' })).getByText('09:00–09:30')).toBeTruthy();
    } else {
      expect(screen.getByText('Reduced Day active')).toBeTruthy();
      expect(laterHasB()).toBe(false);
    }
    expect(await storedState()).toEqual(before);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['start', 'end'] as const)('rejects a saved-plan read that finishes after a same-day %s boundary', async (edge) => {
    vi.setSystemTime(new Date(2026, 8, 15, edge === 'start' ? 11 : 12, edge === 'start' ? 59 : 29, 30));
    await seedBoundaryDay();
    const before = await storedState();
    const writes = watchWrites();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const liveRead = vi.spyOn(planCoordinator, 'buildCurrentLiveSchedulingContext');
    const modeRead = vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode');
    const view = render(renderToday());
    await settleUntil(() => planReady() && Boolean(screen.queryByText('Reduced Day active')) && (edge === 'start' ? laterHasB() : scheduledContextHasB()));

    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    let captured = false;
    const originalSavedRead = planRepository.loadSchedulerPlanState;
    vi.spyOn(planRepository, 'loadSchedulerPlanState').mockImplementationOnce(async (...args) => {
      const result = await originalSavedRead(...args);
      captured = true;
      await released;
      return result;
    });
    const planReadsBefore = liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length;
    const modeReadsBefore = modeRead.mock.calls.length;
    view.rerender(renderToday(1));
    await settleUntil(() => captured && !planReady());
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    await act(async () => { release(); });
    await settleUntil(() => planReady() && (edge === 'start' ? scheduledContextHasB() : !scheduledContextHasB()) && !laterHasB());
    expectNowUnchanged();
    expect(screen.getByText('Reduced Day active')).toBeTruthy();
    expect(modeRead.mock.calls.length).toBe(modeReadsBefore);
    // One requested read and one immediate recovery read, not a polling loop.
    expect(liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length - planReadsBefore).toBe(2);
    expect(await storedState()).toEqual(before);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rechecks an elapsed boundary between read completion and timer installation', async () => {
    await seedBoundaryDay();
    const before = await storedState();
    const writes = watchWrites();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const view = render(renderToday());
    await settleUntil(() => planReady() && laterHasB());
    const originalBuild = calmSurface.buildTodayCalmSurface;
    vi.spyOn(calmSurface, 'buildTodayCalmSurface').mockImplementationOnce((input) => {
      const result = originalBuild(input);
      // The snapshot was assembled before the boundary; React installs its
      // effect after the boundary. No timer callback has delivered the change.
      vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 1));
      return result;
    });
    view.rerender(renderToday(1));
    await settleUntil(() => planReady() && scheduledContextHasB() && !laterHasB());
    expectNowUnchanged();
    expect(await storedState()).toEqual(before);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });
});


describe('Today midnight independently of optional plan reads', () => {
  it.each(['result', 'rejection'] as const)('keeps midnight active after a %s failure and permits next-day Retry', async (failure) => {
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 30));
    await seedBoundaryDay();
    const before = await storedState();
    const writes = watchWrites();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const originalRead = planCoordinator.buildCurrentLiveSchedulingContext;
    let failing = false;
    const liveRead = vi.spyOn(planCoordinator, 'buildCurrentLiveSchedulingContext')
      .mockImplementation(async (options = {}) => {
        if (options.horizonDays === 1 && failing) {
          if (failure === 'rejection') throw new Error('Synthetic calendar read failure');
          return { ok: false, errors: ['Synthetic calendar read failure'] };
        }
        return originalRead(options);
      });
    const modeRead = vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode');
    const view = render(renderToday());
    await settleUntil(() => planReady() && Boolean(screen.queryByText('Reduced Day active')));
    expectNowUnchanged();

    // A failed refresh must not remove the midnight timer installed by the
    // preceding successful read. Only the optional horizon-one read fails.
    failing = true;
    view.rerender(renderToday(1));
    await settleUntil(() => Boolean(screen.queryByText('Later and Changed could not be read.')));
    const readsBeforeMidnight = liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length;
    const modesBeforeMidnight = modeRead.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    await settleUntil(() => Boolean(screen.queryByText('Wednesday, September 16')) &&
      Boolean(screen.queryByRole('button', { name: 'Reduce today' })) &&
      Boolean(screen.queryByText('Later and Changed could not be read.')));
    expect(screen.queryByText('Reduced Day active')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Return to normal day' })).toBeNull();
    expectNowUnchanged();
    expect(liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length - readsBeforeMidnight).toBe(1);
    expect(modeRead.mock.calls.length - modesBeforeMidnight).toBe(1);

    // Persistent failure retains a daily deadline, not a tight retry loop.
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length - readsBeforeMidnight).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    failing = false;
    fireEvent.click(within(screen.getByRole('region', { name: 'Later' })).getByRole('button', { name: 'Retry' }));
    await settleUntil(() => planReady() && laterHasB());
    expect(within(screen.getByRole('region', { name: 'Later' })).getByText('09:00–09:30')).toBeTruthy();
    expect(screen.queryByText('Later and Changed could not be read.')).toBeNull();
    expect(modeRead.mock.calls.length - modesBeforeMidnight).toBe(1);
    expect(await storedState()).toEqual(before);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('advances date and day mode while plan reads remain pending across midnight', async () => {
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 30));
    await seedBoundaryDay();
    const before = await storedState();
    const writes = watchWrites();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const modeRead = vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode');
    const view = render(renderToday());
    await settleUntil(() => planReady() && Boolean(screen.queryByText('Reduced Day active')));
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let captured = 0;
    const originalRead = planCoordinator.buildCurrentLiveSchedulingContext;
    const liveRead = vi.spyOn(planCoordinator, 'buildCurrentLiveSchedulingContext')
      .mockImplementation(async (options = {}) => {
        const result = await originalRead(options);
        if (options.horizonDays === 1) {
          captured += 1;
          await held;
        }
        return result;
      });
    const modesBeforeMidnight = modeRead.mock.calls.length;
    view.rerender(renderToday(1));
    await settleUntil(() => captured === 1 && !planReady());
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    await settleUntil(() => Boolean(screen.queryByText('Wednesday, September 16')) &&
      Boolean(screen.queryByRole('button', { name: 'Reduce today' })) && captured === 2);
    expect(screen.getByText('Reading today’s recorded plan...')).toBeTruthy();
    expect(screen.queryByText('Reduced Day active')).toBeNull();
    expectNowUnchanged();
    expect(modeRead.mock.calls.length - modesBeforeMidnight).toBe(1);
    // Releasing yesterday's obsolete result must not overwrite the new date.
    await act(async () => { release(); });
    await settleUntil(() => planReady() && laterHasB());
    expect(within(screen.getByRole('region', { name: 'Later' })).getByText('09:00–09:30')).toBeTruthy();
    expect(liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1)).toHaveLength(2);
    expect(modeRead.mock.calls.length - modesBeforeMidnight).toBe(1);
    expect(await storedState()).toEqual(before);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('synchronises the represented date on Retry before a suspended midnight timer is delivered', async () => {
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 30));
    await seedBoundaryDay();
    const before = await storedState();
    const writes = watchWrites();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const originalRead = planCoordinator.buildCurrentLiveSchedulingContext;
    let failing = true;
    const liveRead = vi.spyOn(planCoordinator, 'buildCurrentLiveSchedulingContext')
      .mockImplementation(async (options = {}) => {
        if (options.horizonDays === 1 && failing) return { ok: false, errors: ['Synthetic calendar read failure'] };
        return originalRead(options);
      });
    const modeRead = vi.spyOn(reducedDayCoordinator, 'loadTodayDayMode');
    render(renderToday());
    await settleUntil(() => Boolean(screen.queryByText('Later and Changed could not be read.')) &&
      Boolean(screen.queryByText('Reduced Day active')));
    const readsBeforeRetry = liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length;
    const modesBeforeRetry = modeRead.mock.calls.length;
    // Set the wall clock without running the pending timeout.
    vi.setSystemTime(new Date(2026, 8, 16, 8, 0, 0));
    failing = false;
    fireEvent.click(within(screen.getByRole('region', { name: 'Later' })).getByRole('button', { name: 'Retry' }));
    await settleUntil(() => planReady() && laterHasB() &&
      Boolean(screen.queryByText('Wednesday, September 16')) &&
      Boolean(screen.queryByRole('button', { name: 'Reduce today' })));
    expectNowUnchanged();
    expect(screen.queryByText('Reduced Day active')).toBeNull();
    expect(modeRead.mock.calls.length - modesBeforeRetry).toBe(1);
    expect(liveRead.mock.calls.filter(([options]) => options?.horizonDays === 1).length - readsBeforeRetry).toBe(1);
    expect(await storedState()).toEqual(before);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });
});
