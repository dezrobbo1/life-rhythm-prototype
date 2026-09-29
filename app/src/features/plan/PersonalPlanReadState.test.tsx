// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

const correctionMocks = vi.hoisted(() => ({
  movePrivatePlacement: vi.fn(),
  protectPrivatePlacement: vi.fn(),
  unprotectPrivatePlacement: vi.fn(),
}));

vi.mock('../../data/schedulerPlanCoordinator', () => coordinatorMocks);
vi.mock('../../data/taskPoolRepository', () => poolMocks);
vi.mock('../../data/softPlacementRepository', () => placementMocks);
vi.mock('../../data/placementCorrectionCoordinator', () => correctionMocks);

import { AppSnapshotProvider } from '../../data/AppSnapshotProvider';
import { createLifeRhythmDatabase } from '../../data/db';
import { createAuthLocalDataNamespace, getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace, setCurrentLocalDataNamespace } from '../../data/localDataNamespace';
import { advanceProfileRecoveryGeneration, readProfileRecoveryGeneration } from '../../data/profileRecoveryGeneration';
import { PersonalPlanScreen } from '../../screens/PersonalPlanScreen';
import { emptyAppSnapshot } from '../../viewModels';

const emptyPlan = {
  placements: [],
  rejectedExistingPlacements: [],
  unscheduledIntentionIds: [],
  unscheduledRhythmIds: [],
};

const changedPlan = {
  ...emptyPlan,
  repair: {
    changes: [{
      from: {
        date: '2026-09-07',
        end: '09:20',
        start: '09:00',
      },
      kind: 'moved' as const,
      reason: 'A calendar commitment changed.',
      targetId: 'task-moved',
      targetKind: 'intention' as const,
      to: {
        date: '2026-09-07',
        end: '10:20',
        start: '10:00',
      },
    }],
    frozenPastPlacementIds: [],
    preservedPlacementIds: [],
    reason: 'A calendar commitment changed.',
    trigger: 'calendarChanged' as const,
    undo: emptyPlan,
  },
};

function renderPlan() {
  return render(
    <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
      <PersonalPlanScreen />
    </AppSnapshotProvider>,
  );
}

