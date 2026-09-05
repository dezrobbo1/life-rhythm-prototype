import { describe, expect, it } from 'vitest';
import { RollingHorizonScheduler } from './rollingHorizonScheduler';
import type { CandidateSchedulingInterval, SchedulingDomainModel } from './schedulingModel';

const timezone = 'Australia/Perth';

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return `${next.getUTCFullYear().toString().padStart(4, '0')}-${(next.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${next.getUTCDate().toString().padStart(2, '0')}`;
}

function candidates(startDate: string, days: number): CandidateSchedulingInterval[] {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      id: `candidate-${date}`,
      date,
      start: '09:00',
      end: '10:00',
      timezone,
      capacityMeaning: 'candidate-not-capacity' as const,
      provenance: ['Rolling-horizon regression candidate.'],
    };
  });
}

function model(startDate: string, days: number): SchedulingDomainModel {
  return {
    intentions: [],
    rhythms: [
      {
        id: 'walk',
        templateId: 'walk-template',
        title: 'Walk',
        area: 'movement',
        frequency: 3,
        period: 'week',
        preferredDays: [],
        preferredTime: 'morning',
        maxPerDay: 1,
        variants: [
          { kind: 'normal', label: 'Walk', minutes: 10 },
          { kind: 'minimum', label: 'Short walk', minutes: 5 },
        ],
        sourceRecords: [{ kind: 'rhythmTemplate', id: 'walk-template' }],
      },
    ],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    candidateIntervals: candidates(startDate, days),
    preferences: [],
  };
}

describe('rolling-horizon rhythm scheduling', () => {
  it('does not grant a full weekly frequency to both sides of a Monday boundary', () => {
    const scheduler = new RollingHorizonScheduler();
    // Friday through Thursday crosses the scheduler's Monday-anchored week boundary.
    const plan = scheduler.buildPlan(model('2026-09-04', 7));
    const walks = plan.placements.filter((placement) => placement.rhythmId === 'walk');

    expect(walks).toHaveLength(3);
    expect(new Set(walks.map((placement) => placement.date)).size).toBe(3);
    expect(plan.unscheduledRhythmIds).not.toContain('walk');
  });

  it('scales the cap across a two-week rolling horizon instead of each partial calendar week', () => {
    const scheduler = new RollingHorizonScheduler();
    const plan = scheduler.buildPlan(model('2026-09-04', 14));
    const walks = plan.placements.filter((placement) => placement.rhythmId === 'walk');

    expect(walks).toHaveLength(6);
  });
});
