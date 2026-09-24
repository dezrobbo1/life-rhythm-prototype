import { describe, expect, it } from 'vitest';
import { DeterministicScheduler } from './scheduler';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  SchedulingDomainModel,
  SchedulingPreference,
} from './schedulingModel';

function intention(): InternalIntention {
  return {
    id: 'admin-task',
    title: 'Admin task',
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
    sourceRecords: [{ kind: 'taskPoolItem', id: 'admin-task' }],
  };
}

function candidate(start = '09:00', end = '12:00'): CandidateSchedulingInterval {
  return {
    id: 'monday-window',
    date: '2026-09-07',
    start,
    end,
    timezone: 'Australia/Perth',
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Synthetic Gate 7D1 candidate.'],
  };
}

function preference(overrides: Partial<SchedulingPreference>): SchedulingPreference {
  return {
    id: 'preference',
    targetKind: 'area',
    targetValue: 'admin',
    relation: 'prefer',
    days: ['Monday'],
    provenance: 'Synthetic preference.',
    ...overrides,
  };
}

function model(preferences: SchedulingPreference[], interval = candidate()): SchedulingDomainModel {
  return {
    intentions: [intention()],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: [interval],
    preferences,
  };
}

describe('Gate 7D1 scheduler preference integration', () => {
  it('uses a persistent explicit preference while it is active for the candidate slot', () => {
    const scheduler = new DeterministicScheduler();
    const plan = scheduler.buildPlan(model([
      preference({
        id: 'late-morning',
        start: '11:00',
        end: '12:00',
        precedenceSource: 'explicitPersistent',
        activeFrom: '2026-09-07T00:00:00Z',
        expiresAt: '2026-09-07T04:00:00Z',
      }),
    ]));

    expect(plan.placements[0]).toMatchObject({
      start: '11:00',
      end: '11:20',
    });
    expect(plan.placements[0].provenance.join(' ')).toContain('late-morning');
  });

  it('does not apply a preference after its absolute expiry in the candidate timezone', () => {
    const scheduler = new DeterministicScheduler();
    const plan = scheduler.buildPlan(model([
      preference({
        id: 'expired-before-window',
        start: '11:00',
        end: '12:00',
        precedenceSource: 'explicitPersistent',
        activeFrom: '2026-09-07T00:00:00Z',
        expiresAt: '2026-09-07T02:00:00Z',
      }),
    ]));

    expect(plan.placements[0]).toMatchObject({
      start: '09:00',
      end: '09:20',
    });
    expect(plan.placements[0].provenance.join(' ')).not.toContain('expired-before-window');
  });

  it('clips a temporary avoid preference at its expiry instead of avoiding the whole declared window', () => {
    const scheduler = new DeterministicScheduler();
    const plan = scheduler.buildPlan(model([
      preference({
        id: 'avoid-until-0930',
        relation: 'avoid',
        start: '09:00',
        end: '10:00',
        precedenceSource: 'explicitPersistent',
        activeFrom: '2026-09-07T00:00:00Z',
        expiresAt: '2026-09-07T01:30:00Z',
      }),
    ]));

    expect(plan.placements[0]).toMatchObject({
      start: '09:30',
      end: '09:50',
    });
  });

  it('lets higher-precedence explicit guidance outrank a conflicting weaker association', () => {
    const scheduler = new DeterministicScheduler();
    const plan = scheduler.buildPlan(model([
      preference({
        id: 'weak-like-early',
        precedenceSource: 'weakAssociation',
        start: '09:00',
        end: '10:00',
        relation: 'prefer',
      }),
      preference({
        id: 'explicit-avoid-early',
        precedenceSource: 'explicitPersistent',
        start: '09:00',
        end: '10:00',
        relation: 'avoid',
      }),
    ]));

    expect(plan.placements[0]).toMatchObject({
      start: '10:00',
      end: '10:20',
    });
    expect(plan.placements[0].provenance.join(' ')).not.toContain('weak-like-early');
  });

  it('keeps equal-authority contradictions visible instead of silently breaking the tie', () => {
    const scheduler = new DeterministicScheduler();
    const input = model([
      preference({
        id: 'prefer-10',
        precedenceSource: 'explicitPersistent',
        start: '10:00',
        end: '11:00',
        relation: 'prefer',
      }),
      preference({
        id: 'avoid-10',
        precedenceSource: 'explicitPersistent',
        start: '10:00',
        end: '11:00',
        relation: 'avoid',
      }),
    ], candidate('10:00', '12:00'));

    const forward = scheduler.buildPlan(input);
    const reversed = scheduler.buildPlan({
      ...input,
      preferences: [...(input.preferences ?? [])].reverse(),
    });

    expect(forward.placements[0]).toMatchObject({ start: '10:00', end: '10:20' });
    expect(forward.placements[0].provenance.join(' ')).toContain(
      'Conflicting preference guidance was not used to rank this slot',
    );
    expect(reversed).toEqual(forward);
  });
});
