import { describe, expect, it } from 'vitest';
import { clipSchedulingInputToNow } from './elapsedTimeCapacity';
import { DeterministicScheduler } from './scheduler';
import type {
  CandidateSchedulingInterval,
  InternalPlacement,
  RhythmRequirement,
  SchedulingDomainModel,
  SchedulingPreference,
} from './schedulingModel';

const timezone = 'Australia/Perth';

const crossMondayDates = [
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
];

const sameWeekDates = [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-19',
  '2026-09-20',
];

function rhythm(overrides: Partial<RhythmRequirement> = {}): RhythmRequirement {
  return {
    id: 'exercise',
    templateId: 'exercise',
    title: 'Exercise',
    area: 'movement',
    frequency: 3,
    period: 'week',
    preferredDays: [],
    preferredTime: 'anytime',
    maxPerDay: 1,
    variants: [{ kind: 'normal', label: 'Normal', minutes: 20 }],
    sourceRecords: [{ kind: 'rhythmTemplate', id: 'exercise' }],
    ...overrides,
  };
}

function candidate(date: string): CandidateSchedulingInterval {
  return {
    id: `candidate:${date}`,
    date,
    start: '09:00',
    end: '10:00',
    timezone,
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Weekly rhythm rolling-horizon test candidate.'],
  };
}

function userRhythmPlacement(date: string): InternalPlacement {
  return {
    id: 'user:rhythm:exercise',
    intentionId: 'exercise',
    targetKind: 'rhythm',
    rhythmId: 'exercise',
    date,
    start: '09:00',
    end: '09:20',
    timezone,
    origin: 'existingUserConfirmed',
    variantKind: 'normal',
    provenance: ['User-confirmed rhythm occurrence.'],
  };
}

function model({
  candidateDates,
  rhythmPlanningDates,
  placements = [],
  rhythmOverrides = {},
  preferences = [],
}: {
  candidateDates: string[];
  rhythmPlanningDates?: string[];
  placements?: InternalPlacement[];
  rhythmOverrides?: Partial<RhythmRequirement>;
  preferences?: SchedulingPreference[];
}): SchedulingDomainModel {
  return {
    intentions: [],
    rhythms: [rhythm(rhythmOverrides)],
    externalCommitments: [],
    capacityWindows: [],
    placements,
    dayProfiles: [],
    candidateIntervals: candidateDates.map(candidate),
    ...(rhythmPlanningDates ? { rhythmPlanningDates } : {}),
    preferences,
  };
}

function generatedRhythms(plan: ReturnType<DeterministicScheduler['buildPlan']>) {
  return plan.placements.filter(
    (placement) => placement.origin === 'scheduler' && placement.rhythmId === 'exercise',
  );
}

describe('weekly rhythm frequency across a rolling planning horizon', () => {
  it('does not reset a 3/week rhythm when a seven-day horizon crosses Monday', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({ candidateDates: crossMondayDates });

    const plan = scheduler.buildPlan(input);

    expect(generatedRhythms(plan)).toHaveLength(3);
    expect(plan.unscheduledRhythmIds).toEqual([]);
  });

  it('retains frequency behaviour for a seven-day horizon in one calendar week', () => {
    const scheduler = new DeterministicScheduler();
    const plan = scheduler.buildPlan(model({ candidateDates: sameWeekDates }));

    expect(generatedRhythms(plan)).toHaveLength(3);
    expect(plan.unscheduledRhythmIds).toEqual([]);
  });

  it('counts and preserves a user-confirmed occurrence inside the rolling horizon', () => {
    const scheduler = new DeterministicScheduler();
    const existing = userRhythmPlacement(crossMondayDates[0]);
    const plan = scheduler.buildPlan(model({
      candidateDates: crossMondayDates,
      placements: [existing],
    }));
    const rhythmPlacements = plan.placements.filter(
      (placement) => placement.rhythmId === 'exercise',
    );

    expect(plan.placements).toContainEqual(existing);
    expect(generatedRhythms(plan)).toHaveLength(2);
    expect(rhythmPlacements).toHaveLength(3);
    expect(new Set(rhythmPlacements.map((placement) => placement.date)).size).toBe(3);
    expect(plan.rejectedExistingPlacements).toEqual([]);
  });

  it('keeps an under-filled weekly rhythm in unscheduled bookkeeping', () => {
    const scheduler = new DeterministicScheduler();
    const plan = scheduler.buildPlan(model({
      candidateDates: crossMondayDates.slice(0, 2),
      rhythmPlanningDates: crossMondayDates,
    }));

    expect(generatedRhythms(plan)).toHaveLength(2);
    expect(plan.unscheduledRhythmIds).toEqual(['exercise']);
  });

  it('keeps a rhythm unmet when elapsed capacity is removed but its planning date remains', () => {
    const scheduler = new DeterministicScheduler();
    const clipped = clipSchedulingInputToNow(
      model({ candidateDates: [crossMondayDates[0]] }),
      {
        date: crossMondayDates[0],
        time: '10:30',
        timezone,
      },
    );

    expect(clipped.candidateIntervals).toEqual([]);
    expect(clipped.rhythmPlanningDates).toEqual([crossMondayDates[0]]);

    const plan = scheduler.buildPlan(clipped);
    expect(generatedRhythms(plan)).toEqual([]);
    expect(plan.unscheduledRhythmIds).toEqual(['exercise']);
  });

  it('keeps explicit preferences and preferred rhythm days as deterministic ranking inputs', () => {
    const scheduler = new DeterministicScheduler();
    const input = model({
      candidateDates: crossMondayDates,
      rhythmOverrides: { preferredDays: ['Saturday', 'Tuesday'] },
      preferences: [{
        id: 'prefer-thursday-exercise',
        targetKind: 'rhythm',
        targetValue: 'exercise',
        relation: 'prefer',
        days: ['Thursday'],
        provenance: 'The user explicitly prefers exercise on Thursday.',
      }],
    });

    const first = scheduler.buildPlan(input);
    const second = scheduler.buildPlan(input);

    expect(generatedRhythms(first).map((placement) => placement.date)).toEqual([
      '2026-09-12',
      '2026-09-15',
      '2026-09-17',
    ]);
    expect(second).toEqual(first);
  });

  it('preserves calendar-week frequency behaviour for horizons longer than seven days', () => {
    const scheduler = new DeterministicScheduler();
    const plan = scheduler.buildPlan(model({
      candidateDates: [...crossMondayDates, '2026-09-18'],
    }));

    expect(generatedRhythms(plan)).toHaveLength(6);
  });
});
