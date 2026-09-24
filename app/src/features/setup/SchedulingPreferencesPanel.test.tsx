// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const preferenceMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));
const mutationMocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  remove: vi.fn(),
  expectation: vi.fn(),
}));
const controlMocks = vi.hoisted(() => ({
  catalogue: vi.fn(),
  reset: vi.fn(),
}));
const backupMocks = vi.hoisted(() => ({
  backup: vi.fn(),
}));
const planMocks = vi.hoisted(() => ({
  ensure: vi.fn(),
}));

vi.mock('../../data/explicitPreferenceRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/explicitPreferenceRepository')>();
  return { ...actual, loadExplicitPreferencesResult: preferenceMocks.load };
});
vi.mock('../../data/explicitPreferenceMutationCoordinator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/explicitPreferenceMutationCoordinator')>();
  return {
    ...actual,
    commitExplicitPreferenceUpsert: mutationMocks.upsert,
    commitExplicitPreferenceDelete: mutationMocks.remove,
    explicitPreferenceTargetExpectation: mutationMocks.expectation,
  };
});
vi.mock('../../data/explicitPreferenceControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/explicitPreferenceControls')>();
  return {
    ...actual,
    loadPreferenceTargetCatalogue: controlMocks.catalogue,
    commitExplicitPreferenceReset: controlMocks.reset,
  };
});
vi.mock('../../data/explicitPreferenceBackup', () => ({
  buildExplicitPreferenceBackup: backupMocks.backup,
}));
vi.mock('../../data/schedulerPlanCoordinator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/schedulerPlanCoordinator')>();
  return { ...actual, ensureCurrentPrivatePlan: planMocks.ensure };
});

import { SchedulingPreferencesPanel } from './SchedulingPreferencesPanel';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function healthyCatalogue() {
  return {
    status: 'ok' as const,
    options: [
      { kind: 'area' as const, value: 'admin', label: 'Admin' },
      { kind: 'area' as const, value: 'work', label: 'Work' },
    ],
    warnings: [],
  };
}

describe('Gate 7D2 SchedulingPreferencesPanel', () => {
  it('shows persisted preferences using human labels without exposing their IDs', async () => {
    preferenceMocks.load.mockResolvedValue({
      status: 'ok',
      record: {
        id: 'preferences:explicit:v1',
        recordType: 'explicitPreferenceStore',
        formatVersion: 1,
        appVersion: '1.4.6',
        createdAt: '2026-09-24T09:00:00.000Z',
        updatedAt: '2026-09-24T09:00:00.000Z',
        preferences: [],
      },
      preferences: [{
        id: 'preference:internal-secret',
        targetKind: 'area',
        targetValue: 'admin',
        relation: 'prefer',
        days: ['Monday'],
        start: '11:00',
        end: '12:00',
        source: 'explicitPersistent',
        provenance: { actor: 'user', mechanism: 'explicitPreference' },
        createdAt: '2026-09-24T09:00:00.000Z',
        updatedAt: '2026-09-24T09:00:00.000Z',
      }],
    });
    controlMocks.catalogue.mockResolvedValue(healthyCatalogue());

    render(<SchedulingPreferencesPanel />);

    expect(await screen.findByText(/Prefer area “Admin” · Monday · 11:00–12:00/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('preference:internal-secret');
  });

  it('creates a preference through the Gate 7D1 mutation coordinator and reconciles the plan', async () => {
    preferenceMocks.load.mockResolvedValue({ status: 'missing', preferences: [] });
    controlMocks.catalogue.mockResolvedValue(healthyCatalogue());
    mutationMocks.expectation.mockImplementation((_result, id) => ({
      preferenceId: id,
      preference: null,
    }));
    mutationMocks.upsert.mockResolvedValue({
      ok: true,
      preference: {},
      preferences: [],
      repairAttentionPersisted: false,
    });
    planMocks.ensure.mockResolvedValue({
      ok: true,
      mode: 'built',
      plan: {
        placements: [],
        rejectedExistingPlacements: [],
        unscheduledIntentionIds: [],
        unscheduledRhythmIds: [],
      },
      titleByTargetId: {},
      updatedAt: '2026-09-24T09:00:00.000Z',
      warnings: [],
    });
    const onPlanChanged = vi.fn();
    const user = userEvent.setup();

    render(<SchedulingPreferencesPanel onPlanChanged={onPlanChanged} />);

    await user.click(await screen.findByRole('button', { name: 'Add scheduling preference' }));
    await user.selectOptions(screen.getByLabelText('Preference target'), 'admin');
    await user.type(screen.getByLabelText('Preference start time'), '11:00');
    await user.type(screen.getByLabelText('Preference end time'), '12:00');
    await user.click(screen.getByRole('button', { name: 'Add preference' }));

    await waitFor(() => expect(mutationMocks.upsert).toHaveBeenCalledTimes(1));
    expect(mutationMocks.upsert.mock.calls[0][0]).toMatchObject({
      targetKind: 'area',
      targetValue: 'admin',
      relation: 'prefer',
      days: [],
      start: '11:00',
      end: '12:00',
    });
    expect(planMocks.ensure).toHaveBeenCalledTimes(1);
    expect(onPlanChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain(
      'Scheduling preference saved and the flexible plan is up to date.',
    );
  });

  it('keeps export visible but disables destructive clear while preference bytes are unreadable', async () => {
    preferenceMocks.load.mockResolvedValue({
      status: 'readFailed',
      errors: ['explicitPreferences: Preferences could not be read.'],
    });
    controlMocks.catalogue.mockResolvedValue(healthyCatalogue());
    backupMocks.backup.mockResolvedValue({
      ok: false,
      errors: ['explicitPreferences: Preferences could not be exported.'],
    });
    const user = userEvent.setup();

    render(<SchedulingPreferencesPanel />);

    const alert = await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Export scheduling preferences' })).toBeTruthy();
    const clearInput = screen.getByLabelText(/clear scheduling preferences/i);
    await user.type(clearInput, 'DELETE EXPLICIT PREFERENCES');
    expect((screen.getByRole('button', { name: 'Clear scheduling preferences' }) as HTMLButtonElement).disabled).toBe(true);
    expect(alert.textContent).toContain('destructive recovery is disabled');
    expect(controlMocks.reset).not.toHaveBeenCalled();
  });
  it('keeps recovery controls available when the preference record is malformed', async () => {
    preferenceMocks.load.mockResolvedValue({
      status: 'invalid',
      errors: ['explicitPreferences: Saved preferences are invalid.'],
    });
    controlMocks.catalogue.mockResolvedValue(healthyCatalogue());
    backupMocks.backup.mockResolvedValue({
      ok: true,
      fileName: 'preferences.json',
      json: '{}',
    });

    render(<SchedulingPreferencesPanel />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add scheduling preference' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Export scheduling preferences' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Clear scheduling preferences' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
