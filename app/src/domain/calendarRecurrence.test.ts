import { describe, expect, it } from 'vitest';
import { IcsCalendarAdapter } from './calendarAdapter';

const adapter = new IcsCalendarAdapter();
const options = { targetTimezone: 'Australia/Sydney', windowStartDate: '2026-10-01', windowEndDate: '2026-10-31' };
const event = (lines: string[]) => ['BEGIN:VEVENT', 'UID:work@example.com', 'SUMMARY:Work', ...lines, 'END:VEVENT'].join('\r\n');
const calendar = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
const base = ['DTSTART;TZID=Australia/Sydney:20261002T090000', 'DTEND;TZID=Australia/Sydney:20261002T093000'];

describe('bounded recurring calendar authority', () => {
  it('keeps weekly local 09:00 across Sydney DST with stable IDs and skips excluded dates', () => {
    const source = calendar(event([...base, 'RRULE:FREQ=WEEKLY;COUNT=5;BYDAY=FR', 'EXDATE;TZID=Australia/Sydney:20261009T090000']));
    const first = adapter.read(source, options).events;
    const again = adapter.read(source, options).events;
    expect(first.map((item) => [item.start.date, item.start.time])).toEqual([
      ['2026-10-02', '09:00'], ['2026-10-16', '09:00'], ['2026-10-23', '09:00'], ['2026-10-30', '09:00'],
    ]);
    expect(again.map((item) => item.sourceEventId)).toEqual(first.map((item) => item.sourceEventId));
  });

  it('adds RDATE, replaces a moved recurrence ID, and removes a cancelled exception', () => {
    const source = calendar(
      event([...base, 'RRULE:FREQ=WEEKLY;COUNT=3', 'RDATE;TZID=Australia/Sydney:20261028T090000']),
      event(['RECURRENCE-ID;TZID=Australia/Sydney:20261009T090000', 'DTSTART;TZID=Australia/Sydney:20261009T130000', 'DTEND;TZID=Australia/Sydney:20261009T133000']),
      event(['RECURRENCE-ID;TZID=Australia/Sydney:20261016T090000', 'STATUS:CANCELLED', 'DTSTART;TZID=Australia/Sydney:20261016T090000', 'DTEND;TZID=Australia/Sydney:20261016T093000']),
    );
    const rows = adapter.read(source, options).events;
    expect(rows.map((item) => [item.start.date, item.start.time])).toEqual([
      ['2026-10-02', '09:00'], ['2026-10-09', '13:00'], ['2026-10-28', '09:00'],
    ]);
    expect(new Set(rows.map((item) => item.sourceEventId)).size).toBe(rows.length);
  });

  it('rejects an unsupported busy rule rather than accepting only the first date', () => {
    expect(() => adapter.read(calendar(event([...base, 'RRULE:FREQ=HOURLY;COUNT=3'])), options)).toThrow();
    expect(() => adapter.read(calendar(event([...base, 'RRULE:FREQ=WEEKLY;COUNT=3;BYSETPOS=1'])), options)).toThrow();
    expect(() => adapter.read(calendar(event([...base, 'RRULE:FREQ=WEEKLY;COUNT=3;X-WEIRD=1'])), options)).toThrow();
  });

  it('expands all-day recurrence on the intended local dates', () => {
    const rows = adapter.read(calendar(event(['DTSTART;VALUE=DATE:20261002', 'DTEND;VALUE=DATE:20261003', 'RRULE:FREQ=DAILY;COUNT=3'])), options).events;
    expect(rows.map((item) => [item.start.date, item.end.date])).toEqual([
      ['2026-10-02', '2026-10-03'], ['2026-10-03', '2026-10-04'], ['2026-10-04', '2026-10-05'],
    ]);
  });

  it('honours interval, until, selected weekdays, and RDATE in Perth', () => {
    const source = calendar(event([
      'DTSTART;TZID=Australia/Perth:20261002T090000', 'DTEND;TZID=Australia/Perth:20261002T093000',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;UNTIL=20261031T235959Z',
      'RDATE;TZID=Australia/Perth:20261028T090000',
    ]));
    expect(adapter.read(source, { ...options, targetTimezone: 'Australia/Perth' }).events.map((item) => item.start.date)).toEqual([
      '2026-10-02', '2026-10-16', '2026-10-28', '2026-10-30',
    ]);
  });

  it('expands monthly dates and converted UTC events inside the target horizon', () => {
    const source = calendar(event(['DTSTART:20260930T230000Z', 'DTEND:20260930T233000Z', 'RRULE:FREQ=MONTHLY;COUNT=3']));
    expect(adapter.read(source, options).events.map((item) => [item.start.date, item.start.time])).toEqual([
      ['2026-10-01', '09:00'], ['2026-10-31', '10:00'],
    ]);
  });

  it('ignores unsupported recurrence rules that cannot contribute busy VEVENT time', () => {
    const cancelled = [
      'BEGIN:VEVENT',
      'UID:cancelled@example.com',
      'SUMMARY:Cancelled',
      'STATUS:CANCELLED',
      ...base,
      'RRULE:FREQ=HOURLY;COUNT=3',
      'END:VEVENT',
    ].join('\r\n');
    const transparent = [
      'BEGIN:VEVENT',
      'UID:transparent@example.com',
      'SUMMARY:Transparent',
      'TRANSP:TRANSPARENT',
      ...base,
      'RRULE:FREQ=WEEKLY;COUNT=3;BYSETPOS=1',
      'END:VEVENT',
    ].join('\r\n');
    const source = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VTIMEZONE',
      'TZID:Custom/Unused',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'RRULE:FREQ=YEARLY;BYSETPOS=1;BYMONTH=1',
      'TZOFFSETFROM:+0000',
      'TZOFFSETTO:+0000',
      'END:STANDARD',
      'END:VTIMEZONE',
      cancelled,
      transparent,
      ['BEGIN:VEVENT', 'UID:busy@example.com', 'SUMMARY:Busy', 'DTSTART;TZID=Australia/Sydney:20261005T100000',
        'DTEND;TZID=Australia/Sydney:20261005T103000', 'END:VEVENT'].join('\r\n'),
      'END:VCALENDAR',
    ].join('\r\n');

    const rows = adapter.read(source, options).events;

    expect(rows.filter((row) => row.busy).map((row) => row.title)).toEqual(['Busy']);
  });

  it('converts recurring DTSTART and DTEND with their own TZID values', () => {
    const source = calendar(event([
      'DTSTART;TZID=Australia/Perth:20261002T090000',
      'DTEND;TZID=Australia/Sydney:20261002T120000',
      'RRULE:FREQ=WEEKLY;COUNT=1',
    ]));

    const rows = adapter.read(source, { ...options, targetTimezone: 'Australia/Perth' }).events;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      start: { date: '2026-10-02', time: '09:00' },
      end: { date: '2026-10-02', time: '10:00' },
    });
  });

  it('converts an RDATE in its own timezone without borrowing the master timezone', () => {
    const source = calendar(event([
      'DTSTART;TZID=Australia/Perth:20261002T090000',
      'DTEND;TZID=Australia/Perth:20261002T093000',
      'RRULE:FREQ=WEEKLY;COUNT=1',
      'RDATE;TZID=America/New_York:20261005T090000',
    ]));
    const rows = adapter.read(source, { ...options, targetTimezone: 'Australia/Perth' }).events;
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ start: { date: '2026-10-05', time: '21:00' }, end: { date: '2026-10-05', time: '21:30' } }),
    ]));
    expect(adapter.read(source, { ...options, targetTimezone: 'Australia/Perth' }).events).toEqual(rows);
  });

  it('interprets a floating RDATE in the requested timezone, including its end', () => {
    const source = calendar(event([
      'DTSTART;TZID=Australia/Perth:20260901T090000',
      'DTEND;TZID=Australia/Perth:20260901T093000',
      'RRULE:FREQ=DAILY;COUNT=1',
      'RDATE:20260902T090000',
    ]));
    const readOptions = { targetTimezone: 'Australia/Sydney', windowStartDate: '2026-09-01', windowEndDate: '2026-09-02' };
    const rows = adapter.read(source, readOptions).events;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ start: { date: '2026-09-01', time: '11:00' }, end: { date: '2026-09-01', time: '11:30' }, sourceTimezone: 'Australia/Perth' });
    expect(rows[1]).toMatchObject({ start: { date: '2026-09-02', time: '09:00' }, end: { date: '2026-09-02', time: '09:30' } });
    expect(rows[1].sourceTimezone).toBeUndefined();
    expect(rows[1].sourceEventId).toBe('work@example.com::2026-09-02T09:00:00');
    expect(adapter.read(source, readOptions).warnings.filter((warning) => warning.includes('Floating calendar time'))).toEqual([
      'Floating calendar time for work@example.com was interpreted in Australia/Sydney.',
    ]);
    expect(adapter.read(source, readOptions).events.map((row) => row.sourceEventId)).toEqual(rows.map((row) => row.sourceEventId));
  });

  it('keeps UTC and explicit-TZID RDATE instants distinct from floating times and identities', () => {
    const source = calendar(event([
      'DTSTART;TZID=Australia/Perth:20260901T090000',
      'DTEND;TZID=Australia/Perth:20260901T093000',
      'RRULE:FREQ=DAILY;COUNT=1',
      'RDATE:20260902T010000Z',
      'RDATE:20260902T090000',
      'RDATE;TZID=America/New_York:20260903T090000',
    ]));
    const readOptions = { targetTimezone: 'Australia/Sydney', windowStartDate: '2026-09-01', windowEndDate: '2026-09-04' };
    const rows = adapter.read(source, readOptions).events;
    expect(rows).toHaveLength(4);
    expect(rows.slice(1).map((row) => [row.start.date, row.start.time, row.end.time, row.sourceTimezone])).toEqual([
      ['2026-09-02', '09:00', '09:30', undefined],
      ['2026-09-02', '11:00', '11:30', undefined],
      ['2026-09-03', '23:00', '23:30', 'America/New_York'],
    ]);
    expect(new Set(rows.map((row) => row.sourceEventId)).size).toBe(rows.length);
    expect(adapter.read(source, readOptions).events.map((row) => row.sourceEventId)).toEqual(rows.map((row) => row.sourceEventId));
  });

  it('keeps distinct UTC and floating recurrence identities when they display at the same time', () => {
    const source = calendar(event([
      'DTSTART;TZID=Australia/Perth:20260901T090000',
      'DTEND;TZID=Australia/Perth:20260901T093000',
      'RRULE:FREQ=DAILY;COUNT=1',
      'RDATE:20260902T230000Z',
      'RDATE:20260903T090000',
    ]));
    const rows = adapter.read(source, { targetTimezone: 'Australia/Sydney', windowStartDate: '2026-09-01', windowEndDate: '2026-09-03' }).events;
    expect(rows.filter((row) => row.start.date === '2026-09-03')).toHaveLength(2);
    expect(rows.filter((row) => row.start.date === '2026-09-03').map((row) => row.start.time)).toEqual(['09:00', '09:00']);
    expect(new Set(rows.map((row) => row.sourceEventId)).size).toBe(rows.length);
  });

  it('keeps all-day RDATE on its calendar date without timezone conversion', () => {
    const source = calendar(event([
      'DTSTART;VALUE=DATE:20260901',
      'DTEND;VALUE=DATE:20260902',
      'RRULE:FREQ=DAILY;COUNT=1',
      'RDATE;VALUE=DATE:20260903',
    ]));
    const rows = adapter.read(source, { targetTimezone: 'Australia/Sydney', windowStartDate: '2026-09-01', windowEndDate: '2026-09-03' }).events;
    expect(rows[1]).toMatchObject({ allDay: true, start: { date: '2026-09-03' }, end: { date: '2026-09-04' } });
    expect(rows[1].sourceTimezone).toBeUndefined();
  });

  it('keeps floating RDATE at 09:00 Sydney across DST and at 09:00 Perth without DST', () => {
    const source = calendar(event([
      'DTSTART;TZID=Australia/Perth:20261001T090000',
      'DTEND;TZID=Australia/Perth:20261001T093000',
      'RRULE:FREQ=DAILY;COUNT=1',
      'RDATE:20261002T090000,20261005T090000',
    ]));
    for (const targetTimezone of ['Australia/Sydney', 'Australia/Perth']) {
      const readOptions = { targetTimezone, windowStartDate: '2026-10-01', windowEndDate: '2026-10-05' };
      const rows = adapter.read(source, readOptions).events.slice(1);
      expect(rows.map((row) => [row.start.date, row.start.time, row.end.time])).toEqual([
        ['2026-10-02', '09:00', '09:30'], ['2026-10-05', '09:00', '09:30'],
      ]);
      expect(adapter.read(source, readOptions).events.slice(1).map((row) => row.sourceEventId)).toEqual(rows.map((row) => row.sourceEventId));
    }
  });

  it('fails closed before expanding an excessive number of recurring series', () => {
    const manySeries = Array.from({ length: 251 }, (_, index) =>
      [
        'BEGIN:VEVENT',
        `UID:aggregate-${index}@example.com`,
        'SUMMARY:Recurring series',
        'DTSTART;TZID=Australia/Sydney:20260907T090000',
        'DTEND;TZID=Australia/Sydney:20260907T093000',
        'RRULE:FREQ=DAILY;COUNT=2',
        'END:VEVENT',
      ].join('\r\n'),
    );
    const source = ['BEGIN:VCALENDAR', 'VERSION:2.0', ...manySeries, 'END:VCALENDAR'].join('\r\n');

    expect(() => adapter.read(source, {
      targetTimezone: 'Australia/Sydney',
      windowStartDate: '2026-09-07',
      windowEndDate: '2026-09-08',
    })).toThrow('Calendar contains too many recurring series for a safe browser read.');
  });
});
