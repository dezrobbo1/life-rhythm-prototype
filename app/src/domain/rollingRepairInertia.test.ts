import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createLifeRhythmDatabase } from '../data/db';
import { buildAndPersistSchedulerPlan, repairAndPersistSchedulerPlan, loadSchedulerPlanState, undoPersistedSchedulerRepair } from '../data/schedulerPlanStateRepository';
import { primarySchedulerStatus, scheduler as primaryScheduler } from './primaryScheduler';
import { RollingRepairScheduler } from './rollingRepair';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  InternalPlacement,
  SchedulerPlan,
  SchedulerChange,
  SchedulingDomainModel,
} from './schedulingModel';

const timezone = 'Australia/Perth';
const today = '2026-09-07';
const tomorrow = '2026-09-08';
const later = '2026-09-10';
let acceptanceDatabaseIndex = 0;

async function verifyPersistedAcceptance(input: SchedulingDomainModel, change: SchedulerChange, expected: SchedulerPlan) {
  const database = createLifeRhythmDatabase(`repair-acceptance-${++acceptanceDatabaseIndex}`);
  try {
    const built = await buildAndPersistSchedulerPlan(input, database);
    if (!built.ok) throw new Error(built.errors.join('\n'));
    const repaired = await repairAndPersistSchedulerPlan(change, database);
    if (!repaired.ok) throw new Error(repaired.errors.join('\n'));
    const loaded = await loadSchedulerPlanState(database);
    if (loaded.status !== 'ok') throw new Error('Repair did not reload.');
    expect(loaded.plan.placements).toEqual(expected.placements);
    expect(loaded.plan.unscheduledRhythmIds).toEqual(expected.unscheduledRhythmIds);
    expect(loaded.plan.repair?.changes).toEqual(expected.repair?.changes);
    const undone = await undoPersistedSchedulerRepair(database);
    if (!undone.ok) throw new Error(undone.errors.join('\n'));
    const restored = await loadSchedulerPlanState(database);
    if (restored.status !== 'ok') throw new Error('Undo did not reload.');
    expect(restored.plan).toEqual(built.plan);
  } finally {
    await database.delete();
  }
}

function intention(id: string, priority: 'must' | 'normal' = 'normal'): InternalIntention {
  return {
    id,
    title: id,
    area: 'admin',
    taskType: 'admin',
    priority,
    variants: [{ kind: 'normal', label: 'Normal', minutes: 20 }],
    timing: { timeConstraint: 'flexible' },
    lifecycle: {},
    eligibleForScheduling: true,
    sourceRecords: [{ kind: 'taskPoolItem', id }],
  };
}

function candidate(id: string, date: string, start = '09:00', end = '09:20'): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone,
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Test candidate.'],
  };
}

function placement(id: string, intentionId: string, date: string, start = '09:00', end = '09:20'): InternalPlacement {
  return {
    id,
    intentionId,
    date,
    start,
    end,
    timezone,
    origin: 'scheduler',
    targetKind: 'intention',
    variantKind: 'normal',
    provenance: ['Existing scheduler placement.'],
  };
}

function plan(placements: InternalPlacement[]): SchedulerPlan {
  return {
    placements,
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
    rejectedExistingPlacements: [],
  };
}

function model(
  intentions: InternalIntention[],
  candidates: CandidateSchedulingInterval[],
  placements: InternalPlacement[] = [],
): SchedulingDomainModel {
  return {
    intentions,
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements,
    dayProfiles: [],
    candidateIntervals: candidates,
    preferences: [],
  };
}

