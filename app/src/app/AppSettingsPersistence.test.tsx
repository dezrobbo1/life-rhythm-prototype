// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settingsSchema, type Settings } from '../data/schemas';
import type { SettingsWriteInput } from '../data/settingsRepository';

const settingsMocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  resetSettingsToDefaults: vi.fn(),
  saveSettings: vi.fn(),
}));

const settingsExportMocks = vi.hoisted(() => ({
  exportSettingsBackup: vi.fn(),
}));

vi.mock('../data/settingsRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/settingsRepository')>();

  return {
    ...actual,
    loadSettings: settingsMocks.loadSettings,
    resetSettingsToDefaults: settingsMocks.resetSettingsToDefaults,
    saveSettings: settingsMocks.saveSettings,
  };
});

vi.mock('../data/settingsExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/settingsExport')>();

  return {
    ...actual,
    exportSettingsBackup: settingsExportMocks.exportSettingsBackup,
  };
});

import App from '../App';

const now = '2026-06-15T00:00:00.000Z';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return settingsSchema.parse({
    appVersion: '1.4.6',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('App settings persistence wiring', () => {
  it('loads persisted settings into Setup and the app theme', async () => {
    settingsMocks.loadSettings.mockResolvedValue(
      makeSettings({
        lifeShape: {
          commuteMinutes: 35,
          fixedCommitments: [
            {
              bufferMinutes: 10,
              days: ['Monday'],
              id: 'stored-note',
              label: 'Stored appointment note',
              travelMinutes: 15,
            },
          ],
          lowCapacityPreference: 'minimum-first',
          mealAnchors: {
            breakfast: '07:45',
            dinner: '18:45',
            lunch: '12:45',
          },
          sleepWakeAnchors: {
            sleep: '22:15',
            wake: '06:15',
          },
          transitionBufferMinutes: 20,
          travelMinutes: 35,
          usualWorkHours: {
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            end: '17:30',
            start: '09:30',
          },
        },
        startBoostSafety: {
          avoidAccountabilityPrompts: true,
          avoidFoodRewards: true,
          avoidScrollingRewards: true,
          avoidShoppingRewards: true,
          avoidStreakPressure: true,
          avoidUrgencyCountdowns: true,
        },
        theme: 'clear',
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('clear'));
    await user.click(screen.getByRole('button', { name: 'Setup' }));

    expect((screen.getByLabelText('Commute / travel time') as HTMLInputElement).value).toBe('35');
    expect((screen.getByLabelText('Transition buffer') as HTMLSelectElement).value).toBe('20');
    expect((screen.getByLabelText('Low-capacity day preference') as HTMLSelectElement).value).toBe('minimum-first');
    expect((screen.getByLabelText('Fixed commitments') as HTMLTextAreaElement).value).toBe('Stored appointment note');
    expect(within(screen.getByRole('radiogroup', { name: 'Appearance theme' })).getByRole('radio', { name: /Clear/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('saves normalized Setup settings explicitly', async () => {
    settingsMocks.loadSettings.mockResolvedValue(makeSettings());
    settingsMocks.saveSettings.mockImplementation(async (input: SettingsWriteInput) => ({
      ok: true,
      settings: makeSettings({
        lifeShape: input.lifeShape as Settings['lifeShape'],
        startBoostSafety: input.startBoostSafety as Settings['startBoostSafety'],
        theme: input.theme as Settings['theme'],
      }),
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Setup' }));
    await user.click(screen.getByRole('radio', { name: /Clear/ }));
    await user.click(screen.getByRole('checkbox', { name: /Avoid food rewards/ }));
    await user.clear(screen.getByLabelText('Commute / travel time'));
    await user.type(screen.getByLabelText('Commute / travel time'), '35');
    await user.clear(screen.getByLabelText('Fixed commitments'));
    await user.type(screen.getByLabelText('Fixed commitments'), 'School run');
    await user.selectOptions(screen.getByLabelText('Transition buffer'), '20');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Settings saved on this device.'));
    expect(settingsMocks.saveSettings).toHaveBeenCalledTimes(1);
    expect(settingsMocks.saveSettings.mock.calls[0][0]).toMatchObject({
      lifeShape: {
        commuteMinutes: 35,
        fixedCommitments: [{ id: 'setup-fixed-commitments', label: 'School run' }],
        transitionBufferMinutes: 20,
        travelMinutes: 35,
      },
      startBoostSafety: {
        avoidFoodRewards: true,
      },
      theme: 'clear',
    });
  });

  it('resets settings to defaults only', async () => {
    settingsMocks.loadSettings.mockResolvedValue(makeSettings({ theme: 'clear' }));
    settingsMocks.resetSettingsToDefaults.mockResolvedValue(makeSettings());

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('clear'));
    await user.click(screen.getByRole('button', { name: 'Setup' }));
    await user.click(screen.getByRole('button', { name: 'Reset settings to defaults' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Settings reset to defaults on this device.'));
    expect(settingsMocks.resetSettingsToDefaults).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('exhale');
  });

  it('exports a settings-only backup from Setup', async () => {
    settingsMocks.loadSettings.mockResolvedValue(makeSettings());
    settingsExportMocks.exportSettingsBackup.mockResolvedValue({
      fileName: 'life-rhythm-settings-backup-2026-06-16.json',
      json: '{}',
      payload: {},
    });
    const createObjectUrl = vi.fn(() => 'blob:settings-backup');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Setup' }));
    await user.click(screen.getByRole('button', { name: 'Export settings backup' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Settings backup created on this device.'));
    expect(settingsExportMocks.exportSettingsBackup).toHaveBeenCalledTimes(1);
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();
    expect(settingsMocks.resetSettingsToDefaults).not.toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:settings-backup');
  });
});
