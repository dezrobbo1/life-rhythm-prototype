import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/settingsRepository';
import { settingsSchema } from '../data/schemas';
import { IcsCalendarAdapter } from './calendarAdapter';
import { deriveGate2Availability } from './calendarAvailability';
import { DeterministicScheduler, scheduler } from './scheduler';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  RhythmRequirement,
  SchedulingDomainModel,
} from './schedulingModel';

function intention(
  id: string,
  overrides: Partial<InternalIntention> = {},
): InternalIntention {
  return {
    id,
    title: id,
    area: 'admin',
    taskType: 'admin',
    priority: 'normal',
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 5 },
      { kind: 'normal', label: 'Normal', minutes: 20 },
      { kind: 'full', label: 'Full', minutes: 40 },
    ],
    timing: { timeConstraint: 'flexible' },
    lifecycle: {},
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id }],
    ...overrides,
  };
}

function rhythm(
  id: string,
  overrides: Partial<RhythmRequirement> = {},
): RhythmRequirement {
  return {
    id,
    templateId: id.replace(/^rhythm:/, ''),
    title: id,
    area: 'movement',
    frequency: 2,
    period: 'week',
    preferredDays: [],
    preferredTime: 'anytime',
    maxPerDay: 1,
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 10 },
      { kind: 'normal', label: 'Normal', minutes: 30 },
      { kind: 'full', label: 'Full', minutes: 45 },
    ],
    sourceRecords: [{ kind: 'rhythmTemplate', id: id.replace(/^rhythm:/, '') }],
    ...overrides,
  };
}

function candidate(
  id: string,
  date: string,
  start: string,
  end: string,
): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone: 'Australia/Perth',
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Gate 2 candidate interval.'],
  };
}

function model(overrides: Partial<SchedulingDomainModel> = {}): SchedulingDomainModel {
  return {
    intentions: [],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [
      {
        id: 'workday',
        name: 'Workday',
        kind: 'workday',
        assignedWeekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        usableDay: { start: '06:30', end: '21:30' },
        workPeriod: { start: '08:00', end: '16:00' },
        workPlanningUse: 'allowSuitableTasks',
      },
    ],
    candidateIntervals: [],
    preferences: [],
    ...overrides,
  };
}

function generated(plan: ReturnType<DeterministicScheduler['buildPlan']>) {
  return plan.placements.filter((placement) => placement.origin === 'scheduler');
}

