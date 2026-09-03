import { describe, expect, it } from 'vitest';
import { IcsCalendarAdapter } from './calendarAdapter';

const options = {
  targetTimezone: 'Australia/Perth',
  windowStartDate: '2026-09-07',
  windowEndDate: '2026-09-08',
};

function calendar(...events: string[]) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function event(lines: string[]) {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
}

describe('ICS calendar adapter', () => {
  it('imports a UTC event into the requested local timezone', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(event([
      'UID:utc-meeting',
      'SUMMARY:Project review',
      'DTSTART:20260907T010000Z',
      'DTEND:20260907T020000Z',
    ])), options);

    expect(result.warnings).toEqual([]);
    expect(result.events).toEqual([
      {
        adapterId: 'ics',
        sourceEventId: 'utc-meeting',
        title: 'Project review',
        allDay: false,
        start: { date: '2026-09-07', time: '09:00' },
        end: { date: '2026-09-07', time: '10:00' },
        timezone: 'Australia/Perth',
        sourceTimezone: undefined,
      },
    ]);
  });

  it('imports a TZID event and keeps source identity separate from Life Rhythm placement identity', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(event([
      'UID:provider-event-123@example.com',
      'SUMMARY:School appointment',
      'DTSTART;TZID=Australia/Perth:20260907T153000',
      'DTEND;TZID=Australia/Perth:20260907T163000',
    ])), options);

    expect(result.events[0]).toMatchObject({
      sourceEventId: 'provider-event-123@example.com',
      start: { date: '2026-09-07', time: '15:30' },
      end: { date: '2026-09-07', time: '16:30' },
      sourceTimezone: 'Australia/Perth',
    });
  });

  it('imports all-day events using exclusive DTEND dates and skips cancelled events', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(
      event([
        'UID:all-day',
        'SUMMARY:Public holiday',
        'DTSTART;VALUE=DATE:20260907',
        'DTEND;VALUE=DATE:20260908',
      ]),
      event([
        'UID:cancelled',
        'STATUS:CANCELLED',
        'SUMMARY:Cancelled meeting',
        'DTSTART:20260907T010000Z',
        'DTEND:20260907T020000Z',
      ]),
    ), options);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      sourceEventId: 'all-day',
      allDay: true,
      start: { date: '2026-09-07' },
      end: { date: '2026-09-08' },
    });
  });

  it('unfolds ICS lines and reports unsupported recurrence without silently expanding it', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(event([
      'UID:weekly-sync',
      'SUMMARY:Long weekly',
      ' meeting',
      'DTSTART;TZID=Australia/Perth:20260907T090000',
      'DTEND;TZID=Australia/Perth:20260907T093000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
    ])), options);

    expect(result.events[0].title).toBe('Long weeklymeeting');
    expect(result.warnings).toEqual([
      'Recurring event weekly-sync is imported as its DTSTART occurrence only in Gate 2.',
    ]);
  });

  it('warns about floating times and skips malformed event blocks without writing anything', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(
      event([
        'UID:floating',
        'SUMMARY:Floating item',
        'DTSTART:20260907T110000',
        'DTEND:20260907T113000',
      ]),
      event([
        'SUMMARY:Missing identity',
        'DTSTART:20260907T120000Z',
        'DTEND:20260907T123000Z',
      ]),
    ), options);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].start).toEqual({ date: '2026-09-07', time: '11:00' });
    expect(result.warnings).toEqual([
      'Floating calendar time 20260907T110000 was interpreted in Australia/Perth.',
      'Floating calendar time 20260907T113000 was interpreted in Australia/Perth.',
      'A calendar event was skipped because UID, DTSTART or DTEND was missing.',
    ]);
  });

  it('rejects an inverted read window', () => {
    const adapter = new IcsCalendarAdapter();
    expect(() => adapter.read(calendar(), {
      ...options,
      windowStartDate: '2026-09-09',
      windowEndDate: '2026-09-08',
    })).toThrow('Calendar read window start must not be after the end date.');
  });
});