function renderEmbeddedPlan() {
  return render(
    <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
      <PersonalPlanScreen embeddedInDayLine />
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
  correctionMocks.movePrivatePlacement.mockReset();
  correctionMocks.protectPrivatePlacement.mockReset();
  correctionMocks.unprotectPrivatePlacement.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Personal Plan read states', () => {
  it('discards a mixed-generation read and retries once before showing manual data', async () => {
    setCurrentLocalDataNamespace(createAuthLocalDataNamespace('plan-read-generation-test'));
    const db = getCurrentLifeRhythmDatabase();
    const otherHandle = createLifeRhythmDatabase(db.name);
    await db.delete();
    await db.open();
    try {
      let releaseOldRead!: (result: unknown) => void;
      placementMocks.loadSoftPlacementsForDateResult
        .mockImplementationOnce(() => new Promise((resolve) => { releaseOldRead = resolve; }))
        .mockResolvedValueOnce({ invalidRecordCount: 0, items: [{
          id: 'new-placement', taskId: 'new-task', taskTitleSnapshot: 'Restored task',
          blockId: 'block', blockLabelSnapshot: 'Restored window', date: '2026-09-07',
          start: '09:00', end: '09:10', placementSource: 'userConfirmed', status: 'planned',
          createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
        }], status: 'ok' });
      renderPlan();
      await waitFor(() => expect(placementMocks.loadSoftPlacementsForDateResult).toHaveBeenCalledTimes(1));
      expect(await readProfileRecoveryGeneration(otherHandle)).toBe(0);
      await otherHandle.transaction('rw', otherHandle.settings, () => advanceProfileRecoveryGeneration(otherHandle, 0));
      releaseOldRead({ invalidRecordCount: 0, items: [{
        id: 'old-placement', taskId: 'old-task', taskTitleSnapshot: 'Old profile task',
        blockId: 'block', blockLabelSnapshot: 'Old window', date: '2026-09-07',
        start: '09:00', end: '09:10', placementSource: 'userConfirmed', status: 'planned',
        createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
      }], status: 'ok' });
      expect(await screen.findByText('Restored task')).toBeTruthy();
      expect(screen.queryByText('Old profile task')).toBeNull();
      expect(placementMocks.loadSoftPlacementsForDateResult).toHaveBeenCalledTimes(2);
      expect(await readProfileRecoveryGeneration(db)).toBe(1);
    } finally {
      cleanup();
      otherHandle.close();
      await db.delete();
      resetCurrentLocalDataNamespace();
    }
  });

  it('keeps planning mounted while calm Plan details are closed and toggled', async () => {
    const user = userEvent.setup();

    renderEmbeddedPlan();

    await waitFor(() => {
      expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(1);
    });

    const disclosure = screen.getByText('Plan details').closest('details');
    expect(disclosure?.open).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Private plan' })).toBeNull();

    await user.click(screen.getByText('Plan details'));
    expect(disclosure?.open).toBe(true);
    expect(screen.getByRole('heading', { name: 'Private plan' })).toBeTruthy();

    await user.click(screen.getByText('Plan details'));
    expect(disclosure?.open).toBe(false);
    expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(1);
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('rereads the accepted plan without closing Plan details when the plan revision changes', async () => {
    const user = userEvent.setup();
    const rendered = render(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen embeddedInDayLine planRevision={0} />
      </AppSnapshotProvider>,
    );

    await waitFor(() => {
      expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(1);
    });
    await user.click(screen.getByText('Plan details'));
    expect(screen.getByText('Plan details').closest('details')?.open).toBe(true);

    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: changedPlan,
      titleByTargetId: { 'task-moved': 'Move the form' },
      warnings: [],
    });
    rendered.rerender(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen embeddedInDayLine planRevision={1} />
      </AppSnapshotProvider>,
    );

    await waitFor(() => {
      expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('heading', { name: 'Changed' })).toBeTruthy();
    expect(screen.getByText('Plan details').closest('details')?.open).toBe(true);
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('reports a successful manual flexible-plan refresh as recovery', async () => {
    const user = userEvent.setup();
    const onPlanRecovered = vi.fn();
    render(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen embeddedInDayLine onPlanRecovered={onPlanRecovered} />
      </AppSnapshotProvider>,
    );

    await waitFor(() => {
      expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(1);
    });
    await user.click(screen.getByText('Plan details'));
    await user.click(screen.getByRole('button', { name: 'Refresh flexible plan' }));

    await waitFor(() => {
      expect(coordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledTimes(1);
      expect(onPlanRecovered).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Flexible private work was refreshed. External calendar events were not changed.')).toBeTruthy();
  });

  it('does not show an empty Changed section on the default Plan surface', async () => {
    renderEmbeddedPlan();

    await waitFor(() => {
      expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('heading', { name: 'Changed' })).toBeNull();
  });

  it('keeps real Changed information and supported Undo visible outside closed details', async () => {
    const user = userEvent.setup();
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: changedPlan,
      titleByTargetId: { 'task-moved': 'Move the form' },
      warnings: [],
    });

    renderEmbeddedPlan();

    const changed = (await screen.findByRole('heading', { name: 'Changed' })).closest('section');
    if (!changed) throw new Error('Changed section was not found.');

    expect(changed.textContent).toContain('Move the form moved from 2026-09-07 09:00-09:20 to 2026-09-07 10:00-10:20.');
    expect(screen.getByText('Plan details').closest('details')?.open).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Undo last repair' }));
    expect(coordinatorMocks.undoCurrentPrivatePlan).toHaveBeenCalledTimes(1);
  });

  it('shows a settings repair without offering to restore times from before the reviewed boundaries', async () => {
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: { ...changedPlan, repair: { ...changedPlan.repair, trigger: 'settingsChanged', reason: 'Reviewed planning settings changed.' } },
      titleByTargetId: { 'task-moved': 'Move the form' }, warnings: [],
    });
    renderEmbeddedPlan();
    expect(await screen.findByRole('heading', { name: 'Changed' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo last repair' })).toBeNull();
    expect(coordinatorMocks.undoCurrentPrivatePlan).not.toHaveBeenCalled();
    expect(screen.queryByText('The previous private plan was restored.')).toBeNull();
  });

  it('does not offer Undo for a user correction that incorporated pending settings authority', async () => {
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: { ...changedPlan, repair: { ...changedPlan.repair, trigger: 'userCorrection', settingsDefinitionRepairApplied: true } },
      titleByTargetId: { 'task-moved': 'Move the form' }, warnings: [],
    });
    renderEmbeddedPlan();
    expect(await screen.findByRole('heading', { name: 'Changed' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo last repair' })).toBeNull();
    expect(screen.queryByText('The previous private plan was restored.')).toBeNull();
  });

  it('never reports a successful restoration when an otherwise visible Undo is rejected', async () => {
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({ ok: true, plan: changedPlan,
      titleByTargetId: { 'task-moved': 'Move the form' }, warnings: [] });
    coordinatorMocks.undoCurrentPrivatePlan.mockResolvedValue({ ok: false, errors: ['Planning settings changed.'], warnings: [] });
    renderEmbeddedPlan();
    await screen.findByRole('heading', { name: 'Changed' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Undo last repair' }));
    expect(await screen.findByText('The previous private plan could not be restored.')).toBeTruthy();
    expect(screen.queryByText('The previous private plan was restored.')).toBeNull();
  });

  it('keeps a private-plan failure visible while details remain closed', async () => {
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      errors: ['Saved scheduler state is invalid.'],
      ok: false,
    });

    renderEmbeddedPlan();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Private plan needs attention.');
    expect(alert.textContent).toContain('Saved scheduler state is invalid.');
    expect(screen.getByText('Plan details').closest('details')?.open).toBe(false);
  });

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

  it('discards a retry result when the selected Plan day changes before it resolves', async () => {
    const user = userEvent.setup();
    let resolveMondayRetry!: (result: {
      invalidRecordCount: number;
      items: Array<{
        blockId: string;
        blockLabelSnapshot: string;
        createdAt: string;
        date: string;
        end: string;
        id: string;
        placementSource: 'userConfirmed';
        start: string;
        status: 'planned';
        taskId: string;
        taskTitleSnapshot: string;
        updatedAt: string;
      }>;
      status: 'ok';
    }) => void;
    let placementReadCount = 0;
    placementMocks.loadSoftPlacementsForDateResult.mockImplementation(async (date: string) => {
      placementReadCount += 1;

      if (placementReadCount === 1) {
        return { errors: ['softPlacements: read failed'], status: 'readFailed' as const };
      }
      if (placementReadCount === 2) {
        return new Promise((resolve) => {
          resolveMondayRetry = resolve;
        });
      }

      return {
        invalidRecordCount: 0,
        items: [{
          blockId: 'block-tuesday',
          blockLabelSnapshot: 'Tuesday block',
          createdAt: '2026-09-07T08:00:00.000Z',
          date,
          end: '09:20',
          id: 'placement-tuesday',
          placementSource: 'userConfirmed' as const,
          start: '09:00',
          status: 'planned' as const,
          taskId: 'task-tuesday',
          taskTitleSnapshot: 'Tuesday task',
          updatedAt: '2026-09-07T08:00:00.000Z',
        }],
        status: 'ok' as const,
      };
    });

    renderPlan();

    expect(await screen.findByRole('alert', { name: 'Manual Plan data unavailable' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry manual Plan data' }));
    await user.selectOptions(screen.getByLabelText('Selected day'), 'Tuesday');
    expect(await screen.findByText('Tuesday task')).toBeTruthy();

    resolveMondayRetry({
      invalidRecordCount: 0,
      items: [{
        blockId: 'block-monday',
        blockLabelSnapshot: 'Monday block',
        createdAt: '2026-09-07T08:00:00.000Z',
        date: '2026-09-14',
        end: '09:20',
        id: 'placement-monday',
        placementSource: 'userConfirmed',
        start: '09:00',
        status: 'planned',
        taskId: 'task-monday',
        taskTitleSnapshot: 'Monday task',
        updatedAt: '2026-09-07T08:00:00.000Z',
      }],
      status: 'ok',
    });

    await waitFor(() => {
      expect(placementMocks.loadSoftPlacementsForDateResult).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByText('Tuesday task')).toBeTruthy();
    expect(screen.queryByText('Monday task')).toBeNull();
  });
  it('shows repair attention when Unprotect saves but its automatic repair fails', async () => {
    const user = userEvent.setup();
    const protectedPlacement = {
      id: 'correction:intention:protected-task',
      intentionId: 'protected-task',
      targetKind: 'intention' as const,
      date: '2026-09-07',
      start: '09:00',
      end: '09:30',
      timezone: 'Australia/Perth',
      origin: 'existingUserConfirmed' as const,
      sourcePlacementId: 'correction:intention:protected-task',
      variantKind: 'normal' as const,
      provenance: ['User explicitly protected this private placement.'],
    };
    const acceptedPlan = {
      ...emptyPlan,
      placements: [protectedPlacement],
    };
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: acceptedPlan,
      titleByTargetId: { 'protected-task': 'Protected task' },
      warnings: [],
    });
    placementMocks.loadSoftPlacementsForDateResult.mockResolvedValue({
      invalidRecordCount: 0,
      items: [{
        id: 'correction:intention:protected-task',
        taskId: 'protected-task',
        taskTitleSnapshot: 'Protected task',
        blockId: 'correction-slot:protected-task',
        blockLabelSnapshot: 'User-corrected private time',
        date: '2026-09-07',
        start: '09:00',
        end: '09:30',
        timezone: 'Australia/Perth',
        variantKind: 'normal',
        placementSource: 'userConfirmed',
        status: 'planned',
        correctionKind: 'protect',
        targetKind: 'intention',
        createdAt: '2026-09-07T00:00:00.000Z',
        updatedAt: '2026-09-07T00:00:00.000Z',
      }],
      status: 'ok',
    });
    correctionMocks.unprotectPrivatePlacement.mockResolvedValue({
      ok: true,
      placement: null,
      repairPending: true,
      plan: acceptedPlan,
    });

    render(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen preferredPlacementDate="2026-09-07" />
      </AppSnapshotProvider>,
    );

    expect(await screen.findByText('Protected task')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Unprotect' }));

    expect(await screen.findByText(
      'Protection was removed, but the automatic private plan still needs updating.',
    )).toBeTruthy();
    expect(screen.getByText('The automatic private plan still needs updating.')).toBeTruthy();
    expect(correctionMocks.unprotectPrivatePlacement).toHaveBeenCalledTimes(1);
  });

  it('shows the preserved duration and requested end before saving a Move', async () => {
    const user = userEvent.setup();
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: {
        ...emptyPlan,
        placements: [{
          id: 'scheduler:intention:move-task:2026-09-07:09:00',
          intentionId: 'move-task',
          targetKind: 'intention',
          date: '2026-09-07',
          start: '09:00',
          end: '09:30',
          timezone: 'Australia/Perth',
          origin: 'scheduler',
          variantKind: 'normal',
          provenance: ['Automatically placed by the deterministic scheduler.'],
        }],
      },
      titleByTargetId: { 'move-task': 'Move task' },
      warnings: [],
    });

    render(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen preferredPlacementDate="2026-09-07" />
      </AppSnapshotProvider>,
    );

    expect(await screen.findByText('Move task')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Move' }));

    expect(screen.getByText(/Keeps the current 30-minute form/)).toBeTruthy();
    expect(screen.getByText(/requested time 09:00–09:30/)).toBeTruthy();

    await user.clear(screen.getByLabelText('Move start time'));
    await user.type(screen.getByLabelText('Move start time'), '10:15');
    expect(await screen.findByText(/requested time 10:15–10:45/)).toBeTruthy();
  });

  it('surfaces a protected correction that current hard reality rejects without exposing internal IDs', async () => {
    const rejectedPlacement = {
      id: 'correction:intention:protected-task',
      intentionId: 'protected-task',
      targetKind: 'intention' as const,
      date: '2026-09-07',
      start: '09:00',
      end: '09:30',
      timezone: 'Australia/Perth',
      origin: 'existingUserConfirmed' as const,
      sourcePlacementId: 'correction:intention:protected-task',
      variantKind: 'normal' as const,
      provenance: ['User explicitly protected this private placement.'],
    };
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: {
        ...emptyPlan,
        rejectedExistingPlacements: [{
          placement: rejectedPlacement,
          violations: [{
            code: 'external-commitment-overlap',
            placementId: rejectedPlacement.id,
            conflictingId: 'commitment:private-appointment',
            message: 'Placement correction:intention:protected-task overlaps commitment Private appointment.',
          }],
        }],
        unscheduledIntentionIds: ['protected-task'],
      },
      titleByTargetId: { 'protected-task': 'Protected task' },
      warnings: [],
    });
    placementMocks.loadSoftPlacementsForDateResult.mockResolvedValue({
      invalidRecordCount: 0,
      items: [{
        id: rejectedPlacement.id,
        taskId: 'protected-task',
        taskTitleSnapshot: 'Protected task',
        blockId: 'correction-slot:protected-task',
        blockLabelSnapshot: 'User-corrected private time',
        date: '2026-09-07',
        start: '09:00',
        end: '09:30',
        timezone: 'Australia/Perth',
        variantKind: 'normal',
        placementSource: 'userConfirmed',
        status: 'planned',
        correctionKind: 'protect',
        targetKind: 'intention',
        createdAt: '2026-09-07T00:00:00.000Z',
        updatedAt: '2026-09-07T00:00:00.000Z',
      }],
      status: 'ok',
    });

    render(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen preferredPlacementDate="2026-09-07" />
      </AppSnapshotProvider>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Saved private time needs a new choice.');
    expect(alert.textContent).toContain(
      'A fixed or read-only calendar commitment now overlaps this saved private time.',
    );
    expect(alert.textContent).not.toContain('correction:intention:protected-task');
    expect(alert.textContent).not.toContain('commitment:private-appointment');
    expect(within(alert).getByRole('button', { name: 'Move' })).toBeTruthy();
    expect(within(alert).getByRole('button', { name: 'Unprotect' })).toBeTruthy();
  });

});
