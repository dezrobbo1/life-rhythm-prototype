import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/settingsRepository';
import { settingsSchema } from '../data/schemas';
import { IcsCalendarAdapter } from './calendarAdapter';
import {
  deriveGate2Availability,
  externalCommitmentsFromCalendarEvents,
} from './calendarAvailability';

function gate2Settings(overrides: Record<string, unknown> = {}) {
  const base = createDefaultSettings('2026-09-03T00:00:00.000Z');

  return settingsSchema.parse({
    ...base,
    lifeShape: {
      ...base.lifeShape,
      fixedCommitments: [],
      sleepWakeAnchors: { wake: '06:30', sleep: '21:30' },
      usualWorkHours: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        start: '08:00',
        end: '16:00',
      },
      timeBlocks: [
        {
          id: 'family-evening',
          label: 'Family evening',
          type: 'familyTime',
          days: ['Monday'],
          start: '18:00',
          end: '20:00',
          schedulerUse: 'unavailable',
        },
      ],
      ...(overrides.lifeShape as object | undefined),
    },
    dayProfiles: base.dayProfiles.map((profile) =>
      profile.kind === 'workday'
        ? {
            ...profile,
            usableDay: { start: '06:30', end: '21:30' },
            workPeriod: { start: '08:00', end: '16:00' },
            workPlanningUse: 'unavailable',
          }
        : profile,
    ),
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'lifeShape')),
  });
}

const adapter = new IcsCalendarAdapter();

