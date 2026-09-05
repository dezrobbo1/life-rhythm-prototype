import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  importIcsCalendarSource,
  loadCalendarSource,
  readPersistedCalendarEvents,
  removeCalendarSource,
} from './calendarSourceRepository';

let namespaceIndex = 0;
const options = {
  targetTimezone: 'Australia/Perth',
  windowStartDate: '2026-09-07',
  windowEndDate: '2026-09-08',
};

const calendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:meeting-1',
  'DTSTART:20260907T010000Z',
  'DTEND:20260907T020000Z',
  'SUMMARY:School meeting',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:free-1',
  'DTSTART:20260907T030000Z',
  'DTEND:20260907T040000Z',
  'SUMMARY:Optional reminder',
  'TRANSP:TRANSPARENT',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const recurringCalendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:recurring-meeting',
  'DTSTART:20260907T010000Z',
  'DTEND:20260907T020000Z',
  'RRULE:FREQ=WEEKLY;COUNT=4',
  'SUMMARY:Weekly meeting',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`calendar-source-${namespaceIndex}`),
  );
});

describe('calendar source repository', () => {
  it('imports, persists and reads a local read-only ICS calendar', async () => {
    const imported = await importIcsCalendarSource({
      label: 'Family calendar',
      source: calendar,
      options,
      importedAt: '2026-09-05T06:00:00.000Z',
    });

    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.eventCount).toBe(2);
    expect(imported.busyEventCount).toBe(1);

    const loaded = await loadCalendarSource();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record.label).toBe('Family calendar');
    expect(loaded.record.source).toContain('UID:meeting-1');

    const read = await readPersistedCalendarEvents(options);
    expect(read.status).toBe('ok');
    if (read.status !== 'ok') return;
    expect(read.events).toEqual([
      expect.objectContaining({
        sourceEventId: 'meeting-1',
        title: 'School meeting',
        busy: true,
        start: { date: '2026-09-07', time: '09:00' },
        end: { date: '2026-09-07', time: '10:00' },
      }),
      expect.objectContaining({
        sourceEventId: 'free-1',
        busy: false,
        start: { date: '2026-09-07', time: '11:00' },
        end: { date: '2026-09-07', time: '12:00' },
      }),
    ]);
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(1);
  });

  it('rejects non-calendar content without replacing the saved source', async () => {
    const first = await importIcsCalendarSource({
      label: 'Family calendar',
      source: calendar,
      options,
      importedAt: '2026-09-05T06:00:00.000Z',
    });
    expect(first.ok).toBe(true);

    const invalid = await importIcsCalendarSource({
      label: 'Bad file',
      source: 'not an ics calendar',
      options,
      importedAt: '2026-09-05T06:10:00.000Z',
    });

    expect(invalid.ok).toBe(false);
    const loaded = await loadCalendarSource();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record.label).toBe('Family calendar');
  });

  it('rejects unsupported recurrence without replacing a safe saved source', async () => {
    const first = await importIcsCalendarSource({
      label: 'Family calendar',
      source: calendar,
      options,
      importedAt: '2026-09-05T06:00:00.000Z',
    });
    expect(first.ok).toBe(true);

    const recurring = await importIcsCalendarSource({
      label: 'Recurring calendar',
      source: recurringCalendar,
      options,
      importedAt: '2026-09-05T06:10:00.000Z',
    });

    expect(recurring.ok).toBe(false);
    if (recurring.ok) return;
    expect(recurring.errors.join(' ')).toContain('RRULE');
    expect(recurring.errors.join(' ')).toContain('not supported safely yet');

    const loaded = await loadCalendarSource();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record.label).toBe('Family calendar');
  });

  it('fails closed if unsupported recurrence is already present in persisted source data', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.calendarSources.put({
      id: 'primary',
      version: 1,
      adapterId: 'ics',
      label: 'Old recurring source',
      source: recurringCalendar,
      importedAt: '2026-09-05T06:00:00.000Z',
      updatedAt: '2026-09-05T06:00:00.000Z',
    });

    const read = await readPersistedCalendarEvents(options);

    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.errors.join(' ')).toContain('RRULE');
  });

  it('removes the local source without touching another local data class', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.taskPoolItems.put({
      id: 'held-task',
      source: 'adhoc',
      title: 'Held task',
      area: 'admin',
      status: 'captured',
      minimum: { label: 'Open it', minutes: 5 },
      normal: { label: 'Do it', minutes: 10 },
      full: { label: 'Finish it', minutes: 20 },
      createdAt: '2026-09-05T06:00:00.000Z',
      updatedAt: '2026-09-05T06:00:00.000Z',
    });
    const imported = await importIcsCalendarSource({
      label: 'Family calendar',
      source: calendar,
      options,
      importedAt: '2026-09-05T06:00:00.000Z',
    });
    expect(imported.ok).toBe(true);

    const removed = await removeCalendarSource();

    expect(removed).toEqual({ ok: true, removed: true });
    expect((await loadCalendarSource()).status).toBe('missing');
    expect(await database.taskPoolItems.count()).toBe(1);
  });
});
