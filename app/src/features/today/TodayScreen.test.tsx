// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildActiveTaskBackupPayload,
  parseActiveTaskBackupJson,
  serializeActiveTaskBackup,
} from '../../data/activeTaskBackup';
import * as libraryRhythmRepository from '../../data/libraryRhythmRepository';
import { activeTaskSchema, type ActiveTask } from '../../data/schemas';
import * as settingsRepository from '../../data/settingsRepository';
import * as softPlacementRepository from '../../data/softPlacementRepository';
import type { SchedulerPlan } from '../../domain/schedulingModel';

const activeTaskRepositoryMocks = vi.hoisted(() => ({
  createActiveTaskId: vi.fn((prefix = 'active-task') => `${prefix}-test-id`),
  loadActiveTodayTasks: vi.fn(),
  loadActiveTodayTasksResult: vi.fn(),
  loadPersistedActiveTasks: vi.fn(),
  loadPersistedActiveTasksResult: vi.fn(),
  saveActiveTodayTask: vi.fn(),
  updateActiveTaskStatus: vi.fn(),
}));

const settingsRepositoryMocks = vi.hoisted(() => ({
  loadSettingsResult: vi.fn(),
}));

const reducedDayMocks = vi.hoisted(() => ({
  applyReduceToday: vi.fn(),
  loadTodayDayMode: vi.fn(),
  previewReduceToday: vi.fn(),
  returnTodayToNormal: vi.fn(),
  undoTodayPlanChange: vi.fn(),
}));

const taskLifecycleRepositoryMocks = vi.hoisted(() => ({
  loadLinkedTaskPoolItemIds: vi.fn(),
  markTaskLifecycleNoLongerNeeded: vi.fn(),
}));

const schedulerPlanCoordinatorMocks = vi.hoisted(() => ({
  buildCurrentLiveSchedulingContext: vi.fn(),
  ensureCurrentPrivatePlan: vi.fn(),
  repairCurrentPrivatePlan: vi.fn(),
}));

const schedulerPlanStateRepositoryMocks = vi.hoisted(() => ({
  loadSchedulerPlanState: vi.fn(),
}));
const rhythmTodayRepositoryMocks = vi.hoisted(() => ({
  syncScheduledRhythmOccurrencesToToday: vi.fn(),
  addRhythmToTodayOnce: vi.fn(),
}));

vi.mock('../../data/activeTaskRepository', () => activeTaskRepositoryMocks);
vi.mock('../../data/settingsRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/settingsRepository')>();

  return {
    ...actual,
    loadSettingsResult: settingsRepositoryMocks.loadSettingsResult,
  };
});
vi.mock('../../data/reducedDayCoordinator', () => reducedDayMocks);
vi.mock('../../data/taskLifecycleRepository', () => taskLifecycleRepositoryMocks);
vi.mock('../../data/schedulerPlanCoordinator', () => schedulerPlanCoordinatorMocks);
vi.mock('../../data/schedulerPlanStateRepository', () => schedulerPlanStateRepositoryMocks);
vi.mock('../../data/rhythmTodayRepository', () => rhythmTodayRepositoryMocks);

import App from '../../App';
import { TodayScreen } from '../../screens/TodayScreen';
import { AppSnapshotProvider } from '../../data/AppSnapshotProvider';
import { emptyAppSnapshot, normalDayWithOneTaskSnapshot, oneOffTodayTask } from '../../viewModels/fixtures';
import { mockTodayTask } from './mockTodayData';

function persistedOneOffTask(overrides: Partial<ActiveTask> = {}): ActiveTask {
  return activeTaskSchema.parse({
    area: 'money',
    createdAt: '2026-06-17T00:00:00.000Z',
    full: {
      label: 'Open the bill, note the due date, and park the next step.',
      minutes: 20,
    },
    id: 'adhoc-pay-water-bill',
    minimum: {
      label: 'Open the bill and note the due date.',
      minutes: 5,
    },
    normal: {
      label: 'Open the bill and check the amount.',
      minutes: 10,
    },
    purpose: 'Today-only task added by you.',
    showToday: true,
    source: 'adhoc',
    status: 'active',
    title: 'Pay water bill',
    updatedAt: '2026-06-17T00:00:00.000Z',
    ...overrides,
  });
}

function validActiveTaskBackupJson(overrides: Partial<ActiveTask> = {}) {
  return serializeActiveTaskBackup(buildActiveTaskBackupPayload([
    persistedOneOffTask({
      status: 'paused',
      ...overrides,
    }),
  ], '2026-06-17T00:00:00.000Z'));
}

function persistedReducedDayRepairPlan(): SchedulerPlan {
  const undo = {
    placements: [],
    rejectedExistingPlacements: [],
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
  };

  return {
    ...undo,
    repair: {
      trigger: 'userCorrection',
      reason: 'Reduce today was applied to the current local date.',
      now: { date: '2026-09-15', time: '09:00', timezone: 'Australia/Perth' },
      frozenPastPlacementIds: [],
      preservedPlacementIds: [],
      undo,
      changes: [{
        kind: 'variantChanged',
        targetKind: 'intention',
        targetId: 'adhoc-pay-water-bill',
        from: { date: '2026-09-15', start: '10:00', end: '10:10', variantKind: 'normal' },
        to: { date: '2026-09-15', start: '10:00', end: '10:05', variantKind: 'minimum' },
        reason: 'Reduce today was applied to the current local date.',
      }],
    },
  };
}

async function openFilledOneOffModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add one-off' }));
  await user.type(screen.getByLabelText('Task title'), 'Pay water bill');
  await user.selectOptions(screen.getByLabelText('Area'), 'money');
  await user.type(screen.getByLabelText('Minimum version'), 'Open the bill and note the due date.');
  await user.type(screen.getByLabelText('Minimum minutes'), '5');
  await user.click(screen.getByRole('button', { name: /Optional useful window/ }));
}

function savedOneOffTask(): ActiveTask {
  const calls = activeTaskRepositoryMocks.saveActiveTodayTask.mock.calls;

  return calls[calls.length - 1][0] as ActiveTask;
}

function renderEmptyPersonalToday() {
  return render(
    <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
      <TodayScreen />
    </AppSnapshotProvider>,
  );
}

