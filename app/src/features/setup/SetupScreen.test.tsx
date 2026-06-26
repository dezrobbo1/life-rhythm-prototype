// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { themeBackgrounds } from '../../app/theme';
import { buildSettingsBackupPayload } from '../../data/settingsExport';
import { buildSoftPlacementBackupPayload } from '../../data/softPlacementBackup';
import type { SettingsWriteInput, SettingsWriteResult } from '../../data/settingsRepository';
import { settingsSchema, softPlacementSchema, type SoftPlacement } from '../../data/schemas';
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

function validSoftPlacement(overrides: Partial<SoftPlacement> = {}): SoftPlacement {
  return softPlacementSchema.parse({
    blockId: 'monday-open-capacity',
    blockLabelSnapshot: 'Monday open capacity',
    createdAt: '2026-06-18T00:00:00.000Z',
    date: '2026-06-18',
    end: '12:00',
    id: 'soft-placement-send-form',
    placementSource: 'userConfirmed',
    start: '11:00',
    status: 'planned',
    taskId: 'send-form',
    taskTitleSnapshot: 'Send the form',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  });
}

function validSoftPlacementBackupJson() {
  return JSON.stringify(buildSoftPlacementBackupPayload([
    validSoftPlacement(),
    validSoftPlacement({
      id: 'soft-placement-removed',
      status: 'removed',
      taskTitleSnapshot: 'Removed placement',
    }),
  ], '2026-06-18T01:00:00.000Z'));
}