function calendarEvent(start = '20260907T170000', end = '20260907T180000') {
  const source = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:calendar-commitment@example.com',
    'SUMMARY:Real calendar meeting',
    `DTSTART;TZID=Australia/Perth:${start}`,
    `DTEND;TZID=Australia/Perth:${end}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return adapter.read(source, {
    targetTimezone: 'Australia/Perth',
    windowStartDate: '2026-09-07',
    windowEndDate: '2026-09-07',
  }).events;
}

describe('Gate 2 calendar-aware availability', () => {
  it('derives candidate intervals from usable-day boundaries minus work, calendar and protected time', () => {
    const result = deriveGate2Availability({
      settings: gate2Settings(),
      calendarEvents: calendarEvent(),
      date: '2026-09-07',
      timezone: 'Australia/Perth',
    });

    expect(result.profileId).toBeTruthy();
    expect(result.usableDay).toEqual({
      start: '06:30',
      end: '21:30',
      source: 'dayProfile',
    });
    expect(result.candidateIntervals.map(({ start, end }) => [start, end])).toEqual([
      ['06:30', '08:00'],
      ['16:00', '17:00'],
      ['20:00', '21:30'],
    ]);
    expect(result.candidateIntervals.every((interval) => interval.capacityMeaning === 'candidate-not-capacity')).toBe(true);
    expect(result.candidateIntervals[0].provenance.join(' ')).toContain('not a claim that blank calendar time is productive capacity');
  });

  it('keeps external calendar identity separate from private Life Rhythm placement identity', () => {
    const commitments = externalCommitmentsFromCalendarEvents(calendarEvent());

    expect(commitments).toHaveLength(1);
    expect(commitments[0]).toMatchObject({
      source: 'calendar',
      sourceId: 'calendar-commitment@example.com',
      hard: true,
    });
    expect(commitments[0].id).toMatch(/^calendar:ics:/);
    expect(commitments[0].id).not.toMatch(/^placement:/);
  });

  it('preserves known travel-before and transition-after edges on explicit fixed commitments', () => {
    const settings = gate2Settings({
      lifeShape: {
        fixedCommitments: [
          {
            id: 'school-run',
            label: 'School run',
            days: ['Monday'],
            start: '07:00',
            end: '07:30',
            travelMinutes: 10,
            bufferMinutes: 5,
          },
        ],
        timeBlocks: [],
      },
    });

    const result = deriveGate2Availability({
      settings,
      calendarEvents: [],
      date: '2026-09-07',
      timezone: 'Australia/Perth',
    });

    expect(result.candidateIntervals.map(({ start, end }) => [start, end])).toEqual([
      ['06:30', '06:50'],
      ['07:35', '08:00'],
      ['16:00', '21:30'],
    ]);
  });

  it('keeps ask-first time out of automatic candidate intervals while not requiring open-capacity blocks', () => {
    const settings = gate2Settings({
      lifeShape: {
        timeBlocks: [
          {
            id: 'ask-first',
            label: 'Loose family flow',
            type: 'looseTime',
            days: ['Monday'],
            start: '16:00',
            end: '17:00',
            schedulerUse: 'askFirst',
          },
          {
            id: 'open-capacity',
            label: 'Old open capacity marker',
            type: 'openCapacity',
            days: ['Monday'],
            start: '17:00',
            end: '18:00',
            schedulerUse: 'available',
          },
        ],
      },
    });

    const result = deriveGate2Availability({
      settings,
      calendarEvents: [],
      date: '2026-09-07',
      timezone: 'Australia/Perth',
    });

    expect(result.candidateIntervals.map(({ start, end }) => [start, end])).toEqual([
      ['06:30', '08:00'],
      ['17:00', '21:30'],
    ]);
  });

  it('can retain an explicit uncertainty reserve without treating it as a universal ADHD buffer', () => {
    const result = deriveGate2Availability({
      settings: gate2Settings(),
      calendarEvents: [],
      date: '2026-09-07',
      timezone: 'Australia/Perth',
      uncertaintyReserveMinutes: 10,
    });

    expect(result.candidateIntervals.map(({ start, end }) => [start, end])).toEqual([
      ['06:30', '07:50'],
      ['16:00', '17:50'],
      ['20:00', '21:20'],
    ]);
    expect(result.candidateIntervals[0].provenance.join(' ')).toContain('10 minutes of uncertainty reserve');
  });

  it('uses current sleep/wake anchors as a non-persisting fallback when a day profile has no usable-day envelope', () => {
    const base = gate2Settings();
    const settings = settingsSchema.parse({
      ...base,
      lifeShape: {
        ...base.lifeShape,
        sleepWakeAnchors: { wake: '07:00', sleep: '22:00' },
        timeBlocks: [],
      },
      dayProfiles: base.dayProfiles.map((profile) => ({
        ...profile,
        usableDay: undefined,
      })),
    });

    const result = deriveGate2Availability({
      settings,
      calendarEvents: [],
      date: '2026-09-07',
      timezone: 'Australia/Perth',
    });

    expect(result.usableDay).toEqual({
      start: '07:00',
      end: '22:00',
      source: 'sleepWakeFallback',
    });
    expect(result.warnings).toContain(
      'The day profile has no explicit usable-day envelope yet; current sleep/wake anchors were used as a non-persisting fallback.',
    );
  });

  it('blocks an imported all-day event across the usable envelope', () => {
    const allDaySource = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:holiday',
      'SUMMARY:Holiday',
      'DTSTART;VALUE=DATE:20260907',
      'DTEND;VALUE=DATE:20260908',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const calendarEvents = adapter.read(allDaySource, {
      targetTimezone: 'Australia/Perth',
      windowStartDate: '2026-09-07',
      windowEndDate: '2026-09-07',
    }).events;

    const result = deriveGate2Availability({
      settings: gate2Settings({ lifeShape: { timeBlocks: [] } }),
      calendarEvents,
      date: '2026-09-07',
      timezone: 'Australia/Perth',
    });

    expect(result.candidateIntervals).toEqual([]);
  });

  it('rejects overnight usable-day envelopes at the current validated settings boundary', () => {
    const base = gate2Settings();
    const parsed = settingsSchema.safeParse({
      ...base,
      dayProfiles: base.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? { ...profile, usableDay: { start: '22:00', end: '06:00' } }
          : profile,
      ),
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected the current settings schema to reject an overnight usable-day envelope.');
    expect(parsed.error.issues).toEqual([
      expect.objectContaining({
        message: 'End must be later than start.',
        path: ['dayProfiles', 0, 'usableDay', 'end'],
      }),
    ]);
  });
});
