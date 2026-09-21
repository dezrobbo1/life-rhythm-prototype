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
  commitCalendarSourceImport,
} from '../data/calendarSourceMutationCoordinator';
import {
  importIcsCalendarSource,
  loadCalendarSource,
} from '../data/calendarSourceRepository';
import { buildCurrentLiveSchedulingContext } from '../data/schedulerPlanCoordinator';
import {
  loadSchedulerPlanState,
  repairAndPersistSchedulerPlan,
  saveSchedulerPlanState,
} from '../data/schedulerPlanStateRepository';
import { activeTaskSchema } from '../data/schemas';
import { createDefaultSettings, saveSettings } from '../data/settingsRepository';
import { scheduler } from '../domain/primaryScheduler';

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

const priorCalendar = calendar
  .replace('gate6f-meeting', 'prior-meeting')
  .replace('Gate 6F meeting', 'Prior meeting');

beforeEach(async () => {
  coordinatorMocks.repairCurrentPrivatePlan.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 20, 9, 0, 0));
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('persisted calendar repair attention', () => {
  it('refreshes mounted Today only when durable calendar-repair attention changes', async () => {
    const database = getCurrentLifeRhythmDatabase();
    const timestamp = new Date().toISOString();
    const defaults = createDefaultSettings(timestamp);
    const settings = await saveSettings({
      lifeShape: {
        ...defaults.lifeShape,
        timeBlocks: [{
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          end: '17:00',
          id: 'test-capacity',
          label: 'Test capacity',
          schedulerUse: 'available',
          start: '09:00',
          type: 'openCapacity',
        }],
      },
      startBoostSafety: defaults.startBoostSafety,
      theme: defaults.theme,
    });
    expect(settings.ok).toBe(true);

    for (const [id, title] of [
      ['current-task', 'Current focus'],
      ['scheduled-task', 'Stale flexible placement'],
    ]) {
      await database.activeTasks.put(activeTaskSchema.parse({
        area: 'admin',
        createdAt: timestamp,
        full: { label: `Finish ${title}`, minutes: 40 },
        id,
        minimum: { label: `Start ${title}`, minutes: 5 },
        normal: { label: title, minutes: 30 },
        showToday: true,
        source: 'adhoc',
        status: 'active',
        title,
        updatedAt: timestamp,
      }));
    }

    const acceptedPlan = await saveSchedulerPlanState({
      placements: [{
        date: '2026-09-20',
        end: '12:30',
        id: 'scheduled-task-placement',
        intentionId: 'scheduled-task',
        origin: 'scheduler',
        provenance: ['Synthetic accepted private plan.'],
        start: '12:00',
        targetKind: 'intention',
        variantKind: 'normal',
      }],
      rejectedExistingPlacements: [],
      unscheduledIntentionIds: [],
      unscheduledRhythmIds: [],
    }, database, timestamp);
    expect(acceptedPlan.ok).toBe(true);

    render(<App />);
    const later = await screen.findByRole('region', { name: 'Later' });
    expect(await within(later).findByText('Stale flexible placement')).toBeTruthy();

    const committed = await commitCalendarSourceImport({
      importedAt: '2026-09-20T09:05:00.000Z',
      label: 'external-tab.ics',
      options: {
        targetTimezone: 'UTC',
        windowEndDate: '2026-09-21',
        windowStartDate: '2026-09-20',
      },
      source: calendar,
    }, database);
    expect(committed.ok).toBe(true);

    const planPut = vi.spyOn(database.schedulerPlanState, 'put');
    const planUpdate = vi.spyOn(database.schedulerPlanState, 'update');
    const buildPlan = vi.spyOn(scheduler, 'buildPlan');
    const repairPlan = vi.spyOn(scheduler, 'repairPlan');

    expect((await within(later).findByRole('alert')).textContent).toContain(
      'The flexible private plan needs repair after a calendar change.',
    );
    expect(within(later).queryByText('Stale flexible placement')).toBeNull();
    expect(within(later).getByText('Gate 6F meeting')).toBeTruthy();
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
    expect(planPut).not.toHaveBeenCalled();
    expect(planUpdate).not.toHaveBeenCalled();
    expect(buildPlan).not.toHaveBeenCalled();
    expect(repairPlan).not.toHaveBeenCalled();

    const live = await buildCurrentLiveSchedulingContext({
      horizonDays: 1,
      planningPolicy: { dayMode: 'normal' },
      readOnly: true,
    });
    if (!live.ok) throw new Error(live.errors.join(' '));
    const savedCalendar = await loadCalendarSource(database);
    if (savedCalendar.status !== 'ok') throw new Error('Expected saved calendar source.');
    const repaired = await repairAndPersistSchedulerPlan({
      nextInput: live.context.input,
      now: live.now,
      reason: 'A current-calendar repair succeeded in another tab.',
      trigger: 'calendarChanged',
    }, database, '2026-09-20T09:10:00.000Z', undefined, {
      source: savedCalendar.record.source,
      updatedAt: savedCalendar.record.updatedAt,
    });
    expect(repaired.ok).toBe(true);
    expect(repaired.ok && repaired.calendarRepairPendingAt).toBeUndefined();
    planPut.mockClear();
    planUpdate.mockClear();
    buildPlan.mockClear();
    repairPlan.mockClear();

    expect(await within(later).findByText('Stale flexible placement')).toBeTruthy();
    expect(within(later).queryByRole('alert')).toBeNull();
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
    expect(planPut).not.toHaveBeenCalled();
    expect(planUpdate).not.toHaveBeenCalled();
    expect(buildPlan).not.toHaveBeenCalled();
    expect(repairPlan).not.toHaveBeenCalled();
  });

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
    expect(await loadCalendarSource()).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(await loadSchedulerPlanState()).toEqual(expect.objectContaining({
      status: 'ok',
      calendarRepairPendingAt: expect.any(String),
    }));
    firstRender.unmount();

    render(<App />);
    const secondNav = await screen.findByRole('navigation', { name: 'Primary' });
    const todayLater = screen.getByRole('region', { name: 'Later' });
    expect((await within(todayLater).findByRole('alert')).textContent).toContain(
      'The flexible private plan needs repair after a calendar change.',
    );
    await userEvent.setup().click(within(secondNav).getByRole('button', { name: 'Plan' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Calendar change needs attention.');
    });

    const savedCalendar = await loadCalendarSource();
    if (savedCalendar.status !== 'ok') throw new Error('Expected saved calendar source.');
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
    }, getCurrentLifeRhythmDatabase(), '2026-09-20T12:00:00.000Z', undefined, {
      source: savedCalendar.record.source,
      updatedAt: savedCalendar.record.updatedAt,
    });
    expect(recovered.ok).toBe(true);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('reloads the unchanged calendar and plan when their atomic change cannot commit', async () => {
    const database = getCurrentLifeRhythmDatabase();
    const seededCalendar = await importIcsCalendarSource({
      label: 'prior.ics',
      source: priorCalendar,
      options: {
        targetTimezone: 'UTC',
        windowStartDate: '2026-09-20',
        windowEndDate: '2026-09-21',
      },
      importedAt: '2026-09-20T07:00:00.000Z',
    });
    expect(seededCalendar.ok).toBe(true);
    const beforeCalendar = await database.calendarSources.get('primary');
    const beforePlan = await database.schedulerPlanState.get('current');
    vi.spyOn(database.schedulerPlanState, 'update').mockRejectedValueOnce(
      new Error('synthetic marker persistence failure'),
    );

    const firstUser = userEvent.setup();
    const firstRender = render(<App />);
    const firstNav = await screen.findByRole('navigation', { name: 'Primary' });
    await firstUser.click(within(firstNav).getByRole('button', { name: 'Plan' }));
    await firstUser.click(screen.getByText('Plan details'));

    const replacement = new File([calendar], 'replacement.ics', { type: 'text/calendar' });
    Object.defineProperty(replacement, 'text', { value: vi.fn().mockResolvedValue(calendar) });
    await firstUser.upload(screen.getByLabelText('Select read-only calendar file'), replacement);

    await screen.findByText(
      'calendarSource: Calendar change was not saved because repair attention could not be stored safely.',
    );
    expect(coordinatorMocks.repairCurrentPrivatePlan).not.toHaveBeenCalled();
    firstRender.unmount();

    render(<App />);
    const secondNav = await screen.findByRole('navigation', { name: 'Primary' });
    const todayLater = screen.getByRole('region', { name: 'Later' });
    await waitFor(() => {
      expect(within(todayLater).queryByText(
        'The flexible private plan needs repair after a calendar change.',
      )).toBeNull();
    });
    await userEvent.setup().click(within(secondNav).getByRole('button', { name: 'Plan' }));
    await userEvent.setup().click(screen.getByText('Plan details'));
    expect(await screen.findByText('prior.ics')).toBeTruthy();
    expect(screen.queryByText('Calendar change needs attention.')).toBeNull();
    expect(await database.calendarSources.get('primary')).toEqual(beforeCalendar);
    expect(await database.schedulerPlanState.get('current')).toEqual(beforePlan);
  });
});
