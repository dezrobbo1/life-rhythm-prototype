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

    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Secondary' })).getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('button', { name: 'Capture' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Secondary' })).getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('button', { name: 'Capture' })).toBeNull();
  });

  it('captures once from Today, stays on Today, and shows the saved task in Held', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Today' });
    const captureButton = screen.getByRole('button', { name: 'Capture' });
    await user.click(captureButton);
    expect(screen.getByText('Keep this out of Today for now. Life Rhythm can privately plan it when it fits.')).toBeTruthy();
    await user.type(screen.getByLabelText('Task title'), 'Pack spare charger');
    await user.type(screen.getByLabelText('Smallest useful action'), 'Put charger by the bag');
    await user.type(screen.getByLabelText('Minutes for this action'), '5');
    await user.dblClick(screen.getByRole('button', { name: 'Save captured task' }));

    expect(await screen.findByText('Task captured. Held outside Today. Life Rhythm can privately plan it when it fits.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Capture task' })).toBeNull();
    expect(document.activeElement).toBe(captureButton);

    const database = getCurrentLifeRhythmDatabase();
    expect(await database.taskPoolItems.count()).toBe(1);
    expect(await database.activeTasks.count()).toBe(0);
    expect(await database.softPlacements.count()).toBe(0);
    const savedPlans = await database.schedulerPlanState.toArray();
    expect(savedPlans.flatMap((saved) => saved.plan.placements)).toEqual([]);
    expect(await database.rhythmTemplates.count()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Held' }));
    expect(await screen.findByText('Pack spare charger')).toBeTruthy();
  });

  it('starts with only authored capture essentials and reveals optional metadata on request', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Today' });
    await user.click(screen.getByRole('button', { name: 'Capture' }));

    const dialog = screen.getByRole('dialog', { name: 'Capture task' });
    expect(within(dialog).getByLabelText('Task title')).toBeTruthy();
    expect(within(dialog).getByLabelText('Smallest useful action')).toBeTruthy();
    expect(within(dialog).getByLabelText('Minutes for this action')).toBeTruthy();
    expect(within(dialog).queryByLabelText('Area')).toBeNull();
    expect(within(dialog).queryByLabelText('Normal version')).toBeNull();
    expect(within(dialog).queryByLabelText('Purpose')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Save captured task' })).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Task title'));

    const details = within(dialog).getByRole('button', { name: /Optional details/ });
    expect(details.getAttribute('aria-expanded')).toBe('false');
    await user.click(details);
    expect(details.getAttribute('aria-expanded')).toBe('true');
    await user.selectOptions(within(dialog).getByLabelText('Area'), 'admin');
    await user.type(within(dialog).getByLabelText('Task title'), 'Order shoes');
    await user.type(within(dialog).getByLabelText('Smallest useful action'), 'Check size');
    await user.type(within(dialog).getByLabelText('Minutes for this action'), '5');
    await user.type(within(dialog).getByLabelText('Normal version'), 'Browse shoes');
    await user.type(within(dialog).getByLabelText('Normal minutes'), '15');
    await user.click(within(dialog).getByRole('button', { name: 'Save captured task' }));

    await waitFor(async () => expect(await getCurrentLifeRhythmDatabase().taskPoolItems.count()).toBe(1));
    const saved = await getCurrentLifeRhythmDatabase().taskPoolItems.toArray();
    expect(saved[0]).toMatchObject({ area: 'admin', minimum: { label: 'Check size', minutes: 5 }, normal: { label: 'Browse shoes', minutes: 15 } });
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
    await user.type(screen.getByLabelText('Smallest useful action'), 'One safe step');
    await user.type(screen.getByLabelText('Minutes for this action'), '5');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));

    const dialog = screen.getByRole('dialog', { name: 'Capture task' });
    expect(await within(dialog).findByText(/Saved Held tasks could not be read, so nothing was captured/)).toBeTruthy();
    expect(within(dialog).queryByText('Task was not captured. Check the required fields.')).toBeNull();
    expect(screen.queryByText('Task captured. Held outside Today and available for private planning.')).toBeNull();
    expect(putSpy).not.toHaveBeenCalled();
  });
});
