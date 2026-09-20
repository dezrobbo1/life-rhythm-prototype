// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSettings } from '../data/settingsRepository';

const settingsRepositoryMocks = vi.hoisted(() => ({
  loadSettingsResult: vi.fn(),
}));

vi.mock('../data/settingsRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/settingsRepository')>();

  return {
    ...actual,
    loadSettingsResult: settingsRepositoryMocks.loadSettingsResult,
  };
});

vi.mock('../screens/PlanDayLineScreen', async () => {
  const { useState } = await import('react');

  return {
    PlanDayLineScreen: ({
      calendarRepairIssue = null,
      onCalendarRepairIssueChange,
      onPlanRepaired,
      planRevision = 0,
    }: {
      calendarRepairIssue?: string | null;
      onCalendarRepairIssueChange?: (message: string | null) => void;
      onPlanRepaired?: () => void;
      planRevision?: number;
    }) => {
      const [status, setStatus] = useState('');

      return (
        <section>
          <h1>Plan</h1>
          <p data-testid="plan-revision">Revision {planRevision}</p>
          {calendarRepairIssue ? <p role="alert">{calendarRepairIssue}</p> : null}
          <button
            onClick={() => onCalendarRepairIssueChange?.('Calendar change was saved, but the flexible private plan could not be repaired.')}
            type="button"
          >
            Report repair failure
          </button>
          <details>
            <summary>Plan details</summary>
            <button
              onClick={() => {
                onPlanRepaired?.();
                setStatus('Calendar saved on this device. The flexible private plan was repaired.');
              }}
              type="button"
            >
              Replace calendar
            </button>
            {status ? <p role="status">{status}</p> : null}
          </details>
        </section>
      );
    },
  };
});

import App from '../App';

beforeEach(() => {
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
  vi.clearAllMocks();
});

describe('Plan refresh presentation state', () => {
  it('keeps Plan details open and calendar success feedback visible after plan repair', async () => {
    const user = userEvent.setup();
    render(<App />);

    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    await user.click(within(nav).getByRole('button', { name: 'Plan' }));

    const disclosure = screen.getByText('Plan details').closest('details');
    expect(disclosure?.open).toBe(false);
    await user.click(screen.getByText('Plan details'));
    expect(disclosure?.open).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Replace calendar' }));

    expect((await screen.findByRole('status')).textContent).toContain('Calendar saved on this device.');
    expect(screen.getByTestId('plan-revision').textContent).toContain('Revision 1');
    expect(screen.getByText('Plan details').closest('details')?.open).toBe(true);
  });
  it('retains calendar repair attention across route changes and clears it after a successful plan repair', async () => {
    const user = userEvent.setup();
    render(<App />);

    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    await user.click(within(nav).getByRole('button', { name: 'Plan' }));
    await user.click(screen.getByRole('button', { name: 'Report repair failure' }));

    expect(screen.getByRole('alert').textContent).toContain('Calendar change was saved');

    await user.click(within(nav).getByRole('button', { name: 'Held' }));
    await user.click(within(nav).getByRole('button', { name: 'Plan' }));
    expect(screen.getByRole('alert').textContent).toContain('Calendar change was saved');

    await user.click(screen.getByText('Plan details'));
    await user.click(screen.getByRole('button', { name: 'Replace calendar' }));

    await screen.findByRole('status');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
