// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { themeBackgrounds } from '../../app/theme';
import { SetupScreen } from '../../screens/SetupScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Setup screen', () => {
  it('renders all setup sections', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Life shape' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Start Boost safety' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Data and backup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dev tickets' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'About Life Rhythm' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Future modules' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Advanced/ })).toBeTruthy();
  });

  it('renders Life shape preview controls', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Life shape' })).toBeTruthy();
    expect(screen.getByText('Saved on this device when you choose Save settings.')).toBeTruthy();
    expect(screen.getByLabelText('Work starts')).toBeTruthy();
    expect(screen.getByLabelText('Work ends')).toBeTruthy();
    expect(screen.getByLabelText('Commute / travel time')).toBeTruthy();
    expect(screen.getByLabelText('Fixed commitments')).toBeTruthy();
    expect(screen.getByLabelText('Transition buffer')).toBeTruthy();
    expect(screen.getByLabelText('Breakfast anchor')).toBeTruthy();
    expect(screen.getByLabelText('Lunch anchor')).toBeTruthy();
    expect(screen.getByLabelText('Dinner anchor')).toBeTruthy();
    expect(screen.getByLabelText('Wake anchor')).toBeTruthy();
    expect(screen.getByLabelText('Sleep anchor')).toBeTruthy();
    expect(screen.getByLabelText('Low-capacity day preference')).toBeTruthy();
  });

  it('changes Life shape controls without saving until Save settings is used', async () => {
    const user = userEvent.setup();
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const openSpy = vi.fn();
    const deleteDatabaseSpy = vi.fn();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: deleteDatabaseSpy,
        open: openSpy,
      },
    });
    render(<SetupScreen />);

    await user.clear(screen.getByLabelText('Commute / travel time'));
    await user.type(screen.getByLabelText('Commute / travel time'), '35');
    await user.selectOptions(screen.getByLabelText('Transition buffer'), '20');
    await user.selectOptions(screen.getByLabelText('Low-capacity day preference'), 'minimum-first');

    expect((screen.getByLabelText('Commute / travel time') as HTMLInputElement).value).toBe('35');
    expect((screen.getByLabelText('Transition buffer') as HTMLSelectElement).value).toBe('20');
    expect(screen.getByRole('status').textContent).toContain('Life shape updated. Save settings when ready.');
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(deleteDatabaseSpy).not.toHaveBeenCalled();
  });

  it('renders appearance options and updates selected mock state', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    const themes = screen.getByRole('radiogroup', { name: 'Appearance theme' });
    expect(within(themes).getByRole('radio', { name: /Exhale/ })).toBeTruthy();
    expect(within(themes).getByRole('radio', { name: /Clear/ })).toBeTruthy();
    expect(within(themes).getByRole('radio', { name: /Grounded/ })).toBeTruthy();
    expect(screen.getByText('Selected: Exhale')).toBeTruthy();

    await user.click(within(themes).getByRole('radio', { name: /Clear/ }));

    expect(screen.getByText('Selected: Clear')).toBeTruthy();
    expect(within(themes).getByRole('radio', { name: /Clear/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('uses Setup theme selection to change the actual app theme', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Setup' }));
    await user.click(screen.getByRole('radio', { name: /Clear/ }));

    expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('clear');
    expect((screen.getByLabelText('Theme') as HTMLSelectElement).value).toBe('clear');

    await user.selectOptions(screen.getByLabelText('Theme'), 'grounded');

    expect(within(screen.getByRole('radiogroup', { name: 'Appearance theme' })).getByRole('radio', { name: /Grounded/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('keeps the Clear theme away from beige backgrounds', () => {
    expect(themeBackgrounds.clear).toBe('#f4f8fa');
    expect(themeBackgrounds.clear).not.toMatch(/f7f2e8|fff7e8|f3eadf|fffaf3|f7eadc/i);
  });

  it('renders safety toggles and can toggle them', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    const foodToggle = screen.getByRole('checkbox', { name: /Avoid food rewards/ }) as HTMLInputElement;
    const scrollingToggle = screen.getByRole('checkbox', { name: /Avoid scrolling rewards/ }) as HTMLInputElement;

    expect(foodToggle.checked).toBe(false);
    expect(scrollingToggle.checked).toBe(true);

    await user.click(foodToggle);
    await user.click(scrollingToggle);

    expect(foodToggle.checked).toBe(true);
    expect(scrollingToggle.checked).toBe(false);
  });

  it('renders data buttons without writing storage', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const exportSettingsBackup = vi.fn(async () => ({
      fileName: 'life-rhythm-settings-backup-2026-06-16.json',
      json: '{}',
      payload: {} as never,
    }));
    render(<SetupScreen onExportSettingsBackup={exportSettingsBackup} />);

    await user.click(screen.getByRole('button', { name: 'Export settings backup' }));

    expect(screen.getByText('This backup includes settings only. Tasks and rhythms are not included yet.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Settings backup created on this device.');
    expect(exportSettingsBackup).toHaveBeenCalledTimes(1);
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Import backup later' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export dev tickets later' })).toBeTruthy();
  });

  it('renders settings-only save and reset controls', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Save settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset settings to defaults' })).toBeTruthy();
    expect(screen.getByText('This does not save tasks, rhythms, packs, resets, imports, dev tickets, or future modules.')).toBeTruthy();
  });

  it('renders dev tickets as a local mock entry point', () => {
    render(<SetupScreen />);

    expect(screen.getByText('Capture a local note later')).toBeTruthy();
    expect(screen.getByText('Dev tickets are local testing notes, not a support desk or live GitHub integration.')).toBeTruthy();
  });

  it('keeps Advanced collapsed by default and can expand it', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    expect(screen.queryByRole('heading', { name: 'Reset whole app' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Advanced/ }));

    expect(screen.getByRole('heading', { name: 'Reset whole app' })).toBeTruthy();
    expect(screen.getByText('Whole-app reset controls will stay protected and separate. Settings reset only affects settings.')).toBeTruthy();
  });

  it('renders non-clinical boundary copy', () => {
    render(<SetupScreen />);

    expect(screen.getByText('Non-clinical self-management support. No medical claims.')).toBeTruthy();
  });

  it('keeps future modules planned and inactive', () => {
    render(<SetupScreen />);

    expect(screen.getByText('Future modules: planned, inactive for now.')).toBeTruthy();
    expect(screen.getByText('Rhythm Food: Inactive')).toBeTruthy();
    expect(screen.getByText('Rhythm Goals / Quiet Goals: Inactive')).toBeTruthy();
  });

  it('keeps bottom navigation available', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Setup' }));

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
  });
});
