// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calendarMocks = vi.hoisted(() => ({
  loadCalendarSource: vi.fn(),
  commitCalendarSourceImport: vi.fn(),
  commitCalendarSourceRemoval: vi.fn(),
}));

const coordinatorMocks = vi.hoisted(() => ({
  repairCurrentPrivatePlan: vi.fn(),
}));

vi.mock('../../data/calendarSourceRepository', () => ({
  loadCalendarSource: calendarMocks.loadCalendarSource,
}));
vi.mock('../../data/calendarSourceMutationCoordinator', () => ({
  commitCalendarSourceImport: calendarMocks.commitCalendarSourceImport,
  commitCalendarSourceRemoval: calendarMocks.commitCalendarSourceRemoval,
}));
vi.mock('../../data/schedulerPlanCoordinator', () => coordinatorMocks);

import { CalendarSourceControl } from './CalendarSourceControl';

beforeEach(() => {
  calendarMocks.loadCalendarSource.mockResolvedValue({
    errors: ['calendarSources: Saved source is invalid.'],
    status: 'invalid',
  });
  calendarMocks.commitCalendarSourceImport.mockResolvedValue({
    busyEventCount: 1,
    ok: true,
    repairAttentionPersisted: false,
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
  calendarMocks.commitCalendarSourceRemoval.mockResolvedValue({
    ok: true,
    removed: true,
    repairAttentionPersisted: false,
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
  it('does not claim or repair a calendar change when its atomic commit fails', async () => {
    const user = userEvent.setup();
    const onRepairIssueChange = vi.fn();
    calendarMocks.commitCalendarSourceImport.mockResolvedValue({
      errors: [
        'calendarSource: Calendar change was not saved because repair attention could not be stored safely.',
      ],
      ok: false,
      warnings: [],
    });
    render(<CalendarSourceControl onRepairIssueChange={onRepairIssueChange} />);

    const file = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'replacement.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
    });
    await user.upload(screen.getByLabelText('Select read-only calendar file'), file);

    await screen.findByText(
      'calendarSource: Calendar change was not saved because repair attention could not be stored safely.',
    );
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
    expect(onRepairIssueChange).not.toHaveBeenCalled();
    expect(screen.queryByText('replacement.ics')).toBeNull();
  });

  it('keeps the displayed prior source when an atomic replacement fails', async () => {
    const user = userEvent.setup();
    calendarMocks.loadCalendarSource.mockResolvedValue({
      record: {
        id: 'primary',
        version: 1,
        adapterId: 'ics',
        importedAt: '2026-09-20T07:00:00.000Z',
        label: 'saved.ics',
        source: 'BEGIN:VCALENDAR\nEND:VCALENDAR',
        updatedAt: '2026-09-20T07:00:00.000Z',
      },
      status: 'ok',
    });
    calendarMocks.commitCalendarSourceImport.mockResolvedValue({
      errors: [
        'calendarSource: Calendar change was not saved because repair attention could not be stored safely.',
      ],
      ok: false,
      warnings: [],
    });
    render(<CalendarSourceControl />);

    const file = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'replacement.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
    });
    await user.upload(await screen.findByLabelText('Select read-only calendar file'), file);

    await screen.findByText(
      'calendarSource: Calendar change was not saved because repair attention could not be stored safely.',
    );
    expect(screen.getByText('saved.ics')).toBeTruthy();
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
  });

  it('keeps the displayed source when an atomic removal fails', async () => {
    const user = userEvent.setup();
    calendarMocks.loadCalendarSource.mockResolvedValue({
      record: {
        id: 'primary',
        version: 1,
        adapterId: 'ics',
        importedAt: '2026-09-20T07:00:00.000Z',
        label: 'saved.ics',
        source: 'BEGIN:VCALENDAR\nEND:VCALENDAR',
        updatedAt: '2026-09-20T07:00:00.000Z',
      },
      status: 'ok',
    });
    calendarMocks.commitCalendarSourceRemoval.mockResolvedValue({
      errors: [
        'calendarSource: Calendar removal was not saved because repair attention could not be stored safely.',
      ],
      ok: false,
    });
    render(<CalendarSourceControl />);

    await user.click(await screen.findByRole('button', { name: 'Remove calendar' }));

    await screen.findByText(
      'calendarSource: Calendar removal was not saved because repair attention could not be stored safely.',
    );
    expect(screen.getByText('saved.ics')).toBeTruthy();
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
    expect(coordinatorMocks.repairCurrentPrivatePlan).toHaveBeenCalledTimes(1);
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
