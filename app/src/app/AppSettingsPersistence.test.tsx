// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settingsSchema, type Settings } from '../data/schemas';
import { buildSettingsBackupPayload } from '../data/settingsExport';
import { buildSoftPlacementBackupPayload } from '../data/softPlacementBackup';
import type { SettingsLoadResult, SettingsWriteInput } from '../data/settingsRepository';

const settingsMocks = vi.hoisted(() => ({
  loadSettingsResult: vi.fn(),
  resetSettingsToDefaults: vi.fn(),
  saveSettings: vi.fn(),
}));

const settingsExportMocks = vi.hoisted(() => ({
  exportSettingsBackup: vi.fn(),
}));

const softPlacementBackupMocks = vi.hoisted(() => ({
  exportSoftPlacementBackup: vi.fn(),
}));

vi.mock('../data/settingsRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/settingsRepository')>();

  return {
    ...actual,
    loadSettingsResult: settingsMocks.loadSettingsResult,
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

vi.mock('../data/softPlacementBackup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/softPlacementBackup')>();

  return {
    ...actual,
    exportSoftPlacementBackup: softPlacementBackupMocks.exportSoftPlacementBackup,
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

function makeLoadResult(
  settings: Settings,
  status: SettingsLoadResult['status'] = 'loaded',
  errors: string[] = [],
): SettingsLoadResult {
  return {
    conflicts: [],
    errors,
    migrationPersisted: status === 'migrated',
    settings,
    status,
  };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('App settings persistence wiring', () => {
  it('loads persisted settings into Setup and the app theme', async () => {
    settingsMocks.loadSettingsResult.mockResolvedValue(
      makeLoadResult(makeSettings({
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
          timeBlocks: [
            {
              days: ['Monday'],
              end: '12:00',
              id: 'protected-writing',
              label: 'Protected writing space',
              schedulerUse: 'unavailable',
              start: '10:00',
              type: 'protectedTime',
            },
          ],
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
      }), 'migrated'),
    );

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('clear'));
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect((screen.getByLabelText('Commute / travel time') as HTMLInputElement).value).toBe('35');
    expect((screen.getByLabelText('Transition buffer') as HTMLSelectElement).value).toBe('20');
    expect((screen.getByLabelText('Low-capacity day preference') as HTMLSelectElement).value).toBe('minimum-first');
    expect((screen.getByLabelText('Fixed commitments') as HTMLTextAreaElement).value).toBe('Stored appointment note');
    expect((screen.getByLabelText('Time block 1 label') as HTMLInputElement).value).toBe('Protected writing space');
    expect((screen.getByLabelText('Time block 1 scheduler use') as HTMLSelectElement).value).toBe('unavailable');
    expect(within(screen.getByRole('radiogroup', { name: 'Appearance theme' })).getByRole('radio', { name: /Clear/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText(/updated settings foundation could not be saved/i)).toBeNull();
  });

  it('saves normalized Setup settings explicitly', async () => {
    settingsMocks.loadSettingsResult.mockResolvedValue(makeLoadResult(makeSettings()));
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

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('radio', { name: /Clear/ }));
    await user.click(screen.getByRole('checkbox', { name: /Avoid food rewards/ }));
    await user.clear(screen.getByLabelText('Commute / travel time'));
    await user.type(screen.getByLabelText('Commute / travel time'), '35');
    await user.clear(screen.getByLabelText('Fixed commitments'));
    await user.type(screen.getByLabelText('Fixed commitments'), 'School run');
    await user.selectOptions(screen.getByLabelText('Transition buffer'), '20');
    await user.click(screen.getByRole('button', { name: 'Add block' }));
    await user.clear(screen.getByLabelText('Time block 1 label'));
    await user.type(screen.getByLabelText('Time block 1 label'), 'Loose Saturday time');
    await user.selectOptions(screen.getByLabelText('Time block 1 type'), 'looseTime');
    await user.selectOptions(screen.getByLabelText('Time block 1 scheduler use'), 'askFirst');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Settings saved on this device.'));
    expect(settingsMocks.saveSettings).toHaveBeenCalledTimes(1);
    expect(settingsMocks.saveSettings.mock.calls[0][0]).toMatchObject({
      lifeShape: {
        commuteMinutes: 35,
        fixedCommitments: [{ id: 'setup-fixed-commitments', label: 'School run' }],
        timeBlocks: [
          expect.objectContaining({
            label: 'Loose Saturday time',
            schedulerUse: 'askFirst',
            type: 'looseTime',
          }),
        ],
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
    settingsMocks.loadSettingsResult.mockResolvedValue(makeLoadResult(makeSettings({ theme: 'clear' })));
    settingsMocks.resetSettingsToDefaults.mockResolvedValue(makeSettings());

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('clear'));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Reset settings to defaults' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Settings reset to defaults on this device.'));
    expect(settingsMocks.resetSettingsToDefaults).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('exhale');
  });

  it('exports a settings-only backup from Setup', async () => {
    settingsMocks.loadSettingsResult.mockResolvedValue(makeLoadResult(makeSettings()));
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

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Export settings backup' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Settings backup created on this device.'));
    expect(settingsExportMocks.exportSettingsBackup).toHaveBeenCalledTimes(1);
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();
    expect(settingsMocks.resetSettingsToDefaults).not.toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:settings-backup');
  });

  it('checks a settings backup without saving or resetting settings', async () => {
    settingsMocks.loadSettingsResult.mockResolvedValue(makeLoadResult(makeSettings()));
    const backupJson = JSON.stringify(buildSettingsBackupPayload(makeSettings({ theme: 'clear' }), '2026-06-16T00:00:00.000Z'));

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByLabelText('Settings backup text'), {
      target: {
        value: backupJson,
      },
    });
    await user.click(screen.getByRole('button', { name: 'Check settings backup' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Settings backup looks valid. Restore is not connected yet.'));
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();
    expect(settingsMocks.resetSettingsToDefaults).not.toHaveBeenCalled();
    expect(settingsExportMocks.exportSettingsBackup).not.toHaveBeenCalled();
  });

  it('exports a soft placement backup from Setup without saving settings', async () => {
    settingsMocks.loadSettingsResult.mockResolvedValue(makeLoadResult(makeSettings()));
    softPlacementBackupMocks.exportSoftPlacementBackup.mockResolvedValue({
      fileName: 'life-rhythm-soft-placements-backup-2026-06-18.json',
      json: '{}',
      payload: buildSoftPlacementBackupPayload([
        {
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
        },
      ], '2026-06-18T01:00:00.000Z'),
      placementCount: 1,
    });
    const createObjectUrl = vi.fn(() => 'blob:soft-placement-backup');
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

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Export soft placement backup' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Soft placement backup created on this device.'));
    expect(softPlacementBackupMocks.exportSoftPlacementBackup).toHaveBeenCalledTimes(1);
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();
    expect(settingsMocks.resetSettingsToDefaults).not.toHaveBeenCalled();
    expect(settingsExportMocks.exportSettingsBackup).not.toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:soft-placement-backup');
  });

  it('shows an explicit loading state without mounting the normal app or writing settings', async () => {
    let resolveLoad: ((result: SettingsLoadResult) => void) | undefined;
    settingsMocks.loadSettingsResult.mockReturnValue(new Promise((resolve) => {
      resolveLoad = resolve;
    }));

    render(<App />);

    expect(screen.getByRole('status').textContent).toContain('Loading your saved Life Rhythm settings');
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();
    expect(settingsMocks.resetSettingsToDefaults).not.toHaveBeenCalled();

    await act(async () => {
      resolveLoad?.(makeLoadResult(makeSettings()));
    });

    expect(await screen.findByRole('button', { name: 'Today' })).toBeTruthy();
  });

  it('blocks the normal app when profile-aware saved settings are malformed', async () => {
    settingsMocks.loadSettingsResult.mockResolvedValue(
      makeLoadResult(
        makeSettings(),
        'invalid',
        ['weekdayProfileAssignments.0.profileId: Expected an existing day profile'],
      ),
    );

    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Saved settings could not be loaded.');
    expect(alert.textContent).toContain('Nothing stored on this device was changed.');
    expect(alert.textContent).toContain('Life Rhythm has not replaced the saved settings with defaults.');
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();
    expect(settingsMocks.resetSettingsToDefaults).not.toHaveBeenCalled();
    expect(settingsExportMocks.exportSettingsBackup).not.toHaveBeenCalled();
  });

  it('blocks the normal app when saved settings cannot be read', async () => {
    settingsMocks.loadSettingsResult.mockResolvedValue(
      makeLoadResult(makeSettings(), 'readFailed', ['settings: Saved settings could not be read.']),
    );

    render(<App />);

    expect((await screen.findByRole('alert')).textContent).toContain('Saved settings could not be loaded.');
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();
    expect(settingsMocks.resetSettingsToDefaults).not.toHaveBeenCalled();
    expect(settingsExportMocks.exportSettingsBackup).not.toHaveBeenCalled();
  });

  it('uses a validated in-memory migration candidate and reports that persistence failed', async () => {
    settingsMocks.loadSettingsResult.mockResolvedValue(
      makeLoadResult(
        makeSettings({ theme: 'clear' }),
        'migrationPersistenceFailed',
        ['settings: Day-profile migration could not be saved; the original row was left unchanged.'],
      ),
    );

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Today' })).toBeTruthy();
    expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('clear');
    expect(screen.getByRole('status').textContent).toContain(
      'Your settings were loaded for this session, but the updated settings foundation could not be saved.',
    );
    expect(screen.getByRole('status').textContent).toContain('Nothing already stored on this device was changed.');
    expect(screen.getByRole('status').textContent).toContain('The migration will need to be retried.');
    expect(settingsMocks.loadSettingsResult).toHaveBeenCalledTimes(1);
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();
    expect(settingsMocks.resetSettingsToDefaults).not.toHaveBeenCalled();
  });
});
