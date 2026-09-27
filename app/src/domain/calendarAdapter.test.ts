import { describe, expect, it } from 'vitest';
import { IcsCalendarAdapter } from './calendarAdapter';
import { externalCommitmentsFromCalendarEvents } from './calendarAvailability';

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
  it('rejects an overflowing busy all-day duration before commitment expansion', () => {
    const source = calendar(event([
      'UID:huge-day', 'DTSTART;VALUE=DATE:20260101', 'DURATION:P100000000D',
    ]));
    expect(() => new IcsCalendarAdapter().read(source, {
      targetTimezone: 'UTC', windowStartDate: '2026-01-01', windowEndDate: '2026-01-02',
    })).toThrow();
    const read = (duration: string) => new IcsCalendarAdapter().read(
      source.replace('P100000000D', duration),
      { targetTimezone: 'UTC', windowStartDate: '2026-01-01', windowEndDate: '2026-01-02' },
    ).events[0];
    expect(read('P1D').end.date).toBe('2026-01-02');
    expect(read('P1W').end.date).toBe('2026-01-08');
    expect(read('P10000D').end.date).toBe('2053-05-19');
    for (const invalid of ['P10001D', 'P0D', '-P1D']) expect(() => read(invalid)).toThrow();
    expect(() => read('P1D')).not.toThrow();
  });

  it('skips a malformed transparent duration without hiding a valid busy event', () => {
    const source = calendar(event([
      'UID:free-invalid', 'TRANSP:TRANSPARENT',
      'DTSTART:20260907T010000Z', 'DTEND:20260907T020000Z', 'DURATION:PT1H',
    ]), event([
      'UID:busy-valid', 'DTSTART:20260907T030000Z', 'DTEND:20260907T040000Z',
    ]));
    const result = new IcsCalendarAdapter().read(source, options);
    expect(result.events.map((entry) => entry.sourceEventId)).toEqual(['busy-valid']);
    expect(result.warnings).toEqual([expect.stringContaining('skipped')]);
    expect(() => new IcsCalendarAdapter().read(source.replace('TRANSP:TRANSPARENT', 'TRANSP:OPAQUE'), options)).toThrow();
    const malformed = source.replace('DTEND:20260907T020000Z', '').replace('DURATION:PT1H', 'DURATION:PT0H');
    expect(new IcsCalendarAdapter().read(malformed, options).events.map((entry) => entry.sourceEventId)).toEqual(['busy-valid']);
  });

  it('resolves a nominal day end landing in Sydney spring gap while rejecting an authored gap start', () => {
    const source = calendar(event([
      'UID:nominal-gap', 'DTSTART;TZID=Australia/Sydney:20261003T023000', 'DURATION:P1D',
      'RRULE:FREQ=DAILY;COUNT=1',
    ]));
    const result = new IcsCalendarAdapter().read(source, {
      targetTimezone: 'Australia/Sydney', windowStartDate: '2026-10-03', windowEndDate: '2026-10-04',
    });
    expect(result.events[0]).toMatchObject({ start: { date: '2026-10-03', time: '02:30' }, end: { date: '2026-10-04', time: '03:30' } });
    const asUtc = new IcsCalendarAdapter().read(source, {
      targetTimezone: 'UTC', windowStartDate: '2026-10-02', windowEndDate: '2026-10-04',
    }).events[0];
    expect(asUtc).toMatchObject({ end: { date: '2026-10-03', time: '16:30' } });
    const mixed = source.replace('DURATION:P1D', 'DURATION:P1DT1H');
    expect(new IcsCalendarAdapter().read(mixed, {
      targetTimezone: 'Australia/Sydney', windowStartDate: '2026-10-03', windowEndDate: '2026-10-04',
    }).events[0].end).toEqual({ date: '2026-10-04', time: '04:30' });
    const moved = calendar(event([
      'UID:gap-override', 'DTSTART;TZID=Australia/Sydney:20261002T023000',
      'DTEND;TZID=Australia/Sydney:20261002T030000', 'RRULE:FREQ=DAILY;COUNT=2',
    ]), event([
      'UID:gap-override', 'RECURRENCE-ID;TZID=Australia/Sydney:20261003T023000',
      'DTSTART;TZID=Australia/Sydney:20261003T023000', 'DURATION:P1D',
    ]));
    expect(new IcsCalendarAdapter().read(moved, {
      targetTimezone: 'Australia/Sydney', windowStartDate: '2026-10-02', windowEndDate: '2026-10-04',
    }).events.find((entry) => entry.start.date === '2026-10-03')).toMatchObject({
      end: { date: '2026-10-04', time: '03:30' },
    });
    const halfHourGap = source.replace('Australia/Sydney', 'Australia/Lord_Howe')
      .replace(/023000/g, '021500');
    expect(new IcsCalendarAdapter().read(halfHourGap, {
      targetTimezone: 'Australia/Lord_Howe', windowStartDate: '2026-10-03', windowEndDate: '2026-10-04',
    }).events[0].end).toEqual({ date: '2026-10-04', time: '02:45' });
    expect(() => new IcsCalendarAdapter().read(source.replace('20261003T023000', '20261004T023000'), {
      targetTimezone: 'Australia/Sydney', windowStartDate: '2026-10-04', windowEndDate: '2026-10-05',
    })).toThrow();
  });
  it('keeps an elapsed-hour moved exception across Sydney spring-forward', () => {
    const source = calendar(event([
      'UID:duration-spring', 'SUMMARY:Master',
      'DTSTART;TZID=Australia/Sydney:20261003T013000',
      'DTEND;TZID=Australia/Sydney:20261003T020000', 'RRULE:FREQ=DAILY;COUNT=2',
    ]), event([
      'UID:duration-spring', 'RECURRENCE-ID;TZID=Australia/Sydney:20261004T013000',
      'SUMMARY:Moved', 'DTSTART;TZID=Australia/Sydney:20261004T013000', 'DURATION:PT1H',
    ]));
    const events = new IcsCalendarAdapter().read(source, {
      targetTimezone: 'Australia/Sydney', windowStartDate: '2026-10-03', windowEndDate: '2026-10-04',
    }).events;
    expect(events.find((item) => item.title === 'Moved')).toMatchObject({
      start: { date: '2026-10-04', time: '01:30' }, end: { date: '2026-10-04', time: '03:30' },
    });
    expect(new IcsCalendarAdapter().read(source, {
      targetTimezone: 'UTC', windowStartDate: '2026-10-03', windowEndDate: '2026-10-04',
    }).events.find((item) => item.title === 'Moved')).toMatchObject({
      start: { date: '2026-10-03', time: '15:30' }, end: { date: '2026-10-03', time: '16:30' },
    });
    expect(new IcsCalendarAdapter().read(source, {
      targetTimezone: 'Australia/Sydney', windowStartDate: '2026-10-03', windowEndDate: '2026-10-04',
    }).events.map((item) => item.sourceEventId)).toEqual(events.map((item) => item.sourceEventId));
  });

  it.each([
    ['spring elapsed', '20261004T013000', 'PT1H', '2026-10-04', '03:30'],
    ['fall elapsed', '20260405T013000', 'PT2H', '2026-04-05', '02:30'],
    ['spring nominal day', '20261003T090000', 'P1D', '2026-10-04', '09:00'],
    ['spring accurate day', '20261003T090000', 'PT24H', '2026-10-04', '10:00'],
    ['fall nominal day', '20260404T090000', 'P1D', '2026-04-05', '09:00'],
    ['fall accurate day', '20260404T090000', 'PT24H', '2026-04-05', '08:00'],
    ['nominal then accurate', '20261003T090000', 'P1DT1H', '2026-10-04', '10:00'],
  ])('%s applies RFC nominal and accurate duration in order', (_name, start, duration, endDate, endTime) => {
    const source = calendar(event([
      `UID:duration-${start}`, 'SUMMARY:Timed', `DTSTART;TZID=Australia/Sydney:${start}`,
      `DURATION:${duration}`, 'RRULE:FREQ=DAILY;COUNT=1',
    ]));
    const [item] = new IcsCalendarAdapter().read(source, {
      targetTimezone: 'Australia/Sydney', windowStartDate: start.slice(0, 4) + '-04-01', windowEndDate: '2026-10-05',
    }).events;
    expect(item).toMatchObject({ end: { date: endDate, time: endTime } });
  });

  it('distinguishes authored DTEND, UTC, floating, and all-day DURATION', () => {
    const read = (lines: string[], targetTimezone = 'Australia/Sydney') => new IcsCalendarAdapter().read(
      calendar(event(['UID:duration-forms', 'SUMMARY:Forms', ...lines])),
      { targetTimezone, windowStartDate: '2026-10-03', windowEndDate: '2026-10-05' },
    ).events[0];
    expect(read(['DTSTART;TZID=Australia/Sydney:20261004T013000', 'DURATION:PT1H'])).toMatchObject({
      start: { time: '01:30' }, end: { time: '03:30' },
    });
    expect(read(['DTSTART;TZID=Australia/Sydney:20261004T013000',
      'DTEND;TZID=Australia/Sydney:20261004T033000'])).toMatchObject({ end: { time: '03:30' } });
    expect(read(['DTSTART:20261003T153000Z', 'DURATION:PT1H'])).toMatchObject({
      start: { time: '01:30' }, end: { time: '03:30' },
    });
    expect(read(['DTSTART:20261004T013000', 'DURATION:PT1H'])).toMatchObject({
      start: { time: '01:30' }, end: { time: '03:30' },
    });
    expect(read(['DTSTART;VALUE=DATE:20261004', 'DURATION:P1D'])).toMatchObject({
      allDay: true, start: { date: '2026-10-04' }, end: { date: '2026-10-05' },
    });
    expect(() => read(['DTSTART;VALUE=DATE:20261004', 'DURATION:PT24H'])).toThrow();
    expect(() => read(['DTSTART;TZID=Australia/Sydney:20261004T023000', 'DURATION:PT1H'])).toThrow();
    expect(() => read(['DTSTART;TZID=Australia/Sydney:20261004T013000', 'DURATION:-PT1H'])).toThrow();
  });

  it('uses an explicit RDATE timezone and the first repeated instant for elapsed duration', () => {
    const source = calendar(event([
      'UID:duration-rdate', 'SUMMARY:Series',
      'DTSTART;TZID=Australia/Perth:20260404T090000', 'DURATION:PT2H',
      'RDATE;TZID=Australia/Sydney:20260405T023000',
    ]));
    const options = { targetTimezone: 'UTC', windowStartDate: '2026-04-04', windowEndDate: '2026-04-05' };
    const first = new IcsCalendarAdapter().read(source, options).events;
    expect(first.find((item) => item.start.time === '15:30')).toMatchObject({
      start: { date: '2026-04-04', time: '15:30' }, end: { date: '2026-04-04', time: '17:30' },
      sourceTimezone: 'Australia/Sydney',
    });
    expect(new IcsCalendarAdapter().read(source, options).events.map((item) => item.sourceEventId))
      .toEqual(first.map((item) => item.sourceEventId));
  });

  it('retains two elapsed hours when Sydney falls back', () => {
    const source = calendar(event([
      'UID:duration-fall', 'SUMMARY:Fall',
      'DTSTART;TZID=Australia/Sydney:20260405T013000', 'DURATION:PT2H',
      'RRULE:FREQ=DAILY;COUNT=1',
    ]));
    const result = new IcsCalendarAdapter().read(source, {
      targetTimezone: 'UTC', windowStartDate: '2026-04-04', windowEndDate: '2026-04-05',
    });
    expect(result.events[0]).toMatchObject({
      start: { date: '2026-04-04', time: '14:30' }, end: { date: '2026-04-04', time: '16:30' },
    });
  });
  it('retains a moved Perth exception four-hour DURATION under a Sydney master', () => {
    const source = calendar(event([
      'UID:duration-zone', 'SUMMARY:Master',
      'DTSTART;TZID=Australia/Sydney:20260907T090000',
      'DTEND;TZID=Australia/Sydney:20260907T093000',
      'RRULE:FREQ=DAILY;COUNT=2',
    ]), event([
      'UID:duration-zone', 'RECURRENCE-ID;TZID=Australia/Sydney:20260908T090000',
      'SUMMARY:Moved', 'DTSTART;TZID=Australia/Perth:20260908T090000',
      'DURATION:PT4H',
    ]));
    const events = new IcsCalendarAdapter().read(source, {
      targetTimezone: 'Australia/Perth', windowStartDate: '2026-09-07', windowEndDate: '2026-09-08',
    }).events;
    expect(events.find((item) => item.title === 'Moved')).toMatchObject({
      start: { date: '2026-09-08', time: '09:00' }, end: { date: '2026-09-08', time: '13:00' },
      sourceTimezone: 'Australia/Perth',
    });
    const commitments = externalCommitmentsFromCalendarEvents(events.filter((item) => item.title === 'Moved'), 15, 20);
    expect(commitments).toEqual([expect.objectContaining({
      interval: expect.objectContaining({ start: '09:00', end: '13:00' }),
      travelBeforeMinutes: 15, transitionAfterMinutes: 20,
    })]);
    const explicit = source.replace('DURATION:PT4H', 'DTEND;TZID=Australia/Perth:20260908T130000');
    expect(new IcsCalendarAdapter().read(explicit, {
      targetTimezone: 'Australia/Perth', windowStartDate: '2026-09-07', windowEndDate: '2026-09-08',
    }).events.find((item) => item.title === 'Moved')).toEqual(events.find((item) => item.title === 'Moved'));
  });

  it('uses UTC and floating exception starts for their own duration-derived ends', () => {
    const master = event([
      'UID:duration-form', 'SUMMARY:Master',
      'DTSTART;TZID=Australia/Sydney:20260907T090000',
      'DTEND;TZID=Australia/Sydney:20260907T093000', 'RRULE:FREQ=DAILY;COUNT=2',
    ]);
    const override = (start: string) => event([
      'UID:duration-form', 'RECURRENCE-ID;TZID=Australia/Sydney:20260908T090000',
      'SUMMARY:Override', start, 'DURATION:PT4H',
    ]);
    const read = (start: string) => new IcsCalendarAdapter().read(calendar(master, override(start)), {
      targetTimezone: 'Australia/Perth', windowStartDate: '2026-09-07', windowEndDate: '2026-09-08',
    }).events.find((item) => item.title === 'Override');
    expect(read('DTSTART:20260908T010000Z')).toMatchObject({
      start: { date: '2026-09-08', time: '09:00' }, end: { date: '2026-09-08', time: '13:00' },
    });
    expect(read('DTSTART:20260908T090000')).toMatchObject({
      start: { date: '2026-09-08', time: '09:00' }, end: { date: '2026-09-08', time: '13:00' },
    });
  });

  it('resolves a duration-derived moved exception at the first repeated Sydney instant and rejects a spring gap', () => {
    const moved = calendar(event([
      'UID:ambiguous-duration', 'SUMMARY:Master',
      'DTSTART;TZID=Australia/Sydney:20260404T023000',
      'DTEND;TZID=Australia/Sydney:20260404T024500',
      'RRULE:FREQ=DAILY;COUNT=2',
    ]), event([
      'UID:ambiguous-duration', 'RECURRENCE-ID;TZID=Australia/Sydney:20260405T023000',
      'SUMMARY:Moved', 'DTSTART;TZID=Australia/Sydney:20260405T023000', 'DURATION:PT15M',
    ]));
    const options = { targetTimezone: 'UTC', windowStartDate: '2026-04-04', windowEndDate: '2026-04-05' };
    const result = new IcsCalendarAdapter().read(moved, options);
    expect(result.events.find((item) => item.title === 'Moved')).toMatchObject({
      start: { date: '2026-04-04', time: '15:30' }, end: { date: '2026-04-04', time: '15:45' },
    });
    expect(new IcsCalendarAdapter().read(moved, options).events.map((item) => item.sourceEventId))
      .toEqual(result.events.map((item) => item.sourceEventId));
    const gap = moved.split('20260404').join('20261003').split('20260405').join('20261004');
    expect(() => new IcsCalendarAdapter().read(gap, {
      targetTimezone: 'UTC', windowStartDate: '2026-10-03', windowEndDate: '2026-10-04',
    })).toThrow();
  });

  it('scans both first post-window Kiritimati RDATEs that map into Pago Pago', () => {
    const source = calendar(event([
      'UID:dateline-rdates', 'SUMMARY:Dateline events',
      'DTSTART;TZID=Pacific/Kiritimati:20261001T001000',
      'DTEND;TZID=Pacific/Kiritimati:20261001T004000',
      'RDATE;TZID=Pacific/Kiritimati:20261003T001000,20261003T003000,20261005T001000',
    ]));
    const options = { targetTimezone: 'Pacific/Pago_Pago', windowStartDate: '2026-10-01', windowEndDate: '2026-10-02' };
    const first = new IcsCalendarAdapter().read(source, options).events;
    const second = new IcsCalendarAdapter().read(source, options).events;
    expect(first.filter((item) => item.start.date === '2026-10-01').map((item) => item.start.time)).toEqual(['23:10', '23:30']);
    expect(first.map((item) => item.sourceEventId)).toEqual(second.map((item) => item.sourceEventId));
    expect(new Set(first.map((item) => item.sourceEventId)).size).toBe(first.length);
    expect(new IcsCalendarAdapter().read(source, {
      ...options, windowEndDate: '2026-10-01',
    }).events.map((item) => item.start.time)).toEqual(['23:10', '23:30']);
  });
  it('selects the first occurrence of repeated Sydney 02:30 and retains its actual duration', () => {
    const adapter = new IcsCalendarAdapter();
    const result = adapter.read(calendar(event([
      'UID:repeated-wall-time',
      'SUMMARY:Repeated time',
      'DTSTART;TZID=Australia/Sydney:20260405T023000',
      'DTEND;TZID=Australia/Sydney:20260405T024500',
    ])), { targetTimezone: 'UTC', windowStartDate: '2026-04-04', windowEndDate: '2026-04-05' });
    expect(result.events[0]).toMatchObject({
      start: { date: '2026-04-04', time: '15:30' }, end: { date: '2026-04-04', time: '15:45' },
    });
    const [commitment] = externalCommitmentsFromCalendarEvents(result.events, 10, 5);
    expect(commitment).toMatchObject({ interval: { start: '15:30', end: '15:45' }, travelBeforeMinutes: 10, transitionAfterMinutes: 5 });
  });

  it('handles a repeated half-hour offset and a quarter-hour IANA offset without host-local time', () => {
    const adapter = new IcsCalendarAdapter();
    const options = { targetTimezone: 'UTC', windowStartDate: '2026-04-04', windowEndDate: '2026-04-05' };
    const lordHowe = adapter.read(calendar(event([
      'UID:lord-howe-fallback', 'SUMMARY:Repeated half-hour',
      'DTSTART;TZID=Australia/Lord_Howe:20260405T014500',
      'DTEND;TZID=Australia/Lord_Howe:20260405T015000',
    ])), options).events;
    expect(lordHowe[0]).toMatchObject({
      start: { date: '2026-04-04', time: '14:45' }, end: { date: '2026-04-04', time: '14:50' },
    });
    const kathmandu = adapter.read(calendar(event([
      'UID:kathmandu-offset', 'SUMMARY:Quarter-hour zone',
      'DTSTART;TZID=Asia/Kathmandu:20260405T090030',
      'DTEND;TZID=Asia/Kathmandu:20260405T093030',
    ])), options).events;
    expect(kathmandu[0]).toMatchObject({
      start: { date: '2026-04-05', time: '03:15' }, end: { date: '2026-04-05', time: '03:45' },
    });
  });
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

  it('fails closed when any busy event has an unresolvable TZID, even alongside valid events', () => {
    const adapter = new IcsCalendarAdapter();
    expect(() => adapter.read(calendar(
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
    ), options)).toThrow('Busy calendar event custom-zone has an unresolved timezone or local time.');
  });

  it('fails closed on a nonexistent busy DST local time rather than silently normalizing it', () => {
    const adapter = new IcsCalendarAdapter();
    expect(() => adapter.read(calendar(event([
      'UID:spring-gap',
      'SUMMARY:Nonexistent local time',
      'DTSTART;TZID=America/New_York:20260308T023000',
      'DTEND;TZID=America/New_York:20260308T033000',
    ])), {
      targetTimezone: 'America/New_York',
      windowStartDate: '2026-03-08',
      windowEndDate: '2026-03-08',
    })).toThrow('Busy calendar event spring-gap has an unresolved timezone or local time.');
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
