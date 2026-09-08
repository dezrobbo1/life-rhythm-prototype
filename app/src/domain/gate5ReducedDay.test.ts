import { describe, expect, it } from 'vitest';
import { Gate5ReducedDayScheduler } from './gate5ReducedDay';
import { scheduler as primaryScheduler } from './primaryScheduler';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  RhythmRequirement,
  SchedulerPlan,
  ReducedDayPlanningPolicy,
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
    lifecycle: { activeTaskStatus: 'active' },
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id }],
    ...overrides,
  };
}

function rhythm(id: string, overrides: Partial<RhythmRequirement> = {}): RhythmRequirement {
  return {
    id,
    templateId: id,
    title: id,
    area: 'movement',
    frequency: 2,
    period: 'week',
    preferredDays: ['Monday'],
    preferredTime: 'morning',
    maxPerDay: 2,
    variants: [
      { kind: 'minimum', label: 'Minimum', minutes: 5 },
      { kind: 'normal', label: 'Normal', minutes: 20 },
      { kind: 'full', label: 'Full', minutes: 40 },
    ],
    sourceRecords: [{ kind: 'rhythmTemplate', id }],
    ...overrides,
  };
}

function candidate(
  id: string,
  start = '09:00',
  end = '12:00',
  date = '2026-09-07',
): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone: 'Australia/Perth',
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Gate 5 test candidate.'],
  };
}

function model(overrides: Partial<SchedulingDomainModel> = {}): SchedulingDomainModel {
  return {
    intentions: [intention('task-a')],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: [candidate('morning')],
    preferences: [],
    planningPolicy: { dayMode: 'normal' },
    ...overrides,
  };
}

function placementFor(
  plan: ReturnType<Gate5ReducedDayScheduler['buildPlan']>,
  targetId: string,
) {
  return plan.placements.find((placement) =>
    (placement.targetKind ?? 'intention') === 'rhythm'
      ? (placement.rhythmId ?? placement.intentionId) === targetId
      : placement.intentionId === targetId,
  );
}

