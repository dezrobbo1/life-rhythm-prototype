// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';
import { taskPoolItemSchema } from '../../data/schemas';
import { createLifeRhythmDatabase } from '../../data/db';
import { checkPortableProfileForRestore, exportPortableProfile,
  REPLACE_LOCAL_PROFILE_CONFIRMATION, restorePortableProfile } from '../../data/portableProfileBackup';
import { readProfileRecoveryGeneration } from '../../data/profileRecoveryGeneration';
import { confirmTaskPoolSoftPlacement } from '../../data/taskSoftPlacementRepository';
import { localDateForNextSelectedDay } from './softPlacementDate';
import * as schedulerPlanCoordinator from '../../data/schedulerPlanCoordinator';

let namespaceIndex = 0;

beforeEach(async () => {
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`pool-soft-placement-flow-${namespaceIndex}`));

  const defaults = createDefaultSettings('2026-07-01T00:00:00.000Z');
  await saveSettings({
    lifeShape: {
      ...defaults.lifeShape,
      timeBlocks: [
        {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          end: '10:30',
          id: 'open-morning',
          label: 'Open morning capacity',
          schedulerUse: 'available',
          start: '10:00',
          type: 'openCapacity',
        },
      ],
    },
    startBoostSafety: defaults.startBoostSafety,
    theme: defaults.theme,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('Pool soft placement flow', () => {
  async function seedManualPlan() {
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(taskPoolItemSchema.parse({ id: 'manual-plan-pool', source: 'adhoc',
      title: 'Send school form', area: 'admin', minimum: { label: 'Open the form', minutes: 5 },
      normal: { label: 'Fill first page', minutes: 10 }, full: { label: 'Complete form', minutes: 20 },
      createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' }));
    return db;
  }

  async function openManualPlan(user: ReturnType<typeof userEvent.setup>, withSuggestion = true) {
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Plan' }));
    await user.click(screen.getByText('Plan details'));
    const suggestions = screen.getByRole('heading', { name: 'Soft suggestions' }).closest('section');
    if (!suggestions) throw new Error('Soft suggestions section was not found.');
    if (withSuggestion) await within(suggestions).findByText('Send school form');
    await waitFor(() => expect(screen.queryByText('Preparing the private plan.')).toBeNull());
    return suggestions;
  }

  async function replaceFromOtherHandle(json: string) {
    const sameNamespaceHandle = createLifeRhythmDatabase(getCurrentLifeRhythmDatabase().name);
    try {
      const checked = await checkPortableProfileForRestore(json, sameNamespaceHandle);
      if (!checked.ok || !('expectation' in checked)) throw new Error('Backup check failed.');
      expect(await restorePortableProfile(json, checked.expectation,
        REPLACE_LOCAL_PROFILE_CONFIRMATION, sameNamespaceHandle)).toEqual({ ok: true });
    } finally {
      sameNamespaceHandle.close();
    }
  }

  it('rejects a stale rendered Add after another handle restores the same Pool ID', async () => {
    const user = userEvent.setup();
    const db = await seedManualPlan();
    const suggestions = await openManualPlan(user);
    const payload = structuredClone((await exportPortableProfile(db)).payload);
    payload.data.taskPoolItems[0].title = 'Restored school form';
    await replaceFromOtherHandle(JSON.stringify(payload));
    expect(await readProfileRecoveryGeneration(db)).toBe(1);
    const beforeEvents = await db.taskHistory.toArray();
    const repair = vi.spyOn(schedulerPlanCoordinator, 'repairCurrentPrivatePlan');

    await user.click(within(suggestions).getByRole('button', { name: 'Add manual placement' }));
    expect(await screen.findByText('The local profile changed. Refresh Plan and try again.')).toBeTruthy();
    expect(await db.softPlacements.count()).toBe(0);
    expect(await db.taskPoolItems.get('manual-plan-pool')).toMatchObject({ status: 'captured', title: 'Restored school form' });
    expect(await db.taskHistory.toArray()).toEqual(beforeEvents);
    expect(repair).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Send school form')).toBeNull());
    expect(await within(suggestions).findByText('Restored school form')).toBeTruthy();
    await user.click(within(suggestions).getByRole('button', { name: 'Add manual placement' }));
    expect(await screen.findByText('User-confirmed placement added.')).toBeTruthy();
    expect(await db.softPlacements.toArray()).toEqual([expect.objectContaining({
      status: 'planned', taskTitleSnapshot: 'Restored school form',
    })]);
  });

  it('rejects a stale rendered Remove when restored state reuses its placement ID', async () => {
    const user = userEvent.setup();
    const db = await seedManualPlan();
    const input = { id: 'shared-placement', taskId: 'manual-plan-pool', blockId: 'open-morning',
      blockLabel: 'Open morning capacity', blockStart: '10:00', blockEnd: '10:30', date: localDateForNextSelectedDay('Monday') };
    expect((await confirmTaskPoolSoftPlacement(input, db)).ok).toBe(true);
    await openManualPlan(user, false);
    const placements = screen.getByRole('heading', { name: 'User-confirmed placements' }).closest('section');
    if (!placements) throw new Error('User-confirmed placements section was not found.');
    await within(placements).findByText('Send school form');
    const payload = structuredClone((await exportPortableProfile(db)).payload);
    payload.data.softPlacements[0].blockLabelSnapshot = 'Restored open window';
    await replaceFromOtherHandle(JSON.stringify(payload));
    const beforeEvents = await db.taskHistory.toArray();
    const repair = vi.spyOn(schedulerPlanCoordinator, 'repairCurrentPrivatePlan');

    await user.click(within(placements).getByRole('button', { name: 'Remove placement' }));
    expect(await screen.findByText('The local profile changed. Refresh Plan and try again.')).toBeTruthy();
    expect(await db.softPlacements.get('shared-placement')).toMatchObject({ status: 'planned', blockLabelSnapshot: 'Restored open window' });
    expect(await db.taskPoolItems.get('manual-plan-pool')).toMatchObject({ status: 'softPlaced' });
    expect(await db.taskHistory.toArray()).toEqual(beforeEvents);
    expect(repair).not.toHaveBeenCalled();
    expect(await within(placements).findByText(/Restored open window/)).toBeTruthy();
    await user.click(within(placements).getByRole('button', { name: 'Remove placement' }));
    expect(await screen.findByText('User-confirmed placement removed.')).toBeTruthy();
    expect(await db.softPlacements.get('shared-placement')).toMatchObject({ status: 'removed', blockLabelSnapshot: 'Restored open window' });
    expect(await db.taskPoolItems.get('manual-plan-pool')).toMatchObject({ status: 'captured' });
  });

  it('suggests only explicit open capacity and persists a user-confirmed placement', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Held' }));
    await user.click(screen.getByRole('button', { name: 'Capture task' }));
    await user.type(screen.getByLabelText('Task title'), 'Send school form');
    await user.selectOptions(screen.getByLabelText('Area'), 'admin');
    await user.type(screen.getByLabelText('Minimum version'), 'Open the form');
    await user.type(screen.getByLabelText('Minimum minutes'), '5');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));

    const taskPool = screen.getByRole('heading', { name: 'Captured tasks' }).closest('section');
    if (!taskPool) throw new Error('Captured tasks section was not found.');

    expect(await within(taskPool).findByText('Send school form')).toBeTruthy();
    await user.click(within(taskPool).getByRole('button', { name: 'Find soft window' }));

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeTruthy();
    await user.click(screen.getByText('Plan details'));
    const suggestions = screen.getByRole('heading', { name: 'Soft suggestions' }).closest('section');
    if (!suggestions) throw new Error('Soft suggestions section was not found.');

    expect(await within(suggestions).findByText('Send school form')).toBeTruthy();
    expect(within(suggestions).getByText('Open morning capacity · 10:00-10:30')).toBeTruthy();
    expect(within(suggestions).getByText('Minimum: Open the form · 5 min')).toBeTruthy();
    await user.click(within(suggestions).getByRole('button', { name: 'Add manual placement' }));

    expect(await screen.findByText('User-confirmed placement added.')).toBeTruthy();
    const placements = screen.getByRole('heading', { name: 'User-confirmed placements' }).closest('section');
    if (!placements) throw new Error('User-confirmed placements section was not found.');

    expect(await within(placements).findByText('Send school form')).toBeTruthy();
    expect(within(placements).getByText('Open morning capacity · 10:00-10:30')).toBeTruthy();

    const database = getCurrentLifeRhythmDatabase();
    expect(await database.softPlacements.toArray()).toEqual([
      expect.objectContaining({
        blockId: 'open-morning',
        placementSource: 'userConfirmed',
        status: 'planned',
        taskTitleSnapshot: 'Send school form',
      }),
    ]);
    expect(await database.taskPoolItems.toArray()).toEqual([
      expect.objectContaining({ status: 'softPlaced', title: 'Send school form' }),
    ]);
    expect(await database.activeTasks.count()).toBe(0);

    await user.click(within(placements).getByRole('button', { name: 'Remove placement' }));
    expect(await screen.findByText('User-confirmed placement removed.')).toBeTruthy();
    expect(await within(placements).findByText(/No user-confirmed placements for/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Held' }));
    expect(await screen.findByText('Send school form')).toBeTruthy();
    expect(screen.getByText('Admin - Safely held')).toBeTruthy();
    expect(await database.softPlacements.toArray()).toEqual([
      expect.objectContaining({ status: 'removed' }),
    ]);
  });
});
