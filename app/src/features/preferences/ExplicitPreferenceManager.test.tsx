// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE_EXPLICIT_PREFERENCES_CONFIRMATION,
  type ExplicitPreferenceLoadResult,
} from '../../data/explicitPreferenceRepository';
import type { ExplicitPreference } from '../../data/explicitPreferenceSchema';
import {
  emptyExplicitPreferenceTargetCatalog,
  type ExplicitPreferenceTargetCatalogResult,
} from '../../data/explicitPreferenceTargetCatalog';
import { ExplicitPreferenceManager } from './ExplicitPreferenceManager';

const timestamp = '2026-09-24T10:00:00.000Z';

const emptyPlan = {
  placements: [],
  rejectedExistingPlacements: [],
  unscheduledIntentionIds: [],
  unscheduledRhythmIds: [],
};

function preference(overrides: Partial<ExplicitPreference> = {}): ExplicitPreference {
  return {
    id: 'preference-admin',
    targetKind: 'area',
    targetValue: 'admin',
    relation: 'prefer',
    days: ['Monday'],
    start: '11:00',
    end: '12:00',
    source: 'explicitPersistent',
    provenance: { actor: 'user', mechanism: 'explicitPreference' },
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function loaded(preferences: ExplicitPreference[]): ExplicitPreferenceLoadResult {
  return {
    status: 'ok',
    preferences,
    record: {
      id: 'preferences:explicit:v1',
      recordType: 'explicitPreferenceStore',
      formatVersion: 1,
      appVersion: '1.4.6',
      createdAt: timestamp,
      updatedAt: timestamp,
      preferences,
    },
  };
}

function catalog(): ExplicitPreferenceTargetCatalogResult {
  return {
    status: 'ok',
    invalidRecordCount: 0,
    ...emptyExplicitPreferenceTargetCatalog(),
    tasks: [{
      kind: 'intention',
      value: 'task-internal-123',
      label: 'Send school form',
    }],
    rhythms: [{
      kind: 'rhythm',
      value: 'rhythm-internal-456',
      label: 'Evening reset',
    }],
  };
}

function successfulPlan() {
  return {
    ok: true as const,
    mode: 'repaired' as const,
    plan: emptyPlan,
    titleByTargetId: {},
    updatedAt: timestamp,
    warnings: [],
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Gate 7D2 explicit preference manager', () => {
  it('creates a preference through the coordinated mutation path and reconciles the plan', async () => {
    const user = userEvent.setup();
    const readPreferences = vi.fn<() => Promise<ExplicitPreferenceLoadResult>>()
      .mockResolvedValue({ status: 'missing', preferences: [] });
    const readTargets = vi.fn().mockResolvedValue(catalog());
    const savedPreference = preference({ id: 'saved-new', days: [] });
    const savePreference = vi.fn().mockResolvedValue({
      ok: true,
      preference: savedPreference,
      preferences: [savedPreference],
      repairAttentionPersisted: true,
    });
    const ensurePlan = vi.fn().mockResolvedValue(successfulPlan());
    const onPlanChanged = vi.fn();

    render(
      <ExplicitPreferenceManager
        ensurePlan={ensurePlan}
        onPlanChanged={onPlanChanged}
        readPreferences={readPreferences}
        readTargets={readTargets}
        savePreference={savePreference}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Manage scheduling preferences' }));
    await screen.findByRole('button', { name: 'Add preference' });
    await user.click(screen.getByRole('button', { name: 'Add preference' }));
    expect((screen.getByLabelText('Preference target') as HTMLSelectElement).value).toBe('admin');

    await user.click(screen.getByRole('button', { name: 'Save preference' }));

    await waitFor(() => expect(savePreference).toHaveBeenCalledTimes(1));
    expect(savePreference.mock.calls[0][0]).toMatchObject({
      relation: 'prefer',
      targetKind: 'area',
      targetValue: 'admin',
      days: [],
    });
    expect(savePreference.mock.calls[0][1]).toMatchObject({ preference: null });
    expect(ensurePlan).toHaveBeenCalledTimes(1);
    expect(onPlanChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Preference saved\. Flexible plan updated\./)).toBeTruthy();
  });

  it('shows task titles instead of raw task IDs and keeps expired preferences inspectable', async () => {
    const user = userEvent.setup();
    const taskPreference = preference({
      id: 'task-pref',
      targetKind: 'intention',
      targetValue: 'task-internal-123',
      expiresAt: '2026-09-24T11:00:00.000Z',
    });

    render(
      <ExplicitPreferenceManager
        readPreferences={vi.fn().mockResolvedValue(loaded([taskPreference]))}
        readTargets={vi.fn().mockResolvedValue(catalog())}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Manage scheduling preferences' }));
    expect(await screen.findByText(/Prefer Send school form/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('task-internal-123');
    expect(screen.getByText(/Expired|Expires/)).toBeTruthy();
  });

  it('fails visibly on a stale save without attempting plan reconciliation', async () => {
    const user = userEvent.setup();
    const current = preference();
    const savePreference = vi.fn().mockResolvedValue({
      ok: false,
      conflict: 'stale',
      errors: ['explicitPreferences: This preference changed after the edit began. Reload the saved preference and try again.'],
    });
    const ensurePlan = vi.fn();

    render(
      <ExplicitPreferenceManager
        ensurePlan={ensurePlan}
        readPreferences={vi.fn().mockResolvedValue(loaded([current]))}
        readTargets={vi.fn().mockResolvedValue(catalog())}
        savePreference={savePreference}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Manage scheduling preferences' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.selectOptions(screen.getByLabelText('Preference direction'), 'avoid');
    await user.click(screen.getByRole('button', { name: 'Save preference' }));

    expect(await screen.findByText(/changed after the edit began/i)).toBeTruthy();
    expect(ensurePlan).not.toHaveBeenCalled();
  });

  it('offers raw export and confirmed recovery clear when the preference store is invalid', async () => {
    const user = userEvent.setup();
    const readPreferences = vi.fn<() => Promise<ExplicitPreferenceLoadResult>>()
      .mockResolvedValue({
        status: 'invalid',
        errors: ['explicitPreferences: Saved preferences are invalid and were left untouched.'],
      });
    const clearPreferences = vi.fn().mockResolvedValue({
      ok: true,
      removed: true,
      preferences: [],
      repairAttentionPersisted: true,
    });
    const ensurePlan = vi.fn().mockResolvedValue(successfulPlan());
    const exportPreferences = vi.fn().mockResolvedValue({
      status: 'ok',
      fileName: 'life-rhythm-scheduling-preferences-2026-09-24.json',
      json: '{"rawRecord":{"broken":true}}',
      payload: {
        kind: 'life-rhythm-explicit-preferences-backup',
        version: 1,
        exportedAt: timestamp,
        rawRecord: { broken: true },
      },
    });
    const createObjectURL = vi.fn(() => 'blob:preferences');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(
      <ExplicitPreferenceManager
        clearPreferences={clearPreferences}
        ensurePlan={ensurePlan}
        exportPreferences={exportPreferences}
        readPreferences={readPreferences}
        readTargets={vi.fn().mockResolvedValue(catalog())}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Manage scheduling preferences' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Saved scheduling preferences need attention.');

    await user.click(screen.getByRole('button', { name: 'Export scheduling preferences' }));
    expect(exportPreferences).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preferences');

    const confirmation = screen.getByLabelText(
      `Type ${DELETE_EXPLICIT_PREFERENCES_CONFIRMATION} to clear scheduling preferences`,
    );
    await user.type(confirmation, DELETE_EXPLICIT_PREFERENCES_CONFIRMATION);
    await user.click(screen.getByRole('button', { name: 'Clear scheduling preferences' }));

    expect(clearPreferences).toHaveBeenCalledWith(DELETE_EXPLICIT_PREFERENCES_CONFIRMATION);
    expect(ensurePlan).toHaveBeenCalledTimes(1);
  });
});
