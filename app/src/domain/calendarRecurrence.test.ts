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
