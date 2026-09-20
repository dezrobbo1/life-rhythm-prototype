// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calendarMocks = vi.hoisted(() => ({
  importIcsCalendarSource: vi.fn(),
  loadCalendarSource: vi.fn(),
  removeCalendarSource: vi.fn(),
}));

const coordinatorMocks = vi.hoisted(() => ({
  repairCurrentPrivatePlan: vi.fn(),
}));

vi.mock('../../data/calendarSourceRepository', () => calendarMocks);
vi.mock('../../data/schedulerPlanCoordinator', () => coordinatorMocks);

import { CalendarSourceControl } from './CalendarSourceControl';

beforeEach(() => {
  calendarMocks.loadCalendarSource.mockResolvedValue({
    errors: ['calendarSources: Saved source is invalid.'],
    status: 'invalid',
  });
  calendarMocks.importIcsCalendarSource.mockResolvedValue({
    busyEventCount: 1,
    ok: true,
    record: {
      events: [],
      id: 'primary',
      importedAt: '2026-09-20T08:00:00.000Z',
      label: 'replacement.ics',
      source: 'BEGIN:VCALENDAR\nEND:VCALENDAR',
      updatedAt: '2026-09-20T08:00:00.000Z',
    },
    warnings: [],
  });
  coordinatorMocks.repairCurrentPrivatePlan.mockResolvedValue({
    ok: true,
    plan: {
      placements: [],
      rejectedExistingPlacements: [],
      unscheduledIntentionIds: [],
      unscheduledRhythmIds: [],
    },
    titleByTargetId: {},
    warnings: [],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CalendarSourceControl Plan health reporting', () => {
  it('clears a saved-source read warning after a valid replacement is imported', async () => {
    const user = userEvent.setup();
    const onReadIssueChange = vi.fn();
    render(<CalendarSourceControl onReadIssueChange={onReadIssueChange} />);

    await waitFor(() => {
      expect(onReadIssueChange).toHaveBeenCalledWith(
        'Saved calendar data could not be read safely. The flexible plan will not use it.',
      );
    });

    onReadIssueChange.mockClear();
    const file = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'replacement.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
    });

    await user.upload(screen.getByLabelText('Select read-only calendar file'), file);

    await waitFor(() => {
      expect(onReadIssueChange).toHaveBeenCalledWith(null);
    });
    expect(await screen.findByText(/Calendar saved on this device/)).toBeTruthy();
  });
});
