// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commitCalendarSourceImport,
} from '../data/calendarSourceMutationCoordinator';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../data/localDataNamespace';
import { taskPoolItemSchema } from '../data/schemas';
import { createDefaultSettings, saveSettings } from '../data/settingsRepository';
import { scheduler } from '../domain/primaryScheduler';

const repositoryMocks = vi.hoisted(() => ({
  actualLoad: undefined as undefined | ((...args: unknown[]) => Promise<unknown>),
  loadSchedulerPlanState: vi.fn(),
}));

vi.mock('../data/schedulerPlanStateRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/schedulerPlanStateRepository')>();
  repositoryMocks.actualLoad = actual.loadSchedulerPlanState as (...args: unknown[]) => Promise<unknown>;

  return {
    ...actual,
    loadSchedulerPlanState: repositoryMocks.loadSchedulerPlanState,
  };
});

const coordinatorMocks = vi.hoisted(() => ({
  actualBuild: undefined as undefined | ((...args: unknown[]) => Promise<unknown>),
  buildCurrentLiveSchedulingContext: vi.fn(),
  repairCurrentPrivatePlan: vi.fn(),
}));

vi.mock('../data/schedulerPlanCoordinator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/schedulerPlanCoordinator')>();
  coordinatorMocks.actualBuild = actual.buildCurrentLiveSchedulingContext as (...args: unknown[]) => Promise<unknown>;

  return {
    ...actual,
    buildCurrentLiveSchedulingContext: coordinatorMocks.buildCurrentLiveSchedulingContext,
    repairCurrentPrivatePlan: coordinatorMocks.repairCurrentPrivatePlan,
  };
});

vi.mock('../features/plan/TimeDisruptionRepairWatcher', () => ({
  TimeDisruptionRepairWatcher: () => null,
}));

import App from '../App';
import {
  saveSchedulerPlanState,
} from '../data/schedulerPlanStateRepository';

const calendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:bootstrap-meeting',
  'DTSTART:20260920T100000Z',
  'DTEND:20260920T110000Z',
  'SUMMARY:Safe fixed commitment',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

