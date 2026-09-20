// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../data/localDataNamespace';
import {
  repairAndPersistSchedulerPlan,
  saveSchedulerPlanState,
} from '../data/schedulerPlanStateRepository';
import { createDefaultSettings, saveSettings } from '../data/settingsRepository';

const coordinatorMocks = vi.hoisted(() => ({
  repairCurrentPrivatePlan: vi.fn(),
}));

vi.mock('../data/schedulerPlanCoordinator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/schedulerPlanCoordinator')>();

  return {
    ...actual,
    repairCurrentPrivatePlan: coordinatorMocks.repairCurrentPrivatePlan,
  };
});

import App from '../App';

let namespaceIndex = 0;

const calendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:gate6f-meeting',
  'DTSTART:20260920T100000Z',
  'DTEND:20260920T110000Z',
  'SUMMARY:Gate 6F meeting',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

beforeEach(async () => {
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate6f-calendar-attention-${namespaceIndex}`));

  const defaults = createDefaultSettings('2026-09-20T08:00:00.000Z');
  const settings = await saveSettings({
    lifeShape: defaults.lifeShape,
    startBoostSafety: defaults.startBoostSafety,
    theme: defaults.theme,
  });
  expect(settings.ok).toBe(true);

  const saved = await saveSchedulerPlanState({
    placements: [],
    rejectedExistingPlacements: [],
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
  }, getCurrentLifeRhythmDatabase(), '2026-09-20T08:00:00.000Z');
  expect(saved.ok).toBe(true);

  coordinatorMocks.repairCurrentPrivatePlan.mockResolvedValue({
    errors: ['scheduler: synthetic repair failure'],
    ok: false,
    warnings: [],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('persisted calendar repair attention', () => {
  it('survives an application reload until a successful private-plan repair is saved', async () => {
    const firstUser = userEvent.setup();
    const firstRender = render(<App />);
    const firstNav = await screen.findByRole('navigation', { name: 'Primary' });
    await firstUser.click(within(firstNav).getByRole('button', { name: 'Plan' }));
    await firstUser.click(screen.getByText('Plan details'));

    const file = new File([calendar], 'gate6f.ics', { type: 'text/calendar' });
    Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue(calendar) });
    await firstUser.upload(screen.getByLabelText('Select read-only calendar file'), file);

    expect((await screen.findByRole('alert')).textContent).toContain('Calendar change needs attention.');
    firstRender.unmount();

    render(<App />);
    const secondNav = await screen.findByRole('navigation', { name: 'Primary' });
    await userEvent.setup().click(within(secondNav).getByRole('button', { name: 'Plan' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Calendar change needs attention.');
    });

    const recovered = await repairAndPersistSchedulerPlan({
      nextInput: {
        candidateIntervals: [],
        capacityWindows: [],
        dayProfiles: [],
        externalCommitments: [],
        intentions: [],
        placements: [],
        preferences: [],
        rhythms: [],
      },
      now: { date: '2026-09-20', time: '12:00', timezone: 'UTC' },
      reason: 'A later current-context repair succeeded.',
      trigger: 'userCorrection',
    }, getCurrentLifeRhythmDatabase(), '2026-09-20T12:00:00.000Z');
    expect(recovered.ok).toBe(true);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