describe('Gate 4 graded schedule inertia', () => {
  it('moves lower-cost tomorrow work so disrupted same-day must-work can recover', () => {
    const scheduler = new RollingRepairScheduler();
    const before = plan([
      placement('p-urgent', 'urgent', today),
      placement('p-flex', 'flex', tomorrow),
    ]);
    const nextInput = model(
      [intention('urgent', 'must'), intention('flex')],
      [candidate('tomorrow-slot', tomorrow)],
    );

    const repaired = scheduler.repairPlan(before, {
      reason: 'Calendar removed the original slot',
      trigger: 'calendarChanged',
      now: { date: today, time: '08:00', timezone },
      nextInput,
    });

    expect(repaired.placements.find((item) => item.intentionId === 'urgent')).toMatchObject({
      date: tomorrow,
      start: '09:00',
      end: '09:20',
    });
    expect(repaired.placements.some((item) => item.intentionId === 'flex')).toBe(false);
    expect(repaired.unscheduledIntentionIds).toContain('flex');
    expect(repaired.unscheduledIntentionIds).not.toContain('urgent');
  });

  it('does not auto-release a pinned placement to recover another task', () => {
    const scheduler = new RollingRepairScheduler();
    const before = plan([
      placement('p-urgent', 'urgent', today),
      placement('p-flex', 'flex', tomorrow),
    ]);
    const nextInput = model(
      [intention('urgent', 'must'), intention('flex')],
      [candidate('tomorrow-slot', tomorrow)],
    );

    const repaired = scheduler.repairPlan(before, {
      reason: 'Calendar removed the original slot',
      trigger: 'calendarChanged',
      now: { date: today, time: '08:00', timezone },
      pinnedPlacementIds: ['p-flex'],
      nextInput,
    });

    expect(repaired.placements.find((item) => item.id === 'p-flex')).toMatchObject({
      intentionId: 'flex',
      date: tomorrow,
    });
    expect(repaired.unscheduledIntentionIds).toContain('urgent');
  });

  it('preserves surfaced work before releasing a more distant unsurfaced placement', () => {
    const scheduler = new RollingRepairScheduler();
    const before = plan([
      placement('p-urgent', 'urgent', today),
      placement('p-surfaced', 'surfaced', tomorrow),
      placement('p-distant', 'distant', later),
    ]);
    const nextInput = model(
      [intention('urgent', 'must'), intention('surfaced'), intention('distant')],
      [candidate('tomorrow-slot', tomorrow), candidate('later-slot', later)],
    );

    const repaired = scheduler.repairPlan(before, {
      reason: 'Calendar removed the original slot',
      trigger: 'calendarChanged',
      now: { date: today, time: '08:00', timezone },
      surfacedPlacementIds: ['p-surfaced'],
      nextInput,
    });

    expect(repaired.placements.find((item) => item.id === 'p-surfaced')).toMatchObject({
      intentionId: 'surfaced',
      date: tomorrow,
    });
    expect(repaired.placements.find((item) => item.intentionId === 'urgent')).toMatchObject({
      date: later,
      start: '09:00',
    });
    expect(repaired.placements.some((item) => item.intentionId === 'distant')).toBe(false);
  });

  it('removes explicitly released placements even when nextInput still contains the old seed', () => {
    const scheduler = new RollingRepairScheduler();
    const oldPlacement = placement('p-task', 'task', today);
    const before = plan([oldPlacement]);
    const nextInput = model(
      [intention('task')],
      [candidate('later-today', today, '10:00', '10:20')],
      [oldPlacement],
    );

    const repaired = scheduler.repairPlan(before, {
      reason: 'User moved the task',
      trigger: 'userCorrection',
      now: { date: today, time: '08:00', timezone },
      releasePlacementIds: ['p-task'],
      nextInput,
    });

    expect(repaired.placements).toHaveLength(1);
    expect(repaired.placements[0]).toMatchObject({
      intentionId: 'task',
      date: today,
      start: '10:00',
      end: '10:20',
    });
    expect(repaired.placements[0].id).not.toBe('p-task');
  });
});

describe('primary scheduler entry point', () => {
  it('uses the Gate 5 primary scheduler while retaining Gate 4 rolling-repair behavior', () => {
    expect(primarySchedulerStatus).toBe('gate5-primary-reduced-day');

    const input = model([intention('task')], [candidate('slot', today)]);
    const before = primaryScheduler.buildPlan(input);
    const repaired = primaryScheduler.repairPlan(before, {
      reason: 'Manual repair',
      trigger: 'manualReplan',
      now: { date: today, time: '08:00', timezone },
      nextInput: input,
    });

    expect(repaired.repair).toMatchObject({
      trigger: 'manualReplan',
      reason: 'Manual repair',
    });
  });
});

