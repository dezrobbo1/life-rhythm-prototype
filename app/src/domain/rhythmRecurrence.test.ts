import { describe, expect, it } from 'vitest';
import { rhythmTemplateSchema } from '../data/schemas';
import {
  rhythmInstanceSchema,
  rhythmPlanSchema,
  rhythmRecurrenceRevisionSchema,
  type RhythmInstance,
  type RhythmPlan,
  type RhythmRecurrenceRevision,
} from '../data/rhythmAuthoritySchemas';
import { buildMissingRhythmInstances, mondayStart, recurrencePeriodIdentity } from './rhythmRecurrence';

const createdAt = '2026-09-01T00:00:00.000Z';
const template = rhythmTemplateSchema.parse({
  id: 'rhythm-a', source: 'custom', title: 'A rhythm', area: 'house',
  minimum: { label: 'Minimum action', minutes: 4 },
  normal: { label: 'Normal action', minutes: 11 },
  full: { label: 'Full action', minutes: 23 },
  enabled: false, createdAt, updatedAt: createdAt,
});

function plan(overrides: Partial<RhythmPlan> = {}) {
  return rhythmPlanSchema.parse({
    id: 'plan-a', rhythmTemplateId: template.id, state: 'enabled', latestRecurrenceRevisionId: 'revision-1',
    initialEffectiveFromLocalDate: '2026-09-01', preferredTime: 'morning', timezone: 'Australia/Perth',
    missedOccurrencePolicy: 'skip', planningMode: 'automaticPrivate', createdAt, updatedAt: createdAt,
    ...overrides,
  });
}

function revision(overrides: Partial<RhythmRecurrenceRevision> = {}) {
  return rhythmRecurrenceRevisionSchema.parse({
    id: 'revision-1', rhythmPlanId: 'plan-a', revisionNumber: 1,
    effectiveFromLocalDate: '2026-09-01', timezone: 'Australia/Perth',
    rule: { frequency: 3, period: 'week', preferredDays: ['Monday', 'Wednesday'], maxPerDay: 1 },
    createdAt, ...overrides,
  });
}

function generate(options: {
  plan?: RhythmPlan;
  revisions?: RhythmRecurrenceRevision[];
  existing?: RhythmInstance[];
  start?: string;
  end?: string;
} = {}) {
  return buildMissingRhythmInstances({
    plan: options.plan ?? plan(), template, revisions: options.revisions ?? [revision()],
    existing: options.existing ?? [], horizonStartDate: options.start ?? '2026-09-07',
    horizonEndDate: options.end ?? '2026-09-13', createdAt,
  });
}

