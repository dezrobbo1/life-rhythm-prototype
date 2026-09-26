import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { commitCalendarSourceBuffers, commitCalendarSourceImport } from './calendarSourceMutationCoordinator';
import {
  buildCurrentLiveSchedulingContext,
  ensureCurrentPrivatePlan,
  repairCurrentPrivatePlan,
} from './schedulerPlanCoordinator';
import { createDefaultSettings, saveSettings } from './settingsRepository';
import { taskPoolItemSchema } from './schemas';
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';

const monday = '2026-09-07';
const timezone = 'Australia/Perth';
const testNow = new Date('2026-09-06T23:30:00.000Z');
let namespaceIndex = 0;

function coordinatorOptions() {
  return {
    horizonDays: 1,
    now: testNow,
    startDate: monday,
    timezone,
  };
}

const blockingCalendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:calendar-meeting',
  'DTSTART:20260907T010000Z',
  'DTEND:20260907T020000Z',
  'SUMMARY:Calendar meeting',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

beforeEach(async () => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`scheduler-calendar-repair-${namespaceIndex}`),
  );

  const defaults = createDefaultSettings('2026-09-05T00:00:00.000Z');
  const settings = await saveSettings({
    theme: defaults.theme,
    startBoostSafety: defaults.startBoostSafety,
    lifeShape: {
      ...defaults.lifeShape,
      timeBlocks: [
        {
          id: 'monday-available',
          label: 'Monday available',
          type: 'openCapacity',
          schedulerUse: 'available',
          days: ['Monday'],
          start: '09:00',
          end: '12:00',
        },
      ],
    },
  });
  expect(settings.ok).toBe(true);

  await getCurrentLifeRhythmDatabase().taskPoolItems.put(
    taskPoolItemSchema.parse({
      id: 'task-a',
      source: 'adhoc',
      title: 'Send the form',
      area: 'admin',
      status: 'captured',
      minimum: { label: 'Open it', minutes: 30 },
      normal: { label: 'Do it', minutes: 30 },
      full: { label: 'Finish it', minutes: 30 },
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    }),
  );
});

describe('calendar-driven rolling repair', () => {
  it('includes adjacent-date events whose authored spacing blocks the planning horizon', async () => {
    const source = ['BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VEVENT', 'UID:previous-day', 'DTSTART;TZID=Australia/Perth:20260906T233000',
      'DTEND;TZID=Australia/Perth:20260906T234500', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:following-day', 'DTSTART;TZID=Australia/Perth:20260908T003000',
      'DTEND;TZID=Australia/Perth:20260908T010000', 'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    expect((await commitCalendarSourceImport({ label: 'Adjacent events', source, options: {
      targetTimezone: timezone, windowStartDate: monday, windowEndDate: monday,
    } })).ok).toBe(true);
    expect((await commitCalendarSourceBuffers(60, 60)).ok).toBe(true);
    const context = await buildCurrentLiveSchedulingContext({ ...coordinatorOptions(), readOnly: true });
    expect(context.ok).toBe(true);
    if (!context.ok) return;
    expect(context.context.input.externalCommitments).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'previous-day', interval: expect.objectContaining({ date: monday, start: '00:00', end: '00:45' }) }),
      expect.objectContaining({ sourceId: 'following-day', interval: expect.objectContaining({ date: monday, start: '23:30', end: '24:00' }) }),
    ]));
  });

  it('moves a flexible automatic placement when a read-only calendar commitment arrives', async () => {
    const initial = await ensureCurrentPrivatePlan(coordinatorOptions());

    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.plan.placements).toEqual([
      expect.objectContaining({
        intentionId: 'task-a',
        origin: 'scheduler',
        date: monday,
        start: '09:00',
        end: '09:30',
      }),
    ]);

    const imported = await commitCalendarSourceImport({
      label: 'Work calendar',
      source: blockingCalendar,
      options: {
        targetTimezone: timezone,
        windowStartDate: monday,
        windowEndDate: monday,
      },
      importedAt: '2026-09-05T06:00:00.000Z',
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.repairAttentionPersisted).toBe(true);
    expect(await loadSchedulerPlanState()).toEqual(expect.objectContaining({
      status: 'ok',
      calendarRepairPendingAt: expect.any(String),
    }));

    const repaired = await repairCurrentPrivatePlan({
      ...coordinatorOptions(),
      trigger: 'calendarChanged',
      reason: 'Read-only calendar changed.',
    });

    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.plan.repair?.trigger).toBe('calendarChanged');
    expect(repaired.plan.placements).toEqual([
      expect.objectContaining({
        intentionId: 'task-a',
        date: monday,
        start: '10:00',
        end: '10:30',
      }),
    ]);
    expect(repaired.plan.repair?.changes).toEqual([
      expect.objectContaining({
        kind: 'moved',
        targetId: 'task-a',
        from: expect.objectContaining({ start: '09:00', end: '09:30' }),
        to: expect.objectContaining({ start: '10:00', end: '10:30' }),
      }),
    ]);
    expect(repaired.warnings.some((warning) => warning.includes('Work calendar supplied 1 event'))).toBe(true);
    expect(await loadSchedulerPlanState()).toEqual(expect.not.objectContaining({
      calendarRepairPendingAt: expect.any(String),
    }));
  });

  it('fails closed when the stored calendar source record is malformed', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.calendarSources.put({
      id: 'primary',
      version: 1,
      adapterId: 'ics',
      label: '',
      source: blockingCalendar,
      importedAt: 'bad timestamp',
      updatedAt: 'bad timestamp',
    } as never);

    const result = await ensureCurrentPrivatePlan(coordinatorOptions());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(await database.schedulerPlanState.count()).toBe(0);
  });
});