describe('Gate 5 Reduced Day scheduling policy', () => {
  it('does not force an unlisted daily rhythm to Minimum in a fresh Reduced Day plan', () => {
    const input = model({ intentions: [], rhythms: [rhythm('daily', { period: 'day', frequency: 1, maxPerDay: 1 })], planningPolicy: { dayMode: 'reduced', dayModeDate: '2026-09-07' } });
    const plan = primaryScheduler.buildPlan(input);
    expect(plan.placements).toHaveLength(1);
    expect(plan.placements[0]).toMatchObject({ start: '09:00', end: '09:20', variantKind: 'normal' });
  });

  it('preserves an unlisted future rhythm when switching to Reduced Day', () => {
    const input = model({ intentions: [], rhythms: [rhythm('daily', { period: 'day', frequency: 1, maxPerDay: 1 })] });
    const before = primaryScheduler.buildPlan(input);
    expect(before.placements[0]).toMatchObject({ start: '09:00', end: '09:20', variantKind: 'normal' });
    const after = primaryScheduler.repairPlan(before, {
      reason: 'Reduced Day requested', trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      nextInput: { ...input, planningPolicy: { dayMode: 'reduced', dayModeDate: '2026-09-07' } },
    });
    expect(after.placements).toEqual(before.placements);
    expect(after.repair?.changes).toEqual([]);
  });

  it('keeps normal mode on the normal task form', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model();

    const plan = scheduler.buildPlan(input);

    expect(placementFor(plan, 'task-a')).toMatchObject({
      start: '09:00',
      end: '09:20',
      variantKind: 'normal',
    });
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('uses the explicit minimum form for flexible private work on Reduced Day', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model({
      planningPolicy: { dayMode: 'reduced', dayModeDate: '2026-09-07' },
    });

    const plan = scheduler.buildPlan(input);
    const placement = placementFor(plan, 'task-a');

    expect(placement).toMatchObject({
      start: '09:00',
      end: '09:05',
      variantKind: 'minimum',
      origin: 'scheduler',
    });
    expect(placement?.provenance).toContain(
      'Reduced Day used the explicit minimum form for flexible private work.',
    );
    expect(placement?.provenance).not.toContain(
      'Minimum Done was used only after no valid normal-sized placement fit.',
    );
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('does not silently right-size must-do or in-progress work', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model({
      intentions: [
        intention('must-task', { priority: 'must' }),
        intention('running-task', {
          lifecycle: { activeTaskStatus: 'inProgress' },
        }),
      ],
      planningPolicy: { dayMode: 'reduced', dayModeDate: '2026-09-07' },
    });

    const plan = scheduler.buildPlan(input);

    expect(placementFor(plan, 'must-task')).toMatchObject({
      end: '09:20',
      variantKind: 'normal',
    });
    expect(placementFor(plan, 'running-task')).toMatchObject({
      end: '09:40',
      variantKind: 'normal',
    });
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('can use a stricter Reduced Day placement cap without inventing a global default', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model({
      intentions: [intention('task-a'), intention('task-b')],
      planningPolicy: {
        dayMode: 'reduced', dayModeDate: '2026-09-07',
        reducedDay: {
          maxAutomaticPlacementsPerDay: 1,
        },
      },
    });

    const plan = scheduler.buildPlan(input);

    expect(plan.placements).toHaveLength(1);
    expect(plan.placements[0]).toMatchObject({ variantKind: 'minimum' });
    expect(plan.unscheduledIntentionIds).toHaveLength(1);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('keeps rhythm frequency semantics while using the rhythm minimum form', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const input = model({
      intentions: [],
      rhythms: [rhythm('exercise')],
      planningPolicy: { dayMode: 'reduced', dayModeDate: '2026-09-07', reducedDay: { minimumEligibleRhythmIds: ['exercise'] } },
    });

    const plan = scheduler.buildPlan(input);
    const rhythmPlacements = plan.placements.filter(
      (placement) => placement.targetKind === 'rhythm' && placement.rhythmId === 'exercise',
    );

    expect(rhythmPlacements).toHaveLength(2);
    expect(rhythmPlacements).toEqual([
      expect.objectContaining({ start: '09:00', end: '09:05', variantKind: 'minimum' }),
      expect.objectContaining({ start: '09:05', end: '09:10', variantKind: 'minimum' }),
    ]);
    expect(plan.unscheduledRhythmIds).toEqual([]);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('right-sizes preserved future work during rolling repair and keeps one-step undo', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const normalInput = model({
      intentions: [intention('task-a'), intention('task-b')],
      planningPolicy: { dayMode: 'normal' },
    });
    const before = scheduler.buildPlan(normalInput);

    const reducedInput = model({
      intentions: [intention('task-a'), intention('task-b')],
      planningPolicy: { dayMode: 'reduced', dayModeDate: '2026-09-07' },
    });
    const repaired = scheduler.repairPlan(before, {
      reason: 'Reduced Day requested',
      trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      nextInput: reducedInput,
    });

    expect(placementFor(repaired, 'task-a')).toMatchObject({
      start: '09:00',
      end: '09:05',
      variantKind: 'minimum',
    });
    expect(placementFor(repaired, 'task-b')).toMatchObject({
      start: '09:20',
      end: '09:25',
      variantKind: 'minimum',
    });
    expect(repaired.repair?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'variantChanged', targetId: 'task-a' }),
        expect.objectContaining({ kind: 'variantChanged', targetId: 'task-b' }),
      ]),
    );
    expect(repaired.repair?.preservedPlacementIds).toEqual([]);
    expect(scheduler.undoRepair(repaired)).toEqual({
      placements: before.placements,
      unscheduledIntentionIds: before.unscheduledIntentionIds,
      unscheduledRhythmIds: before.unscheduledRhythmIds,
      rejectedExistingPlacements: before.rejectedExistingPlacements,
    });
    expect(scheduler.validatePlan(repaired, reducedInput)).toEqual([]);
  });

  it('does not emit repeated Reduced Day variant churn on the next unchanged repair', () => {
    const scheduler = new Gate5ReducedDayScheduler();
    const normalInput = model({ planningPolicy: { dayMode: 'normal' } });
    const before = scheduler.buildPlan(normalInput);
    const reducedInput = model({ planningPolicy: { dayMode: 'reduced', dayModeDate: '2026-09-07' } });
    const first = scheduler.repairPlan(before, {
      reason: 'Reduced Day requested',
      trigger: 'userCorrection',
      now: { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' },
      nextInput: reducedInput,
    });

    const second = scheduler.repairPlan(first, {
      reason: 'No new disruption',
      trigger: 'manualReplan',
      now: { date: '2026-09-07', time: '08:01', timezone: 'Australia/Perth' },
      nextInput: reducedInput,
    });

    expect(placementFor(second, 'task-a')).toMatchObject({
      start: '09:00',
      end: '09:05',
      variantKind: 'minimum',
    });
    expect(second.repair?.changes).toEqual([]);
    expect(scheduler.validatePlan(second, reducedInput)).toEqual([]);
  });
});

describe('Reduced Day rhythm opt-in contract through the primary scheduler', () => {
  const scheduler = primaryScheduler;
  const now = { date: '2026-09-07', time: '08:00', timezone: 'Australia/Perth' };
  const daily = (id: string) => rhythm(id, {
    period: 'day', frequency: 1, maxPerDay: 1,
    title: 'Shared title', templateId: 'shared-template', area: 'movement',
  });
  const inputFor = (reducedDay?: ReducedDayPlanningPolicy) => model({
    intentions: [], rhythms: [daily('a'), daily('b')],
    planningPolicy: { dayMode: 'reduced', dayModeDate: '2026-09-07', reducedDay },
  });
  const repair = (plan: SchedulerPlan, input: SchedulingDomainModel, time = now.time) =>
    scheduler.repairPlan(plan, { reason: 'Policy changed', trigger: 'userCorrection', now: { ...now, time }, nextInput: input });
  const optedIn = () => inputFor({ minimumEligibleRhythmIds: ['a'] });

  it.each([undefined, [], ['shared-template', 'Shared title', 'movement', 'unknown']])('keeps Normal without exact ID permission: %j', (ids) => {
    const input = inputFor({ minimumEligibleRhythmIds: ids });
    const plan = scheduler.buildPlan(input);
    expect(plan.placements.map((p) => p.variantKind)).toEqual(['normal', 'normal']);
    expect(plan.placements.map((p) => p.end)).toEqual(['09:20', '09:40']);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('reduces only the exact opted-in ID, deterministically without input mutation', () => {
    const input = optedIn();
    const original = structuredClone(input);
    const plan = scheduler.buildPlan(input);
    expect(placementFor(plan, 'a')).toMatchObject({ start: '09:00', end: '09:05', variantKind: 'minimum' });
    expect(placementFor(plan, 'b')).toMatchObject({ start: '09:05', end: '09:25', variantKind: 'normal' });
    expect(placementFor(plan, 'a')?.provenance.join(' ')).toContain('Reduced Day');
    expect(placementFor(plan, 'a')?.provenance.join(' ')).not.toContain('no valid normal-sized');
    expect(scheduler.buildPlan(input)).toEqual(plan);
    expect(scheduler.buildPlan(inputFor({ minimumEligibleRhythmIds: ['a', 'unknown', 'a'] }))).toEqual(plan);
    expect(input).toEqual(original);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it.each(['normal', 'disabled'] as const)('respects the %s policy switch in build and repair', (mode) => {
    const input = optedIn();
    if (mode === 'normal') input.planningPolicy!.dayMode = 'normal';
    else input.planningPolicy!.reducedDay!.preferMinimumForFlexibleWork = false;
    const plan = scheduler.buildPlan(input);
    expect(plan.placements.every((p) => p.variantKind === 'normal')).toBe(true);
    expect(repair(plan, input).placements).toEqual(plan.placements);
  });

  it.each([undefined, 0, -1, NaN, Infinity])('does not fabricate or force an unusable Minimum (%s)', (minutes) => {
    const input = optedIn();
    input.rhythms[0].variants = [{ kind: 'normal', label: 'Normal', minutes: 20 },
      ...(minutes === undefined ? [] : [{ kind: 'minimum' as const, label: 'Minimum', minutes }])];
    const plan = scheduler.buildPlan(input);
    expect(placementFor(plan, 'a')).toMatchObject({ end: '09:20', variantKind: 'normal' });
    expect(repair(plan, input).placements).toEqual(plan.placements);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
  });

  it('shrinks eligible future work in place with honest Changed, Undo, and no subsequent churn', () => {
    const before = scheduler.buildPlan(inputFor());
    const input = optedIn();
    const original = structuredClone(input);
    const beforeSnapshot = structuredClone(before);
    const after = repair(before, input);
    expect(placementFor(after, 'a')).toMatchObject({ id: placementFor(before, 'a')!.id, start: '09:00', end: '09:05', variantKind: 'minimum' });
    expect(placementFor(after, 'b')).toEqual(placementFor(before, 'b'));
    expect(after.repair?.changes).toEqual([expect.objectContaining({
      kind: 'variantChanged', targetKind: 'rhythm', targetId: 'a',
      from: { date: now.date, start: '09:00', end: '09:20', variantKind: 'normal' },
      to: { date: now.date, start: '09:00', end: '09:05', variantKind: 'minimum' },
      reason: expect.stringContaining('Reduced Day'),
    })]);
    expect(scheduler.undoRepair(after)).toEqual(before);
    for (const nextInput of [input, inputFor()]) {
      const next = repair(after, nextInput);
      expect(next.placements).toEqual(after.placements);
      expect(next.repair?.changes).toEqual([]);
      expect(scheduler.validatePlan(next, nextInput)).toEqual([]);
    }
    expect(input).toEqual(original);
    expect(before).toEqual(beforeSnapshot);
    expect(scheduler.validatePlan(after, input)).toEqual([]);
  });

  it('leaves a rhythm with an empty Minimum label on its explicit Normal form', () => {
    const input = optedIn();
    input.rhythms[0].variants[0].label = '';
    const plan = scheduler.buildPlan(input);
    expect(placementFor(plan, 'a')).toMatchObject({ end: '09:20', variantKind: 'normal' });
    expect(repair(plan, input).placements).toEqual(plan.placements);
  });

  it.each(['user', 'past'] as const)('preserves %s authority even with explicit permission', (authority) => {
    const before = scheduler.buildPlan(inputFor());
    if (authority === 'user') before.placements[0].origin = 'existingUserConfirmed';
    const after = repair(before, optedIn(), authority === 'past' ? '09:30' : '08:00');
    expect(after.placements).toEqual(before.placements);
    expect(after.repair?.changes).toEqual([]);
    expect(scheduler.validatePlan(after, optedIn())).toEqual([]);
  });

  it('retains capacity fallback and its historical explanation without claiming Reduced Day permission', () => {
    const input = inputFor();
    input.rhythms = [daily('a')];
    input.candidateIntervals = [candidate('short', '09:00', '09:10')];
    const plan = scheduler.buildPlan(input);
    expect(plan.placements[0]).toMatchObject({ end: '09:05', variantKind: 'minimum' });
    expect(plan.placements[0].provenance.join(' ')).toContain('no valid normal-sized rhythm placement fit');
    expect(plan.placements[0].provenance.join(' ')).not.toContain('Reduced Day');
    const newlyEligible = { ...input, planningPolicy: optedIn().planningPolicy };
    expect(repair(plan, newlyEligible).placements).toEqual(plan.placements);
    expect(scheduler.buildPlan({ ...newlyEligible, placements: plan.placements }).placements).toEqual(plan.placements);
    expect(scheduler.validatePlan(plan, input)).toEqual([]);
    input.candidateIntervals = [candidate('too-short', '09:00', '09:04')];
    const unmet = scheduler.buildPlan(input);
    expect(unmet.placements).toEqual([]);
    expect(unmet.unscheduledRhythmIds).toEqual(['a']);
  });

  it.each([null, 'a', {}, [1], [''], ['  '], [undefined]])('rejects malformed eligibility consistently: %j', (invalid) => {
    const plan = scheduler.buildPlan(inputFor());
    for (const dayMode of ['normal', 'reduced'] as const) {
      const input = inputFor({ minimumEligibleRhythmIds: invalid as unknown as string[] });
      input.planningPolicy!.dayMode = dayMode;
      const message = 'minimumEligibleRhythmIds must be an array of non-empty strings.';
      expect(() => scheduler.buildPlan(input)).toThrow(message);
      expect(() => repair(plan, input)).toThrow(message);
      expect(() => scheduler.validatePlan(plan, input)).toThrow(message);
    }
  });
});