describe('Setup screen', () => {
  it('renders all setup sections', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Life shape' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Start Boost safety' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Backup and recovery' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Trial limits' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dev tickets' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'About Life Rhythm' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Future modules' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Advanced/ })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|catch up|optimize|productivity score|compliance)\b/i,
    );
  });

  it('renders Life shape preview controls', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Life shape' })).toBeTruthy();
    expect(screen.getByText('Saved on this device when you choose Save settings.')).toBeTruthy();
    expect(screen.getByLabelText('Work starts')).toBeTruthy();
    expect(screen.getByLabelText('Work ends')).toBeTruthy();
    expect(screen.getByLabelText('Commute / travel time')).toBeTruthy();
    expect(screen.getByLabelText('Fixed commitments')).toBeTruthy();
    expect(
      screen.getByText(
        'Notes only for now. These do not place tasks or affect Plan yet. Use Time to leave alone blocks for protected, recovery, family, loose, household, or open-capacity time.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Transition buffer')).toBeTruthy();
    expect(screen.getByLabelText('Breakfast anchor')).toBeTruthy();
    expect(screen.getByLabelText('Lunch anchor')).toBeTruthy();
    expect(screen.getByLabelText('Dinner anchor')).toBeTruthy();
    expect(screen.getByLabelText('Wake anchor')).toBeTruthy();
    expect(screen.getByLabelText('Sleep anchor')).toBeTruthy();
    expect(screen.getByLabelText('Low-capacity day preference')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Time to leave alone' })).toBeTruthy();
    expect(screen.getByText('Not every open gap is available.')).toBeTruthy();
    expect(
      screen.getByText('Use these blocks for time the app should leave alone, ask first about, or treat as open capacity.'),
    ).toBeTruthy();
    expect(screen.getByText('Life Rhythm will not place tasks here unless you allow it. Loose time can stay loose.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add block' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|catch up|optimize|productivity score|compliance)\b/i,
    );
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

  it('keeps generated Life Shape block labels aligned with the selected type', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await user.click(screen.getByRole('button', { name: 'Add block' }));

    expect((screen.getByLabelText('Time block 1 label') as HTMLInputElement).value).toBe('Protected time');

    await user.selectOptions(screen.getByLabelText('Time block 1 type'), 'openCapacity');

    expect((screen.getByLabelText('Time block 1 label') as HTMLInputElement).value).toBe('Open capacity');
    expect((screen.getByLabelText('Time block 1 scheduler use') as HTMLSelectElement).value).toBe('available');

    await user.clear(screen.getByLabelText('Time block 1 label'));
    await user.type(screen.getByLabelText('Time block 1 label'), 'My open window');
    await user.selectOptions(screen.getByLabelText('Time block 1 type'), 'recoveryTime');

    expect((screen.getByLabelText('Time block 1 label') as HTMLInputElement).value).toBe('My open window');
    expect((screen.getByLabelText('Time block 1 scheduler use') as HTMLSelectElement).value).toBe('unavailable');
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

    await user.click(screen.getByRole('button', { name: 'Settings' }));
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

    expect(screen.getByText('Creates a local backup file for settings and Life Shape only.')).toBeTruthy();
    expect(screen.getByText('It does not include Today tasks, Library rhythms, or soft placements.')).toBeTruthy();
    expect(screen.getByText('Export settings')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Settings backup created on this device.');
    expect(exportSettingsBackup).toHaveBeenCalledTimes(1);
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Import backup later' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export dev tickets later' })).toBeTruthy();
  });

  it('renders calm personal trial limits without adding feature controls', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Trial limits' })).toBeTruthy();
    expect(screen.getByText('Use one browser, one device, and one stable URL for the trial.')).toBeTruthy();
    expect(screen.getByText('Life Rhythm is local-first. This browser and device store the live trial data.')).toBeTruthy();
    expect(screen.getByText('Login is not cloud sync. Backups can be exported and checked, but import/restore is not enabled.')).toBeTruthy();
    expect(
      screen.getByText(
        'Calendar, AI, cloud sync, notifications, askFirst placement, and move/edit placement are not part of this trial.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /restore/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /sync/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /calendar/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|catch up|optimize|productivity score|compliance)\b/i,
    );
  });

  it('renders soft placement backup export and checker controls', () => {
    render(<SetupScreen />);

    expect(screen.getByRole('heading', { name: 'Export soft placements' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export soft placement backup' })).toBeTruthy();
    expect(screen.getByText('Creates a local backup file for saved soft placements, including removed placement state.')).toBeTruthy();
    expect(screen.getByText('It does not include tasks, settings, Library rhythms, or calendar events.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Check soft placement backup' })).toBeTruthy();
    expect(screen.getByLabelText('Soft placement backup text')).toBeTruthy();
    expect(screen.getByLabelText('Select soft placement backup file')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check soft placement backup' })).toBeTruthy();
    expect(screen.getByText('Check only. Paste or select a soft placement backup.')).toBeTruthy();
    expect(screen.getByText('Restore is not connected yet. No calendar events are created.')).toBeTruthy();
    expect(screen.getByText('Checking does not restore placements or change this device.')).toBeTruthy();
  });

  it('exports a soft placement backup through the connected handler', async () => {
    const user = userEvent.setup();
    const onExportSoftPlacementBackup = vi.fn(async () => ({
      fileName: 'life-rhythm-soft-placements-backup-2026-06-18.json',
      json: '{}',
      payload: buildSoftPlacementBackupPayload([validSoftPlacement()], '2026-06-18T01:00:00.000Z'),
      placementCount: 1,
    }));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<SetupScreen onExportSoftPlacementBackup={onExportSoftPlacementBackup} />);

    await user.click(screen.getByRole('button', { name: 'Export soft placement backup' }));

    expect(screen.getByRole('status').textContent).toContain('Soft placement backup created on this device.');
    expect(onExportSoftPlacementBackup).toHaveBeenCalledTimes(1);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('shows an empty soft placement backup export message', async () => {
    const user = userEvent.setup();
    const onExportSoftPlacementBackup = vi.fn(async () => null);

    render(<SetupScreen onExportSoftPlacementBackup={onExportSoftPlacementBackup} />);

    await user.click(screen.getByRole('button', { name: 'Export soft placement backup' }));

    expect(screen.getByRole('status').textContent).toContain('No saved soft placements to export yet.');
    expect(onExportSoftPlacementBackup).toHaveBeenCalledTimes(1);
  });

  it('shows valid soft placement backup preview feedback without writing', async () => {
    const user = userEvent.setup();
    const onSaveSettings = vi.fn();
    const onResetSettings = vi.fn();
    const onExportSettingsBackup = vi.fn();
    const onExportSoftPlacementBackup = vi.fn();
    const fetchSpy = vi.fn();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

    try {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: fetchSpy,
      });
      render(
        <SetupScreen
          onExportSettingsBackup={onExportSettingsBackup}
          onExportSoftPlacementBackup={onExportSoftPlacementBackup}
          onResetSettings={onResetSettings}
          onSaveSettings={onSaveSettings}
        />,
      );

      fireEvent.change(screen.getByLabelText('Soft placement backup text'), {
        target: {
          value: validSoftPlacementBackupJson(),
        },
      });
      await user.click(screen.getByRole('button', { name: 'Check soft placement backup' }));

      expect(screen.getByRole('status').textContent).toContain('Soft placement backup looks valid. Restore is not connected yet.');
      const preview = screen.getByLabelText('Soft placement backup preview');
      expect(preview.textContent).toContain('Placements');
      expect(preview.textContent).toContain('2');
      expect(preview.textContent).toContain('1 planned, 1 removed');
      expect(preview.textContent).toContain('Send the form, Removed placement');
      expect(onSaveSettings).not.toHaveBeenCalled();
      expect(onResetSettings).not.toHaveBeenCalled();
      expect(onExportSettingsBackup).not.toHaveBeenCalled();
      expect(onExportSoftPlacementBackup).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    } finally {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }
    }
  });

  it('shows invalid soft placement backup feedback', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    fireEvent.change(screen.getByLabelText('Soft placement backup text'), {
      target: {
        value: '{ not json',
      },
    });
    await user.click(screen.getByRole('button', { name: 'Check soft placement backup' }));

    expect(screen.getByRole('status').textContent).toContain('This soft placement backup could not be used.');
    expect(screen.getByRole('list', { name: 'Soft placement backup errors' })).toBeTruthy();
    expect(screen.getByText('backup: Soft placement backup JSON is malformed.')).toBeTruthy();
  });

  it('loads a selected soft placement backup file and validates it', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);
    const file = new File([validSoftPlacementBackupJson()], 'soft-placements.json', {
      type: 'application/json',
    });

    await user.upload(screen.getByLabelText('Select soft placement backup file'), file);

    expect(screen.getByRole('status').textContent).toContain('Soft placement backup loaded. Choose Check soft placement backup.');

    await user.click(screen.getByRole('button', { name: 'Check soft placement backup' }));

    expect(screen.getByRole('status').textContent).toContain('Soft placement backup looks valid. Restore is not connected yet.');
    expect(screen.getByLabelText('Soft placement backup preview').textContent).toContain('Send the form');
  });

  it('shows valid settings backup preview feedback', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    fireEvent.change(screen.getByLabelText('Settings backup text'), {
      target: {
        value: validSettingsBackupJson(),
      },
    });
    await user.click(screen.getByRole('button', { name: 'Check settings backup' }));

    expect(screen.getByRole('status').textContent).toContain('Settings backup looks valid. Restore is not connected yet.');
    expect(screen.getByText('Check only. Paste or select a settings backup.')).toBeTruthy();
    expect(screen.getByText('Restore is not connected yet.')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByText('clear')).toBeTruthy();
    expect(screen.getByText('4 safety choices on')).toBeTruthy();
    expect(screen.getByText('09:00-16:30, 10 min buffer')).toBeTruthy();
    expect(screen.getByText('Checking does not restore settings or change this device.')).toBeTruthy();
  });

  it('shows invalid settings backup feedback', async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    fireEvent.change(screen.getByLabelText('Settings backup text'), {
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

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Pool' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Settings' })).toBeNull();

    const secondaryNav = screen.getByRole('navigation', { name: 'Secondary' });
    expect(within(secondaryNav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(secondaryNav).getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
  });
});
