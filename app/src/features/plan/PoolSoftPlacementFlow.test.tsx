// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
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
  it('suggests only explicit open capacity and persists a user-confirmed placement', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Pool' }));
    await user.click(screen.getByRole('button', { name: 'Capture task' }));
    await user.type(screen.getByLabelText('Task title'), 'Send school form');
    await user.selectOptions(screen.getByLabelText('Area'), 'admin');
    await user.type(screen.getByLabelText('Minimum version'), 'Open the form');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));

    const taskPool = screen.getByRole('heading', { name: 'Task Pool' }).closest('section');
    if (!taskPool) throw new Error('Task Pool section was not found.');

    expect(await within(taskPool).findByText('Send school form')).toBeTruthy();
    await user.click(within(taskPool).getByRole('button', { name: 'Find soft window' }));

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeTruthy();
    const suggestions = screen.getByRole('heading', { name: 'Soft suggestions' }).closest('section');
    if (!suggestions) throw new Error('Soft suggestions section was not found.');

    expect(await within(suggestions).findByText('Send school form')).toBeTruthy();
    expect(within(suggestions).getByText('Open morning capacity · 10:00-10:30')).toBeTruthy();
    expect(within(suggestions).getByText('Minimum: Open the form · 5 min')).toBeTruthy();
    await user.click(within(suggestions).getByRole('button', { name: 'Add soft placement' }));

    expect(await screen.findByText('Soft placement added.')).toBeTruthy();
    const placements = screen.getByRole('heading', { name: 'Soft placements' }).closest('section');
    if (!placements) throw new Error('Soft placements section was not found.');

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
    expect(await screen.findByText('Soft placement removed.')).toBeTruthy();
    expect(await within(placements).findByText(/No saved soft placements for/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Pool' }));
    expect(await screen.findByText('Send school form')).toBeTruthy();
    expect(screen.getByText('Admin - Safely held')).toBeTruthy();
    expect(await database.softPlacements.toArray()).toEqual([
      expect.objectContaining({ status: 'removed' }),
    ]);
  });
});
