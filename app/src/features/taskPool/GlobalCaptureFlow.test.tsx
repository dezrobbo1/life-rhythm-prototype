// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { createDefaultSettings } from '../../data/settingsRepository';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';

const settingsRepositoryMocks = vi.hoisted(() => ({
  loadSettingsResult: vi.fn(),
}));

vi.mock('../../data/settingsRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/settingsRepository')>();
  return { ...actual, loadSettingsResult: settingsRepositoryMocks.loadSettingsResult };
});

let namespaceIndex = 0;

beforeEach(() => {
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`global-capture-${namespaceIndex}`));
  settingsRepositoryMocks.loadSettingsResult.mockResolvedValue({
    conflicts: [],
    errors: [],
    migrationPersisted: false,
    settings: createDefaultSettings('2026-09-20T00:00:00.000Z'),
    status: 'defaulted',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('persistent shell Capture', () => {
  it('stays available on every primary destination without becoming a destination', async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Primary' });

    for (const destination of ['Today', 'Plan', 'Held', 'Library']) {
      await user.click(within(nav).getByRole('button', { name: destination }));
      expect(screen.getByRole('button', { name: 'Capture' })).toBeTruthy();
    }

    expect(within(nav).queryByRole('button', { name: 'Capture' })).toBeNull();
  });

  it('captures once from Today, stays on Today, and shows the saved task in Held', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Today' });
    const captureButton = screen.getByRole('button', { name: 'Capture' });
    await user.click(captureButton);
    await user.type(screen.getByLabelText('Task title'), 'Pack spare charger');
    await user.type(screen.getByLabelText('Minimum version'), 'Put charger by the bag');
    await user.dblClick(screen.getByRole('button', { name: 'Save captured task' }));

    expect(await screen.findByText('Task captured. It is safely held.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Capture task' })).toBeNull();
    expect(document.activeElement).toBe(captureButton);

    const database = getCurrentLifeRhythmDatabase();
    expect(await database.taskPoolItems.count()).toBe(1);
    expect(await database.activeTasks.count()).toBe(0);
    expect(await database.softPlacements.count()).toBe(0);
    expect(await database.schedulerPlanState.count()).toBe(0);
    expect(await database.rhythmTemplates.count()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Held' }));
    expect(await screen.findByText('Pack spare charger')).toBeTruthy();
  });

  it('opens and closes Capture from the keyboard and restores focus', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Today' });
    const captureButton = screen.getByRole('button', { name: 'Capture' });
    captureButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Capture task' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Capture task' })).toBeNull();
    expect(document.activeElement).toBe(captureButton);
  });

  it('does not claim success or write when the Held collection cannot be trusted', async () => {
    const user = userEvent.setup();
    const database = getCurrentLifeRhythmDatabase();
    const putSpy = vi.spyOn(database.taskPoolItems, 'put');
    vi.spyOn(database.taskPoolItems, 'toArray').mockRejectedValue(new Error('storage unavailable'));
    render(<App />);

    await screen.findByRole('heading', { name: 'Today' });
    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await user.type(screen.getByLabelText('Task title'), 'Should remain unsaved');
    await user.type(screen.getByLabelText('Minimum version'), 'One safe step');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));

    expect(await screen.findByText(/Saved Held tasks could not be read, so nothing was captured/)).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Capture task' })).toBeTruthy();
    expect(screen.queryByText('Task captured. It is safely held.')).toBeNull();
    expect(putSpy).not.toHaveBeenCalled();
  });
});