let namespaceIndex = 0;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-20T09:00:00.000Z'));
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`initial-calendar-reconciliation-${namespaceIndex}`),
  );

  repositoryMocks.loadSchedulerPlanState.mockReset();
  repositoryMocks.loadSchedulerPlanState.mockImplementation((...args: unknown[]) => {
    if (!repositoryMocks.actualLoad) throw new Error('Actual scheduler-state reader is unavailable.');
    return repositoryMocks.actualLoad(...args);
  });
  coordinatorMocks.buildCurrentLiveSchedulingContext.mockReset();
  coordinatorMocks.buildCurrentLiveSchedulingContext.mockImplementation((...args: unknown[]) => {
    if (!coordinatorMocks.actualBuild) throw new Error('Actual live-context builder is unavailable.');
    return coordinatorMocks.actualBuild(...args);
  });
  coordinatorMocks.repairCurrentPrivatePlan.mockReset();

  const defaults = createDefaultSettings('2026-09-20T08:00:00.000Z');
  const settings = await saveSettings({
    lifeShape: {
      ...defaults.lifeShape,
      timeBlocks: [{
        days: ['Sunday'],
        end: '17:00',
        id: 'sunday-capacity',
        label: 'Sunday capacity',
        schedulerUse: 'available',
        start: '09:00',
        type: 'openCapacity',
      }],
    },
    startBoostSafety: defaults.startBoostSafety,
    theme: defaults.theme,
  });
  expect(settings.ok).toBe(true);

  const database = getCurrentLifeRhythmDatabase();
  await database.taskPoolItems.put(taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-09-20T08:00:00.000Z',
    full: { label: 'Finish stale task', minutes: 40 },
    id: 'stale-task',
    minimum: { label: 'Start stale task', minutes: 5 },
    normal: { label: 'Stale automatic placement', minutes: 30 },
    source: 'adhoc',
    status: 'captured',
    title: 'Stale automatic placement',
    updatedAt: '2026-09-20T08:00:00.000Z',
  }));
  const saved = await saveSchedulerPlanState({
    placements: [{
      date: '2026-09-20',
      end: '12:30',
      id: 'stale-placement',
      intentionId: 'stale-task',
      origin: 'scheduler',
      provenance: ['Previously accepted private plan.'],
      start: '12:00',
      targetKind: 'intention',
      variantKind: 'normal',
    }],
    rejectedExistingPlacements: [],
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
  }, database, '2026-09-20T08:00:00.000Z');
  expect(saved.ok).toBe(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('initial calendar-repair observation', () => {
  it('reconciles Today when the first live observation is already pending', async () => {
    if (!repositoryMocks.actualLoad || !coordinatorMocks.actualBuild) {
      throw new Error('Actual scheduling readers are unavailable.');
    }
    const database = getCurrentLifeRhythmDatabase();
    const staleState = await repositoryMocks.actualLoad(database);
    const staleContext = await coordinatorMocks.actualBuild({
      horizonDays: 1,
      planningPolicy: { dayMode: 'normal' },
      readOnly: true,
    });

    let releaseStaleState!: () => void;
    const staleStateGate = new Promise<void>((resolve) => { releaseStaleState = resolve; });
    let releaseFirstObservation!: () => void;
    const firstObservationGate = new Promise<void>((resolve) => { releaseFirstObservation = resolve; });
    let schedulerReadCount = 0;
    let pendingTodayStateReads = 0;
    let firstObservationStarted = false;
    repositoryMocks.loadSchedulerPlanState.mockImplementation(async (...args: unknown[]) => {
      schedulerReadCount += 1;
      if (pendingTodayStateReads > 0) {
        pendingTodayStateReads -= 1;
        await staleStateGate;
        return staleState;
      }
      if (!firstObservationStarted) {
        firstObservationStarted = true;
        await firstObservationGate;
      }
      return repositoryMocks.actualLoad!(...args);
    });

    let releaseStaleContext!: () => void;
    const staleContextGate = new Promise<void>((resolve) => { releaseStaleContext = resolve; });
    let buildReadCount = 0;
    let calendarCommitted = false;
    coordinatorMocks.buildCurrentLiveSchedulingContext.mockImplementation(async (...args: unknown[]) => {
      buildReadCount += 1;
      if (!calendarCommitted) {
        pendingTodayStateReads += 1;
        await staleContextGate;
        return staleContext;
      }
      return coordinatorMocks.actualBuild!(...args);
    });

    render(<App />);
    await waitFor(() => {
      expect(firstObservationStarted).toBe(true);
      expect(schedulerReadCount).toBeGreaterThanOrEqual(2);
      expect(buildReadCount).toBeGreaterThanOrEqual(1);
    });
    const staleBuildReadCount = buildReadCount;

    const committed = await commitCalendarSourceImport({
      importedAt: '2026-09-20T09:05:00.000Z',
      label: 'external-tab.ics',
      options: {
        targetTimezone: 'UTC',
        windowEndDate: '2026-09-20',
        windowStartDate: '2026-09-20',
      },
      source: calendar,
    }, database);
    expect(committed.ok).toBe(true);
    calendarCommitted = true;

    const planPut = vi.spyOn(database.schedulerPlanState, 'put');
    const planUpdate = vi.spyOn(database.schedulerPlanState, 'update');
    const buildPlan = vi.spyOn(scheduler, 'buildPlan');
    const repairPlan = vi.spyOn(scheduler, 'repairPlan');

    await act(async () => {
      releaseFirstObservation();
      releaseStaleState();
      releaseStaleContext();
    });

    const later = await screen.findByRole('region', { name: 'Later' });
    expect((await within(later).findByRole('alert')).textContent).toContain(
      'The flexible private plan needs repair after a calendar change.',
    );
    expect(within(later).queryByText('Stale automatic placement')).toBeNull();
    expect(within(later).getByText('Safe fixed commitment')).toBeTruthy();
    expect(buildReadCount).toBe(staleBuildReadCount + 1);
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
    expect(planPut).not.toHaveBeenCalled();
    expect(planUpdate).not.toHaveBeenCalled();
    expect(buildPlan).not.toHaveBeenCalled();
    expect(repairPlan).not.toHaveBeenCalled();
  });
});
