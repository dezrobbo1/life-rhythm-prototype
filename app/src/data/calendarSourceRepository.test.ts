import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  type CalendarSourceStore,
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

  it('imports supported recurrence as the saved read-only source', async () => {
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

    expect(recurring.ok).toBe(true);

    const loaded = await loadCalendarSource();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record.label).toBe('Recurring calendar');
  });

  it('reads a previously saved recurring source without rewriting its stored file', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.calendarSources.put({
      id: 'primary',
      version: 1,
      adapterId: 'ics',
      label: 'Old recurring source',
      source: recurringCalendar,
      importedAt: '2026-09-05T06:00:00.000Z',
      updatedAt: '2026-09-05T06:00:00.000Z',
      beforeBusyMinutes: 0,
      afterBusyMinutes: 0,
    });

    const read = await readPersistedCalendarEvents(options);

    expect(read.status).toBe('ok');
    if (read.status !== 'ok') return;
    expect(read.events.length).toBeGreaterThan(0);
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

  it('preserves explicit buffers when replacing a valid v2 source', async () => {
    const database = getCurrentLifeRhythmDatabase();
    expect((await importIcsCalendarSource({
      label: 'Family calendar',
      source: calendar,
      options,
      importedAt: '2026-09-05T06:00:00.000Z',
    })).ok).toBe(true);
    await database.calendarSources.update('primary', { beforeBusyMinutes: 12, afterBusyMinutes: 7 });

    const replacement = await importIcsCalendarSource({
      label: 'Recurring calendar',
      source: recurringCalendar,
      options,
      importedAt: '2026-09-05T06:10:00.000Z',
    });

    expect(replacement.ok).toBe(true);
    const loaded = await loadCalendarSource();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record).toMatchObject({ version: 2, beforeBusyMinutes: 12, afterBusyMinutes: 7 });
  });

  it('replaces a valid v1 source with safe zero buffer semantics', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.calendarSources.put({
      id: 'primary',
      version: 1,
      adapterId: 'ics',
      label: 'Legacy source',
      source: calendar,
      importedAt: '2026-09-05T06:00:00.000Z',
      updatedAt: '2026-09-05T06:00:00.000Z',
    } as never);

    const replacement = await importIcsCalendarSource({
      label: 'Recurring calendar',
      source: recurringCalendar,
      options,
      importedAt: '2026-09-05T06:10:00.000Z',
    });

    expect(replacement.ok).toBe(true);
    const loaded = await loadCalendarSource();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record).toMatchObject({ version: 2, beforeBusyMinutes: 0, afterBusyMinutes: 0 });
  });

  it('allows a valid explicit import to recover from a schema-invalid saved source', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.calendarSources.put({
      id: 'primary',
      version: 99,
      adapterId: 'ics',
      label: 'Corrupt source',
      source: calendar,
      importedAt: 'not-a-time',
      updatedAt: 'not-a-time',
      beforeBusyMinutes: 999,
      afterBusyMinutes: 999,
    } as never);

    expect((await loadCalendarSource()).status).toBe('invalid');

    const replacement = await importIcsCalendarSource({
      label: 'Recovered calendar',
      source: recurringCalendar,
      options,
      importedAt: '2026-09-05T06:10:00.000Z',
    });

    expect(replacement.ok).toBe(true);
    const loaded = await loadCalendarSource();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record).toMatchObject({
      version: 2,
      label: 'Recovered calendar',
      beforeBusyMinutes: 0,
      afterBusyMinutes: 0,
    });
  });

  it('does not overwrite an invalid stored row when the incoming file is malformed', async () => {
    const database = getCurrentLifeRhythmDatabase();
    const corrupt = {
      id: 'primary',
      version: 99,
      adapterId: 'ics',
      label: 'Corrupt source',
      source: calendar,
      importedAt: 'not-a-time',
      updatedAt: 'not-a-time',
    };
    await database.calendarSources.put(corrupt as never);

    const replacement = await importIcsCalendarSource({
      label: 'Bad replacement',
      source: 'not an ics calendar',
      options,
      importedAt: '2026-09-05T06:10:00.000Z',
    });

    expect(replacement.ok).toBe(false);
    expect(await database.calendarSources.get('primary')).toEqual(corrupt);
  });

  it('fails closed on an actual saved-source read failure', async () => {
    const put = vi.fn();
    const store = {
      calendarSources: {
        delete: vi.fn(),
        get: vi.fn().mockRejectedValue(new Error('read failed')),
        put,
      },
    } as unknown as CalendarSourceStore;

    const result = await importIcsCalendarSource({
      label: 'Replacement',
      source: calendar,
      options,
      importedAt: '2026-09-05T06:10:00.000Z',
    }, store);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ errors: [expect.stringContaining('could not be read')] });
    expect(put).not.toHaveBeenCalled();
  });
});