beforeEach(() => {
  activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([]);
  activeTaskRepositoryMocks.loadActiveTodayTasksResult.mockImplementation(async () => ({
    invalidRecordCount: 0,
    items: await activeTaskRepositoryMocks.loadActiveTodayTasks(),
    status: 'ok',
  }));
  activeTaskRepositoryMocks.loadPersistedActiveTasks.mockResolvedValue([]);
  activeTaskRepositoryMocks.loadPersistedActiveTasksResult.mockImplementation(async () => ({
    invalidRecordCount: 0,
    items: await activeTaskRepositoryMocks.loadPersistedActiveTasks(),
    status: 'ok',
  }));
  activeTaskRepositoryMocks.saveActiveTodayTask.mockImplementation(async (task: ActiveTask) => ({
    alreadyExists: false,
    ok: true,
    task,
  }));
  activeTaskRepositoryMocks.updateActiveTaskStatus.mockImplementation(async (id: string, status: ActiveTask['status']) => {
    const visibleToday = status === 'active' || status === 'inProgress' || status === 'paused' || status === 'minimumDone';
    const minimumWasAchieved = status === 'minimumDone' || activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls
      .some((call) => call[1] === 'minimumDone');

    return {
      ok: true,
      task: persistedOneOffTask({
        id,
        minimumAchievedAt: minimumWasAchieved ? '2026-06-17T00:05:00.000Z' : undefined,
        showToday: visibleToday,
        status,
      }),
      visibleToday,
    };
  });
  settingsRepositoryMocks.loadSettingsResult.mockImplementation(async () => ({
    conflicts: [],
    errors: [],
    migrationPersisted: false,
    settings: settingsRepository.createDefaultSettings('2026-08-15T00:00:00.000Z'),
    status: 'defaulted',
  }));
  reducedDayMocks.loadTodayDayMode.mockResolvedValue({
    ok: true, date: '2026-09-07', dayMode: 'normal',
  });
  const plan = {
    placements: [], unscheduledIntentionIds: [], unscheduledRhythmIds: [], rejectedExistingPlacements: [],
  };
  reducedDayMocks.previewReduceToday.mockResolvedValue({
    ok: true, date: '2026-09-07', dayMode: 'reduced', plan, warnings: [],
    preview: {
      date: '2026-09-07', initialPlan: false, plan,
      items: [{
        category: 'getsSmaller', targetId: 'adhoc-pay-water-bill', title: 'Pay water bill',
        detail: '10 minutes → 5 minutes', reason: 'Reduce today was applied to the current local date.',
      }],
    },
  });
  reducedDayMocks.applyReduceToday.mockImplementation(reducedDayMocks.previewReduceToday);
  reducedDayMocks.returnTodayToNormal.mockResolvedValue({
    ok: true, date: '2026-09-07', dayMode: 'normal', plan, warnings: [],
    preview: { date: '2026-09-07', initialPlan: false, plan, items: [] },
  });
  reducedDayMocks.undoTodayPlanChange.mockResolvedValue({
    ok: true, date: '2026-09-07', dayMode: 'normal', plan, warnings: [],
    preview: { date: '2026-09-07', initialPlan: false, plan, items: [] },
  });
  taskLifecycleRepositoryMocks.loadLinkedTaskPoolItemIds.mockResolvedValue([]);
  taskLifecycleRepositoryMocks.markTaskLifecycleNoLongerNeeded.mockResolvedValue({ ok: false });
  schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext.mockResolvedValue({
    ok: true,
    context: {
      input: {
        intentions: [], rhythms: [], externalCommitments: [], capacityWindows: [], placements: [], dayProfiles: [],
      },
      titleByTargetId: { 'adhoc-pay-water-bill': 'Pay water bill' },
      warnings: [],
    },
    now: { date: '2026-09-15', time: '09:00', timezone: 'Australia/Perth' },
  });
  schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan.mockResolvedValue({ ok: true });
  schedulerPlanCoordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({ ok: true });
  schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({ status: 'missing' });
  rhythmTodayRepositoryMocks.syncScheduledRhythmOccurrencesToToday.mockResolvedValue({ ok: true, tasks: [], mutated: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('Today screen', () => {
  it.each([false, true])('reloads Today projections only when rhythm sync mutated=%s', async (mutated) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 15, 12));
    const date = '2026-09-15';
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok', updatedAt: '2026-09-15T01:00:00.000Z',
      plan: {
        placements: [{
          id: 'rhythm-placement', intentionId: 'rhythm-instance', targetKind: 'rhythm',
          rhythmId: 'rhythm-instance', rhythmInstanceId: 'rhythm-instance',
          date, start: '09:00', end: '09:10', origin: 'scheduler', variantKind: 'normal', provenance: [],
        }],
        unscheduledIntentionIds: [], unscheduledRhythmIds: [], rejectedExistingPlacements: [],
      },
    });
    rhythmTodayRepositoryMocks.syncScheduledRhythmOccurrencesToToday.mockResolvedValue({
      ok: true, tasks: [persistedOneOffTask()], mutated: false,
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const rendered = render(<TodayScreen planRevision={0} />);
    await screen.findByRole('article', { name: 'Pay water bill' });
    await waitFor(() => expect(rhythmTodayRepositoryMocks.syncScheduledRhythmOccurrencesToToday.mock.calls.length).toBeGreaterThan(0));
    expect(activeTaskRepositoryMocks.loadActiveTodayTasksResult).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    expect(screen.getByRole('dialog', { name: 'Start Boost' })).toBeTruthy();
    const before = activeTaskRepositoryMocks.loadActiveTodayTasksResult.mock.calls.length;
    const beforeSync = rhythmTodayRepositoryMocks.syncScheduledRhythmOccurrencesToToday.mock.calls.length;
    const beforeRepair = schedulerPlanCoordinatorMocks.ensureCurrentPrivatePlan.mock.calls.length;
    rhythmTodayRepositoryMocks.syncScheduledRhythmOccurrencesToToday.mockResolvedValue({
      ok: true, tasks: [persistedOneOffTask()], mutated,
    });
    rendered.rerender(<TodayScreen planRevision={1} />);
    await waitFor(() => expect(rhythmTodayRepositoryMocks.syncScheduledRhythmOccurrencesToToday.mock.calls.length).toBeGreaterThan(beforeSync));
    if (mutated) {
      await waitFor(() => expect(activeTaskRepositoryMocks.loadActiveTodayTasksResult).toHaveBeenCalledTimes(before + 1));
      expect(schedulerPlanCoordinatorMocks.ensureCurrentPrivatePlan.mock.calls.length).toBeGreaterThan(beforeRepair);
      expect(screen.queryByRole('dialog', { name: 'Start Boost' })).toBeNull();
    } else {
      expect(activeTaskRepositoryMocks.loadActiveTodayTasksResult).toHaveBeenCalledTimes(before);
      expect(schedulerPlanCoordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(beforeRepair);
      expect(screen.getByRole('dialog', { name: 'Start Boost' })).toBeTruthy();
      expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Close Start Boost' }));
      await user.click(screen.getByRole('button', { name: 'Start task' }));
      expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
      const beforeAnotherRead = activeTaskRepositoryMocks.loadActiveTodayTasksResult.mock.calls.length;
      const beforeAnotherSync = rhythmTodayRepositoryMocks.syncScheduledRhythmOccurrencesToToday.mock.calls.length;
      rendered.rerender(<TodayScreen planRevision={2} />);
      await waitFor(() => expect(rhythmTodayRepositoryMocks.syncScheduledRhythmOccurrencesToToday.mock.calls.length).toBeGreaterThan(beforeAnotherSync));
      expect(activeTaskRepositoryMocks.loadActiveTodayTasksResult).toHaveBeenCalledTimes(beforeAnotherRead);
      expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
      expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    }
  });
  it('offers correction for another saved one-off without changing the current focus', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([
      persistedOneOffTask(),
      persistedOneOffTask({ id: 'adhoc-second', title: 'Read the post' }),
    ]);
    const user = userEvent.setup();
    renderEmptyPersonalToday();

    expect(await screen.findByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    const others = screen.getByRole('region', { name: 'Other saved Today tasks' });
    expect(within(others).getByText('Read the post · Minimum 5 min')).toBeTruthy();
    await user.click(within(others).getByRole('button', { name: 'Edit task' }));
    expect(within(screen.getByRole('dialog', { name: 'Edit one-off' })).getByLabelText('Task title')).toHaveProperty('value', 'Read the post');
  });

  it('shows the ordinary empty state only after a successful empty personal read', async () => {
    renderEmptyPersonalToday();

    expect(await screen.findByRole('heading', { name: 'Choose rhythms to turn on' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a quiet loading state before saved Today tasks resolve', () => {
    activeTaskRepositoryMocks.loadActiveTodayTasksResult.mockReturnValue(new Promise(() => undefined));

    renderEmptyPersonalToday();

    expect(screen.getByText('Loading your saved Today tasks...')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Choose rhythms to turn on' })).toBeNull();
  });

  it('does not present a failed Today read as a genuine empty state and can retry', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasksResult
      .mockResolvedValueOnce({
        errors: ['activeTasks: Saved Today tasks could not be read.'],
        status: 'readFailed',
      })
      .mockResolvedValueOnce({
        invalidRecordCount: 0,
        items: [persistedOneOffTask()],
        status: 'ok',
      });

    renderEmptyPersonalToday();

    expect((await screen.findByRole('alert')).textContent).toContain('Your saved Today tasks could not be loaded.');
    expect(screen.queryByRole('heading', { name: 'Choose rhythms to turn on' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'Pay water bill' })).toBeTruthy();
    expect(activeTaskRepositoryMocks.loadActiveTodayTasksResult).toHaveBeenCalledTimes(2);
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
  });

  it('keeps an adapter-provided task visible when the unrelated local Today read fails', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasksResult.mockResolvedValue({
      errors: ['activeTasks: synthetic local read failure'],
      status: 'readFailed',
    });

    render(
      <AppSnapshotProvider
        source="read-only adapter"
        snapshot={{ ...normalDayWithOneTaskSnapshot, activeTasks: [oneOffTodayTask] }}
      >
        <TodayScreen />
      </AppSnapshotProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain('saved Today tasks could not be loaded');
    expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Choose rhythms to turn on' })).toBeNull();
  });

  it('keeps valid Today tasks visible while warning about unreadable saved rows', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasksResult.mockResolvedValue({
      invalidRecordCount: 1,
      items: [persistedOneOffTask()],
      status: 'partial',
    });

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Pay water bill' })).toBeTruthy();
    const warning = await screen.findByRole('status', { name: 'Saved Today task warning' });
    expect(warning.textContent).toContain('Some saved Today task data could not be read.');
    expect(warning.textContent).toContain('Nothing stored on this device was changed.');
  });

  it('keeps Add one-off available when every saved Today row is unreadable', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasksResult.mockResolvedValue({
      invalidRecordCount: 2,
      items: [],
      status: 'partial',
    });

    renderEmptyPersonalToday();

    expect(await screen.findByRole('status', { name: 'Saved Today task warning' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add one-off' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Choose rhythms to turn on' })).toBeNull();
  });

  it('keeps loading until the first persisted task is ready to present', async () => {
    let resolveLinks!: (ids: string[]) => void;
    activeTaskRepositoryMocks.loadActiveTodayTasksResult.mockResolvedValue({
      invalidRecordCount: 0,
      items: [persistedOneOffTask()],
      status: 'ok',
    });
    taskLifecycleRepositoryMocks.loadLinkedTaskPoolItemIds.mockImplementation(() => new Promise((resolve) => {
      resolveLinks = resolve;
    }));

    renderEmptyPersonalToday();

    expect(await screen.findByText('Loading your saved Today tasks...')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Choose rhythms to turn on' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pay water bill' })).toBeNull();

    resolveLinks([]);

    expect(await screen.findByRole('heading', { name: 'Pay water bill' })).toBeTruthy();
  });

  it('does not let a retry restore a stale task state after a successful write', async () => {
    const user = userEvent.setup();
    let resolveRetry!: (result: {
      invalidRecordCount: number;
      items: ActiveTask[];
      status: 'partial';
    }) => void;
    activeTaskRepositoryMocks.loadActiveTodayTasksResult
      .mockResolvedValueOnce({
        invalidRecordCount: 1,
        items: [persistedOneOffTask()],
        status: 'partial',
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveRetry = resolve;
      }));

    renderEmptyPersonalToday();

    expect(await screen.findByRole('button', { name: 'Start task' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy();

    resolveRetry({
      invalidRecordCount: 1,
      items: [persistedOneOffTask({ status: 'active' })],
      status: 'partial',
    });

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.loadActiveTodayTasksResult).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start task' })).toBeNull();
  });
  it('previews, cancels, and applies Reduce today from the primary task area', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    render(<TodayScreen />);

    const card = await screen.findByRole('article', { name: 'Pay water bill' });
    const control = await screen.findByLabelText('Reduced Day controls');
    expect(card.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(within(control).getByRole('button', { name: 'Reduce today' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reduce today' });
    expect(within(dialog).getByText('Pay water bill')).toBeTruthy();
    expect(within(dialog).getByText('10 minutes → 5 minutes')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(reducedDayMocks.applyReduceToday).not.toHaveBeenCalled();

    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok',
      plan: persistedReducedDayRepairPlan(),
      updatedAt: '2026-09-15T01:00:00.000Z',
    });
    await user.click(within(control).getByRole('button', { name: 'Reduce today' }));
    await user.click(await screen.findByRole('button', { name: 'Apply reduced day' }));
    expect(reducedDayMocks.applyReduceToday).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Reduced Day active')).toBeTruthy();
    const changed = await screen.findByRole('region', { name: 'Changed' });
    expect(changed.textContent).toContain('Pay water bill');
    expect(changed.textContent).toContain('Changed from Normal, 10 min to Minimum, 5 min.');
  });

  it('returns keyboard focus to Reduce today after the preview closes', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    const successful = await reducedDayMocks.previewReduceToday();
    let finishPreview!: (value: typeof successful) => void;
    reducedDayMocks.previewReduceToday.mockImplementation(() => new Promise((resolve) => {
      finishPreview = resolve;
    }));
    render(<TodayScreen />);

    const trigger = await screen.findByRole('button', { name: 'Reduce today' });
    await user.click(trigger);
    await waitFor(() => expect(trigger.hasAttribute('disabled')).toBe(true));
    trigger.blur();
    finishPreview(successful);
    await screen.findByRole('dialog', { name: 'Reduce today' });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Reduce today' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('returns to Normal and Undo restores the mode reported by the persisted action', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    reducedDayMocks.loadTodayDayMode.mockResolvedValue({
      ok: true, date: '2026-09-07', dayMode: 'reduced',
    });
    const unchangedRepairPlan = persistedReducedDayRepairPlan();
    unchangedRepairPlan.repair = { ...unchangedRepairPlan.repair!, changes: [] };
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok', plan: unchangedRepairPlan, updatedAt: '2026-09-15T01:00:00.000Z',
    });
    render(<TodayScreen />);
    const control = await screen.findByLabelText('Reduced Day controls');
    await screen.findByText('Reduced Day active');
    await user.click(await within(control).findByRole('button', { name: 'Undo last change' }));
    expect(reducedDayMocks.undoTodayPlanChange).toHaveBeenCalledTimes(1);
    expect(await within(control).findByRole('button', { name: 'Reduce today' })).toBeTruthy();

    cleanup();
    reducedDayMocks.loadTodayDayMode.mockResolvedValue({ ok: true, date: '2026-09-07', dayMode: 'reduced' });
    render(<TodayScreen />);
    const nextControl = await screen.findByLabelText('Reduced Day controls');
    await user.click(await within(nextControl).findByRole('button', { name: 'Return to normal day' }));
    expect(reducedDayMocks.returnTodayToNormal).toHaveBeenCalledTimes(1);
    expect(await within(nextControl).findByRole('button', { name: 'Reduce today' })).toBeTruthy();
  });

  it('waits for the saved-plan read before exposing one stable Reduced Day Undo control', async () => {
    let finishPlanRead!: (value: unknown) => void;
    reducedDayMocks.loadTodayDayMode.mockResolvedValue({
      ok: true, date: '2026-09-07', dayMode: 'reduced',
    });
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockImplementation(
      () => new Promise((resolve) => { finishPlanRead = resolve; }),
    );
    render(<TodayScreen />);

    const control = await screen.findByLabelText('Reduced Day controls');
    await screen.findByText('Reduced Day active');
    expect(within(control).queryByRole('button', { name: 'Undo last change' })).toBeNull();

    const unchangedRepairPlan = persistedReducedDayRepairPlan();
    unchangedRepairPlan.repair = { ...unchangedRepairPlan.repair!, changes: [] };
    finishPlanRead({
      status: 'ok', plan: unchangedRepairPlan, updatedAt: '2026-09-15T01:00:00.000Z',
    });

    expect(await within(control).findByRole('button', { name: 'Undo last change' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Undo last change' })).toHaveLength(1);
  });

  it('shows persisted Changed information when Reduced Day reloads on the same date', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    const previewResult = await reducedDayMocks.previewReduceToday();
    reducedDayMocks.loadTodayDayMode.mockResolvedValue({
      ok: true, date: '2026-09-07', dayMode: 'reduced', preview: previewResult.preview,
    });
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok',
      plan: persistedReducedDayRepairPlan(),
      updatedAt: '2026-09-15T01:00:00.000Z',
    });
    render(<TodayScreen />);
    expect(await screen.findByText('Reduced Day active')).toBeTruthy();
    const changed = await screen.findByRole('region', { name: 'Changed' });
    expect(changed.textContent).toContain('Pay water bill');
    expect(changed.textContent).toContain('Changed from Normal, 10 min to Minimum, 5 min.');
  });

  it('keeps Normal visible when applying Reduced Day fails', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    reducedDayMocks.applyReduceToday.mockResolvedValue({
      ok: false, errors: ['Saved scheduler state could not be written.'], warnings: [],
    });
    render(<TodayScreen />);
    await user.click(await screen.findByRole('button', { name: 'Reduce today' }));
    await user.click(await screen.findByRole('button', { name: 'Apply reduced day' }));
    expect((await screen.findByRole('alert')).textContent).toContain('could not be written');
    expect(screen.queryByText('Reduced Day active')).toBeNull();
  });

  it('does not present a failed day-mode read as proof that today is Normal', async () => {
    reducedDayMocks.loadTodayDayMode.mockResolvedValue({
      ok: false,
      errors: ['Today’s persisted day mode could not be read.'],
    });

    render(<TodayScreen />);

    const control = await screen.findByLabelText('Reduced Day controls');
    expect((await within(control).findByRole('alert')).textContent).toContain('could not be read');
    expect(within(control).queryByRole('button', { name: 'Reduce today' })).toBeNull();
    expect(within(control).queryByText('Reduced Day active')).toBeNull();
  });

  it('prevents duplicate Apply submissions while the first write is pending', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    const successful = await reducedDayMocks.previewReduceToday();
    let finish!: (value: typeof successful) => void;
    reducedDayMocks.applyReduceToday.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<TodayScreen />);
    await user.click(await screen.findByRole('button', { name: 'Reduce today' }));
    const apply = await screen.findByRole('button', { name: 'Apply reduced day' });
    await user.click(apply);
    await waitFor(() => expect(reducedDayMocks.applyReduceToday).toHaveBeenCalledTimes(1));
    fireEvent.click(apply);
    expect(reducedDayMocks.applyReduceToday).toHaveBeenCalledTimes(1);
    finish(successful);
    expect(await screen.findByText('Reduced Day active')).toBeTruthy();
  });

  it.each(['adhoc', 'library', 'view-model'] as const)('keeps all eight Start Boost barriers and selectable supports for %s tasks', async (source) => {
    const user = userEvent.setup();
    if (source === 'view-model') {
      render(<AppSnapshotProvider source="read-only adapter" snapshot={{ ...normalDayWithOneTaskSnapshot, activeTasks: [oneOffTodayTask] }}><TodayScreen /></AppSnapshotProvider>);
    } else {
      activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([
        persistedOneOffTask({ source, ...(source === 'library' ? { templateId: 'water-bill' } : {}) }),
      ]);
      render(<TodayScreen />);
    }
    const card = await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(within(card).getByRole('button', { name: 'Start Boost' }));
    const dialog = screen.getByRole('dialog', { name: 'Start Boost' });
    const barriers = ['Too big', 'Unclear first step', 'Too boring', 'Low energy', 'Not enough time', 'Emotionally hard', 'Need information', 'Pulled to phone'];
    const barrierSection = within(dialog).getByRole('heading', { name: 'What is blocking the start?' }).closest('section')!;
    expect(within(barrierSection).getAllByRole('button').map((button) => button.textContent)).toEqual(barriers);
    for (const barrier of barriers) {
      await user.click(within(barrierSection).getByRole('button', { name: barrier }));
      const supportSection = within(dialog).getByRole('heading', { name: 'Choose one support' }).closest('section')!;
      const supports = within(supportSection).getAllByRole('button');
      expect(supports.length).toBeGreaterThan(0);
      for (const support of supports) {
        expect(support.textContent?.trim()).toBeTruthy();
        await user.click(support);
        expect(support.getAttribute('aria-pressed')).toBe('true');
        expect(within(supportSection).getByRole('heading', { name: 'Did that reduce friction?' })).toBeTruthy();
      }
    }
  });

  it.each(['adhoc', 'library'] as const)('does not leak mock Details into a persisted %s task', async (source) => {
    const task = persistedOneOffTask({ source, ...(source === 'library' ? { templateId: 'water-bill' } : {}) });
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([task]);
    const user = userEvent.setup();
    render(<TodayScreen />);
    const card = await screen.findByRole('article', { name: task.title });
    await user.click(within(card).getByRole('button', { name: 'Details' }));
    for (const copy of [mockTodayTask.timingReality, ...mockTodayTask.hiddenEdges]) {
      expect.soft(within(card).queryByText(copy)).toBeNull();
    }
    for (const copy of [task.purpose!, task.minimum.label, task.normal.label, task.full.label, '5 min minimum']) {
      expect(within(card).getByText(copy)).toBeTruthy();
    }
    expect(within(card).queryByRole('heading', { name: 'Timing reality' })).toBeNull();
    expect(within(card).queryByRole('heading', { name: 'Hidden edges' })).toBeNull();
  });

  it('does not leak mock Details into a real view-model task', async () => {
    const user = userEvent.setup();
    render(<AppSnapshotProvider source="read-only adapter" snapshot={{ ...normalDayWithOneTaskSnapshot, activeTasks: [oneOffTodayTask] }}><TodayScreen /></AppSnapshotProvider>);
    const card = screen.getByRole('article', { name: 'Pay water bill' });
    await user.click(within(card).getByRole('button', { name: 'Details' }));
    for (const copy of [mockTodayTask.timingReality, ...mockTodayTask.hiddenEdges, mockTodayTask.whyThis]) {
      expect.soft(within(card).queryByText(copy)).toBeNull();
    }
  });

  it('retains authored mock fixture details', () => {
    expect(mockTodayTask.timingReality).toBe('Best before shutdown. If the day is full, two minutes still counts.');
    expect(mockTodayTask.hiddenEdges).toEqual(['Find the note or place to capture it', 'Decide what is hidden rather than deleted']);
  });

  it.each([
    ['dueBy', 'dueAt', 'Useful before'],
    ['fixedAt', 'fixedAt', 'Tied to'],
    ['expiresAfter', 'expiresAfter', 'Useful until'],
  ] as const)('retains persisted %s time-edge presentation', async (timeConstraint, field, label) => {
    const instant = '2030-09-11T09:00:00.000Z';
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask({ timeConstraint, [field]: instant })]);
    render(<TodayScreen />);
    const card = await screen.findByRole('article', { name: 'Pay water bill' });
    const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant));
    expect(within(card).getByText(`${label} ${formatted}`)).toBeTruthy();
  });

  it('renders the Today surface', () => {
    render(<TodayScreen />);

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Now' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Later' })).toBeTruthy();
    expect(screen.getByRole('article', { name: "Set tomorrow's first step" })).toBeTruthy();
  });

  it('uses one calm personal hierarchy without presentation-only Today-state authority', () => {
    render(<TodayScreen />);

    expect(screen.getAllByRole('heading', { name: 'Today' })).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Now' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Later' })).toBeTruthy();
    expect(screen.queryByText(/Today feels:/)).toBeNull();
    expect(screen.queryByText('Next useful action')).toBeNull();
    expect(screen.queryByText(/Plan adjusted:/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Today rhythm preview' })).toBeNull();
  });

  it('renders current commitment context and factual Later rows from the read-only Day Line truth', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext.mockResolvedValue({
      ok: true,
      context: {
        input: {
          intentions: [], rhythms: [], capacityWindows: [], dayProfiles: [],
          externalCommitments: [
            {
              id: 'current-meeting', title: 'School meeting', source: 'calendar', sourceId: 'calendar:meeting',
              interval: { kind: 'datedLocal', date: '2026-09-15', start: '10:00', end: '10:30', timezone: 'Australia/Perth' },
              hard: true, travelBeforeMinutes: 0, transitionAfterMinutes: 0,
            },
            {
              id: 'later-dentist', title: 'Dentist', source: 'calendar', sourceId: 'calendar:dentist',
              interval: { kind: 'datedLocal', date: '2026-09-15', start: '14:00', end: '15:00', timezone: 'Australia/Perth' },
              hard: true, travelBeforeMinutes: 0, transitionAfterMinutes: 0,
            },
          ],
          placements: [{
            id: 'manual-call', intentionId: 'manual-task', date: '2026-09-15', start: '13:00', end: '13:20',
            origin: 'existingUserConfirmed', sourcePlacementId: 'soft:manual-call', provenance: ['user'],
          }],
        },
        titleByTargetId: {
          'adhoc-pay-water-bill': 'Pay water bill',
          'automatic-task': 'Write outline',
          'manual-task': 'Call the plumber',
        },
        warnings: [],
      },
      now: { date: '2026-09-15', time: '10:15', timezone: 'Australia/Perth' },
    });
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok',
      updatedAt: '2026-09-15T02:15:00.000Z',
      plan: {
        placements: [
          {
            id: 'current-task-plan', intentionId: 'adhoc-pay-water-bill', date: '2026-09-15', start: '11:00', end: '11:10',
            origin: 'scheduler', targetKind: 'intention', variantKind: 'normal', provenance: ['scheduler'],
          },
          {
            id: 'automatic-outline', intentionId: 'automatic-task', date: '2026-09-15', start: '12:00', end: '12:30',
            origin: 'scheduler', targetKind: 'intention', variantKind: 'normal', provenance: ['scheduler'],
          },
        ],
        rejectedExistingPlacements: [], unscheduledIntentionIds: [], unscheduledRhythmIds: [],
      },
    });

    render(<TodayScreen />);

    const now = screen.getByRole('region', { name: 'Now' });
    expect(await within(now).findByText('School meeting')).toBeTruthy();
    const later = screen.getByRole('region', { name: 'Later' });
    await waitFor(() => {
      expect(within(later).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        expect.stringContaining('Write outline'),
        expect.stringContaining('Call the plumber'),
        expect.stringContaining('Dentist'),
      ]);
    });
    expect(within(later).queryByText('Pay water bill')).toBeNull();
    expect(within(later).queryByText('School meeting')).toBeNull();
    expect(schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext).toHaveBeenCalledWith({
      horizonDays: 1,
      planningPolicy: { dayMode: 'normal' },
      readOnly: true,
    });
    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('identifies a missing saved private plan even when fixed Later facts remain readable', async () => {
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext.mockResolvedValue({
      ok: true,
      context: {
        input: {
          intentions: [], rhythms: [], capacityWindows: [], placements: [], dayProfiles: [],
          externalCommitments: [{
            id: 'later-appointment', title: 'Real appointment', source: 'calendar', sourceId: 'calendar:later',
            interval: { kind: 'datedLocal', date: '2026-09-15', start: '14:00', end: '15:00' },
            hard: true, travelBeforeMinutes: 0, transitionAfterMinutes: 0,
          }],
        },
        titleByTargetId: {}, warnings: [],
      },
      now: { date: '2026-09-15', time: '09:00', timezone: 'Australia/Perth' },
    });

    render(<TodayScreen />);

    const later = screen.getByRole('region', { name: 'Later' });
    expect(await within(later).findByText('Real appointment')).toBeTruthy();
    expect(within(later).getByText(/No saved private plan is available/)).toBeTruthy();
  });

  it('surfaces skipped calendar facts instead of presenting Later as genuinely empty', async () => {
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext.mockResolvedValue({
      ok: true,
      context: {
        input: {
          intentions: [], rhythms: [], capacityWindows: [], placements: [], dayProfiles: [],
          externalCommitments: [],
        },
        titleByTargetId: {},
        warnings: ['calendar[0]: A saved commitment could not be read.'],
      },
      now: { date: '2026-09-15', time: '09:00', timezone: 'Australia/Perth' },
    });
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok',
      updatedAt: '2026-09-15T01:00:00.000Z',
      plan: {
        placements: [], rejectedExistingPlacements: [],
        unscheduledIntentionIds: [], unscheduledRhythmIds: [],
      },
    });

    render(<TodayScreen />);

    const later = screen.getByRole('region', { name: 'Later' });
    expect(await within(later).findByText('Some calendar or planning facts could not be shown.')).toBeTruthy();
    expect(within(later).queryByText('Nothing else is recorded for later today.')).toBeNull();
  });

  it('refreshes Today facts when the current commitment reaches its end boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15, 10, 15, 0));
    const currentCommitment = {
      id: 'current-meeting', title: 'School meeting', source: 'calendar' as const, sourceId: 'calendar:meeting',
      interval: { kind: 'datedLocal' as const, date: '2026-09-15', start: '10:00', end: '10:30', timezone: 'Australia/Perth' },
      hard: true, travelBeforeMinutes: 0, transitionAfterMinutes: 0,
    };
    const liveContext = {
      ok: true as const,
      context: {
        input: {
          intentions: [], rhythms: [], capacityWindows: [], placements: [], dayProfiles: [],
          externalCommitments: [currentCommitment],
        },
        titleByTargetId: {}, warnings: [],
      },
    };
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext
      .mockResolvedValueOnce({
        ...liveContext,
        now: { date: '2026-09-15', time: '10:15', timezone: 'Australia/Perth' },
      })
      .mockResolvedValue({
        ...liveContext,
        now: { date: '2026-09-15', time: '10:30', timezone: 'Australia/Perth' },
      });

    render(<TodayScreen />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('School meeting')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    });

    expect(schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('School meeting')).toBeNull();
  });

  it('moves a private placement from Later to scheduled Now context at its start without remounting', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15, 11, 59, 0));
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    reducedDayMocks.loadTodayDayMode.mockResolvedValue({
      ok: true, date: '2026-09-15', dayMode: 'reduced',
    });
    const liveContext = {
      ok: true as const,
      context: {
        input: {
          intentions: [], rhythms: [], capacityWindows: [], placements: [], dayProfiles: [],
          externalCommitments: [],
        },
        titleByTargetId: {
          'adhoc-pay-water-bill': 'Pay water bill',
          'scheduled-task-b': 'Scheduled task B',
        },
        warnings: [],
      },
    };
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext
      .mockResolvedValueOnce({
        ...liveContext,
        now: { date: '2026-09-15', time: '11:59', timezone: 'Australia/Perth' },
      })
      .mockResolvedValueOnce({
        ...liveContext,
        now: { date: '2026-09-15', time: '11:59', timezone: 'Australia/Perth' },
      })
      .mockResolvedValue({
        ...liveContext,
        now: { date: '2026-09-15', time: '12:00', timezone: 'Australia/Perth' },
      });
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok',
      updatedAt: '2026-09-15T03:59:00.000Z',
      plan: {
        placements: [{
          id: 'scheduled-b', intentionId: 'scheduled-task-b', date: '2026-09-15',
          start: '12:00', end: '12:30', origin: 'scheduler', targetKind: 'intention',
          variantKind: 'normal', provenance: ['scheduler'],
        }],
        rejectedExistingPlacements: [], unscheduledIntentionIds: [], unscheduledRhythmIds: [],
      },
    });

    render(<TodayScreen />);
    await act(async () => { await Promise.resolve(); });
    const now = screen.getByRole('region', { name: 'Now' });
    const later = screen.getByRole('region', { name: 'Later' });
    expect(within(later).getByText('Scheduled task B')).toBeTruthy();
    expect(within(now).queryByText('Scheduled task B')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000);
    });

    expect(within(now).getByText('Scheduled for this time')).toBeTruthy();
    expect(within(now).getByText('Scheduled task B')).toBeTruthy();
    expect(within(now).getByText('Flexible private plan · normal')).toBeTruthy();
    expect(within(later).queryByText('Scheduled task B')).toBeNull();
    expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    expect(screen.getByText('Reduced Day active')).toBeTruthy();
    expect(reducedDayMocks.loadTodayDayMode).toHaveBeenCalledTimes(1);
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('refreshes the Today date and facts at local midnight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 30));
    const emptyContext = {
      ok: true as const,
      context: {
        input: {
          intentions: [], rhythms: [], capacityWindows: [], placements: [], dayProfiles: [],
          externalCommitments: [],
        },
        titleByTargetId: {}, warnings: [],
      },
    };
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext
      .mockResolvedValueOnce({
        ...emptyContext,
        now: { date: '2026-09-15', time: '23:59', timezone: 'Australia/Perth' },
      })
      .mockResolvedValue({
        ...emptyContext,
        now: { date: '2026-09-16', time: '00:00', timezone: 'Australia/Perth' },
      });
    reducedDayMocks.loadTodayDayMode
      .mockResolvedValueOnce({ ok: true, date: '2026-09-15', dayMode: 'reduced' })
      .mockResolvedValue({ ok: true, date: '2026-09-16', dayMode: 'normal' });

    render(<TodayScreen />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Tuesday, September 15')).toBeTruthy();
    expect(screen.getByText('Reduced Day active')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });

    expect(schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Wednesday, September 16')).toBeTruthy();
    expect(screen.queryByText('Reduced Day active')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reduce today' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Return to normal day' })).toBeNull();
    expect(reducedDayMocks.loadTodayDayMode).toHaveBeenCalledTimes(2);
    expect(reducedDayMocks.loadTodayDayMode).toHaveBeenNthCalledWith(1, { readOnly: true });
    expect(reducedDayMocks.loadTodayDayMode).toHaveBeenNthCalledWith(2, { readOnly: true });
  });

  it('keeps Now usable and does not call an invalid private plan empty', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'invalid', errors: ['schedulerPlanState.plan: invalid'],
    });

    render(<TodayScreen />);

    expect(await screen.findByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    const later = screen.getByRole('region', { name: 'Later' });
    expect((await within(later).findByRole('alert')).textContent).toContain('saved private plan could not be read');
    expect(within(later).queryByText('Nothing else is recorded for later today.')).toBeNull();
  });

  it('keeps Now and fixed facts usable without presenting a pending calendar-repair plan as current', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext.mockResolvedValue({
      ok: true,
      context: {
        input: {
          intentions: [], rhythms: [], capacityWindows: [], placements: [], dayProfiles: [],
          externalCommitments: [{
            id: 'current-calendar', title: 'Current calendar commitment', source: 'calendar', sourceId: 'calendar:current',
            interval: { kind: 'datedLocal', date: '2026-09-15', start: '10:30', end: '11:00' },
            hard: true, travelBeforeMinutes: 0, transitionAfterMinutes: 0,
          }],
        },
        titleByTargetId: { 'stale-task': 'Stale flexible placement' },
        warnings: [],
      },
      now: { date: '2026-09-15', time: '09:00', timezone: 'Australia/Perth' },
    });
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      calendarRepairPendingAt: '2026-09-15T01:00:00.000Z',
      status: 'ok',
      updatedAt: '2026-09-15T00:00:00.000Z',
      plan: {
        placements: [{
          id: 'stale-placement', intentionId: 'stale-task', date: '2026-09-15', start: '10:00', end: '10:20',
          origin: 'scheduler', targetKind: 'intention', variantKind: 'normal', provenance: ['scheduler'],
        }],
        rejectedExistingPlacements: [],
        unscheduledIntentionIds: [],
        unscheduledRhythmIds: [],
      },
    });

    render(<TodayScreen />);

    expect(await screen.findByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    const later = screen.getByRole('region', { name: 'Later' });
    expect((await within(later).findByRole('alert')).textContent).toContain(
      'The flexible private plan needs repair after a calendar change.',
    );
    expect(within(later).getByText('Current calendar commitment')).toBeTruthy();
    expect(within(later).queryByText('Stale flexible placement')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Changed' })).toBeNull();
  });

  it('uses the pending calendar-repair action to run a canonical repair before refreshing Today', async () => {
    const user = userEvent.setup();
    const pendingPlan = {
      placements: [],
      rejectedExistingPlacements: [],
      unscheduledIntentionIds: [],
      unscheduledRhythmIds: [],
    };
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState
      .mockResolvedValueOnce({
        calendarRepairPendingAt: '2026-09-15T01:00:00.000Z',
        status: 'ok',
        updatedAt: '2026-09-15T00:00:00.000Z',
        plan: pendingPlan,
      })
      .mockResolvedValue({
        status: 'ok',
        updatedAt: '2026-09-15T01:05:00.000Z',
        plan: pendingPlan,
      });

    render(<TodayScreen />);

    const later = screen.getByRole('region', { name: 'Later' });
    expect((await within(later).findByRole('alert')).textContent).toContain(
      'The flexible private plan needs repair after a calendar change.',
    );

    await user.click(within(later).getByRole('button', { name: 'Retry repair' }));

    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledWith({
      reason: 'Retry the saved calendar change using current scheduling information.',
      trigger: 'calendarChanged',
    });
    await waitFor(() => {
      expect(within(later).queryByText(
        'The flexible private plan needs repair after a calendar change.',
      )).toBeNull();
    });
  });

  it('keeps pending attention visible when the Today repair retry fails', async () => {
    const user = userEvent.setup();
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      calendarRepairPendingAt: '2026-09-15T01:00:00.000Z',
      status: 'ok',
      updatedAt: '2026-09-15T00:00:00.000Z',
      plan: {
        placements: [],
        rejectedExistingPlacements: [],
        unscheduledIntentionIds: [],
        unscheduledRhythmIds: [],
      },
    });
    schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan.mockResolvedValue({
      ok: false,
      errors: ['schedulerPlanState: Synthetic retry failure.'],
      warnings: [],
    });

    render(<TodayScreen />);

    const later = screen.getByRole('region', { name: 'Later' });
    await user.click(await within(later).findByRole('button', { name: 'Retry repair' }));

    expect((await within(later).findByRole('alert')).textContent).toContain(
      'schedulerPlanState: Synthetic retry failure.',
    );
    expect(within(later).getByText(
      'The flexible private plan needs repair after a calendar change.',
    )).toBeTruthy();
  });

  it('isolates an optional live-context failure from the readable Now task', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext.mockResolvedValue({
      ok: false,
      errors: ['calendar: synthetic read failure'],
      warnings: [],
    });

    render(<TodayScreen />);

    expect(await screen.findByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    const later = screen.getByRole('region', { name: 'Later' });
    expect((await within(later).findByRole('alert')).textContent).toContain('Later and Changed could not be read');
    expect(within(later).queryByText('Nothing else is recorded for later today.')).toBeNull();
  });

  it('does not let an older plan-context read replace newer Later facts', async () => {
    let resolveOld!: (value: unknown) => void;
    const oldRead = new Promise((resolve) => { resolveOld = resolve; });
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([persistedOneOffTask()]);
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext
      .mockImplementationOnce(() => oldRead)
      .mockResolvedValue({
        ok: true,
        context: {
          input: {
            intentions: [], rhythms: [], capacityWindows: [], placements: [], dayProfiles: [],
            externalCommitments: [{
              id: 'new', title: 'Newer appointment', source: 'calendar', sourceId: 'calendar:new',
              interval: { kind: 'datedLocal', date: '2026-09-15', start: '14:00', end: '15:00' },
              hard: true, travelBeforeMinutes: 0, transitionAfterMinutes: 0,
            }],
          },
          titleByTargetId: {}, warnings: [],
        },
        now: { date: '2026-09-15', time: '09:00', timezone: 'Australia/Perth' },
      });

    render(<TodayScreen />);
    expect(await screen.findByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    expect(await screen.findByText('Newer appointment')).toBeTruthy();

    resolveOld({
      ok: true,
      context: {
        input: {
          intentions: [], rhythms: [], capacityWindows: [], placements: [], dayProfiles: [],
          externalCommitments: [{
            id: 'old', title: 'Stale appointment', source: 'calendar', sourceId: 'calendar:old',
            interval: { kind: 'datedLocal', date: '2026-09-15', start: '13:00', end: '14:00' },
            hard: true, travelBeforeMinutes: 0, transitionAfterMinutes: 0,
          }],
        },
        titleByTargetId: {}, warnings: [],
      },
      now: { date: '2026-09-15', time: '09:00', timezone: 'Australia/Perth' },
    });

    await waitFor(() => expect(screen.queryByText('Stale appointment')).toBeNull());
    expect(screen.getByText('Newer appointment')).toBeTruthy();
  });

  it('refreshes Later when the app reports a background scheduler revision', async () => {
    const firstContext = await schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext();
    const rendered = render(<TodayScreen planRevision={0} />);
    await screen.findByRole('region', { name: 'Later' });
    schedulerPlanCoordinatorMocks.buildCurrentLiveSchedulingContext.mockResolvedValue({
      ...firstContext,
      context: {
        ...firstContext.context,
        input: {
          ...firstContext.context.input,
          externalCommitments: [{
            id: 'new-background-fact', title: 'Updated appointment', source: 'calendar', sourceId: 'calendar:updated',
            interval: { kind: 'datedLocal', date: '2026-09-15', start: '14:00', end: '15:00' },
            hard: true, travelBeforeMinutes: 0, transitionAfterMinutes: 0,
          }],
        },
      },
    });

    rendered.rerender(<TodayScreen planRevision={1} />);

    expect(await screen.findByText('Updated appointment')).toBeTruthy();
  });

  it('uses the mode-aware authoritative Undo and refreshes Changed without a reload', async () => {
    const user = userEvent.setup();
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok', plan: persistedReducedDayRepairPlan(), updatedAt: '2026-09-15T01:00:00.000Z',
    });
    render(<TodayScreen />);
    const changed = await screen.findByRole('region', { name: 'Changed' });

    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({ status: 'missing' });
    await user.click(within(changed).getByRole('button', { name: 'Undo last change' }));

    expect(reducedDayMocks.undoTodayPlanChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Changed' })).toBeNull());
    expect(reducedDayMocks.loadTodayDayMode.mock.calls.length).toBeGreaterThan(1);
  });

  it.each([
    ['calendarChanged', 'A read-only calendar commitment changed.'],
    ['completionChanged', 'A Today task was completed.'],
  ] as const)('does not offer plan-only Undo for a %s repair whose source fact remains changed', async (trigger, reason) => {
    const repairedPlan = persistedReducedDayRepairPlan();
    repairedPlan.repair = {
      ...repairedPlan.repair!,
      trigger,
      reason,
      changes: [{
        kind: 'moved', targetKind: 'intention', targetId: 'adhoc-pay-water-bill',
        from: { date: '2026-09-15', start: '10:00', end: '10:10', variantKind: 'normal' },
        to: { date: '2026-09-15', start: '11:00', end: '11:10', variantKind: 'normal' },
        reason,
      }],
    };
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok', plan: repairedPlan, updatedAt: '2026-09-15T01:00:00.000Z',
    });

    render(<TodayScreen />);

    const changed = await screen.findByRole('region', { name: 'Changed' });
    expect(within(changed).queryByRole('button', { name: 'Undo last change' })).toBeNull();
    expect(reducedDayMocks.undoTodayPlanChange).not.toHaveBeenCalled();
  });

  it('refreshes Later and Changed after a successful Today lifecycle repair', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([
      persistedOneOffTask({
        minimumAchievedAt: '2026-09-15T00:30:00.000Z',
        status: 'minimumDone',
      }),
    ]);
    render(<TodayScreen />);
    const park = await screen.findByRole('button', { name: 'Park' });
    const repairedPlan = persistedReducedDayRepairPlan();
    repairedPlan.repair = {
      ...repairedPlan.repair!,
      trigger: 'userCorrection',
      reason: 'A Today choice changed which private work remains active.',
      changes: repairedPlan.repair!.changes.map((change) => ({
        ...change,
        reason: 'A Today choice changed which private work remains active.',
      })),
    };
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState.mockResolvedValue({
      status: 'ok', plan: repairedPlan, updatedAt: '2026-09-15T01:00:00.000Z',
    });

    await user.click(park);

    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledWith({
      reason: 'A Today choice changed which private work remains active.',
      trigger: 'userCorrection',
    });
    const changed = await screen.findByRole('region', { name: 'Changed' });
    expect(changed.textContent).toContain('A private-plan choice changed the plan.');
    expect(changed.textContent).not.toContain('Reduced Day changed');
  });

  it('keeps Today backup tools reachable inside the secondary Recovery disclosure', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    const recovery = screen.getByText('More / Recovery');
    await user.click(recovery);
    expect(screen.getByRole('button', { name: 'Export Today tasks backup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check Today tasks backup' })).toBeTruthy();
  });

  it('keeps presentation-only Today state controls out of the personal surface', () => {
    render(<TodayScreen />);

    expect(screen.queryByRole('radiogroup', { name: 'How today feels' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.queryByText(/Plan adjusted:/)).toBeNull();
  });

  it('keeps the bottom navigation available in the app shell', async () => {
    render(<App />);

    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Held' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Settings' })).toBeNull();

    const secondaryNav = screen.getByRole('navigation', { name: 'Secondary' });
    expect(within(secondaryNav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(secondaryNav).getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('renders the main task card with no more than two chips', () => {
    render(<TodayScreen />);

    const taskCard = screen.getByRole('article', { name: "Set tomorrow's first step" });
    const chips = within(taskCard).getAllByText(/Minimum counts|No catch-up pile/);

    expect(within(taskCard).getByText("Lower tomorrow's start friction before the day closes.")).toBeTruthy();
    expect(chips).toHaveLength(2);
  });

  it('renders the authoritative task inside Now', () => {
    render(<TodayScreen />);

    const now = screen.getByRole('region', { name: 'Now' });
    expect(within(now).getByRole('article', { name: "Set tomorrow's first step" })).toBeTruthy();
  });

  it('shows Add one-off as a secondary today-only action', () => {
    render(<TodayScreen />);

    expect(screen.getByRole('button', { name: 'Add one-off' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
    expect(screen.getByText('Add one today-only task. It will not go into Library.')).toBeTruthy();
  });

  it('renders the Today tasks backup export action', () => {
    render(<TodayScreen />);

    expect(screen.getByRole('heading', { name: 'Today task backup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export Today tasks backup' })).toBeTruthy();
    expect(screen.getByText('Creates a local backup file for Today tasks only.')).toBeTruthy();
    expect(screen.getByText('It does not include Library rhythms, settings, or soft placements.')).toBeTruthy();
  });

  it('renders the Today tasks backup checker UI', () => {
    render(<TodayScreen />);

    expect(screen.getByRole('heading', { name: 'Check Today tasks backup' })).toBeTruthy();
    expect(screen.getByLabelText('Today task backup text')).toBeTruthy();
    expect(screen.getByLabelText('Select Today tasks backup file')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check Today tasks backup' })).toBeTruthy();
    expect(screen.getByText('Check only. Paste or select a Today tasks backup.')).toBeTruthy();
    expect(screen.getByText('Restore is not connected yet.')).toBeTruthy();
    expect(screen.getByText('Checking does not restore tasks or change this device.')).toBeTruthy();
  });

  it('shows an empty export message and does not download when there are no saved Today tasks', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:today-tasks');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    activeTaskRepositoryMocks.loadPersistedActiveTasks.mockResolvedValueOnce([]);
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Export Today tasks backup' }));

    expect(screen.getByText('No saved Today tasks to export yet.')).toBeTruthy();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it.each([
    {
      expected: 'Saved Today tasks could not be loaded for backup.',
      result: { errors: ['activeTasks: synthetic read failure'], status: 'readFailed' as const },
    },
    {
      expected: 'Today tasks backup was not created because some saved task data could not be read.',
      result: {
        invalidRecordCount: 1,
        items: [persistedOneOffTask()],
        status: 'partial' as const,
      },
    },
  ])('does not create a misleading or partial backup when saved-task reads are uncertain', async ({ expected, result }) => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:today-tasks');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    activeTaskRepositoryMocks.loadPersistedActiveTasksResult.mockResolvedValueOnce(result);

    render(<TodayScreen />);
    await user.click(screen.getByRole('button', { name: 'Export Today tasks backup' }));

    expect(screen.getByRole('status').textContent).toContain(expected);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('exports valid active task backup JSON for saved Today tasks', async () => {
    const user = userEvent.setup();
    const exportedBlobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      exportedBlobs.push(blob);
      return 'blob:today-tasks';
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    activeTaskRepositoryMocks.loadPersistedActiveTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        showToday: false,
        status: 'done',
      }),
    ]);
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Export Today tasks backup' }));

    expect(screen.getByText('Today tasks backup created on this device.')).toBeTruthy();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:today-tasks');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(exportedBlobs).toHaveLength(1);

    const exportedJson = await exportedBlobs[0].text();
    const parsed = parseActiveTaskBackupJson(exportedJson);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload).toMatchObject({
        format: 'life-rhythm-active-task-backup',
      });
      expect(parsed.payload.activeTasks).toHaveLength(1);
      expect(parsed.payload.activeTasks[0]).toMatchObject({
        id: 'adhoc-pay-water-bill',
        source: 'adhoc',
        status: 'done',
        title: 'Pay water bill',
      });
      expect(Object.keys(parsed.payload).sort()).toEqual(['activeTasks', 'appVersion', 'exportedAt', 'format']);
      expect(parsed.payload).not.toHaveProperty('settings');
      expect(parsed.payload).not.toHaveProperty('rhythmTemplates');
      expect(parsed.payload).not.toHaveProperty('schedulerOutput');
      expect(parsed.payload).not.toHaveProperty('completionLog');
      expect(parsed.payload).not.toHaveProperty('taskHistory');
      expect(parsed.payload).not.toHaveProperty('migrationLog');
      expect(parsed.payload).not.toHaveProperty('lifeRhythm_v146');
    }
  });

  it('exports Today task backup with time-edge fields when saved tasks have them', async () => {
    const user = userEvent.setup();
    const exportedBlobs: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        exportedBlobs.push(blob);
        return 'blob:today-tasks';
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    activeTaskRepositoryMocks.loadPersistedActiveTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2026-06-17T09:00:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        missedPolicy: 'minimumOnly',
        timeConstraint: 'dueBy',
      }),
    ]);
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Export Today tasks backup' }));

    const parsed = parseActiveTaskBackupJson(await exportedBlobs[0].text());

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload.activeTasks[0]).toMatchObject({
        dueAt: '2026-06-17T09:00:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        missedPolicy: 'minimumOnly',
        timeConstraint: 'dueBy',
      });
      expect(parsed.payload).not.toHaveProperty('settings');
      expect(parsed.payload).not.toHaveProperty('rhythmTemplates');
      expect(parsed.payload).not.toHaveProperty('schedulerOutput');
    }
  });

  it('does not use localStorage when exporting Today tasks backup', async () => {
    const user = userEvent.setup();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:today-tasks'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    activeTaskRepositoryMocks.loadPersistedActiveTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Export Today tasks backup' }));

    expect(screen.getByText('Today tasks backup created on this device.')).toBeTruthy();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('validates pasted Today task backup JSON and shows a preview without saving', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    fireEvent.change(screen.getByLabelText('Today task backup text'), {
      target: { value: validActiveTaskBackupJson({ status: 'paused' }) },
    });
    await user.click(screen.getByRole('button', { name: 'Check Today tasks backup' }));

    expect(screen.getByRole('status').textContent).toContain('Today tasks backup looks valid. Restore is not connected yet.');
    const preview = screen.getByLabelText('Today task backup preview');
    expect(preview.textContent).toContain('Pay water bill (paused)');
    expect(preview.textContent).toContain('Tasks');
    expect(preview.textContent).toContain('1');
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
  });

  it('shows invalid feedback for malformed pasted Today task backup JSON', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    fireEvent.change(screen.getByLabelText('Today task backup text'), {
      target: { value: '{ not json' },
    });
    await user.click(screen.getByRole('button', { name: 'Check Today tasks backup' }));

    expect(screen.getByRole('status').textContent).toContain('This Today tasks backup could not be used. Nothing changed on this device.');
    expect(screen.getByText('backup: Active task backup JSON is malformed.')).toBeTruthy();
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
  });

  it('loads a valid selected Today task backup file and validates it', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    const file = new File([validActiveTaskBackupJson({ status: 'minimumDone' })], 'today-tasks.json', {
      type: 'application/json',
    });

    await user.upload(screen.getByLabelText('Select Today tasks backup file'), file);

    expect(screen.getByRole('status').textContent).toContain('Today tasks backup loaded. Choose Check Today tasks backup.');

    await user.click(screen.getByRole('button', { name: 'Check Today tasks backup' }));

    expect(screen.getByRole('status').textContent).toContain('Today tasks backup looks valid. Restore is not connected yet.');
    expect(screen.getByLabelText('Today task backup preview').textContent).toContain('Pay water bill (minimumDone)');
  });

  it('loads an invalid selected Today task backup file and shows invalid feedback after checking', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    const file = new File(['{ not json'], 'today-tasks.json', {
      type: 'application/json',
    });

    await user.upload(screen.getByLabelText('Select Today tasks backup file'), file);

    expect(screen.getByRole('status').textContent).toContain('Today tasks backup loaded. Choose Check Today tasks backup.');

    await user.click(screen.getByRole('button', { name: 'Check Today tasks backup' }));

    expect(screen.getByRole('status').textContent).toContain('This Today tasks backup could not be used. Nothing changed on this device.');
    expect(screen.getByText('backup: Active task backup JSON is malformed.')).toBeTruthy();
  });

  it('checks Today task backups without localStorage, Dexie writes, or current-task changes', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    expect(await screen.findByRole('article', { name: 'Pay water bill' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Today task backup text'), {
      target: { value: validActiveTaskBackupJson({ title: 'Different saved task' }) },
    });
    await user.click(screen.getByRole('button', { name: 'Check Today tasks backup' }));

    expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Different saved task' })).toBeNull();
    expect(screen.getByLabelText('Today task backup preview').textContent).toContain('Different saved task (paused)');
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('keeps Add one-off as a quiet secondary action inside Now', () => {
    render(<TodayScreen />);

    const now = screen.getByRole('region', { name: 'Now' });

    expect(within(now).getByRole('article', { name: "Set tomorrow's first step" })).toBeTruthy();
    expect(within(now).getByRole('button', { name: 'Add one-off' })).toBeTruthy();
  });

  it('opens task details', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByRole('heading', { name: 'Why this?' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Versions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hidden edges' })).toBeTruthy();
  });

  it('runs the Start task flow before minimum completion feedback', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    expect(screen.getByRole('button', { name: 'Start task' })).toBeTruthy();
    expect(screen.queryByText('Minimum done. That counts.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Start task' }));

    expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark minimum done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep going' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Mark minimum done' }));

    expect(screen.getAllByText('Minimum done. That counts.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Minimum done' })).toBeTruthy();
  });

  it('persists Start as inProgress for a persisted active task', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus).toHaveBeenCalledWith(
        'adhoc-pay-water-bill',
        'inProgress',
      );
    });
    expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
  });

  it('pauses and resumes an in-progress task', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(screen.getByText('Paused. You can restart small.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark minimum done' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Resume' }));

    expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('persists Pause and Resume for a persisted active task', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Pause' }));
    await user.click(await screen.findByRole('button', { name: 'Resume' }));

    expect(activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls.map((call) => call[1])).toEqual([
      'inProgress',
      'paused',
      'inProgress',
    ]);
  });

  it('persists Minimum done for a persisted active task', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls.map((call) => call[1])).toEqual([
        'inProgress',
        'minimumDone',
      ]);
    });
    expect(screen.getAllByText('Minimum done. That counts.').length).toBeGreaterThan(0);
  });

  it('persists Stop here as done and removes the task from the next-action slot', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Stop here' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus).toHaveBeenLastCalledWith(
        'adhoc-pay-water-bill',
        'done',
      );
    });
    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
    expect(screen.getByText('Stopped here. That task is out of Today. No catch-up pile.')).toBeTruthy();
    expect(screen.getByText('Choose rhythms to turn on')).toBeTruthy();
  });

  it('persists Mark normal done as done and removes the task from Today', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const saveSettingsSpy = vi.spyOn(settingsRepository, 'saveSettings');
    const saveLibraryRhythmSpy = vi.spyOn(libraryRhythmRepository, 'saveCustomLibraryRhythm');
    const saveSoftPlacementSpy = vi.spyOn(softPlacementRepository, 'saveSoftPlacement');
    const updateSoftPlacementSpy = vi.spyOn(softPlacementRepository, 'updateSoftPlacementStatus');
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Keep going' }));
    await user.click(await screen.findByRole('button', { name: 'Mark normal done' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls.map((call) => call[1])).toEqual([
        'inProgress',
        'minimumDone',
        'inProgress',
        'done',
      ]);
    });

    const statuses = activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls.map((call) => call[1]);

    expect(statuses).not.toContain('normalDone');
    expect(statuses).not.toContain('fullDone');
    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
    expect(screen.getByText('Normal done. That task is out of Today. No catch-up pile.')).toBeTruthy();
    expect(screen.getByText('Choose rhythms to turn on')).toBeTruthy();
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(saveSettingsSpy).not.toHaveBeenCalled();
    expect(saveLibraryRhythmSpy).not.toHaveBeenCalled();
    expect(saveSoftPlacementSpy).not.toHaveBeenCalled();
    expect(updateSoftPlacementSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('persists Mark full done as done and removes the task from Today', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const saveSettingsSpy = vi.spyOn(settingsRepository, 'saveSettings');
    const saveLibraryRhythmSpy = vi.spyOn(libraryRhythmRepository, 'saveCustomLibraryRhythm');
    const saveSoftPlacementSpy = vi.spyOn(softPlacementRepository, 'saveSoftPlacement');
    const updateSoftPlacementSpy = vi.spyOn(softPlacementRepository, 'updateSoftPlacementStatus');
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Keep going' }));
    await user.click(await screen.findByRole('button', { name: 'Mark full done' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls.map((call) => call[1])).toEqual([
        'inProgress',
        'minimumDone',
        'inProgress',
        'done',
      ]);
    });

    const statuses = activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls.map((call) => call[1]);

    expect(statuses).not.toContain('normalDone');
    expect(statuses).not.toContain('fullDone');
    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
    expect(screen.getByText('Full done. That task is out of Today. No catch-up pile.')).toBeTruthy();
    expect(screen.getByText('Choose rhythms to turn on')).toBeTruthy();
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(saveSettingsSpy).not.toHaveBeenCalled();
    expect(saveLibraryRhythmSpy).not.toHaveBeenCalled();
    expect(saveSoftPlacementSpy).not.toHaveBeenCalled();
    expect(updateSoftPlacementSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('does not create new statuses for normal or full completion endpoints', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Keep going' }));
    await user.click(await screen.findByRole('button', { name: 'Mark normal done' }));

    const statuses = activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls.map((call) => call[1]);

    expect(statuses).not.toContain('normalDone');
    expect(statuses).not.toContain('fullDone');
    expect(statuses[statuses.length - 1]).toBe('done');
    expect(document.body.textContent).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|catch up|optimize|productivity score|compliance)\b/i,
    );
  });

  it('persists Park and removes the task from the next-action slot', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Park' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus).toHaveBeenLastCalledWith(
        'adhoc-pay-water-bill',
        'parked',
      );
    });
    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
    expect(screen.getByText('Parked. It is safely held. No catch-up pile.')).toBeTruthy();
  });

  it('persists Not today and removes the task from the next-action slot', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Not today' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus).toHaveBeenLastCalledWith(
        'adhoc-pay-water-bill',
        'notToday',
      );
    });
    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
    expect(screen.getByText('Not today. It is out of the current list. No catch-up pile.')).toBeTruthy();
  });

  it('shows the next visible active task after the current task leaves Today', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask(),
      persistedOneOffTask({
        id: 'adhoc-file-letter',
        title: 'File letter',
      }),
    ]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Stop here' }));

    expect(await screen.findByRole('article', { name: 'File letter' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
  });

  it('persists Keep going after minimum done as inProgress', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);
    render(<TodayScreen />);

    await screen.findByRole('article', { name: 'Pay water bill' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Keep going' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus.mock.calls.map((call) => call[1])).toEqual([
        'inProgress',
        'minimumDone',
        'inProgress',
      ]);
    });
    expect(screen.getByText('Optional. Minimum already counts. Continue only if it helps.')).toBeTruthy();
  });

  it('renders durable and legacy Minimum achievement without guessing for ordinary in-progress work', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        minimumAchievedAt: '2026-06-17T00:05:00.000Z',
        status: 'inProgress',
      }),
    ]);
    const achievedRender = render(<TodayScreen />);

    expect(await screen.findByText('Minimum already counts.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark minimum done' })).toBeNull();
    achievedRender.unmount();

    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({ status: 'minimumDone' }),
    ]);
    const legacyMinimumRender = render(<TodayScreen />);
    expect((await screen.findAllByText('Minimum done. That counts.')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Mark minimum done' })).toBeNull();
    legacyMinimumRender.unmount();

    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({ status: 'inProgress' }),
    ]);
    render(<TodayScreen />);
    expect(await screen.findByText('In progress. Keep it small.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark minimum done' })).toBeTruthy();
  });

  it('does not show Minimum achieved when the persistence transition fails', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({ status: 'inProgress' }),
    ]);
    activeTaskRepositoryMocks.updateActiveTaskStatus.mockResolvedValueOnce({
      errors: ['write failed'],
      ok: false,
    });
    render(<TodayScreen />);

    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));

    expect(await screen.findByText('Task state was not saved. Try again.')).toBeTruthy();
    expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark minimum done' })).toBeTruthy();
    expect(screen.queryByText('Minimum already counts.')).toBeNull();
  });

  it('keeps Minimum achieved when Keep going persistence fails', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        minimumAchievedAt: '2026-06-17T00:05:00.000Z',
        status: 'minimumDone',
      }),
    ]);
    activeTaskRepositoryMocks.updateActiveTaskStatus.mockResolvedValueOnce({
      errors: ['write failed'],
      ok: false,
    });
    render(<TodayScreen />);

    await user.click(await screen.findByRole('button', { name: 'Keep going' }));

    expect(await screen.findByText('Task state was not saved. Try again.')).toBeTruthy();
    expect((screen.getAllByText('Minimum done. That counts.')).length).toBeGreaterThan(0);
    expect(screen.queryByText('In progress. Keep it small.')).toBeNull();
  });

  it('keeps optional normal and full versions hidden until Keep going', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    expect(screen.queryByRole('button', { name: 'Mark normal done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark full done' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Keep going' }));

    expect(screen.getByText('Optional. Keep the minimum small, then continue only if it helps.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Normal version' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Full version' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark normal done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark full done' })).toBeTruthy();
  });

  it('keeps going after minimum done with minimum-already-counts copy', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Mark minimum done' }));
    await user.click(screen.getByRole('button', { name: 'Keep going' }));

    expect(screen.getByText('Optional. Minimum already counts. Continue only if it helps.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark normal done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark full done' })).toBeTruthy();
  });

  it('keeps pressure wording out of the optional completion flow', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Mark minimum done' }));
    await user.click(screen.getByRole('button', { name: 'Keep going' }));

    const taskCard = screen.getByRole('article', { name: "Set tomorrow's first step" });
    const flowText = taskCard.textContent?.toLowerCase() ?? '';

    expect(flowText).toContain('optional. minimum already counts. continue only if it helps.');
    expect(flowText).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|optimize|compliance)\b|catch up|productivity score/,
    );
  });

  it('can stop after opening optional continuation', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Keep going' }));
    await user.click(screen.getByRole('button', { name: 'Stop here' }));

    expect(screen.queryByRole('heading', { name: 'Normal version' })).toBeNull();
    expect(screen.getByText('Stopped here. That task is out of Today. No catch-up pile.')).toBeTruthy();
  });

  it('opens Start Boost from the task card', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));

    const dialog = screen.getByRole('dialog', { name: 'Start Boost' });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: "Set tomorrow's first step" })).toBeTruthy();
    expect(within(dialog).getByText(/Minimum:/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Read the first action/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Set up the space/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Do the 30-second start/ })).toBeTruthy();
    expect(within(dialog).getByText('What is blocking the start?')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Too big' })).toBeTruthy();
  });

  it('opens Start Boost from in-progress state', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Start Boost' }));

    expect(screen.getByRole('dialog', { name: 'Start Boost' })).toBeTruthy();
    expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
  });

  it('opens Start Boost from paused state', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await user.click(screen.getByRole('button', { name: 'Start Boost' }));

    expect(screen.getByRole('dialog', { name: 'Start Boost' })).toBeTruthy();
    expect(screen.getByText('Paused. You can restart small.')).toBeTruthy();
  });

  it('selects a mock Start Boost activation option without writing storage', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: /Read the first action/ }));

    expect(screen.getByText('Read the first action is enough to begin.')).toBeTruthy();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('shows support buttons after barrier selection', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Unclear first step' }));

    expect(screen.getByText('Choose one support')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Name the first step/ })).toBeTruthy();
    expect(screen.queryByText('Did that reduce friction?')).toBeNull();
  });

  it('renders feedback controls after support selection', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Low energy' }));
    await user.click(screen.getByRole('button', { name: /Use the minimum version/ }));

    expect(screen.getByText('Did that reduce friction?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A bit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Made it harder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  });

  it('closes Start Boost after minimum completion', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Too big' }));
    expect(screen.getByText('Choose one support')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Mark minimum done' }));

    expect(screen.queryByRole('dialog', { name: 'Start Boost' })).toBeNull();
    expect(screen.getAllByText('Minimum done. That counts.').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Start Boost' })).toBeNull();
  });

  it('opens Add one-off and persists one active Today task only', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Add one-off' }));
    expect(screen.getByText('For today only. Saved on this device. It will not go into Library.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Optional useful window/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('combobox', { name: 'Time edge type' })).toBeNull();
    await user.type(screen.getByLabelText('Task title'), 'Pay water bill');
    await user.selectOptions(screen.getByLabelText('Area'), 'money');
    await user.type(screen.getByLabelText('Minimum version'), 'Open the bill and note the due date.');
    await user.type(screen.getByLabelText('Minimum minutes'), '7');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(screen.queryByRole('dialog', { name: 'Add one-off' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    expect(screen.getByText('One-off saved to Today on this device. It will not go into Library.')).toBeTruthy();
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).toHaveBeenCalledTimes(1);
    expect(activeTaskRepositoryMocks.saveActiveTodayTask.mock.calls[0][0]).toMatchObject({
      area: 'money',
      minimum: { label: 'Open the bill and note the due date.', minutes: 7 },
      normal: { label: 'Open the bill and note the due date.', minutes: 7 },
      full: { label: 'Open the bill and note the due date.', minutes: 7 },
      showToday: true,
      source: 'adhoc',
      status: 'active',
      title: 'Pay water bill',
    });
    expect(activeTaskRepositoryMocks.saveActiveTodayTask.mock.calls[0][0]).not.toHaveProperty('timeConstraint');
    expect(activeTaskRepositoryMocks.saveActiveTodayTask.mock.calls[0][0]).not.toHaveProperty('dueAt');
    expect(activeTaskRepositoryMocks.saveActiveTodayTask.mock.calls[0][0]).not.toHaveProperty('fixedAt');
    expect(activeTaskRepositoryMocks.saveActiveTodayTask.mock.calls[0][0]).not.toHaveProperty('expiresAfter');
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('sends three distinctly entered action durations to the canonical Today write', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);
    await user.click(screen.getByRole('button', { name: 'Add one-off' }));
    await user.type(screen.getByLabelText('Task title'), 'Sort files');
    await user.type(screen.getByLabelText('Minimum version'), 'Open folder');
    await user.type(screen.getByLabelText('Minimum minutes'), '13');
    await user.click(screen.getByRole('button', { name: /Optional normal\/full versions/ }));
    await user.type(screen.getByLabelText('Normal version'), 'Sort papers');
    await user.type(screen.getByLabelText('Normal minutes'), '29');
    await user.type(screen.getByLabelText('Full version'), 'File everything');
    await user.type(screen.getByLabelText('Full minutes'), '61');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));
    expect(activeTaskRepositoryMocks.saveActiveTodayTask.mock.calls.slice(-1)[0]?.[0]).toMatchObject({
      minimum: { label: 'Open folder', minutes: 13 },
      normal: { label: 'Sort papers', minutes: 29 },
      full: { label: 'File everything', minutes: 61 },
    });
  });

  it('persists a due-by time edge for an Add one-off task', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await openFilledOneOffModal(user);
    await user.selectOptions(screen.getByLabelText('Time edge type'), 'dueBy');
    fireEvent.change(screen.getByLabelText('Due by'), {
      target: { value: '2026-06-17T09:00' },
    });
    await user.click(screen.getByLabelText('Minimum still helps after the time edge'));
    await user.selectOptions(screen.getByLabelText('If it stops being useful'), 'minimumOnly');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    const saved = savedOneOffTask();

    expect(saved).toMatchObject({
      minimumStillUsefulAfterDeadline: true,
      missedPolicy: 'minimumOnly',
      source: 'adhoc',
      timeConstraint: 'dueBy',
      title: 'Pay water bill',
    });
    expect(saved.dueAt).toBe(new Date('2026-06-17T09:00').toISOString());
    expect(saved).not.toHaveProperty('settings');
    expect(saved).not.toHaveProperty('rhythmTemplates');
    expect(saved).not.toHaveProperty('schedulerOutput');
    expect(screen.getByLabelText('Time edge').textContent).toContain('Useful before');
    expect(screen.getByLabelText('Time edge').textContent).toContain('Minimum still helps');
    expect(screen.getByLabelText('Time edge').textContent).toContain('This helps guide private planning.');
  });

  it('persists a fixed-at time edge for an Add one-off task', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await openFilledOneOffModal(user);
    await user.selectOptions(screen.getByLabelText('Time edge type'), 'fixedAt');
    fireEvent.change(screen.getByLabelText('Fixed at'), {
      target: { value: '2026-06-17T10:30' },
    });
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(savedOneOffTask()).toMatchObject({
      fixedAt: new Date('2026-06-17T10:30').toISOString(),
      timeConstraint: 'fixedAt',
    });
    expect(screen.getByLabelText('Time edge').textContent).toContain('Tied to');
    expect(screen.getByLabelText('Time edge').textContent).toContain('This helps guide private planning.');
  });

  it('persists an expires-after time edge for an Add one-off task', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await openFilledOneOffModal(user);
    await user.selectOptions(screen.getByLabelText('Time edge type'), 'expiresAfter');
    fireEvent.change(screen.getByLabelText('Expires after'), {
      target: { value: '2026-06-17T18:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(savedOneOffTask()).toMatchObject({
      expiresAfter: new Date('2026-06-17T18:00').toISOString(),
      timeConstraint: 'expiresAfter',
    });
    expect(screen.getByLabelText('Time edge').textContent).toContain('Useful until');
    expect(screen.getByLabelText('Time edge').textContent).toContain('This helps guide private planning.');
  });

  it('does not save a due-by one-off without a due-by time', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await openFilledOneOffModal(user);
    await user.selectOptions(screen.getByLabelText('Time edge type'), 'dueBy');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Add a due-by time, or keep this flexible.');
  });

  it('does not save a fixed-at one-off without a fixed time', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await openFilledOneOffModal(user);
    await user.selectOptions(screen.getByLabelText('Time edge type'), 'fixedAt');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Add the fixed time, or keep this flexible.');
  });

  it('does not save an expires-after one-off without an expires-after time', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await openFilledOneOffModal(user);
    await user.selectOptions(screen.getByLabelText('Time edge type'), 'expiresAfter');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Add when this stops being useful, or keep this flexible.');
  });

  it('does not save a one-off when latest useful start is after not-useful-after', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await openFilledOneOffModal(user);
    fireEvent.change(screen.getByLabelText('Last useful start'), {
      target: { value: '2026-06-17T18:00' },
    });
    fireEvent.change(screen.getByLabelText('Not useful after'), {
      target: { value: '2026-06-17T09:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      'Last useful start needs to be before the not-useful-after time.',
    );
  });

  it('shows calm time-edge copy without pressure wording on the Today card', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await openFilledOneOffModal(user);
    await user.selectOptions(screen.getByLabelText('Time edge type'), 'dueBy');
    fireEvent.change(screen.getByLabelText('Due by'), {
      target: { value: '2026-06-17T09:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    const taskCard = screen.getByRole('article', { name: 'Pay water bill' });
    const cardText = taskCard.textContent?.toLowerCase() ?? '';

    expect(within(taskCard).getByLabelText('Time edge').textContent).toContain('Useful before');
    expect(within(taskCard).getByLabelText('Time edge').textContent).toContain('This helps guide private planning.');
    expect(cardText).not.toMatch(/overdue|late|failed|urgent|behind/);
  });

  it('does not show re-entry review when no time-edge task needs review', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2999-06-17T09:00:00.000Z',
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Needs a choice' })).toBeNull();
  });

  it('shows re-entry review buttons for a dueBy task whose useful window changed', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        missedPolicy: 'minimumOnly',
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    expect(screen.getByText('Some tasks may need a calm review because their useful window changed.')).toBeTruthy();
    expect(screen.getByText('Nothing moves unless you choose.')).toBeTruthy();
    expect(screen.getByText('No catch-up pile.')).toBeTruthy();
    expect(screen.getByText('Choose later when you are ready.')).toBeTruthy();
    expect(screen.getByText('Useful-before time has passed.')).toBeTruthy();
    expect(screen.getByText('Minimum may still help.')).toBeTruthy();
    expect(screen.getByText('The authored Minimum is available if you choose it.')).toBeTruthy();

    const actions = screen.getByLabelText('Re-entry actions for Pay water bill');
    expect(within(actions).getByRole('button', { name: 'Park safely' })).toBeTruthy();
    expect(within(actions).getByRole('button', { name: 'Try the minimum' })).toBeTruthy();
    expect(within(actions).getByRole('button', { name: 'Mark not today' })).toBeTruthy();
    expect(within(actions).getByRole('button', { name: 'Keep for review' })).toBeTruthy();
    expect(within(actions).queryByRole('button', { name: 'Move later' })).toBeNull();
    expect(within(actions).queryByRole('button', { name: 'No longer needed' })).toBeNull();
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
  });

  it('parks a re-entry review task only after the user clicks Park safely', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Park safely' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus).toHaveBeenCalledWith(
        'adhoc-pay-water-bill',
        'parked',
      );
    });
    expect(screen.getByText('Parked safely. Still safely held. No catch-up pile.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Needs a choice' })).toBeNull();
    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledWith({
      reason: 'A re-entry choice changed which private work remains active.',
      trigger: 'userCorrection',
    });
  });

  it('marks a re-entry review task not today only after the user clicks Mark not today', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Mark not today' }));

    await waitFor(() => {
      expect(activeTaskRepositoryMocks.updateActiveTaskStatus).toHaveBeenCalledWith(
        'adhoc-pay-water-bill',
        'notToday',
      );
    });
    expect(screen.getByText('Marked not today. Still safely held. No catch-up pile.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Needs a choice' })).toBeNull();
    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledWith({
      reason: 'A re-entry choice changed which private work remains active.',
      trigger: 'userCorrection',
    });
  });

  it('keeps a review task unchanged when the user chooses Keep for review', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    await user.click(await screen.findByRole('button', { name: 'Keep for review' }));
    expect(screen.getByText('Still safely held. Nothing changed.')).toBeTruthy();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
    expect(taskLifecycleRepositoryMocks.markTaskLifecycleNoLongerNeeded).not.toHaveBeenCalled();
    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('offers No longer needed only for an expired linked task and writes only after confirmation', async () => {
    const user = userEvent.setup();
    const task = persistedOneOffTask({
      expiresAfter: '2000-06-17T09:00:00.000Z',
      id: 'linked-expired-task',
      missedPolicy: 'archiveIfExpired',
      timeConstraint: 'expiresAfter',
      title: 'Expired linked task',
    });
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([task]);
    taskLifecycleRepositoryMocks.loadLinkedTaskPoolItemIds.mockResolvedValueOnce([task.id]);
    taskLifecycleRepositoryMocks.markTaskLifecycleNoLongerNeeded.mockResolvedValueOnce({
      item: { id: task.id, status: 'noLongerNeeded' },
      ok: true,
      placements: [],
      task: { ...task, showToday: false, status: 'skipped' },
    });

    render(<TodayScreen />);

    const action = await screen.findByRole('button', { name: 'No longer needed' });
    expect(taskLifecycleRepositoryMocks.markTaskLifecycleNoLongerNeeded).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Try the minimum' })).toBeNull();

    await user.click(action);

    await waitFor(() => {
      expect(taskLifecycleRepositoryMocks.markTaskLifecycleNoLongerNeeded).toHaveBeenCalledWith(task.id);
    });
    expect(screen.getByText('No longer needed. It is out of Today. No catch-up pile.')).toBeTruthy();
    expect(screen.queryByRole('article', { name: task.title })).toBeNull();
    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledWith({
      reason: 'A user confirmed that a re-entry task is no longer needed.',
      trigger: 'userCorrection',
    });
  });

  it('omits No longer needed when an expired task has no supported linked Pool path', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        expiresAfter: '2000-06-17T09:00:00.000Z',
        missedPolicy: 'archiveIfExpired',
        timeConstraint: 'expiresAfter',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'No longer needed' })).toBeNull();
  });

  it('keeps the prior task visible when No longer needed persistence fails', async () => {
    const user = userEvent.setup();
    const task = persistedOneOffTask({
      expiresAfter: '2000-06-17T09:00:00.000Z',
      id: 'linked-expired-task',
      missedPolicy: 'archiveIfExpired',
      timeConstraint: 'expiresAfter',
      title: 'Expired linked task',
    });
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([task]);
    taskLifecycleRepositoryMocks.loadLinkedTaskPoolItemIds.mockResolvedValueOnce([task.id]);

    render(<TodayScreen />);

    await user.click(await screen.findByRole('button', { name: 'No longer needed' }));
    expect(await screen.findByText('Task state was not saved. Try again.')).toBeTruthy();
    expect(screen.getByRole('article', { name: task.title })).toBeTruthy();
    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('selects Try the minimum without writing a status or completing the task', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try the minimum' }));

    expect(screen.getByText('Minimum selected. It has not been completed.')).toBeTruthy();
    expect(screen.getByText('Choosing Minimum does not complete it.')).toBeTruthy();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('does not offer Try the minimum after Minimum is already achieved', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        minimumAchievedAt: '2000-06-17T08:00:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try the minimum' })).toBeNull();
  });

  it('makes Try the minimum focus the exact existing task and show its authored Minimum without completing it', async () => {
    const user = userEvent.setup();
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        id: 'current-task',
        title: 'Current task',
      }),
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        id: 'minimum-review-task',
        minimum: {
          label: 'Open the exact form and write one line.',
          minutes: 5,
        },
        minimumStillUsefulAfterDeadline: true,
        missedPolicy: 'minimumOnly',
        timeConstraint: 'dueBy',
        title: 'Review exact form',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('article', { name: 'Current task' })).toBeTruthy();
    const actions = screen.getByLabelText('Re-entry actions for Review exact form');
    await user.click(within(actions).getByRole('button', { name: 'Try the minimum' }));

    const selectedTask = screen.getByRole('article', { name: 'Review exact form' });
    expect(within(selectedTask).getByText(/Open the exact form and write one line\./)).toBeTruthy();
    expect(within(selectedTask).getAllByText(/5 min/).length).toBeGreaterThan(0);
    expect(within(selectedTask).getByText('Choosing Minimum does not complete it.')).toBeTruthy();
    expect(activeTaskRepositoryMocks.updateActiveTaskStatus).not.toHaveBeenCalled();
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).not.toHaveBeenCalled();
  });

  it('shows minimum-oriented re-entry review copy after latest useful start', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        latestUsefulStartAt: '2000-06-17T09:00:00.000Z',
        notUsefulAfter: '2999-06-17T09:00:00.000Z',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    expect(screen.getByText('The latest useful start has passed.')).toBeTruthy();
    expect(screen.getByText('The original start opportunity has narrowed.')).toBeTruthy();
  });

  it('shows calm re-entry review copy after notUsefulAfter has passed', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        notUsefulAfter: '2000-06-17T09:00:00.000Z',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    expect(screen.getByText('This is past its useful window.')).toBeTruthy();
  });

  it('does not render parked or not-today tasks in the re-entry review', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        id: 'parked-task',
        showToday: false,
        status: 'parked',
        timeConstraint: 'dueBy',
      }),
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        id: 'not-today-task',
        showToday: false,
        status: 'notToday',
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Needs a choice' })).toBeNull();
    });
  });

  it('keeps forbidden pressure wording out of the re-entry review section', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    const review = await screen.findByRole('heading', { name: 'Needs a choice' });
    const sectionText = review.closest('section')?.textContent?.toLowerCase() ?? '';

    expect(sectionText).not.toMatch(/\b(overdue|late|failed|urgent|behind|missed|score|streak)\b|catch up/);
    expect(sectionText).toContain('no catch-up pile');
  });

  it('does not use localStorage while rendering the re-entry preview', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([
      persistedOneOffTask({
        dueAt: '2000-06-17T09:00:00.000Z',
        timeConstraint: 'dueBy',
      }),
    ]);

    render(<TodayScreen />);

    expect(await screen.findByRole('heading', { name: 'Needs a choice' })).toBeTruthy();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('reloads persisted active Today tasks from the repository', async () => {
    activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValueOnce([persistedOneOffTask()]);

    render(<TodayScreen />);

    expect(await screen.findByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    expect(screen.getByText('Today-only task added by you.')).toBeTruthy();
  });

  it('does not add a saved one-off to the Library catalogue', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Add one-off' }));
    await user.type(screen.getByLabelText('Task title'), 'Pay water bill');
    await user.selectOptions(screen.getByLabelText('Area'), 'money');
    await user.type(screen.getByLabelText('Minimum version'), 'Open the bill and note the due date.');
    await user.type(screen.getByLabelText('Minimum minutes'), '5');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Library' }));

    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
  });

  it('closes Start Boost from the modal close button', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Close Start Boost' }));

    expect(screen.queryByRole('dialog', { name: 'Start Boost' })).toBeNull();
  });

  it('uses settings-specific repair semantics and gives settings precedence when both markers are pending', async () => {
    const user = userEvent.setup();
    const pendingPlan = {
      placements: [],
      rejectedExistingPlacements: [],
      unscheduledIntentionIds: [],
      unscheduledRhythmIds: [],
    };
    schedulerPlanStateRepositoryMocks.loadSchedulerPlanState
      .mockResolvedValueOnce({
        settingsRepairPendingAt: '2026-09-15T01:00:00.000Z',
        calendarRepairPendingAt: '2026-09-15T01:00:00.000Z',
        status: 'ok',
        updatedAt: '2026-09-15T00:00:00.000Z',
        plan: pendingPlan,
      })
      .mockResolvedValue({
        status: 'ok',
        updatedAt: '2026-09-15T01:05:00.000Z',
        plan: pendingPlan,
      });

    render(<TodayScreen />);

    const later = screen.getByRole('region', { name: 'Later' });
    expect((await within(later).findByRole('alert')).textContent).toContain(
      'The flexible private plan needs updating after planning settings changed.',
    );
    expect(within(later).queryByText('The flexible private plan needs repair after a calendar change.')).toBeNull();

    await user.click(within(later).getByRole('button', { name: 'Retry update' }));

    expect(schedulerPlanCoordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledWith({
      reason: 'Retry the saved planning settings using current scheduling information.',
      trigger: 'settingsChanged',
    });
  });
});
