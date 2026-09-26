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
        busy: true,
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
      adapterId: 'ics',
      sourceEventId: 'provider-event-123@example.com',
      busy: true,
      start: { date: '2026-09-07', time: '15:30' },
      end: { date: '2026-09-07', time: '16:30' },
      sourceTimezone: 'Australia/Perth',
    });
  });

  it('keeps transparent events readable without classifying them as busy', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(event([
      'UID:free-reminder',
      'SUMMARY:Optional reminder',
      'TRANSP:TRANSPARENT',
      'DTSTART;TZID=Australia/Perth:20260907T170000',
      'DTEND;TZID=Australia/Perth:20260907T180000',
    ])), options);

    expect(result.events).toEqual([
      expect.objectContaining({
        adapterId: 'ics',
        sourceEventId: 'free-reminder',
        busy: false,
      }),
    ]);
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
      busy: true,
      start: { date: '2026-09-07' },
      end: { date: '2026-09-08' },
    });
  });

  it('unfolds ICS lines and expands supported recurrence', () => {
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
    expect(result.warnings).toEqual([]);
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

  it('skips an event with an unresolvable TZID without aborting other calendar events', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(
      event([
        'UID:custom-zone',
        'SUMMARY:Unsupported timezone',
        'DTSTART;TZID="Custom/Office":20260907T090000',
        'DTEND;TZID="Custom/Office":20260907T100000',
      ]),
      event([
        'UID:valid-after-bad-zone',
        'SUMMARY:Valid event',
        'DTSTART;TZID=Australia/Perth:20260907T110000',
        'DTEND;TZID=Australia/Perth:20260907T120000',
      ]),
    ), options);

    expect(result.events.map((candidate) => candidate.sourceEventId)).toEqual(['valid-after-bad-zone']);
    expect(result.warnings).toEqual([
      'Calendar event custom-zone was skipped because its timezone or local time could not be resolved.',
    ]);
  });

  it('skips a nonexistent DST local time rather than silently normalizing it', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(event([
      'UID:spring-gap',
      'SUMMARY:Nonexistent local time',
      'DTSTART;TZID=America/New_York:20260308T023000',
      'DTEND;TZID=America/New_York:20260308T033000',
    ])), {
      targetTimezone: 'America/New_York',
      windowStartDate: '2026-03-08',
      windowEndDate: '2026-03-08',
    });

    expect(result.events).toEqual([]);
    expect(result.warnings).toEqual([
      'Calendar event spring-gap was skipped because its timezone or local time could not be resolved.',
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

  it('emits a post-horizon moved recurrence override only once by logical identity', () => {
    const adapter = new IcsCalendarAdapter();
    const source = calendar(
      event([
        'UID:moved-back',
        'SUMMARY:Base meeting',
        'DTSTART;TZID=Australia/Perth:20260907T090000',
        'DTEND;TZID=Australia/Perth:20260907T093000',
        'RRULE:FREQ=DAILY;COUNT=3',
      ]),
      event([
        'UID:moved-back',
        'RECURRENCE-ID;TZID=Australia/Perth:20260909T090000',
        'SUMMARY:Moved into horizon',
        'DTSTART;TZID=Australia/Perth:20260908T150000',
        'DTEND;TZID=Australia/Perth:20260908T153000',
      ]),
    );

    const first = adapter.read(source, options);
    const second = adapter.read(source, options);
    const moved = first.events.filter((candidate) => candidate.title === 'Moved into horizon');

    expect(moved).toHaveLength(1);
    expect(new Set(first.events.map((candidate) => candidate.sourceEventId)).size).toBe(first.events.length);
    expect(moved[0]).toMatchObject({
      start: { date: '2026-09-08', time: '15:00' },
      end: { date: '2026-09-08', time: '15:30' },
    });
    expect(second.events.map((candidate) => candidate.sourceEventId))
      .toEqual(first.events.map((candidate) => candidate.sourceEventId));
  });

  it('does not emit a post-horizon override whose moved time remains outside the window', () => {
    const adapter = new IcsCalendarAdapter();
    const source = calendar(
      event([
        'UID:moved-outside',
        'SUMMARY:Base meeting',
        'DTSTART;TZID=Australia/Perth:20260907T090000',
        'DTEND;TZID=Australia/Perth:20260907T093000',
        'RRULE:FREQ=DAILY;COUNT=3',
      ]),
      event([
        'UID:moved-outside',
        'RECURRENCE-ID;TZID=Australia/Perth:20260909T090000',
        'SUMMARY:Moved outside',
        'DTSTART;TZID=Australia/Perth:20260910T150000',
        'DTEND;TZID=Australia/Perth:20260910T153000',
      ]),
    );

    const result = adapter.read(source, options);

    expect(result.events.some((candidate) => candidate.title === 'Moved outside')).toBe(false);
  });

  it('keeps distinct recurrence identities even when overrides share the same displayed time', () => {
    const adapter = new IcsCalendarAdapter();
    const source = calendar(
      event([
        'UID:shared-time',
        'SUMMARY:Base meeting',
        'DTSTART;TZID=Australia/Perth:20260907T090000',
        'DTEND;TZID=Australia/Perth:20260907T093000',
        'RRULE:FREQ=DAILY;COUNT=4',
      ]),
      event([
        'UID:shared-time',
        'RECURRENCE-ID;TZID=Australia/Perth:20260909T090000',
        'SUMMARY:Moved slot three',
        'DTSTART;TZID=Australia/Perth:20260908T150000',
        'DTEND;TZID=Australia/Perth:20260908T153000',
      ]),
      event([
        'UID:shared-time',
        'RECURRENCE-ID;TZID=Australia/Perth:20260910T090000',
        'SUMMARY:Moved slot four',
        'DTSTART;TZID=Australia/Perth:20260908T150000',
        'DTEND;TZID=Australia/Perth:20260908T153000',
      ]),
    );

    const result = adapter.read(source, options);
    const moved = result.events.filter((candidate) => candidate.start.date === '2026-09-08' && candidate.start.time === '15:00');

    expect(moved).toHaveLength(2);
    expect(new Set(moved.map((candidate) => candidate.sourceEventId)).size).toBe(2);
  });

  it('does not let a moved post-horizon exception bypass COUNT', () => {
    const adapter = new IcsCalendarAdapter();
    const source = calendar(
      event([
        'UID:count-limited',
        'SUMMARY:Count limited',
        'DTSTART;TZID=Australia/Perth:20260907T090000',
        'DTEND;TZID=Australia/Perth:20260907T093000',
        'RRULE:FREQ=DAILY;COUNT=2',
      ]),
      event([
        'UID:count-limited',
        'RECURRENCE-ID;TZID=Australia/Perth:20260909T090000',
        'SUMMARY:Invalid moved slot',
        'DTSTART;TZID=Australia/Perth:20260908T150000',
        'DTEND;TZID=Australia/Perth:20260908T153000',
      ]),
    );

    const result = adapter.read(source, options);

    expect(result.events.some((candidate) => candidate.title === 'Invalid moved slot')).toBe(false);
  });

  it('does not let a moved post-horizon exception bypass EXDATE', () => {
    const adapter = new IcsCalendarAdapter();
    const source = calendar(
      event([
        'UID:excluded-slot',
        'SUMMARY:Excluded slot',
        'DTSTART;TZID=Australia/Perth:20260907T090000',
        'DTEND;TZID=Australia/Perth:20260907T093000',
        'RRULE:FREQ=DAILY;COUNT=3',
        'EXDATE;TZID=Australia/Perth:20260909T090000',
      ]),
      event([
        'UID:excluded-slot',
        'RECURRENCE-ID;TZID=Australia/Perth:20260909T090000',
        'SUMMARY:Excluded moved slot',
        'DTSTART;TZID=Australia/Perth:20260908T150000',
        'DTEND;TZID=Australia/Perth:20260908T153000',
      ]),
    );

    const result = adapter.read(source, options);

    expect(result.events.some((candidate) => candidate.title === 'Excluded moved slot')).toBe(false);
  });
});
