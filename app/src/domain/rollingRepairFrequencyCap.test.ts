import { describe, expect, it } from 'vitest';
import { scheduler as primaryScheduler } from './primaryScheduler';
import type {
  CandidateSchedulingInterval,
  InternalIntention,
  InternalPlacement,
  RhythmRequirement,
  SchedulingDomainModel,
} from './schedulingModel';

const timezone = 'Australia/Perth';
const today = '2026-09-07';
const tomorrow = '2026-09-08';
const later = '2026-09-10';

function candidate(id: string, date: string, start: string, end: string): CandidateSchedulingInterval {
  return {
    id,
    date,
    start,
    end,
    timezone,
    capacityMeaning: 'candidate-not-capacity',
    provenance: ['Frequency-cap regression candidate.'],
  };
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

function placement(
  id: string,
  intentionId: string,
  date: string,
  start: string,
  end: string,
): InternalPlacement {
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
    provenance: ['Frequency-cap regression placement.'],
  };
}

function fixture(firstRhythmVariant: 'normal' | 'minimum' = 'normal') {
  const urgent = intention('urgent', 'must');
  urgent.timing = {
    timeConstraint: 'dueBy',
    dueAt: `${tomorrow}T09:20:00+08:00`,
  };

  const rhythm: RhythmRequirement = {
    id: 'r',
    templateId: 'r',
    title: 'Weekly rhythm',
    area: 'admin',
    period: 'week',
    frequency: 1,
    maxPerDay: 2,
    preferredDays: [],
    preferredTime: 'anytime',
    variants: [
      { kind: 'normal', label: 'Normal', minutes: 20 },
      { kind: 'minimum', label: 'Minimum', minutes: 20 },
    ],
    sourceRecords: [],
  };

  const rhythmPlacement = (
    id: string,
    start: string,
    end: string,
    variantKind: 'normal' | 'minimum',
  ): InternalPlacement => ({
    ...placement(id, 'r', later, start, end),
    targetKind: 'rhythm',
    rhythmId: 'r',
    variantKind,
  });

  const input: SchedulingDomainModel = {
    intentions: [urgent, intention('blocker'), intention('distant')],
    rhythms: [rhythm],
    externalCommitments: [],
    capacityWindows: [],
    placements: [
      placement('p-urgent', 'urgent', today, '09:00', '09:20'),
      placement('p-blocker', 'blocker', tomorrow, '09:00', '09:20'),
      rhythmPlacement('p-r1', '09:00', '09:20', firstRhythmVariant),
      placement('p-distant', 'distant', later, '09:20', '09:40'),
      rhythmPlacement('p-r2', '09:40', '10:00', 'normal'),
    ],
    dayProfiles: [],
    candidateIntervals: [
      candidate('today', today, '09:00', '09:20'),
      candidate('tomorrow', tomorrow, '09:00', '09:20'),
      candidate('later', later, '09:00', '10:00'),
    ],
    preferences: [],
    planningPolicy: { dayMode: 'normal' },
  };

  const before = primaryScheduler.buildPlan(input);
  expect(primaryScheduler.validatePlan(before, input)).toEqual([]);
  expect(before.placements).toEqual(input.placements);

  const nextInput: SchedulingDomainModel = {
    ...input,
    placements: [],
    candidateIntervals: input.candidateIntervals!.slice(1),
    planningPolicy: {
      dayMode: 'normal',
      maxAutomaticPlacementsPerDay: 2,
    },
  };

  return { before, input, nextInput };
}

describe('speculative restoration caps rhythm protection at required frequency', () => {
  it('restores a lower-inertia seed when dropping only excess same-period rhythm coverage', () => {
    const { before, nextInput } = fixture();

    const repaired = primaryScheduler.repairPlan(before, {
      reason: 'Today removed and future automatic-placement cap tightened',
      trigger: 'calendarChanged',
      now: { date: today, time: '08:00', timezone },
      nextInput,
      surfacedPlacementIds: ['p-r1', 'p-r2'],
    });

    expect(repaired.placements.find((item) => item.id === 'p-distant')).toMatchObject({
      intentionId: 'distant',
      date: later,
      start: '09:20',
      end: '09:40',
    });
    expect(repaired.placements.filter((item) => item.rhythmId === 'r')).toEqual([
      expect.objectContaining({ id: 'p-r1', variantKind: 'normal' }),
    ]);
    expect(repaired.unscheduledIntentionIds).toEqual(['blocker']);
    expect(repaired.unscheduledRhythmIds).toEqual([]);
    expect(repaired.repair?.preservedPlacementIds).toEqual(['p-distant', 'p-r1']);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });

  it('still rejects restoration when it would keep only a weaker form of required rhythm coverage', () => {
    const { before, nextInput } = fixture('minimum');

    const repaired = primaryScheduler.repairPlan(before, {
      reason: 'Today removed and future automatic-placement cap tightened',
      trigger: 'calendarChanged',
      now: { date: today, time: '08:00', timezone },
      nextInput,
      surfacedPlacementIds: ['p-r1', 'p-r2'],
    });

    expect(repaired.placements.some((item) => item.id === 'p-distant')).toBe(false);
    expect(repaired.placements.filter((item) => item.rhythmId === 'r')).toEqual([
      expect.objectContaining({ id: 'p-r1', variantKind: 'minimum' }),
      expect.objectContaining({ id: 'p-r2', variantKind: 'normal' }),
    ]);
    expect(repaired.unscheduledIntentionIds).toEqual(['blocker', 'distant']);
    expect(repaired.unscheduledRhythmIds).toEqual([]);
    expect(primaryScheduler.validatePlan(repaired, nextInput)).toEqual([]);
  });
});