describe('flexible-quota rhythm recurrence', () => {
  it('uses deterministic Monday-start week identity', () => {
    expect(mondayStart('2026-09-13')).toBe('2026-09-07');
    expect(recurrencePeriodIdentity('week', '2026-09-13')).toBe('week:2026-09-07');
  });

  it('supports daily, weekly, and monthly quota periods', () => {
    const dailyRevision = revision({ rule: { frequency: 1, period: 'day', preferredDays: [], maxPerDay: 1 } });
    const monthlyRevision = revision({ rule: { frequency: 2, period: 'month', preferredDays: [], maxPerDay: 1 } });
    expect(generate({ revisions: [dailyRevision], start: '2026-09-07', end: '2026-09-09' })).toHaveLength(3);
    expect(generate()).toHaveLength(3);
    expect(generate({ revisions: [monthlyRevision] })).toHaveLength(2);
  });

  it('keeps logical local-date identities stable across a Sydney DST boundary', () => {
    const sydneyPlan = plan({
      initialEffectiveFromLocalDate: '2026-10-03',
      timezone: 'Australia/Sydney',
    });
    const sydneyRevision = revision({
      effectiveFromLocalDate: '2026-10-03',
      timezone: 'Australia/Sydney',
      rule: { frequency: 1, period: 'day', preferredDays: [], maxPerDay: 1 },
    });
    const instances = generate({
      plan: sydneyPlan,
      revisions: [sydneyRevision],
      start: '2026-10-03',
      end: '2026-10-05',
    });
    expect(instances.map((instance) => instance.periodKey)).toEqual([
      'day:2026-10-03',
      'day:2026-10-04',
      'day:2026-10-05',
    ]);
    expect(new Set(instances.map((instance) => instance.id)).size).toBe(3);
  });

  it('never generates before the explicit effective date', () => {
    const effectivePlan = plan({ initialEffectiveFromLocalDate: '2026-09-10' });
    const effectiveRevision = revision({ effectiveFromLocalDate: '2026-09-10' });
    const instances = generate({ plan: effectivePlan, revisions: [effectiveRevision] });
    expect(instances).toHaveLength(3);
    expect(instances.every((instance) => instance.eligibilityStartDate === '2026-09-10')).toBe(true);
  });

  it('limits a partial first period to prospectively feasible slots without backfill', () => {
    const lateRevision = revision({
      effectiveFromLocalDate: '2026-09-13',
      rule: { frequency: 4, period: 'week', preferredDays: [], maxPerDay: 1 },
    });
    const instances = generate({
      plan: plan({ initialEffectiveFromLocalDate: '2026-09-13' }),
      revisions: [lateRevision],
    });
    expect(instances).toHaveLength(1);
    expect(instances[0].eligibilityStartDate).toBe('2026-09-13');
  });

  it('does not carry an unmet quota into the next period', () => {
    const firstWeek = generate().slice(0, 1).map((instance) => rhythmInstanceSchema.parse({
      ...instance, lifecycleState: 'closed', completionState: 'skipped', planningState: 'closed',
    }));
    const next = generate({ existing: firstWeek, start: '2026-09-14', end: '2026-09-20' });
    expect(next).toHaveLength(3);
    expect(next.every((instance) => instance.periodKey === 'week:2026-09-14')).toBe(true);
  });

  it('retains preferred days as a snapshot without using them as hard generation gates', () => {
    const instances = generate();
    expect(instances).toHaveLength(3);
    expect(instances[0].recurrenceSnapshot.preferredDays).toEqual(['Monday', 'Wednesday']);
    expect(instances[0].eligibilityStartDate).toBe('2026-09-07');
    expect(instances[0].eligibilityEndDate).toBe('2026-09-13');
  });

  it('produces stable IDs and deduplication keys', () => {
    expect(generate().map((instance) => instance.id)).toEqual(generate().map((instance) => instance.id));
    expect(new Set(generate().map((instance) => instance.deduplicationKey)).size).toBe(3);
  });

  it('is idempotent when generated rows are supplied again after reload', () => {
    const first = generate();
    expect(generate({ existing: first })).toEqual([]);
  });

  it('does not regenerate closed or skipped occurrences', () => {
    const closed = generate().map((instance, index) => rhythmInstanceSchema.parse({
      ...instance,
      lifecycleState: 'closed',
      completionState: index === 0 ? 'done' : 'skipped',
      planningState: 'closed',
    }));
    expect(generate({ existing: closed })).toEqual([]);
  });

  it('generates nothing while paused or disabled', () => {
    expect(generate({ plan: plan({ state: 'paused', pausedAt: createdAt }) })).toEqual([]);
    expect(generate({ plan: plan({ state: 'disabled' }) })).toEqual([]);
  });

  it('keeps distinct quota slots as distinct instances', () => {
    const instances = generate();
    expect(instances.map((instance) => instance.slotNumber)).toEqual([1, 2, 3]);
    expect(new Set(instances.map((instance) => instance.occurrenceKey)).size).toBe(3);
  });

  it('uses a prospective revision without mutating an existing instance snapshot', () => {
    const old = generate().slice(0, 1);
    const nextRevision = revision({
      id: 'revision-2', revisionNumber: 2, effectiveFromLocalDate: '2026-09-10',
      rule: { frequency: 4, period: 'week', preferredDays: ['Friday'], maxPerDay: 1 },
    });
    const next = generate({ revisions: [revision(), nextRevision], existing: old });
    expect(old[0].recurrenceRevisionId).toBe('revision-1');
    expect(old[0].recurrenceSnapshot.preferredDays).toEqual(['Monday', 'Wednesday']);
    expect(next.some((instance) => instance.recurrenceRevisionId === 'revision-2')).toBe(true);
  });
});
