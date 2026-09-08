// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const coordinatorMocks = vi.hoisted(() => ({
  ensureCurrentPrivatePlan: vi.fn(),
  repairCurrentPrivatePlan: vi.fn(),
  undoCurrentPrivatePlan: vi.fn(),
}));

const poolMocks = vi.hoisted(() => ({
  loadTaskPoolItems: vi.fn(),
  loadTaskPoolItemsResult: vi.fn(),
}));

const placementMocks = vi.hoisted(() => ({
  loadSoftPlacementsForDate: vi.fn(),
  loadSoftPlacementsForDateResult: vi.fn(),
}));

vi.mock('../../data/schedulerPlanCoordinator', () => coordinatorMocks);
vi.mock('../../data/taskPoolRepository', () => poolMocks);
vi.mock('../../data/softPlacementRepository', () => placementMocks);

import { AppSnapshotProvider } from '../../data/AppSnapshotProvider';
import { PersonalPlanScreen } from '../../screens/PersonalPlanScreen';
import { emptyAppSnapshot } from '../../viewModels';

const emptyPlan = {
  placements: [],
  rejectedExistingPlacements: [],
  unscheduledIntentionIds: [],
  unscheduledRhythmIds: [],
};

function renderPlan() {
  return render(
    <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
      <PersonalPlanScreen />
    </AppSnapshotProvider>,
  );
}

beforeEach(() => {
  coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
    ok: true,
    plan: emptyPlan,
    titleByTargetId: {},
    warnings: [],
  });
  coordinatorMocks.repairCurrentPrivatePlan.mockResolvedValue({
    ok: true,
    plan: emptyPlan,
    titleByTargetId: {},
    warnings: [],
  });
  coordinatorMocks.undoCurrentPrivatePlan.mockResolvedValue({
    ok: true,
    plan: emptyPlan,
    titleByTargetId: {},
    warnings: [],
  });
  poolMocks.loadTaskPoolItems.mockResolvedValue([]);
  poolMocks.loadTaskPoolItemsResult.mockResolvedValue({
    invalidRecordCount: 0,
    items: [],
    status: 'ok',
  });
  placementMocks.loadSoftPlacementsForDate.mockResolvedValue([]);
  placementMocks.loadSoftPlacementsForDateResult.mockResolvedValue({
    invalidRecordCount: 0,
    items: [],
    status: 'ok',
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Personal Plan read states', () => {
  it('keeps the automatic plan truthful when optional manual-placement data fails', async () => {
    placementMocks.loadSoftPlacementsForDateResult.mockResolvedValue({
      errors: ['softPlacements: Saved manual placements could not be read.'],
      status: 'readFailed',
    });

    renderPlan();

    expect(await screen.findByText('No automatic private placements for Monday.')).toBeTruthy();
    expect(screen.getByRole('alert', { name: 'Manual Plan data unavailable' }).textContent).toContain(
      'Saved manual placements could not be loaded.',
    );
    expect(screen.queryByText('No user-confirmed placements for Monday.')).toBeNull();
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('keeps readable manual placements visible while warning about invalid saved rows', async () => {
    placementMocks.loadSoftPlacementsForDateResult.mockResolvedValue({
      invalidRecordCount: 1,
      items: [{
        blockId: 'block-open-morning',
        blockLabelSnapshot: 'Open morning capacity',
        createdAt: '2026-09-07T08:00:00.000Z',
        date: '2026-09-07',
        end: '09:20',
        id: 'placement-partial',
        placementSource: 'userConfirmed',
        start: '09:00',
        status: 'planned',
        taskId: 'task-partial',
        taskTitleSnapshot: 'Readable partial task',
        updatedAt: '2026-09-07T08:00:00.000Z',
      }],
      status: 'partial',
    });

    renderPlan();

    expect(await screen.findByText('Readable partial task')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Saved manual Plan data warning' })).toBeTruthy();
    expect(screen.queryByText('No user-confirmed placements for Monday.')).toBeNull();
  });

  it('retries failed Plan dependencies without rebuilding or repairing scheduler state', async () => {
    const user = userEvent.setup();
    poolMocks.loadTaskPoolItemsResult
      .mockResolvedValueOnce({ errors: ['taskPoolItems: read failed'], status: 'readFailed' })
      .mockResolvedValueOnce({ invalidRecordCount: 0, items: [], status: 'ok' });

    renderPlan();

    expect(await screen.findByRole('alert', { name: 'Manual Plan data unavailable' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry manual Plan data' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert', { name: 'Manual Plan data unavailable' })).toBeNull();
    });
    expect(poolMocks.loadTaskPoolItemsResult).toHaveBeenCalledTimes(2);
    expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(1);
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });
});
