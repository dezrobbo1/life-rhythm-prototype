import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/settingsRepository';
import { settingsSchema } from '../data/schemas';
import { IcsCalendarAdapter } from './calendarAdapter';
import {
  deriveGate2Availability,
  externalCommitmentsFromCalendarEvents,
} from './calendarAvailability';

function settingsWithUsableWorkday() {
  const base = createDefaultSettings('2026-09-03T00:00:00.000Z');
  return settingsSchema.parse({
    ...base,
    dayProfileMigrationState: { ...base.dayProfileMigrationState, reviewState: 'reviewedAndEnabled', reviewedAt: '2026-09-03T00:00:00.000Z' },
    lifeShape: {
      ...base.lifeShape,
      fixedCommitments: [],
      timeBlocks: [],
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
  });
}

function readEvent(uid: string, transp?: 'TRANSPARENT') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    'SUMMARY:Calendar item',
    ...(transp ? [`TRANSP:${transp}`] : []),
    'DTSTART;TZID=Australia/Perth:20260907T170000',
    'DTEND;TZID=Australia/Perth:20260907T180000',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new IcsCalendarAdapter().read(lines, {
    targetTimezone: 'Australia/Perth',
    windowStartDate: '2026-09-07',
    windowEndDate: '2026-09-07',
  }).events[0];
}

describe('Gate 2 calendar availability edge semantics', () => {
  it('keeps user-authored protected and ask-first blocks inside work-only time even if labels resemble core work', () => {
    const base = settingsWithUsableWorkday();
    const settings = settingsSchema.parse({
      ...base,
      dayProfiles: base.dayProfiles.map((profile) => profile.kind === 'workday'
        ? { ...profile, workPlanningUse: 'workRhythmsOnly' }
        : profile),
      lifeShape: { ...base.lifeShape, timeBlocks: [
        { id: 'lunch', label: 'work period lunch', type: 'protectedTime', schedulerUse: 'unavailable', days: ['Monday'], start: '12:00', end: '13:00' },
        { id: 'review', label: 'work period review', type: 'looseTime', schedulerUse: 'askFirst', days: ['Monday'], start: '14:00', end: '14:30' },
      ] },
    });
    const result = deriveGate2Availability({ settings, calendarEvents: [], date: '2026-09-07', timezone: 'Australia/Perth' });
    expect(result.candidateIntervals.filter((interval) => interval.workOnly).map(({ start, end }) => [start, end])).toEqual([
      ['08:00', '12:00'], ['13:00', '14:00'], ['14:30', '16:00'],
    ]);
  });

  it('does not turn a transparent calendar event into a hard scheduling commitment', () => {
    const event = readEvent('free-reminder', 'TRANSPARENT');

    expect(event.busy).toBe(false);
    expect(externalCommitmentsFromCalendarEvents([event])).toEqual([]);

    const result = deriveGate2Availability({
      settings: settingsWithUsableWorkday(),
      calendarEvents: [event],
      date: '2026-09-07',
      timezone: 'Australia/Perth',
    });

    expect(result.candidateIntervals.map(({ start, end }) => [start, end])).toEqual([
      ['06:30', '08:00'],
      ['16:00', '21:30'],
    ]);
  });

  it('keeps distinct external source identities distinct even when punctuation differs', () => {
    const colon = readEvent('source:a');
    const underscore = readEvent('source_a');
    const commitments = externalCommitmentsFromCalendarEvents([colon, underscore]);

    expect(commitments).toHaveLength(2);
    expect(new Set(commitments.map((commitment) => commitment.id)).size).toBe(2);
    expect(commitments.map((commitment) => commitment.sourceId).sort()).toEqual(['source:a', 'source_a']);
  });

  it('rejects invalid candidate interval tuning inputs instead of producing nonsense', () => {
    const base = {
      settings: settingsWithUsableWorkday(),
      calendarEvents: [],
      date: '2026-09-07',
      timezone: 'Australia/Perth',
    };

    expect(() => deriveGate2Availability({
      ...base,
      uncertaintyReserveMinutes: -1,
    })).toThrow('uncertaintyReserveMinutes must be a finite non-negative number.');

    expect(() => deriveGate2Availability({
      ...base,
      minimumCandidateMinutes: 0,
    })).toThrow('minimumCandidateMinutes must be a finite positive number.');
  });

  it('carries before-event spacing into the previous local date', () => {
    const event = {
      adapterId: 'ics',
      sourceEventId: 'after-midnight',
      title: 'After midnight meeting',
      allDay: false,
      busy: true,
      start: { date: '2026-09-08', time: '00:30' },
      end: { date: '2026-09-08', time: '01:00' },
      timezone: 'Australia/Perth',
    };
    const commitments = externalCommitmentsFromCalendarEvents([event], 60, 0);
    expect(commitments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        interval: expect.objectContaining({ kind: 'datedLocal', date: '2026-09-07', start: '23:30', end: '24:00' }),
        travelBeforeMinutes: 0,
        transitionAfterMinutes: 0,
      }),
    ]));
  });

  it('carries after-event spacing into the next local date', () => {
    const event = {
      adapterId: 'ics',
      sourceEventId: 'before-midnight',
      title: 'Late meeting',
      allDay: false,
      busy: true,
      start: { date: '2026-09-07', time: '23:30' },
      end: { date: '2026-09-07', time: '23:45' },
      timezone: 'Australia/Perth',
    };
    const commitments = externalCommitmentsFromCalendarEvents([event], 0, 60);
    expect(commitments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        interval: expect.objectContaining({ kind: 'datedLocal', date: '2026-09-08', start: '00:00', end: '00:45' }),
        travelBeforeMinutes: 0,
        transitionAfterMinutes: 0,
      }),
    ]));
  });

  it('carries all-day source spacing onto adjacent local dates', () => {
    const event = {
      adapterId: 'ics',
      sourceEventId: 'all-day',
      title: 'All-day commitment',
      allDay: true,
      busy: true,
      start: { date: '2026-09-07' },
      end: { date: '2026-09-08' },
      timezone: 'Australia/Perth',
    };
    const commitments = externalCommitmentsFromCalendarEvents([event], 60, 60);
    expect(commitments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        interval: expect.objectContaining({ date: '2026-09-06', start: '23:00', end: '24:00' }),
      }),
      expect.objectContaining({
        interval: expect.objectContaining({ date: '2026-09-08', start: '00:00', end: '01:00' }),
      }),
    ]));
  });
});
