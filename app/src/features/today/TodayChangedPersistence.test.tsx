// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
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
import { activeTaskSchema } from '../../data/schemas';
import type { SchedulerPlan } from '../../domain/schedulingModel';
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
    await getCurrentLifeRhythmDatabase().delete();
    resetCurrentLocalDataNamespace();
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
