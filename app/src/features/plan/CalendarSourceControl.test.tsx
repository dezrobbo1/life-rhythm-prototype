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

const planStateMocks = vi.hoisted(() => ({
  markCalendarRepairPending: vi.fn(),
}));

vi.mock('../../data/calendarSourceRepository', () => calendarMocks);
vi.mock('../../data/schedulerPlanCoordinator', () => coordinatorMocks);
vi.mock('../../data/schedulerPlanStateRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/schedulerPlanStateRepository')>();

  return {
    ...actual,
    markCalendarRepairPending: planStateMocks.markCalendarRepairPending,
  };
});

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
  calendarMocks.removeCalendarSource.mockResolvedValue({ ok: true });
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
  planStateMocks.markCalendarRepairPending.mockResolvedValue({ ok: true, persisted: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CalendarSourceControl Plan health reporting', () => {
  it('stops before repair when durable calendar-repair attention cannot be saved', async () => {
    const user = userEvent.setup();
    const onRepairIssueChange = vi.fn();
    planStateMocks.markCalendarRepairPending.mockResolvedValue({
      errors: ['schedulerPlanState: Calendar repair attention could not be saved.'],
      ok: false,
    });
    render(<CalendarSourceControl onRepairIssueChange={onRepairIssueChange} />);

    const file = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'replacement.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
    });
    await user.upload(screen.getByLabelText('Select read-only calendar file'), file);

    const expected = 'Calendar change was saved, but the flexible private plan could not be repaired.';
    await waitFor(() => expect(onRepairIssueChange).toHaveBeenCalledWith(expected));
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

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
  it('reports a saved-calendar repair failure outside the calendar detail after import', async () => {
    const user = userEvent.setup();
    const onReadIssueChange = vi.fn();
    const onRepairIssueChange = vi.fn();
    coordinatorMocks.repairCurrentPrivatePlan.mockResolvedValue({
      errors: ['scheduler: synthetic repair failure'],
      ok: false,
      warnings: [],
    });
    render(
      <CalendarSourceControl
        onReadIssueChange={onReadIssueChange}
        onRepairIssueChange={onRepairIssueChange}
      />,
    );

    await waitFor(() => {
      expect(onReadIssueChange).toHaveBeenCalledWith(
        'Saved calendar data could not be read safely. The flexible plan will not use it.',
      );
    });

    const file = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'replacement.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
    });
    await user.upload(screen.getByLabelText('Select read-only calendar file'), file);

    const expected = 'Calendar change was saved, but the flexible private plan could not be repaired.';
    await waitFor(() => {
      expect(onReadIssueChange).toHaveBeenCalledWith(null);
      expect(onRepairIssueChange).toHaveBeenCalledWith(expected);
    });
    expect(screen.queryByText('Calendar file could not be read. Nothing was replaced.')).toBeNull();
  });

  it('keeps a thrown post-import repair failure truthful instead of claiming the calendar was not replaced', async () => {
    const user = userEvent.setup();
    const onRepairIssueChange = vi.fn();
    coordinatorMocks.repairCurrentPrivatePlan.mockRejectedValue(new Error('synthetic repair rejection'));
    render(<CalendarSourceControl onRepairIssueChange={onRepairIssueChange} />);

    const file = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'replacement.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
    });
    await user.upload(screen.getByLabelText('Select read-only calendar file'), file);

    const expected = 'Calendar change was saved, but the flexible private plan could not be repaired.';
    await waitFor(() => expect(onRepairIssueChange).toHaveBeenCalledWith(expected));
    expect(screen.queryByText('Calendar file could not be read. Nothing was replaced.')).toBeNull();
  });

  it('reports a repair failure after removing a saved calendar', async () => {
    const user = userEvent.setup();
    const onRepairIssueChange = vi.fn();
    calendarMocks.loadCalendarSource.mockResolvedValue({
      record: {
        events: [],
        id: 'primary',
        importedAt: '2026-09-20T08:00:00.000Z',
        label: 'saved.ics',
        source: 'BEGIN:VCALENDAR\nEND:VCALENDAR',
        updatedAt: '2026-09-20T08:00:00.000Z',
      },
      status: 'ok',
      warnings: [],
    });
    coordinatorMocks.repairCurrentPrivatePlan.mockResolvedValue({
      errors: ['scheduler: synthetic repair failure'],
      ok: false,
      warnings: [],
    });
    render(<CalendarSourceControl onRepairIssueChange={onRepairIssueChange} />);

    await user.click(await screen.findByRole('button', { name: 'Remove calendar' }));

    const expected = 'Calendar change was saved, but the flexible private plan could not be repaired.';
    await waitFor(() => expect(onRepairIssueChange).toHaveBeenCalledWith(expected));
  });

  it('clears the repair issue after a later successful calendar repair', async () => {
    const user = userEvent.setup();
    const onRepairIssueChange = vi.fn();
    coordinatorMocks.repairCurrentPrivatePlan
      .mockResolvedValueOnce({
        errors: ['scheduler: synthetic repair failure'],
        ok: false,
        warnings: [],
      })
      .mockResolvedValueOnce({
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
    render(<CalendarSourceControl onRepairIssueChange={onRepairIssueChange} />);

    const first = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'replacement.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(first, 'text', {
      value: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
    });
    await user.upload(screen.getByLabelText('Select read-only calendar file'), first);

    const expected = 'Calendar change was saved, but the flexible private plan could not be repaired.';
    await waitFor(() => expect(onRepairIssueChange).toHaveBeenCalledWith(expected));

    onRepairIssueChange.mockClear();
    const second = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'replacement-2.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(second, 'text', {
      value: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
    });
    await user.upload(screen.getByLabelText('Replace calendar file'), second);

    await waitFor(() => expect(onRepairIssueChange).toHaveBeenCalledWith(null));
    expect(await screen.findByText(/Calendar saved on this device/)).toBeTruthy();
  });
});
