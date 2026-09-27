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
import { validateCalendarCommitmentExpansion } from '../domain/calendarAvailability';
import { icsCalendarAdapter } from '../domain/calendarAdapter';

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

function calendarWith(...entries: string[][]) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0',
    ...entries.flatMap((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']),
    'END:VCALENDAR'].join('\r\n');
}

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`calendar-source-${namespaceIndex}`),
  );
});

describe('calendar source repository', () => {
  it('accepts expired BUSY history above the source budget without hiding a valid current event', async () => {
    const result = await importIcsCalendarSource({
      label: 'Historical archive',
      source: calendarWith(
        ['UID:old-a', 'DTSTART:19000101T090000Z', 'DURATION:P6000D'],
        ['UID:old-b', 'DTSTART:19000102T090000Z', 'DURATION:P6000D'],
        ['UID:current', 'DTSTART:20260907T010000Z', 'DURATION:PT1H'],
      ), options,
    });
    expect(result).toMatchObject({ ok: true, busyEventCount: 1 });
  });

  it('rejects a timezone-dependent budget boundary before creating an unreadable saved source', async () => {
    const source = calendarWith(['UID:zone-sensitive',
      'DTSTART:20260101T163000Z', 'DTEND:20530519T160000Z']);
    const perth = icsCalendarAdapter.read(source, { ...options, windowStartDate: '2026-01-01', windowEndDate: '2053-05-20' });
    expect(() => validateCalendarCommitmentExpansion(perth.events)).not.toThrow();
    expect(() => icsCalendarAdapter.read(source, { ...options, targetTimezone: 'America/New_York',
      windowStartDate: '2026-01-01', windowEndDate: '2053-05-20' }))
      .toThrow('Calendar event exceeds safe daily expansion bounds.');
    const result = await importIcsCalendarSource({ label: 'Zone-dependent', source, options });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(0);
  });

  it('applies the timezone-independent bound to future recurring BUSY occurrences', async () => {
    const result = await importIcsCalendarSource({
      label: 'Zone-dependent recurrence',
      source: calendarWith(['UID:zone-recurring', 'DTSTART:20261201T163000Z',
        'DURATION:P10000D', 'RRULE:FREQ=YEARLY;COUNT=1']),
      options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(0);
  });

  it('charges two individually legal future 6,000-fragment BUSY events before persistence', async () => {
    const a = ['UID:future-a', 'DTSTART:20261201T160000Z', 'DURATION:P6000D'];
    const b = ['UID:future-b', 'DTSTART:20261202T160000Z', 'DURATION:P6000D'];
    for (const entry of [a, b]) {
      expect(icsCalendarAdapter.readForImport(calendarWith(entry), options).events).toEqual([]);
    }
    const result = await importIcsCalendarSource({ label: 'Future aggregate', source: calendarWith(a, b), options });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(0);
  });

  it.each([
    { label: 'two future timed events', second: ['UID:second', 'DTSTART:20261202T160000Z', 'DURATION:P4001D'] },
    { label: 'future timed plus all-day', second: ['UID:second', 'DTSTART;VALUE=DATE:20261202', 'DURATION:P4001D'] },
    { label: 'one in-window plus future', second: ['UID:second', 'DTSTART:20260907T160000Z', 'DURATION:P4001D'] },
  ])('rejects $label at 10,001 aggregate fragments', async ({ second }) => {
    const result = await importIcsCalendarSource({
      label: 'Mixed aggregate',
      source: calendarWith(['UID:first', 'DTSTART:20261201T160000Z', 'DURATION:P6000D'], second),
      options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(0);
  });

  it('accepts exactly 10,000 aggregate fragments outside the read window', async () => {
    const imported = await importIcsCalendarSource({
      label: 'Future accepted',
      source: calendarWith(
        ['UID:first', 'DTSTART;VALUE=DATE:20261201', 'DURATION:P6000D'],
        ['UID:second', 'DTSTART;VALUE=DATE:20261202', 'DURATION:P4000D'],
      ), options,
    });
    expect(imported.ok).toBe(true);
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(1);
  });

  it('does not charge transparent or cancelled future events against valid BUSY commitments', async () => {
    const imported = await importIcsCalendarSource({
      label: 'Non-blocking future',
      source: calendarWith(
        ['UID:free-a', 'TRANSP:TRANSPARENT', 'DTSTART:20261201T160000Z', 'DURATION:P1000000D'],
        ['UID:free-b', 'TRANSP:TRANSPARENT', 'DTSTART:20261202T160000Z', 'DURATION:P1000000D'],
        ['UID:cancelled', 'STATUS:CANCELLED', 'DTSTART:20261203T160000Z', 'DURATION:P1000000D'],
        ['UID:busy', 'DTSTART:20260907T010000Z', 'DURATION:PT1H'],
      ), options,
    });
    expect(imported).toMatchObject({ ok: true, busyEventCount: 1 });
  });

  it('counts finite recurring BUSY occurrences beyond the read window', async () => {
    const result = await importIcsCalendarSource({
      label: 'Future recurrence',
      source: calendarWith(['UID:future', 'DTSTART:20261201T160000Z', 'DURATION:P6000D',
        'RRULE:FREQ=DAILY;COUNT=2']), options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(0);
  });

  it.each([
    { kind: 'UNTIL', recurrence: ['RRULE:FREQ=DAILY;UNTIL=20261202T160000Z'] },
    { kind: 'RDATE', recurrence: ['RRULE:FREQ=DAILY;COUNT=1', 'RDATE:20261202T160000Z'] },
  ])('counts future $kind occurrences using the effective recurrence iterator', async ({ recurrence }) => {
      const result = await importIcsCalendarSource({
        label: 'Future recurrence',
        source: calendarWith(['UID:future', 'DTSTART:20261201T160000Z', 'DURATION:P6000D', ...recurrence]),
        options,
      });
      expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
      expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(0);
  });

  it('counts a future BUSY moved exception once alongside an ordinary future event', async () => {
    const result = await importIcsCalendarSource({
      label: 'Future moved aggregate',
      source: calendarWith(
        ['UID:ordinary', 'DTSTART:20261201T160000Z', 'DURATION:P6000D'],
        ['UID:series', 'TRANSP:TRANSPARENT', 'DTSTART:20261202T160000Z', 'DURATION:PT1H',
          'RRULE:FREQ=DAILY;COUNT=2'],
        ['UID:series', 'RECURRENCE-ID:20261203T160000Z', 'TRANSP:OPAQUE',
          'DTSTART:20261203T160000Z', 'DURATION:P4001D'],
      ), options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
  });

  it('charges two BUSY moved exceptions without charging their transparent master', async () => {
    const result = await importIcsCalendarSource({
      label: 'Future overrides',
      source: calendarWith(
        ['UID:series', 'TRANSP:TRANSPARENT', 'DTSTART:20261201T160000Z', 'DURATION:PT1H',
          'RRULE:FREQ=DAILY;COUNT=3'],
        ['UID:series', 'RECURRENCE-ID:20261202T160000Z', 'TRANSP:OPAQUE',
          'DTSTART:20261202T160000Z', 'DURATION:P6000D'],
        ['UID:series', 'RECURRENCE-ID:20261203T160000Z', 'TRANSP:OPAQUE',
          'DTSTART:20261203T160000Z', 'DURATION:P6000D'],
      ), options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
  });

  it('replaces logical slots exactly once and ignores transparent, cancelled and EXDATE slots', async () => {
    const result = await importIcsCalendarSource({
      label: 'Effective recurrence',
      source: calendarWith(
        ['UID:series', 'DTSTART:20261201T160000Z', 'DURATION:P6000D',
          'RRULE:FREQ=DAILY;COUNT=4', 'EXDATE:20261204T160000Z'],
        ['UID:series', 'RECURRENCE-ID:20261202T160000Z', 'TRANSP:OPAQUE',
          'DTSTART:20261202T160000Z', 'DURATION:P3996D'],
        ['UID:series', 'RECURRENCE-ID:20261203T160000Z', 'TRANSP:TRANSPARENT',
          'DTSTART:20261203T160000Z', 'DURATION:P1000000D'],
      ), options,
    });
    expect(result.ok).toBe(true);
  });

  it('does not charge a cancelled future recurrence exception', async () => {
    const result = await importIcsCalendarSource({
      label: 'Cancelled future slot',
      source: calendarWith(
        ['UID:series', 'DTSTART:20261201T160000Z', 'DURATION:P6000D',
          'RRULE:FREQ=DAILY;COUNT=2'],
        ['UID:series', 'RECURRENCE-ID:20261202T160000Z', 'STATUS:CANCELLED',
          'DTSTART:20261202T160000Z', 'DURATION:P6000D'],
        ['UID:other', 'DTSTART:20261203T160000Z', 'DURATION:P3996D'],
      ), options,
    });
    expect(result.ok).toBe(true);
  });

  it('keeps open-ended recurrence bounded to the rolling read horizon', async () => {
    const result = await importIcsCalendarSource({
      label: 'Open recurrence',
      source: calendarWith(['UID:future', 'DTSTART:20261201T160000Z', 'DURATION:PT1H',
        'RRULE:FREQ=DAILY']), options,
    });
    expect(result.ok).toBe(true);
  });

  it('reserves explicit future RDATE additions to an open-ended master', async () => {
    const rdates = Array.from({ length: 101 }, (_, index) => {
      const day = new Date(Date.UTC(2030, 0, 1 + index));
      return `${day.getUTCFullYear()}${(day.getUTCMonth() + 1).toString().padStart(2, '0')}${day.getUTCDate().toString().padStart(2, '0')}T090000Z`;
    });
    const result = await importIcsCalendarSource({
      label: 'Future RDATE cluster',
      source: calendarWith(['UID:series', 'DTSTART:20271201T090000Z', 'DURATION:P100D',
        'RRULE:FREQ=YEARLY', `RDATE:${rdates.join(',')}`]), options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
  });

  it('charges future BUSY moved exceptions of an open-ended recurrence before persistence', async () => {
    const result = await importIcsCalendarSource({
      label: 'Future busy exceptions',
      source: calendarWith(
        ['UID:series', 'DTSTART:20271201T090000Z', 'DURATION:P100D', 'RRULE:FREQ=YEARLY'],
        ['UID:series', 'RECURRENCE-ID:20301201T090000Z', 'DTSTART:20301201T090000Z', 'DURATION:P6000D'],
        ['UID:series', 'RECURRENCE-ID:20311201T090000Z', 'DTSTART:20311201T090000Z', 'DURATION:P6000D'],
      ), options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
  });

  it('does not charge a century of disjoint past open-ended yearly occurrences', async () => {
    const result = await importIcsCalendarSource({
      label: 'Long-lived yearly commitment',
      source: calendarWith(['UID:yearly', 'DTSTART:19261201T160000Z', 'DURATION:P200D',
        'RRULE:FREQ=YEARLY']), options,
    });
    expect(result.ok).toBe(true);
  });

  it('counts explicit future RDATE once even if it duplicates a finite RRULE occurrence', async () => {
    const result = await importIcsCalendarSource({
      label: 'Future RDATE',
      source: calendarWith(['UID:series', 'DTSTART:20261201T160000Z', 'DURATION:P4998D',
        'RRULE:FREQ=DAILY;COUNT=2', 'RDATE:20261202T160000Z']), options,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a first over-budget timed import before persisting a source', async () => {
    const result = await importIcsCalendarSource({
      label: 'Too long',
      source: calendarWith(['UID:huge', 'DTSTART:20260101T090000Z', 'DURATION:P1000000D']),
      options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(0);
  });

  it.each([
    { kind: 'single', recurrence: [] },
    { kind: 'recurring', recurrence: ['RRULE:FREQ=DAILY;COUNT=1'] },
  ])('rejects a future $kind over-budget BUSY event before replacing a valid source', async ({ recurrence }) => {
    expect((await importIcsCalendarSource({
      label: 'Existing', source: calendar, options,
      importedAt: '2026-09-05T06:00:00.000Z',
    })).ok).toBe(true);
    const database = getCurrentLifeRhythmDatabase();
    const before = await database.calendarSources.get('primary');
    const result = await importIcsCalendarSource({
      label: 'Future unsafe event',
      source: calendarWith(['UID:future', 'DTSTART:20261201T090000Z', 'DURATION:P1000000D', ...recurrence]),
      options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await database.calendarSources.get('primary')).toEqual(before);
  });

  it.each([
    { kind: 'single', recurrence: [] },
    { kind: 'recurring', recurrence: ['RRULE:FREQ=DAILY;COUNT=1'] },
  ])('allows a future $kind transparent long span alongside a valid BUSY event', async ({ recurrence }) => {
    const imported = await importIcsCalendarSource({
      label: 'Future transparent reminder',
      source: calendarWith(
        ['UID:future-free', 'DTSTART:20261201T090000Z', 'DURATION:P1000000D', 'TRANSP:TRANSPARENT', ...recurrence],
        ['UID:busy-now', 'DTSTART:20260907T010000Z', 'DTEND:20260907T020000Z'],
      ),
      options,
    });
    expect(imported).toMatchObject({ ok: true, busyEventCount: 1 });
    const read = await readPersistedCalendarEvents(options);
    expect(read.status).toBe('ok');
    if (read.status === 'ok') {
      expect(read.events.filter((event) => event.busy).map((event) => event.sourceEventId)).toEqual(['busy-now']);
      expect(() => validateCalendarCommitmentExpansion(read.events)).not.toThrow();
    }
  });

  it('rejects an off-window BUSY moved exception with an unsafe timed span', async () => {
    expect((await importIcsCalendarSource({
      label: 'Existing', source: calendar, options,
      importedAt: '2026-09-05T06:00:00.000Z',
    })).ok).toBe(true);
    const database = getCurrentLifeRhythmDatabase();
    const before = await database.calendarSources.get('primary');
    const result = await importIcsCalendarSource({
      label: 'Future moved blocker',
      source: calendarWith(
        ['UID:future-series', 'DTSTART:20261201T090000Z', 'DURATION:PT1H',
          'RRULE:FREQ=DAILY;COUNT=2', 'TRANSP:TRANSPARENT'],
        ['UID:future-series', 'RECURRENCE-ID:20261202T090000Z',
          'DTSTART:20261202T090000Z', 'DURATION:P1000000D', 'TRANSP:OPAQUE'],
      ),
      options,
    });
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await database.calendarSources.get('primary')).toEqual(before);
  });

  it('accepts an off-window transparent moved exception with an unsafe span', async () => {
    const result = await importIcsCalendarSource({
      label: 'Future free exception',
      source: calendarWith(
        ['UID:future-series', 'DTSTART:20261201T090000Z', 'DURATION:PT1H',
          'RRULE:FREQ=DAILY;COUNT=2'],
        ['UID:future-series', 'RECURRENCE-ID:20261202T090000Z',
          'DTSTART:20261202T090000Z', 'DURATION:P1000000D', 'TRANSP:TRANSPARENT'],
        ['UID:busy-now', 'DTSTART:20260907T010000Z', 'DTEND:20260907T020000Z'],
      ),
      options,
    });
    expect(result).toMatchObject({ ok: true, busyEventCount: 1 });
  });

  it('accepts exactly 10,000 timed fragments and rejects the immediately following fragment', async () => {
    // This timed span costs 10,000 fragments in Perth and under the
    // timezone-independent import bound; another calendar day costs 10,001.
    const start = ['UID:boundary', 'DTSTART:20260101T120000Z'];
    const accepted = await importIcsCalendarSource({
      label: 'At boundary',
      source: calendarWith([...start, 'DTEND:20530518T090000Z']),
      options,
      importedAt: '2026-09-05T06:00:00.000Z',
    });
    expect(accepted.ok).toBe(true);
    const before = await getCurrentLifeRhythmDatabase().calendarSources.get('primary');
    const read = await readPersistedCalendarEvents(options);
    expect(read.status).toBe('ok');
    if (read.status === 'ok') expect(() => validateCalendarCommitmentExpansion(read.events)).not.toThrow();
    const travelRead = await readPersistedCalendarEvents({ ...options,
      targetTimezone: 'America/New_York', windowStartDate: '2026-01-01', windowEndDate: '2053-05-20' });
    expect(travelRead.status).toBe('ok');
    if (travelRead.status === 'ok') {
      expect(travelRead.events).toHaveLength(1);
      expect(() => validateCalendarCommitmentExpansion(travelRead.events)).not.toThrow();
    }
    const rejected = await importIcsCalendarSource({
      label: 'Beyond boundary',
      source: calendarWith([...start, 'DTEND:20530519T090000Z']),
      options,
    });
    expect(rejected).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await getCurrentLifeRhythmDatabase().calendarSources.get('primary')).toEqual(before);
  });

  it('rejects an aggregate all-day and timed import without replacing the saved source', async () => {
    expect((await importIcsCalendarSource({ label: 'Existing', source: calendar, options,
      importedAt: '2026-09-05T06:00:00.000Z' })).ok).toBe(true);
    const before = await getCurrentLifeRhythmDatabase().calendarSources.get('primary');
    const rejected = await importIcsCalendarSource({
      label: 'Over budget aggregate',
      source: calendarWith(
        ['UID:all-day', 'DTSTART;VALUE=DATE:20260101', 'DURATION:P6000D'],
        ['UID:timed', 'DTSTART:20260101T090000Z', 'DURATION:P6000D'],
      ),
      options,
    });
    expect(rejected).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await getCurrentLifeRhythmDatabase().calendarSources.get('primary')).toEqual(before);
  });

  it('does not charge transparent long spans against the busy import budget', async () => {
    const imported = await importIcsCalendarSource({
      label: 'Mixed source',
      source: calendarWith(
        ['UID:free-long', 'TRANSP:TRANSPARENT', 'DTSTART:20260101T090000Z', 'DURATION:P1000000D'],
        ['UID:busy', 'DTSTART:20260907T010000Z', 'DTEND:20260907T020000Z'],
      ),
      options,
    });
    expect(imported).toMatchObject({ ok: true, eventCount: 2, busyEventCount: 1 });
    const read = await readPersistedCalendarEvents(options);
    expect(read.status).toBe('ok');
    if (read.status === 'ok') expect(() => validateCalendarCommitmentExpansion(read.events)).not.toThrow();
  });

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
