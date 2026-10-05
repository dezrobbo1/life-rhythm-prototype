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
import { advanceProfileRecoveryGeneration, readProfileRecoveryGeneration,
  STALE_PROFILE_RECOVERY_MESSAGE } from '../../data/profileRecoveryGeneration';
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
    expect(screen.queryByRole('heading', { name: 'Flexible plan' })).toBeNull();

    await user.click(screen.getByText('Plan details'));
    expect(disclosure?.open).toBe(true);
    expect(screen.getByRole('heading', { name: 'Flexible plan' })).toBeTruthy();

    await user.click(screen.getByText('Plan details'));
    expect(disclosure?.open).toBe(false);
    expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(1);
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it.each(['ok', 'partial'] as const)(
    'keeps saved correction details available when Day Line has no rendered row (%s manual read)',
    async (readStatus) => {
      const placement = {
        id: 'correction:intention:visible-fallback',
        taskId: 'visible-fallback',
        taskTitleSnapshot: 'Visible corrected task',
        blockId: 'correction-slot:visible-fallback',
        blockLabelSnapshot: 'User-corrected private time',
        date: '2026-09-07',
        start: '10:15',
        end: '10:45',
        timezone: 'Australia/Perth',
        placementSource: 'userConfirmed',
        status: 'planned',
        correctionKind: 'move',
        targetKind: 'intention',
        createdAt: '2026-09-07T00:00:00.000Z',
        updatedAt: '2026-09-07T00:00:00.000Z',
      };
      placementMocks.loadSoftPlacementsForDateResult.mockResolvedValue({
        invalidRecordCount: 0,
        items: [placement],
        status: readStatus,
      });

      const user = userEvent.setup();
      render(
        <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
          <PersonalPlanScreen embeddedInDayLine dayLinePlacementIds={[]} />
        </AppSnapshotProvider>,
      );

      await user.click(screen.getByText('Plan details'));
      expect(await screen.findByText('Visible corrected task')).toBeTruthy();
      expect(screen.getByText('User-corrected private time · 10:15-10:45')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Move' })).toBeTruthy();
      expect(correctionMocks.movePrivatePlacement).not.toHaveBeenCalled();
      expect(correctionMocks.protectPrivatePlacement).not.toHaveBeenCalled();
      expect(correctionMocks.unprotectPrivatePlacement).not.toHaveBeenCalled();
    },
  );

  it('deduplicates a correction only while its Day Line row is rendered', async () => {
    const placement = {
      id: 'correction:intention:day-line-row',
      taskId: 'day-line-row',
      taskTitleSnapshot: 'Day Line corrected task',
      blockId: 'correction-slot:day-line-row',
      blockLabelSnapshot: 'User-corrected private time',
      date: '2026-09-07',
      start: '11:00',
      end: '11:30',
      timezone: 'Australia/Perth',
      placementSource: 'userConfirmed',
      status: 'planned',
      correctionKind: 'move',
      targetKind: 'intention',
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
    };
    placementMocks.loadSoftPlacementsForDateResult.mockResolvedValue({
      invalidRecordCount: 0,
      items: [placement],
      status: 'ok',
    });

    render(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen
          embeddedInDayLine
          dayLinePlacementIds={[placement.id]}
          renderDayLine={(renderCorrection) => (
            <div aria-label="Day Line row">
              <strong>Day Line corrected task</strong>
              <span>11:00-11:30</span>
              {renderCorrection(placement.id)}
            </div>
          )}
        />
      </AppSnapshotProvider>,
    );

    const row = await screen.findByLabelText('Day Line row');
    expect(within(row).getByText('Day Line corrected task')).toBeTruthy();
    expect(within(row).getByText('11:00-11:30')).toBeTruthy();
    expect(screen.getAllByText('Day Line corrected task')).toHaveLength(1);
    expect(screen.queryByText('User-corrected private time · 11:00-11:30')).toBeNull();
    expect(correctionMocks.movePrivatePlacement).not.toHaveBeenCalled();
    expect(correctionMocks.protectPrivatePlacement).not.toHaveBeenCalled();
  });

  it('returns focus to Plan details when Move saves outside the displayed day', async () => {
    const user = userEvent.setup();
    const source = {
      id: 'scheduler:intention:cross-day-focus:2026-09-07:09:00',
      intentionId: 'cross-day-focus',
      targetKind: 'intention' as const,
      date: '2026-09-07',
      start: '09:00',
      end: '09:30',
      timezone: 'Australia/Perth',
      origin: 'scheduler' as const,
      variantKind: 'normal' as const,
      provenance: ['Automatically placed by the deterministic scheduler.'],
    };
    const moved = {
      ...source,
      id: 'correction:intention:cross-day-focus',
      date: '2026-09-08',
      sourcePlacementId: source.id,
      origin: 'existingUserConfirmed' as const,
      provenance: ['User explicitly moved this private placement.'],
    };
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: { ...emptyPlan, placements: [source] },
      titleByTargetId: { 'cross-day-focus': 'Cross-day task' },
      warnings: [],
    });
    correctionMocks.movePrivatePlacement.mockResolvedValue({
      ok: true,
      repairPending: false,
      plan: { ...emptyPlan, placements: [moved] },
    });

    let displayedPlacementId = source.id;
    const rendered = render(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen
          embeddedInDayLine
          dayLinePlacementIds={[source.id]}
          preferredPlacementDate="2026-09-07"
          renderDayLine={(renderCorrection) => (
            <div aria-label="Cross-day Day Line row">
              <strong>Cross-day task</strong>
              {renderCorrection(displayedPlacementId)}
            </div>
          )}
        />
      </AppSnapshotProvider>,
    );

    await user.click(await screen.findByText('Correct Cross-day task'));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await user.clear(screen.getByLabelText('Move date'));
    await user.type(screen.getByLabelText('Move date'), '2026-09-08');
    await user.click(screen.getByRole('button', { name: 'Save move' }));

    const planDetails = screen.getByText('Plan details').closest('summary');
    await waitFor(() => expect(document.activeElement).toBe(planDetails));
    expect(correctionMocks.movePrivatePlacement).toHaveBeenCalledTimes(1);
    displayedPlacementId = moved.id;
    rendered.rerender(
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen
          embeddedInDayLine
          dayLinePlacementIds={[moved.id]}
          preferredPlacementDate="2026-09-08"
          renderDayLine={(renderCorrection) => (
            <div aria-label="Cross-day Day Line row">
              <strong>Cross-day task</strong>
              {renderCorrection(displayedPlacementId)}
            </div>
          )}
        />
      </AppSnapshotProvider>,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(document.activeElement).toBe(planDetails);
  });

  it('restores focus to the replacement Day Line correction after Protect remounts an automatic row', async () => {
    const user = userEvent.setup();
    const source = {
      id: 'scheduler:intention:protect-focus:2026-09-07:09:00',
      intentionId: 'protect-focus',
      targetKind: 'intention' as const,
      date: '2026-09-07',
      start: '09:00',
      end: '09:30',
      timezone: 'Australia/Perth',
      origin: 'scheduler' as const,
      variantKind: 'normal' as const,
      provenance: ['Automatically placed by the deterministic scheduler.'],
    };
    const protectedPlacement = {
      ...source,
      id: 'correction:intention:protect-focus',
      sourcePlacementId: source.id,
      origin: 'existingUserConfirmed' as const,
      provenance: ['User explicitly protected this private placement.'],
    };
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true,
      plan: { ...emptyPlan, placements: [source] },
      titleByTargetId: { 'protect-focus': 'Focus task' },
      warnings: [],
    });
    correctionMocks.protectPrivatePlacement.mockResolvedValue({
      ok: true,
      repairPending: false,
      plan: { ...emptyPlan, placements: [protectedPlacement] },
    });
    let renderedPlacementId = source.id;
    let rowVersion = 0;
    const surface = () => (
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen
          embeddedInDayLine
          dayLinePlacementIds={[renderedPlacementId]}
          preferredPlacementDate="2026-09-07"
          renderDayLine={(renderCorrection) => (
            <>
              <div key={rowVersion} aria-label="Protect Day Line row">
                <strong>Focus task</strong>
                {renderCorrection(renderedPlacementId)}
              </div>
              <button type="button">Stable next control</button>
            </>
          )}
        />
      </AppSnapshotProvider>
    );
    const rendered = render(surface());

    await user.click(await screen.findByText('Correct Focus task'));
    await user.click(screen.getByRole('button', { name: 'Protect this time' }));
    expect(correctionMocks.protectPrivatePlacement).toHaveBeenCalledTimes(1);
    renderedPlacementId = protectedPlacement.id;
    rendered.rerender(surface());
    await waitFor(() => expect(document.activeElement).toBe(
      screen.getByText('Correct Focus task').closest('summary'),
    ));

    // A later read can remount the same corrected row before user input.
    rowVersion += 1;
    rendered.rerender(surface());
    await waitFor(() => expect(document.activeElement).toBe(
      screen.getByText('Correct Focus task').closest('summary'),
    ));

    const nextControl = screen.getByRole('button', { name: 'Stable next control' });
    for (let count = 0; count < 10 && document.activeElement !== nextControl; count += 1) {
      await user.tab();
    }
    expect(document.activeElement).toBe(nextControl);
    rowVersion += 1;
    rendered.rerender(surface());
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(document.activeElement).toBe(nextControl);
  });

  it.each([
    ['Protect', 'none'], ['Unprotect', 'none'], ['Move', 'none'],
    ['Unprotect', 'keyboard'], ['Unprotect', 'pointer'], ['Unprotect', 'date'],
    ['Unprotect', 'keyboard-before-save'], ['Unprotect', 'pointer-before-save'], ['Unprotect', 'date-before-save'],
    ...['Protect', 'Unprotect', 'Move'].flatMap((action) =>
      ['keyboard', 'pointer', 'date'].map((input) => [action, input + '-before-save-connected'])),
    ['Move', 'keyboard'], ['Move', 'pointer'], ['Move', 'date'],
    ['Move', 'keyboard-before-save'], ['Move', 'pointer-before-save'], ['Move', 'date-before-save'],
    ['Protect', 'keyboard'], ['Protect', 'pointer'], ['Protect', 'date'],
    ['Protect', 'keyboard-before-save'], ['Protect', 'pointer-before-save'], ['Protect', 'date-before-save'],
  ])('restores delayed %s focus safely with %s cancellation', async (action, cancellation) => {
    const user = userEvent.setup();
    const source = {
      id: 'old-focus', intentionId: 'focus-task', targetKind: 'intention' as const,
      date: '2026-09-07', start: '09:00', end: '09:30', timezone: 'Australia/Perth',
      origin: 'scheduler' as const, variantKind: 'normal' as const,
      provenance: action === 'Unprotect' ? ['User explicitly protected this private placement.'] : [],
    };
    const successor = { ...source, id: 'new-focus', provenance: [] };
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true, plan: { ...emptyPlan, placements: [source] },
      titleByTargetId: { 'focus-task': 'Ordering task' }, warnings: [],
    });
    let finishSave!: () => void;
    correctionMocks[action === 'Protect' ? 'protectPrivatePlacement' : action === 'Move' ? 'movePrivatePlacement' : 'unprotectPrivatePlacement']
      .mockImplementation(() => new Promise((resolve) => {
        finishSave = () => resolve({ ok: true, repairPending: false, plan: { ...emptyPlan, placements: [successor] } });
      }));
    let rowId = source.id;
    let date = source.date;
    const surface = () => (
      <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
        <PersonalPlanScreen embeddedInDayLine dayLinePlacementIds={rowId ? [rowId] : []}
          preferredPlacementDate={date}
          renderDayLine={(correction) => <>{correction(rowId)}<button>Next control</button></>} />
      </AppSnapshotProvider>
    );
    const rendered = render(surface());
    await user.click(await screen.findByText('Correct Ordering task'));
    await user.click(screen.getByRole('button', { name: action === 'Protect' ? 'Protect this time' : action === 'Move' ? 'Move' : 'Unprotect' }));
    if (action === 'Move') await user.click(screen.getByRole('button', { name: 'Save move' }));
    const savedMessage = action === 'Protect' ? 'This private time is protected.' : action === 'Move' ? 'Placement moved.' : 'Protection removed.';
    const beforeSave = cancellation.includes('before-save');
    const connectedExternal = cancellation.endsWith('connected');
    const fallback = screen.getByText('Plan details').closest('summary');
    if (!beforeSave) {
      finishSave();
      await screen.findByText(savedMessage);
      // The private plan removed the old control, but the subscription has not published its successor.
      await waitFor(() => expect(document.activeElement).toBe(fallback));
      expect(fallback?.isConnected).toBe(true);
      rowId = ''; // Loading/error: no Day Line row at all.
      rendered.rerender(surface());
      expect(document.activeElement).toBe(fallback);
    }
    const next = screen.getByRole('button', { name: 'Next control' });
    if (cancellation !== 'none') {
      next.focus();
      if (cancellation.startsWith('keyboard')) await user.keyboard('{ArrowRight}');
      else if (cancellation.startsWith('pointer')) await user.pointer({ target: next, keys: '[MouseLeft]' });
      else { date = '2026-09-08'; rendered.rerender(surface()); }
    }
    if (cancellation !== 'none' && !connectedExternal) next.blur();
    if (beforeSave) { finishSave(); await screen.findByText(savedMessage); }
    rowId = successor.id;
    rendered.rerender(surface());
    await screen.findByText('Correct Ordering task');
    await waitFor(() => expect(document.activeElement).toBe(cancellation === 'none'
      ? screen.getByText('Correct Ordering task').closest('summary') : connectedExternal ? next : document.body));
    // Repeated subscription commits cannot resurrect a cancelled request.
    rendered.rerender(surface());
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(document.activeElement).toBe(cancellation === 'none'
      ? screen.getByText('Correct Ordering task').closest('summary') : connectedExternal ? next : document.body);
  });

  it.each(['Protect', 'Unprotect'].flatMap((action) =>
    ['keyboard', 'pointer'].flatMap((input) => [true, false].map((success) => ({ action, input, success }))),
  ))('keeps pending $action interaction owned by its correction: $input, success=$success', async ({ action, input, success }) => {
    const user = userEvent.setup();
    const source = {
      id: 'owned-source', intentionId: 'owned-task', targetKind: 'intention' as const,
      date: '2026-09-07', start: '09:00', end: '09:30', timezone: 'Australia/Perth',
      origin: 'scheduler' as const, variantKind: 'normal' as const,
      provenance: [action === 'Protect' ? 'Automatically placed by the deterministic scheduler.'
        : 'User explicitly protected this private placement.'],
    };
    const successor = { ...source, id: 'owned-successor' };
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true, plan: { ...emptyPlan, placements: [source] }, titleByTargetId: { 'owned-task': 'Owned task' }, warnings: [],
    });
    let finish!: () => void;
    correctionMocks[action === 'Protect' ? 'protectPrivatePlacement' : 'unprotectPrivatePlacement']
      .mockImplementation(() => new Promise((resolve) => {
        finish = () => resolve(success ? { ok: true, repairPending: false, plan: { ...emptyPlan, placements: [successor] } }
          : { ok: false, errors: ['Synthetic failed protection.'] });
      }));
    let rowId = source.id;
    const surface = () => (<AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
      <PersonalPlanScreen embeddedInDayLine dayLinePlacementIds={[rowId]} preferredPlacementDate={source.date}
        renderDayLine={(correction) => correction(rowId)} />
    </AppSnapshotProvider>);
    const rendered = render(surface());
    await user.click(await screen.findByText('Correct Owned task'));
    await user.click(screen.getByRole('button', { name: action === 'Protect' ? 'Protect this time' : 'Unprotect' }));
    const why = screen.getByText('Why this time?');
    if (input === 'pointer') { await user.click(why); why.focus(); }
    else { why.focus(); await user.keyboard('{ArrowRight}'); }
    if (success) {
      // A loading/error live read may remove our disclosure before the command settles.
      rowId = ''; rendered.rerender(surface());
      await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Plan details').closest('summary')));
    }
    finish();
    if (success) {
      await screen.findByText(action === 'Protect' ? 'This private time is protected.' : 'Protection removed.');
      await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Plan details').closest('summary')));
      rowId = successor.id; rendered.rerender(surface());
      await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Correct Owned task').closest('summary')));
    } else {
      await screen.findByText('Synthetic failed protection.');
      expect(document.activeElement).toBe(why);
      expect(why.isConnected).toBe(true);
    }
  });

  const pendingMoveCases = (['keyboard', 'pointer'] as const).flatMap((input) =>
    (['immediate', 'delayed', 'missing'] as const).flatMap((delivery) =>
      [false, true].flatMap((crossDay) => [false, true].map((stableId) => ({ input, delivery, crossDay, stableId }))),
    ),
  );
  async function pendingMoveFixture(crossDay = false, stableId = false) {
    const user = userEvent.setup();
    const source = {
      id: 'pending-move', intentionId: 'focus-task', targetKind: 'intention' as const,
      date: '2026-09-07', start: '09:00', end: '09:30', timezone: 'Australia/Perth',
      origin: 'scheduler' as const, variantKind: 'normal' as const, provenance: [],
    };
    const successor = { ...source, id: stableId ? source.id : 'moved-successor',
      date: crossDay ? '2026-09-08' : source.date, start: '11:00', end: '11:30' };
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({
      ok: true, plan: { ...emptyPlan, placements: [source] },
      titleByTargetId: { 'focus-task': 'Pending task' }, warnings: [],
    });
    let finishSave!: (ok?: boolean) => void;
    correctionMocks.movePrivatePlacement.mockImplementation(() => new Promise((resolve) => {
      finishSave = (ok = true) => resolve(ok
        ? { ok: true, repairPending: false, plan: { ...emptyPlan, placements: [successor] } }
        : { ok: false, errors: ['Synthetic failed save.'] });
    }));
    let rowId = source.id;
    const surface = () => (<AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
      <PersonalPlanScreen embeddedInDayLine dayLinePlacementIds={rowId ? [rowId] : []}
        preferredPlacementDate={source.date} renderDayLine={(correction) => correction(rowId)} />
    </AppSnapshotProvider>);
    const rendered = render(surface());
    await user.click(await screen.findByText('Correct Pending task'));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    if (crossDay) {
      await user.clear(screen.getByLabelText('Move date'));
      await user.type(screen.getByLabelText('Move date'), successor.date);
    }
    await user.click(screen.getByRole('button', { name: 'Save move' }));
    return { user, successor, finishSave, showRow(id: string) { rowId = id; rendered.rerender(surface()); } };
  }
  it.each(pendingMoveCases)(
    'recovers pending Move after $input inside modal: $delivery successor, crossDay=$crossDay, stableId=$stableId',
    async ({ input, delivery, crossDay, stableId }) => {
      const { user, successor, finishSave, showRow } = await pendingMoveFixture(crossDay, stableId);
      if (input === 'keyboard') { screen.getByLabelText('Move date').focus(); await user.tab(); }
      else await user.click(screen.getByLabelText('Move start time'));
      const activeInput = document.activeElement;
      expect(screen.getByRole('dialog').contains(activeInput)).toBe(true);
      // Hold or publish the subscriber row independently of private-plan completion.
      showRow(!crossDay && delivery === 'immediate' ? successor.id : '');
      finishSave();
      await screen.findByText('Placement moved.');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const fallback = screen.getByText('Plan details').closest('summary');
      const destination = !crossDay && delivery === 'immediate'
        ? screen.getByText('Correct Pending task').closest('summary') : fallback;
      await waitFor(() => expect(document.activeElement).toBe(destination));
      expect(destination?.isConnected).toBe(true);
      expect(activeInput?.isConnected).toBe(false);
      if (!crossDay && delivery === 'delayed') {
        showRow(successor.id);
        await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Correct Pending task').closest('summary')));
      }
      // Input after close cancels restoration on later subscriber remounts.
      await user.keyboard('{ArrowRight}');
      fallback?.focus();
      showRow('');
      if (!crossDay && delivery !== 'missing') showRow(successor.id);
      expect(document.activeElement).toBe(fallback);
    },
  );
  it.each(['keyboard', 'pointer'] as const)(
    'keeps failed pending Move focused in its open modal after %s input', async (input) => {
      const { user, finishSave } = await pendingMoveFixture();
      if (input === 'keyboard') { screen.getByLabelText('Move date').focus(); await user.tab(); }
      else await user.click(screen.getByLabelText('Move start time'));
      const active = document.activeElement;
      finishSave(false);
      await screen.findByText('Synthetic failed save.');
      expect(document.activeElement).toBe(active);
      expect(screen.getByRole('dialog').contains(active)).toBe(true);
      expect(active?.isConnected).toBe(true);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move' }));
    },
  );

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

  it('does not apply an old manual refresh result after another handle restores the profile', async () => {
    setCurrentLocalDataNamespace(createAuthLocalDataNamespace('plan-refresh-generation-race'));
    const db = getCurrentLifeRhythmDatabase();
    const otherHandle = createLifeRhythmDatabase(db.name);
    await db.delete();
    await db.open();
    try {
      let resolveRepair!: (value: unknown) => void;
      coordinatorMocks.repairCurrentPrivatePlan.mockImplementationOnce(() =>
        new Promise((resolve) => { resolveRepair = resolve; }));
      const onPlanRecovered = vi.fn();

      render(
        <AppSnapshotProvider snapshot={emptyAppSnapshot} source="personal">
          <PersonalPlanScreen embeddedInDayLine onPlanRecovered={onPlanRecovered} />
        </AppSnapshotProvider>,
      );

      await waitFor(() => expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(1));
      await userEvent.setup().click(screen.getByText('Plan details'));
      await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh flexible plan' }));
      await waitFor(() => expect(coordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledTimes(1));
      expect(coordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledWith(expect.objectContaining({
        expectedRecoveryGeneration: 0,
        trigger: 'manualReplan',
      }));

      await otherHandle.transaction('rw', otherHandle.settings, () => advanceProfileRecoveryGeneration(otherHandle, 0));
      resolveRepair({
        ok: true,
        mode: 'repaired',
        plan: changedPlan,
        titleByTargetId: { 'task-moved': 'Old profile move' },
        updatedAt: '2026-09-07T00:05:00.000Z',
        warnings: [],
      });

      expect(await screen.findByText(STALE_PROFILE_RECOVERY_MESSAGE)).toBeTruthy();
      await waitFor(() => expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('heading', { name: 'Changed' })).toBeNull();
      expect(onPlanRecovered).not.toHaveBeenCalled();
      expect(await readProfileRecoveryGeneration(db)).toBe(1);
    } finally {
      cleanup();
      otherHandle.close();
      await db.delete();
      resetCurrentLocalDataNamespace();
    }
  });

  it('does not bless an old Undo result with a newer recovery generation', async () => {
    setCurrentLocalDataNamespace(createAuthLocalDataNamespace('plan-undo-generation-race'));
    const db = getCurrentLifeRhythmDatabase();
    const otherHandle = createLifeRhythmDatabase(db.name);
    await db.delete();
    await db.open();
    try {
      coordinatorMocks.ensureCurrentPrivatePlan
        .mockResolvedValueOnce({
          ok: true,
          plan: changedPlan,
          titleByTargetId: { 'task-moved': 'Move the form' },
          warnings: [],
        })
        .mockResolvedValue({
          ok: true,
          plan: emptyPlan,
          titleByTargetId: {},
          warnings: [],
        });
      let resolveUndo!: (value: unknown) => void;
      coordinatorMocks.undoCurrentPrivatePlan.mockImplementationOnce(() =>
        new Promise((resolve) => { resolveUndo = resolve; }));

      renderEmbeddedPlan();
      await screen.findByRole('heading', { name: 'Changed' });
      await userEvent.setup().click(screen.getByRole('button', { name: 'Undo last change' }));
      await waitFor(() => expect(coordinatorMocks.undoCurrentPrivatePlan).toHaveBeenCalledTimes(1));
      expect(coordinatorMocks.undoCurrentPrivatePlan).toHaveBeenCalledWith({}, 0);

      await otherHandle.transaction('rw', otherHandle.settings, () => advanceProfileRecoveryGeneration(otherHandle, 0));
      resolveUndo({
        ok: true,
        mode: 'undone',
        plan: changedPlan,
        titleByTargetId: { 'task-moved': 'Old profile move' },
        updatedAt: '2026-09-07T00:06:00.000Z',
        warnings: [],
      });

      expect(await screen.findByText(STALE_PROFILE_RECOVERY_MESSAGE)).toBeTruthy();
      await waitFor(() => expect(coordinatorMocks.ensureCurrentPrivatePlan).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('heading', { name: 'Changed' })).toBeNull();
      expect(screen.queryByText('The previous private plan was restored.')).toBeNull();
      expect(await readProfileRecoveryGeneration(db)).toBe(1);
    } finally {
      cleanup();
      otherHandle.close();
      await db.delete();
      resetCurrentLocalDataNamespace();
    }
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

    await user.click(screen.getByRole('button', { name: 'Undo last change' }));
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
    expect(screen.queryByRole('button', { name: 'Undo last change' })).toBeNull();
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
    expect(screen.queryByRole('button', { name: 'Undo last change' })).toBeNull();
    expect(screen.queryByText('The previous private plan was restored.')).toBeNull();
  });

  it('never reports a successful restoration when an otherwise visible Undo is rejected', async () => {
    coordinatorMocks.ensureCurrentPrivatePlan.mockResolvedValue({ ok: true, plan: changedPlan,
      titleByTargetId: { 'task-moved': 'Move the form' }, warnings: [] });
    coordinatorMocks.undoCurrentPrivatePlan.mockResolvedValue({ ok: false, errors: ['Planning settings changed.'], warnings: [] });
    renderEmbeddedPlan();
    await screen.findByRole('heading', { name: 'Changed' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Undo last change' }));
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
    expect(alert.textContent).toContain('Flexible plan needs updating.');
    expect(alert.textContent).toContain('Saved scheduler state is invalid.');
    expect(screen.getByText('Plan details').closest('details')?.open).toBe(false);
  });

  it('keeps the automatic plan truthful when optional manual-placement data fails', async () => {
    placementMocks.loadSoftPlacementsForDateResult.mockResolvedValue({
      errors: ['softPlacements: Saved manual placements could not be read.'],
      status: 'readFailed',
    });

    renderPlan();

    expect(await screen.findByText('No flexible work planned for Monday.')).toBeTruthy();
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
