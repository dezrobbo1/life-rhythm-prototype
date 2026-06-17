// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { themeBackgrounds } from '../../app/theme';
import { buildSettingsBackupPayload } from '../../data/settingsExport';
import type { SettingsWriteInput, SettingsWriteResult } from '../../data/settingsRepository';
import { settingsSchema } from '../../data/schemas';
import { SetupScreen } from '../../screens/SetupScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function validSettingsBackupJson() {
  const settings = settingsSchema.parse({
    appVersion: '1.4.6',
    createdAt: '2026-06-15T00:00:00.000Z',
    id: 'settings',
    lifeShape: {
      commuteMinutes: 20,
      fixedCommitments: [],
      lowCapacityPreference: 'protect-evening',
      mealAnchors: {
        breakfast: '07:30',
        dinner: '18:30',
        lunch: '12:30',
      },
      sleepWakeAnchors: {
        sleep: '22:00',
        wake: '06:30',
      },
      transitionBufferMinutes: 10,
      travelMinutes: 20,
      usualWorkHours: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        end: '16:30',
        start: '09:00',
      },
    },
    startBoostSafety: {
      avoidAccountabilityPrompts: false,
      avoidFoodRewards: false,
      avoidScrollingRewards: true,
      avoidShoppingRewards: true,
      avoidStreakPressure: true,
      avoidUrgencyCountdowns: true,
    },
    theme: 'clear',
    updatedAt: '2026-06-15T01:00:00.000Z',
  });

  return JSON.stringify(buildSettingsBackupPayload(settings, '2026-06-16T00:00:00.000Z'));
}

describe('Setup screen', () => {
  it('renders all setup sections', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Life shape' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Start Boost safety' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Backup and recovery' })).toBeTruthy();
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
    expect(screen.getByRole('heading', { name: 'Time to leave alone' })).toBeTruthy();
    expect(screen.getByText('Not every open gap is available.')).toBeTruthy();
    expect(screen.getByText('Life Rhythm will not place tasks here unless you allow it. Loose time can stay loose.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add block' })).toBeTruthy();
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

  it('adds and saves a Life Shape time block through settings only', async () => {
    const user = userEvent.setup();
    const onSaveSettings = vi.fn(async (input: SettingsWriteInput): Promise<SettingsWriteResult> => ({
      ok: true,
      settings: settingsSchema.parse({
        appVersion: '1.4.6',
        createdAt: '2026-06-15T00:00:00.000Z',
        id: 'settings',
        lifeShape: input.lifeShape,
        startBoostSafety: input.startBoostSafety,
        theme: input.theme,
        updatedAt: '2026-06-15T01:00:00.000Z',
      }),
    }));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<SetupScreen onSaveSettings={onSaveSettings} />);

    await user.click(screen.getByRole('button', { name: 'Add block' }));

    expect((screen.getByLabelText('Time block 1 type') as HTMLSelectElement).value).toBe('protectedTime');
    expect((screen.getByLabelText('Time block 1 scheduler use') as HTMLSelectElement).value).toBe('unavailable');

    await user.clear(screen.getByLabelText('Time block 1 label'));
    await user.type(screen.getByLabelText('Time block 1 label'), 'Protected writing space');
    await user.selectOptions(screen.getByLabelText('Time block 1 type'), 'looseTime');

    expect((screen.getByLabelText('Time block 1 scheduler use') as HTMLSelectElement).value).toBe('askFirst');

    await user.selectOptions(screen.getByLabelText('Time block 1 type'), 'openCapacity');

    expect((screen.getByLabelText('Time block 1 scheduler use') as HTMLSelectElement).value).toBe('available');

    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(onSaveSettings).toHaveBeenCalledTimes(1);
    expect(onSaveSettings.mock.calls[0][0]).toMatchObject({
      lifeShape: {
        timeBlocks: [
          expect.objectContaining({
            days: ['Monday'],
            end: '12:00',
            label: 'Protected writing space',
            schedulerUse: 'available',
            start: '11:00',
            type: 'openCapacity',
          }),
        ],
      },
    });
    expect(screen.getByRole('status').textContent).toContain('Settings saved on this device.');
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('removes a Life Shape time block before saving', async () => {
    const user = userEvent.setup();
    const onSaveSettings = vi.fn(async (input: SettingsWriteInput): Promise<SettingsWriteResult> => ({
      ok: true,
      settings: settingsSchema.parse({
        appVersion: '1.4.6',
        createdAt: '2026-06-15T00:00:00.000Z',
        id: 'settings',
        lifeShape: input.lifeShape,
        startBoostSafety: input.startBoostSafety,
        theme: input.theme,
        updatedAt: '2026-06-15T01:00:00.000Z',
      }),
    }));
    render(<SetupScreen onSaveSettings={onSaveSettings} />);

    await user.click(screen.getByRole('button', { name: 'Add block' }));
    await user.click(screen.getByRole('button', { name: 'Remove block' }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(onSaveSettings.mock.calls[0][0]).toMatchObject({
      lifeShape: {
        timeBlocks: [],
      },
    });
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
    expect(screen.getByText('Export settings')).toBeTruthy();
    expect(screen.getByText('Creates a settings-only file when you choose it.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Settings backup created on this device.');
    expect(exportSettingsBackup).toHaveBeenCalledTimes(1);
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Import backup later' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export dev tickets later' })).toBeTruthy();
  });

  it('shows valid settings backup preview feedback', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    fireEvent.change(screen.getByLabelText('Settings backup JSON'), {
      target: {
        value: validSettingsBackupJson(),
      },
    });
    await user.click(screen.getByRole('button', { name: 'Check settings backup' }));

    expect(screen.getByRole('status').textContent).toContain('Settings backup looks valid. Restore is not connected yet.');
    expect(screen.getByText('Read-only check. Restore/import is not connected yet.')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByText('clear')).toBeTruthy();
    expect(screen.getByText('4 safety choices on')).toBeTruthy();
    expect(screen.getByText('09:00-16:30, 10 min buffer')).toBeTruthy();
    expect(screen.getByText('Checking a backup does not change anything on this device.')).toBeTruthy();
  });

  it('shows invalid settings backup feedback', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    fireEvent.change(screen.getByLabelText('Settings backup JSON'), {
      target: {
        value: '{ not json',
      },
    });
    await user.click(screen.getByRole('button', { name: 'Check settings backup' }));

    expect(screen.getByRole('status').textContent).toContain('Backup check found an issue. Nothing changed on this device.');
    expect(screen.getByText('Backup check notes')).toBeTruthy();
    expect(screen.getByText('Nothing changed on this device. The first items to review are below.')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Settings backup errors' })).toBeTruthy();
    expect(screen.getByText('backup: Settings backup JSON is malformed.')).toBeTruthy();
  });

  it('renders settings-only save and reset controls', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Save settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset settings to defaults' })).toBeTruthy();
    expect(screen.getByText('This is the only settings area here that changes saved data on this device.')).toBeTruthy();
    expect(screen.getByText('Save writes theme, Start Boost safety, and Life shape only. Reset returns those settings to defaults.')).toBeTruthy();
    expect(screen.getByText('Tasks, rhythms, packs, imports, dev tickets, and future modules are not changed.')).toBeTruthy();
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
