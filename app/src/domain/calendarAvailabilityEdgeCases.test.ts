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
});