describe('Gate 3 automatic scheduler v0', () => {
  it('automatically places a flexible private task without a per-placement confirmation loop', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [intention('pay-bill')],
      candidateIntervals: [candidate('candidate-morning', '2026-09-07', '09:00', '12:00')],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.unscheduledIntentionIds).toEqual([]);
    expect(plan.unscheduledRhythmIds).toEqual([]);
    expect(generated(plan)).toEqual([
      expect.objectContaining({
        intentionId: 'pay-bill',
        targetKind: 'intention',
        date: '2026-09-07',
        start: '09:00',
        end: '09:20',
        origin: 'scheduler',
        variantKind: 'normal',
      }),
    ]);
    expect(generated(plan)[0].provenance.join(' ')).toContain('Automatically placed');
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('keeps a hard external commitment authoritative even when a candidate interval is stale or too broad', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [
        intention('long-task', {
          variants: [
            { kind: 'minimum', label: 'Minimum', minutes: 90 },
            { kind: 'normal', label: 'Normal', minutes: 90 },
            { kind: 'full', label: 'Full', minutes: 90 },
          ],
        }),
      ],
      candidateIntervals: [candidate('stale-candidate', '2026-09-07', '09:00', '12:00')],
      externalCommitments: [
        {
          id: 'calendar:meeting',
          title: 'Meeting',
          source: 'calendar',
          sourceId: 'meeting',
          interval: {
            kind: 'datedLocal',
            date: '2026-09-07',
            start: '10:00',
            end: '11:00',
            timezone: 'Australia/Perth',
          },
          hard: true,
          travelBeforeMinutes: 0,
          transitionAfterMinutes: 0,
        },
      ],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements).toEqual([]);
    expect(plan.unscheduledIntentionIds).toEqual(['long-task']);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('keeps explicit protected time authoritative even when a candidate interval is stale or too broad', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [intention('admin-task')],
      candidateIntervals: [candidate('stale-candidate', '2026-09-07', '18:00', '19:00')],
      capacityWindows: [
        {
          id: 'family-window',
          title: 'Family time',
          category: 'familyTime',
          interval: {
            kind: 'recurringLocal',
            days: ['Monday'],
            start: '18:00',
            end: '20:00',
          },
          schedulerUse: 'unavailable',
          sourceId: 'family-window',
        },
      ],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements).toEqual([]);
    expect(plan.unscheduledIntentionIds).toEqual(['admin-task']);
  });

  it('falls back to Minimum Done when the normal form cannot fit before a due-by edge', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [
        intention('submit-form', {
          timing: {
            timeConstraint: 'dueBy',
            dueAt: '2026-09-07T09:10:00+08:00',
          },
        }),
      ],
      candidateIntervals: [candidate('short-window', '2026-09-07', '09:00', '09:15')],
    });

    const plan = scheduler.buildPlan(input);
    const placement = generated(plan)[0];

    expect(placement).toMatchObject({
      intentionId: 'submit-form',
      start: '09:00',
      end: '09:05',
      variantKind: 'minimum',
    });
    expect(placement.provenance.join(' ')).toContain('Minimum Done');
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('places a fixed-at intention at its exact local time', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [
        intention('call-school', {
          timing: {
            timeConstraint: 'fixedAt',
            fixedAt: '2026-09-07T10:00:00+08:00',
          },
        }),
      ],
      candidateIntervals: [candidate('morning', '2026-09-07', '09:00', '12:00')],
    });

    const plan = scheduler.buildPlan(input);

    expect(generated(plan)[0]).toMatchObject({
      intentionId: 'call-school',
      start: '10:00',
      end: '10:20',
      variantKind: 'normal',
    });
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('does not place an intention after its usefulness window', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [
        intention('time-sensitive-task', {
          timing: {
            timeConstraint: 'flexible',
            notUsefulAfter: '2026-09-07T10:00:00+08:00',
          },
        }),
      ],
      candidateIntervals: [candidate('late-window', '2026-09-07', '11:00', '12:00')],
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements).toEqual([]);
    expect(plan.unscheduledIntentionIds).toEqual(['time-sensitive-task']);
  });

  it('honours an explicit daily automatic-placement capacity limit', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [intention('task-a'), intention('task-b')],
      candidateIntervals: [candidate('morning', '2026-09-07', '09:00', '12:00')],
      planningPolicy: { maxAutomaticPlacementsPerDay: 1 },
    });

    const plan = scheduler.buildPlan(input);

    expect(generated(plan)).toHaveLength(1);
    expect(plan.unscheduledIntentionIds).toHaveLength(1);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('honours an explicit internal scheduled-minute capacity limit', () => {
    const scheduler = new DeterministicScheduler();
    const noSmallFallback = (id: string) => intention(id, {
      variants: [
        { kind: 'minimum', label: 'Minimum', minutes: 20 },
        { kind: 'normal', label: 'Normal', minutes: 20 },
        { kind: 'full', label: 'Full', minutes: 20 },
      ],
    });
    const input = model({
      intentions: [noSmallFallback('task-a'), noSmallFallback('task-b')],
      candidateIntervals: [candidate('morning', '2026-09-07', '09:00', '12:00')],
      planningPolicy: { maxInternalScheduledMinutesPerDay: 30 },
    });

    const plan = scheduler.buildPlan(input);

    expect(generated(plan)).toHaveLength(1);
    expect(plan.unscheduledIntentionIds).toHaveLength(1);
  });

  it('uses explicit positive time preferences as soft placement guidance', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [intention('admin-task')],
      candidateIntervals: [
        candidate('early', '2026-09-07', '09:00', '10:00'),
        candidate('late', '2026-09-07', '16:00', '17:00'),
      ],
      preferences: [
        {
          id: 'prefer-late-admin',
          targetKind: 'area',
          targetValue: 'admin',
          relation: 'prefer',
          start: '16:00',
          end: '17:00',
          provenance: 'User explicitly prefers admin at 4pm.',
        },
      ],
    });

    const plan = scheduler.buildPlan(input);

    expect(generated(plan)[0]).toMatchObject({ start: '16:00', end: '16:20' });
    expect(generated(plan)[0].provenance.join(' ')).toContain('prefer-late-admin');
  });

  it('uses explicit avoid preferences to move away from a period when another fit exists', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [intention('admin-task')],
      candidateIntervals: [candidate('morning', '2026-09-07', '09:00', '12:00')],
      preferences: [
        {
          id: 'avoid-nine',
          targetKind: 'area',
          targetValue: 'admin',
          relation: 'avoid',
          start: '09:00',
          end: '10:00',
          provenance: 'User explicitly avoids admin before 10.',
        },
      ],
    });

    const plan = scheduler.buildPlan(input);

    expect(generated(plan)[0]).toMatchObject({ start: '10:00', end: '10:20' });
  });

  it('schedules a weekly rhythm to frequency without creating repeating debt on one day', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      rhythms: [
        rhythm('rhythm:exercise', {
          frequency: 2,
          preferredDays: ['Tuesday'],
          preferredTime: 'morning',
          maxPerDay: 1,
        }),
      ],
      candidateIntervals: [
        candidate('mon', '2026-09-07', '09:00', '10:00'),
        candidate('tue', '2026-09-08', '09:00', '10:00'),
        candidate('wed', '2026-09-09', '09:00', '10:00'),
      ],
    });

    const plan = scheduler.buildPlan(input);
    const placements = generated(plan);

    expect(plan.unscheduledRhythmIds).toEqual([]);
    expect(placements).toHaveLength(2);
    expect(new Set(placements.map((placement) => placement.date)).size).toBe(2);
    expect(placements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetKind: 'rhythm',
        rhythmId: 'rhythm:exercise',
        date: '2026-09-08',
        variantKind: 'normal',
      }),
    ]));
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('is deterministic when intention and candidate input order is reversed', () => {
    const scheduler = new DeterministicScheduler();
    const intentions = [
      intention('task-b', { priority: 'important' }),
      intention('task-a', { priority: 'must' }),
      intention('task-c'),
    ];
    const candidates = [
      candidate('later', '2026-09-08', '09:00', '11:00'),
      candidate('earlier', '2026-09-07', '09:00', '11:00'),
    ];

    const first = scheduler.buildPlan(model({ intentions, candidateIntervals: candidates }));
    const second = scheduler.buildPlan(model({
      intentions: [...intentions].reverse(),
      candidateIntervals: [...candidates].reverse(),
    }));

    expect(second.placements).toEqual(first.placements);
    expect(second.unscheduledIntentionIds).toEqual(first.unscheduledIntentionIds);
  });

  it('produces only non-overlapping automatic placements inside supplied candidate intervals', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      intentions: [intention('a'), intention('b'), intention('c'), intention('d')],
      candidateIntervals: [
        candidate('morning', '2026-09-07', '09:00', '10:00'),
        candidate('afternoon', '2026-09-07', '14:00', '15:00'),
      ],
    });

    const plan = scheduler.buildPlan(input);

    expect(scheduler.validatePlan(plan, input)).toEqual([]);
    for (const placement of generated(plan)) {
      const containing = input.candidateIntervals?.some((interval) =>
        interval.date === placement.date &&
        interval.start <= placement.start &&
        placement.end <= interval.end,
      );
      expect(containing).toBe(true);
    }
  });

  it('integrates Gate 2 real calendar availability with Gate 3 automatic placement', () => {
    const base = createDefaultSettings('2026-09-03T00:00:00.000Z');
    const settings = settingsSchema.parse({
      ...base,
      lifeShape: {
        ...base.lifeShape,
        fixedCommitments: [],
        timeBlocks: [],
        usualWorkHours: {
          ...base.lifeShape.usualWorkHours,
          days: ['Monday'],
          start: '08:00',
          end: '16:00',
        },
      },
      dayProfiles: base.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? {
              ...profile,
              usableDay: { start: '09:00', end: '17:00' },
              workPeriod: { start: '08:00', end: '16:00' },
              workPlanningUse: 'allowSuitableTasks',
            }
          : profile,
      ),
    });

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:real-meeting',
      'SUMMARY:Real meeting',
      'DTSTART;TZID=Australia/Perth:20260907T100000',
      'DTEND;TZID=Australia/Perth:20260907T110000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const calendarEvents = new IcsCalendarAdapter().read(ics, {
      targetTimezone: 'Australia/Perth',
      windowStartDate: '2026-09-07',
      windowEndDate: '2026-09-07',
    }).events;
    const availability = deriveGate2Availability({
      settings,
      calendarEvents,
      date: '2026-09-07',
      timezone: 'Australia/Perth',
    });

    const longTask = intention('deep-admin', {
      variants: [
        { kind: 'minimum', label: 'Minimum', minutes: 90 },
        { kind: 'normal', label: 'Normal', minutes: 90 },
        { kind: 'full', label: 'Full', minutes: 90 },
      ],
    });
    const input = model({
      intentions: [longTask],
      externalCommitments: availability.externalCommitments,
      candidateIntervals: availability.candidateIntervals,
      dayProfiles: settings.dayProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        kind: profile.kind,
        assignedWeekdays: settings.weekdayProfileAssignments
          .filter((assignment) => assignment.profileId === profile.id)
          .map((assignment) => assignment.weekday),
        usableDay: profile.usableDay,
        workPeriod: profile.workPeriod,
        workPlanningUse: profile.workPlanningUse,
      })),
    });

    const plan = scheduler.buildPlan(input);

    expect(availability.candidateIntervals.map(({ start, end }) => [start, end])).toEqual([
      ['09:00', '10:00'],
      ['11:00', '17:00'],
    ]);
    expect(generated(plan)[0]).toMatchObject({
      intentionId: 'deep-admin',
      start: '11:00',
      end: '12:30',
      origin: 'scheduler',
    });
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('rejects invalid planning-policy values instead of silently normalising them', () => {
    const scheduler = new DeterministicScheduler();

    expect(() => scheduler.buildPlan(model({
      planningPolicy: { maxInternalScheduledMinutesPerDay: 0 },
    }))).toThrow('maxInternalScheduledMinutesPerDay must be a finite positive number.');

    expect(() => scheduler.buildPlan(model({
      planningPolicy: { maxAutomaticPlacementsPerDay: 1.5 },
    }))).toThrow('maxAutomaticPlacementsPerDay must be a positive integer.');
  });
});