describe('speculative auto-release through the primary scheduler', () => {
  const now = { date: today, time: '08:00', timezone };

  it('later acceptance retains the protected Normal-40 recovery', async () => {
    const tasks = ['z-surfaced', 'a-second', 'zz-block-early', 'zz-block-late'].map((id, i) => ({
      ...intention(id), variants: [{ kind: 'normal' as const, label: 'Normal', minutes: i === 1 ? 60 : 40 },
        ...(i === 0 ? [{ kind: 'minimum' as const, label: 'Minimum', minutes: 20 }] : [])],
    }));
    const input = model(tasks, [candidate('today', today, '09:00', '11:00'), candidate('tomorrow', tomorrow, '09:00', '10:20')], [
      placement('p-first', 'z-surfaced', today, '09:00', '09:40'), placement('p-second', 'a-second', today, '10:00', '11:00'),
      placement('p-early', 'zz-block-early', tomorrow, '09:00', '09:40'), placement('p-late', 'zz-block-late', tomorrow, '09:40', '10:20'),
    ]);
    const before = primaryScheduler.buildPlan(input);
    expect(primaryScheduler.validatePlan(before, input)).toEqual([]);
    const nextInput = { ...input, placements: [], candidateIntervals: input.candidateIntervals!.slice(1) };
    const chosen = primaryScheduler.buildPlan({ ...nextInput, placements: [input.placements[2]] });
    const trial = primaryScheduler.buildPlan(nextInput);
    expect(chosen.placements.find((p) => p.intentionId === 'z-surfaced')).toMatchObject({ variantKind: 'normal', start: '09:40', end: '10:20' });
    expect(trial.placements.find((p) => p.intentionId === 'z-surfaced')).toMatchObject({ variantKind: 'minimum', start: '10:00', end: '10:20' });
    const repaired = primaryScheduler.repairPlan(before, { reason: 'Today removed', now, nextInput, surfacedPlacementIds: ['p-first'] });
    expect(repaired.placements).toEqual(chosen.placements);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
    await verifyPersistedAcceptance(input, { reason: 'Today removed', now, nextInput, surfacedPlacementIds: ['p-first'] }, repaired);
  });

  it.each(['day', 'week', 'month', 'bounded-week'] as const)('restoration respects %s requirement periods', async (mode) => {
    const period = mode === 'bounded-week' ? 'week' : mode;
    const seedDate = mode === 'bounded-week' ? '2026-09-11' : period === 'month' ? '2026-09-30' : '2026-09-10';
    const newDate = mode === 'bounded-week' ? '2026-09-14' : period === 'month' ? '2026-10-01' : period === 'week' ? '2026-09-21' : '2026-09-11';
    const urgent = { ...intention('urgent', 'must'), variants: [{ kind: 'normal' as const, label: 'Normal', minutes: 40 }], timing: { timeConstraint: 'dueBy' as const, dueAt: `${tomorrow}T09:40:00+08:00` } };
    const blocker = { ...intention('blocker', 'must'), variants: urgent.variants };
    const rhythm = { id: 'r', templateId: 'r', title: 'Rhythm', area: 'admin' as const, period, frequency: 1, maxPerDay: 1, preferredDays: [], preferredTime: 'anytime' as const, variants: urgent.variants, sourceRecords: [] };
    const seed = { ...placement('p-r', 'r', seedDate, '09:00', '09:40'), targetKind: 'rhythm' as const, rhythmId: 'r' };
    const input = model([urgent, blocker], [candidate('today', today, '09:00', '09:40'), candidate('tomorrow', tomorrow, '09:00', '09:40'), candidate('seed', seedDate, '09:00', '09:40')],
      [placement('p-urgent', 'urgent', today, '09:00', '09:40'), placement('p-blocker', 'blocker', tomorrow, '09:00', '09:40'), seed]);
    input.rhythms = [rhythm];
    input.rhythmPlanningDates = mode === 'bounded-week' ? [tomorrow, seedDate, newDate] : [today, tomorrow, seedDate, newDate];
    const stable = mode === 'bounded-week' ? [] : [{ ...seed, id: 'p-stable', date: '2026-12-01', origin: 'existingUserConfirmed' as const }];
    if (stable.length) {
      input.placements.push(...stable);
      input.candidateIntervals!.push(candidate('stable', '2026-12-01', '09:00', '09:40'));
      input.rhythmPlanningDates.push('2026-12-01');
    }
    const before = primaryScheduler.buildPlan(input);
    expect(primaryScheduler.validatePlan(before, input)).toEqual([]);
    const nextInput = { ...input, placements: [], candidateIntervals: [...input.candidateIntervals!.slice(1), candidate('new', newDate, '09:00', '09:40')] };
    const chosen = primaryScheduler.buildPlan({ ...nextInput, placements: stable });
    const probe = primaryScheduler.buildPlan({ ...nextInput, placements: [seed, ...stable] });
    expect(chosen.unscheduledRhythmIds).toEqual(mode === 'bounded-week' ? [] : ['r']);
    expect(probe.unscheduledRhythmIds).toEqual(mode === 'bounded-week' ? [] : ['r']);
    expect(chosen.placements.filter((p) => p.targetKind === 'rhythm')).toHaveLength(1 + stable.length);
    expect(probe.placements.filter((p) => p.targetKind === 'rhythm')).toHaveLength(1 + stable.length);
    expect(chosen.placements.find((p) => p.rhythmId === 'r')?.date).toBe(newDate);
    expect(probe.placements.find((p) => p.rhythmId === 'r')?.date).toBe(seedDate);
    expect(primaryScheduler.validatePlan(chosen, nextInput)).toEqual([]);
    expect(primaryScheduler.validatePlan(probe, nextInput)).toEqual([]);
    const repaired = primaryScheduler.repairPlan(before, { reason: 'Today removed and future capacity supplied', now, nextInput });
    expect(repaired.placements).toEqual((mode === 'bounded-week' ? probe : chosen).placements);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
    await verifyPersistedAcceptance(input, { reason: 'Today removed and future capacity supplied', now, nextInput }, repaired);
  });

  it('later acceptance retains a protected daily rhythm in its recovered period', () => {
    const rhythm = (id: string, minutes: number) => ({ id, templateId: id, title: id, area: 'admin' as const, period: 'day' as const, frequency: 1, maxPerDay: 1, preferredDays: [], preferredTime: 'anytime' as const, variants: [{ kind: 'normal' as const, label: 'Normal', minutes }], sourceRecords: [] });
    const input = model(['early', 'late', 'other'].map((id, i) => ({ ...intention(id), variants: [{ kind: 'normal' as const, label: 'Normal', minutes: i === 0 ? 20 : 40 }] })),
      [candidate('today', today, '09:00', '11:00'), candidate('A', tomorrow, '09:00', '09:40'), candidate('B', later, '09:00', '10:00')], [
        { ...placement('p-high', 'z-high', today, '09:00', '09:40'), targetKind: 'rhythm', rhythmId: 'z-high' },
        { ...placement('p-low', 'a-low', today, '10:00', '11:00'), targetKind: 'rhythm', rhythmId: 'a-low' },
        placement('p-other', 'other', tomorrow, '09:00', '09:40'), placement('p-early', 'early', later, '09:00', '09:20'), placement('p-late', 'late', later, '09:20', '10:00'),
      ]);
    input.rhythms = [rhythm('z-high', 40), rhythm('a-low', 60)];
    const before = primaryScheduler.buildPlan(input);
    expect(primaryScheduler.validatePlan(before, input)).toEqual([]);
    const nextInput = { ...input, placements: [], candidateIntervals: input.candidateIntervals!.slice(1) };
    const chosen = primaryScheduler.buildPlan({ ...nextInput, placements: input.placements.slice(2, 4) });
    const trial = primaryScheduler.buildPlan(nextInput);
    expect(chosen.placements.find((p) => p.rhythmId === 'z-high')?.date).toBe(later);
    expect(trial.placements.find((p) => p.rhythmId === 'z-high')?.date).toBe(tomorrow);
    expect(chosen.unscheduledRhythmIds).toContain('z-high');
    expect(trial.unscheduledRhythmIds).toContain('z-high');
    const repaired = primaryScheduler.repairPlan(before, { reason: 'Today removed', now, nextInput, surfacedPlacementIds: ['p-high'] });
    expect(repaired.placements).toEqual(chosen.placements);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  function prefixFixture() {
    const urgent = intention('urgent', 'must');
    urgent.timing = { timeConstraint: 'dueBy', dueAt: `${tomorrow}T09:20:00+08:00` };
    const beforeInput = model(
      [urgent, intention('blocker'), intention('distant')],
      [candidate('today', today), candidate('tomorrow', tomorrow), candidate('later', later, '09:00', '11:00')],
      [placement('p-urgent', 'urgent', today), placement('p-blocker', 'blocker', tomorrow),
        placement('p-distant', 'distant', later, '10:00', '10:20')],
    );
    beforeInput.planningPolicy = { dayMode: 'normal' };
    const before = primaryScheduler.buildPlan(beforeInput);
    expect(primaryScheduler.validatePlan(before, beforeInput)).toEqual([]);
    expect(before.placements).toEqual(beforeInput.placements);
    const nextInput: SchedulingDomainModel = { ...beforeInput, placements: [], candidateIntervals: beforeInput.candidateIntervals!.slice(1) };
    return { before, beforeInput, nextInput };
  }

  it('A: restores a redundant distant prefix release while recovering the urgent deadline', () => {
    const { before, nextInput } = prefixFixture();
    const repaired = primaryScheduler.repairPlan(before, { reason: 'Today slot removed', trigger: 'calendarChanged', now, nextInput });
    // Independent feasible comparison: release only the blocker, retain the distant seed.
    const comparison = primaryScheduler.buildPlan({ ...nextInput, placements: [before.placements[2]] });
    expect(primaryScheduler.validatePlan(comparison, nextInput)).toEqual([]);
    expect(comparison.unscheduledIntentionIds).toEqual([]);
    expect(comparison.placements.find((p) => p.intentionId === 'urgent')).toMatchObject({ date: tomorrow, start: '09:00', end: '09:20' });
    expect(repaired.placements.find((p) => p.intentionId === 'distant')).toEqual(before.placements[2]);
    expect(repaired.placements).toEqual(comparison.placements);
    expect(repaired.repair?.preservedPlacementIds).toEqual(['p-distant']);
    expect(repaired.repair?.changes.map((c) => [c.targetId, c.kind])).toEqual([['blocker', 'moved'], ['urgent', 'moved']]);
    expect(repaired.unscheduledIntentionIds).toEqual([]);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it('review P1: optional restoration cannot exchange recovered Normal for Minimum', () => {
    const { beforeInput } = prefixFixture();
    const large = intention('large');
    large.variants = [{ kind: 'normal', label: 'Normal', minutes: 60 }, { kind: 'minimum', label: 'Minimum', minutes: 20 }];
    beforeInput.intentions.push(large);
    beforeInput.candidateIntervals = [candidate('today', today, '09:00', '11:00'), candidate('tomorrow', tomorrow), candidate('later', later, '09:00', '10:40')];
    beforeInput.placements[2] = placement('p-distant', 'distant', later, '09:40', '10:00');
    beforeInput.placements.push(placement('p-large', 'large', today, '10:00', '11:00'));
    const before = primaryScheduler.buildPlan(beforeInput);
    expect(primaryScheduler.validatePlan(before, beforeInput)).toEqual([]);
    const nextInput: SchedulingDomainModel = { ...beforeInput, placements: [], candidateIntervals: beforeInput.candidateIntervals.slice(1) };
    const successful = primaryScheduler.buildPlan(nextInput);
    const probe = primaryScheduler.buildPlan({ ...nextInput, placements: [beforeInput.placements[2]] });
    expect(successful.placements.find((p) => p.intentionId === 'large')).toMatchObject({ start: '09:40', end: '10:40', variantKind: 'normal' });
    expect(probe.placements.find((p) => p.intentionId === 'large')).toMatchObject({ start: '09:20', end: '09:40', variantKind: 'minimum' });
    expect(primaryScheduler.validatePlan(successful, nextInput)).toEqual([]);
    expect(primaryScheduler.validatePlan(probe, nextInput)).toEqual([]);
    const original = structuredClone({ before, nextInput });
    const repaired = primaryScheduler.repairPlan(before, { reason: 'Today slots removed', now, nextInput });
    expect(repaired.placements).toEqual(successful.placements);
    expect(repaired.unscheduledIntentionIds).toEqual([]);
    expect(repaired.repair?.changes.find((c) => c.targetId === 'large')?.to).toMatchObject({ variantKind: 'normal', start: '09:40', end: '10:40' });
    const repeated = primaryScheduler.repairPlan(repaired, { reason: 'Unchanged', now, nextInput });
    expect(repeated.placements).toEqual(repaired.placements);
    expect(repeated.repair?.changes).toEqual([]);
    expect({ before, nextInput }).toEqual(original);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
    const fallbackInput: SchedulingDomainModel = { ...nextInput, intentions: [large], candidateIntervals: [candidate('short', later)] };
    const fallback = primaryScheduler.repairPlan(before, { reason: 'Only Minimum fits', now, nextInput: fallbackInput });
    expect(fallback.placements).toHaveLength(1);
    expect(fallback.placements[0]).toMatchObject({ start: '09:00', end: '09:20', variantKind: 'minimum' });
    expect(fallback.placements[0].provenance.join(' ')).toContain('no valid normal-sized placement fit');
    expect(primaryScheduler.validatePlan(fallback, fallbackInput)).toEqual([]);
    const reducedInput = { ...nextInput, planningPolicy: { dayMode: 'reduced' as const } };
    const reduced = primaryScheduler.repairPlan(before, { reason: 'Reduced Day', now, nextInput: reducedInput });
    expect(reduced.placements.find((p) => p.intentionId === 'large')?.variantKind).toBe('minimum');
    expect(primaryScheduler.validatePlan(reduced, reducedInput)).toEqual([]);
  });

  it.each(['equal', 'due-by'] as const)('review: incidental surfaced recovery versus %s priority', (priority) => {
    const tasks = [['b-primary', 20], ['c-incidental', 20], ['a-attempt', 60], ['zz-block-early', 40], ['zz-block-late', 40]] as const;
    const intentions = tasks.map(([id, minutes]) => ({ ...intention(id), variants: [{ kind: 'normal' as const, label: 'Normal', minutes }] }));
    if (priority === 'due-by') intentions[2].timing = { timeConstraint: 'dueBy', dueAt: `${tomorrow}T10:20:00+08:00` };
    const input = model(intentions, [candidate('today', today, '09:00', '11:00'), candidate('tomorrow', tomorrow, '09:00', '10:20')], [
      placement('p-primary', 'b-primary', today), placement('p-incidental', 'c-incidental', today, '09:20', '09:40'),
      placement('p-attempt', 'a-attempt', today, '10:00', '11:00'), placement('p-early', 'zz-block-early', tomorrow, '09:00', '09:40'),
      placement('p-late', 'zz-block-late', tomorrow, '09:40', '10:20'),
    ]);
    const before = primaryScheduler.buildPlan(input);
    expect(primaryScheduler.validatePlan(before, input)).toEqual([]);
    expect(before.placements).toEqual(input.placements);
    const nextInput = { ...input, placements: [], candidateIntervals: input.candidateIntervals!.slice(1) };
    const first = primaryScheduler.buildPlan({ ...nextInput, placements: [input.placements[3]] });
    expect(first.placements.map((p) => p.intentionId)).toEqual(['zz-block-early', 'b-primary', 'c-incidental']);
    const laterTrial = primaryScheduler.buildPlan(nextInput);
    expect(laterTrial.placements.map((p) => p.intentionId)).toEqual(['a-attempt', 'b-primary']);
    const original = structuredClone({ before, nextInput });
    const change = { reason: 'Today slots removed', now, nextInput, surfacedPlacementIds: ['p-primary', 'p-incidental'] };
    const repaired = primaryScheduler.repairPlan(before, change);
    expect(repaired.placements).toEqual((priority === 'equal' ? first : laterTrial).placements);
    expect(repaired.unscheduledIntentionIds).toEqual((priority === 'equal' ? first : laterTrial).unscheduledIntentionIds);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
    expect(primaryScheduler.repairPlan(repaired, change).repair?.changes).toEqual([]);
    expect({ before, nextInput }).toEqual(original);
  });

  it.each(['equal-priority', 'due-by'] as const)('B: respects earlier surfaced recovery versus %s work', (priority) => {
    const second = intention('a-second');
    second.variants = [{ kind: 'normal', label: 'Normal', minutes: 40 }];
    if (priority === 'due-by') second.timing = { timeConstraint: 'dueBy', dueAt: `${tomorrow}T09:40:00+08:00` };
    const beforeInput = model(
      [intention('z-surfaced'), second, intention('zz-block-early'), intention('zz-block-late')],
      [candidate('today', today, '09:00', '11:00'), candidate('tomorrow', tomorrow, '09:00', '09:40')],
      [placement('p-first', 'z-surfaced', today), placement('p-second', 'a-second', today, '10:00', '10:40'),
        placement('p-early', 'zz-block-early', tomorrow), placement('p-late', 'zz-block-late', tomorrow, '09:20', '09:40')],
    );
    beforeInput.planningPolicy = { dayMode: 'normal' };
    const before = primaryScheduler.buildPlan(beforeInput);
    expect(primaryScheduler.validatePlan(before, beforeInput)).toEqual([]);
    expect(before.placements).toEqual(beforeInput.placements);
    const nextInput = { ...beforeInput, placements: [], candidateIntervals: beforeInput.candidateIntervals!.slice(1) };
    // Observe the production builder's accepted first-trial result without a copied repair algorithm.
    const firstTrial = primaryScheduler.buildPlan({ ...nextInput, placements: [before.placements[2]] });
    expect(firstTrial.placements.find((p) => p.intentionId === 'z-surfaced')).toMatchObject({ date: tomorrow, start: '09:20', end: '09:40' });
    expect(firstTrial.unscheduledIntentionIds).toContain('a-second');
    const laterTrial = primaryScheduler.buildPlan(nextInput);
    expect(laterTrial.placements.find((p) => p.intentionId === 'a-second')).toMatchObject({ date: tomorrow, start: '09:00', end: '09:40' });
    expect(laterTrial.unscheduledIntentionIds).toContain('z-surfaced');
    const repaired = primaryScheduler.repairPlan(before, {
      reason: 'Today slots removed', trigger: 'calendarChanged', now, nextInput, surfacedPlacementIds: ['p-first'],
    });
    const expected = priority === 'equal-priority' ? firstTrial : laterTrial;
    expect(repaired.placements).toEqual(expected.placements);
    expect(repaired.unscheduledIntentionIds).toEqual(expected.unscheduledIntentionIds);
    expect(repaired.repair?.preservedPlacementIds).toEqual(priority === 'equal-priority' ? ['p-early'] : []);
    expect(repaired.repair?.changes.map((c) => [c.targetId, c.kind])).toEqual(priority === 'equal-priority'
      ? [['a-second', 'removed'], ['z-surfaced', 'moved'], ['zz-block-late', 'removed']]
      : [['a-second', 'moved'], ['z-surfaced', 'removed'], ['zz-block-early', 'removed'], ['zz-block-late', 'removed']]);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it('C: impossible recovery leaves the initial accepted result, including provenance and bookkeeping', () => {
    const { before, nextInput } = prefixFixture();
    nextInput.candidateIntervals = [candidate('too-short', tomorrow, '09:00', '09:10'), candidate('later', later, '09:00', '11:00')];
    const accepted = primaryScheduler.buildPlan({ ...nextInput, placements: before.placements });
    const repaired = primaryScheduler.repairPlan(before, { reason: 'No deadline capacity', now, nextInput });
    expect(repaired.placements).toEqual(accepted.placements);
    expect(repaired.unscheduledIntentionIds).toEqual(['urgent']);
    expect(repaired.unscheduledRhythmIds).toEqual(accepted.unscheduledRhythmIds);
    expect(repaired.rejectedExistingPlacements).toEqual(accepted.rejectedExistingPlacements);
    expect(repaired.repair?.preservedPlacementIds).toEqual(['p-distant']);
    expect(repaired.repair?.changes.map((c) => [c.targetId, c.kind])).toEqual([['blocker', 'moved'], ['urgent', 'removed']]);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it.each(['user', 'pinned', 'frozen'] as const)('D: does not auto-release valid %s authority', (authority) => {
    const urgent = intention('urgent', 'must');
    const blocker = placement('p-blocker', 'blocker', tomorrow);
    if (authority === 'user') blocker.origin = 'existingUserConfirmed';
    const beforeInput = model([urgent, intention('blocker')],
      [candidate('today', today), candidate('tomorrow', tomorrow)],
      [placement('p-urgent', 'urgent', today), blocker]);
    const before = primaryScheduler.buildPlan(beforeInput);
    expect(primaryScheduler.validatePlan(before, beforeInput)).toEqual([]);
    const nextInput = { ...beforeInput, placements: [], candidateIntervals: [candidate('tomorrow', tomorrow)] };
    // In the frozen case explicitly release the old urgent placement, while advancing
    // the clock to tomorrow. No stale/elapsed candidate capacity is supplied.
    if (authority === 'frozen') nextInput.candidateIntervals = [];
    const repaired = primaryScheduler.repairPlan(before, {
      reason: 'Authority control', now: authority === 'frozen' ? { ...now, date: tomorrow, time: '09:30' } : now,
      nextInput, ...(authority === 'pinned' ? { pinnedPlacementIds: ['p-blocker'] } : {}),
      ...(authority === 'frozen' ? { releasePlacementIds: ['p-urgent'] } : {}),
    });
    expect(repaired.placements).toEqual([blocker]);
    expect(repaired.unscheduledIntentionIds).toEqual(['urgent']);
    expect(repaired.repair?.frozenPastPlacementIds).toEqual(authority === 'frozen' ? ['p-blocker'] : []);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it('D: preserves legitimate displacement, determinism, inputs and unchanged-repair stability', () => {
    const { before, nextInput } = prefixFixture();
    const original = structuredClone({ before, nextInput });
    const repaired = primaryScheduler.repairPlan(before, { reason: 'Today slot removed', now, nextInput });
    expect(primaryScheduler.repairPlan(before, { reason: 'Today slot removed', now, nextInput })).toEqual(repaired);
    const reversed = { ...nextInput, intentions: [...nextInput.intentions].reverse(), candidateIntervals: [...nextInput.candidateIntervals!].reverse() };
    expect(primaryScheduler.repairPlan({ ...before, placements: [...before.placements].reverse() }, { reason: 'Today slot removed', now, nextInput: reversed }).placements).toEqual(repaired.placements);
    const repeated = primaryScheduler.repairPlan(repaired, { reason: 'Unchanged', now, nextInput });
    expect(repeated.placements).toEqual(repaired.placements);
    expect(repeated.repair?.changes).toEqual([]);
    expect({ before, nextInput }).toEqual(original);
    nextInput.candidateIntervals = [candidate('tomorrow', tomorrow)];
    const displaced = primaryScheduler.repairPlan(before, { reason: 'Only tomorrow fits', now, nextInput });
    expect(displaced.placements).toHaveLength(1);
    expect(displaced.placements[0].intentionId).toBe('urgent');
    expect(displaced.unscheduledIntentionIds).toEqual(['blocker', 'distant']);
    expect(primaryScheduler.validatePlan(displaced, nextInput)).toEqual([]);
  });

  it('D: backtracking cannot restore an explicit release from stale nextInput seeds', () => {
    const { before, nextInput } = prefixFixture();
    nextInput.placements = before.placements;
    const repaired = primaryScheduler.repairPlan(before, {
      reason: 'Explicit release plus deadline recovery', now, nextInput, releasePlacementIds: ['p-distant'],
    });
    expect(repaired.placements.some((p) => p.id === 'p-distant')).toBe(false);
    expect(repaired.placements.find((p) => p.intentionId === 'urgent')).toMatchObject({ date: tomorrow, start: '09:00' });
    expect(repaired.repair?.preservedPlacementIds).not.toContain('p-distant');
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it('D: a pin does not preserve an independently invalid placement', () => {
    const { before, nextInput } = prefixFixture();
    const repaired = primaryScheduler.repairPlan(before, {
      reason: 'Pinned slot no longer exists', now, nextInput, pinnedPlacementIds: ['p-urgent'],
    });
    expect(repaired.placements.some((p) => p.id === 'p-urgent')).toBe(false);
    expect(repaired.placements.find((p) => p.intentionId === 'urgent')).toMatchObject({ date: tomorrow, start: '09:00', end: '09:20' });
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it('retains both weekly rhythm occurrences when redundant releases are restored', () => {
    const { beforeInput, nextInput } = prefixFixture();
    const rhythm = {
      id: 'rhythm', templateId: 'rhythm', title: 'Synthetic rhythm', area: 'admin' as const,
      period: 'week' as const, frequency: 2, maxPerDay: 2, preferredDays: [], preferredTime: 'anytime' as const,
      variants: [{ kind: 'normal' as const, label: 'Normal', minutes: 20 }], sourceRecords: [],
    };
    beforeInput.intentions = beforeInput.intentions.filter((i) => i.id !== 'distant');
    beforeInput.rhythms = [rhythm];
    beforeInput.placements = beforeInput.placements.filter((p) => p.intentionId !== 'distant');
    const occurrences = ['10:00', '10:20'].map((start, index) => ({
      ...placement(`p-rhythm-${index}`, 'rhythm', later, start, index === 0 ? '10:20' : '10:40'),
      targetKind: 'rhythm' as const, rhythmId: 'rhythm',
    }));
    beforeInput.placements.push(...occurrences);
    const before = primaryScheduler.buildPlan(beforeInput);
    expect(primaryScheduler.validatePlan(before, beforeInput)).toEqual([]);
    expect(before.unscheduledRhythmIds).toEqual([]);
    const input = { ...nextInput, intentions: beforeInput.intentions, rhythms: [rhythm] };
    const repaired = primaryScheduler.repairPlan(before, { reason: 'Today slot removed', now, nextInput: input });
    expect(repaired.placements.filter((p) => p.targetKind === 'rhythm')).toEqual(occurrences);
    expect(repaired.unscheduledRhythmIds).toEqual([]);
    expect(repaired.repair?.preservedPlacementIds).toEqual(['p-rhythm-0', 'p-rhythm-1']);
    expect(repaired.repair?.changes.map((c) => c.targetId)).toEqual(['blocker', 'urgent']);
    expect(primaryScheduler.validatePlan(repaired, input)).toEqual([]);

    // A separate insufficient-capacity repair may recover one occurrence, but
    // must still report the two-occurrence rhythm as unmet, not satisfied.
    const partialInput = { ...input, intentions: [], candidateIntervals: [candidate('one', tomorrow)] };
    const partial = primaryScheduler.repairPlan(before, { reason: 'Only one occurrence fits', now, nextInput: partialInput });
    expect(partial.placements.filter((p) => p.targetKind === 'rhythm')).toHaveLength(1);
    expect(partial.unscheduledRhythmIds).toEqual(['rhythm']);
    expect(primaryScheduler.validatePlan(partial, partialInput)).toEqual([]);
  });
});
