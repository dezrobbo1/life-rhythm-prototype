import { describe, expect, it } from 'vitest';
import type { SchedulerPlan, SchedulingDomainModel } from '../../domain/schedulingModel';
import { buildTodayCalmSurface } from './todayCalmSurface';

const date = '2026-09-15';

function domain(overrides: Partial<SchedulingDomainModel> = {}): SchedulingDomainModel {
  return {
    intentions: [],
    rhythms: [],
    externalCommitments: [],
    capacityWindows: [],
    placements: [],
    dayProfiles: [],
    ...overrides,
  };
}

function plan(overrides: Partial<SchedulerPlan> = {}): SchedulerPlan {
  return {
    placements: [],
    rejectedExistingPlacements: [],
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
    ...overrides,
  };
}

function fixed(id: string, title: string, start: string, end: string) {
  return {
    id,
    title,
    source: 'calendar' as const,
    sourceId: `calendar:${id}`,
    interval: {
      kind: 'datedLocal' as const,
      date,
      start,
      end,
      timezone: 'Australia/Perth',
    },
    hard: true,
    travelBeforeMinutes: 0,
    transitionAfterMinutes: 0,
  };
}

function privatePlacement(
  id: string,
  intentionId: string,
  start: string,
  end: string,
  origin: 'scheduler' | 'existingUserConfirmed',
) {
  return {
    id,
    intentionId,
    date,
    start,
    end,
    origin,
    targetKind: 'intention' as const,
    variantKind: 'normal' as const,
    provenance: [origin === 'scheduler' ? 'scheduler' : 'user'],
    ...(origin === 'existingUserConfirmed'
      ? { sourcePlacementId: `soft:${id}` }
      : {}),
  };
}

describe('Gate 6D calm Today truth', () => {
  it.each([
    ['automatic', 'scheduler'],
    ['userConfirmed', 'existingUserConfirmed'],
  ] as const)(
    'keeps a current %s placement visible while a different task remains selected as Now',
    (expectedKind, origin) => {
      const placement = privatePlacement('task-b-placement', 'task-b', '12:00', '12:30', origin);
      const input = domain({
        placements: origin === 'existingUserConfirmed' ? [placement] : [],
      });
      const savedPlan = plan({
        placements: origin === 'scheduler' ? [placement] : [],
      });
      const at = (nowTime: string) => buildTodayCalmSurface({
        date,
        nowTime,
        input,
        planStatus: 'available',
        plan: savedPlan,
        titleByTargetId: { 'task-a': 'Selected task A', 'task-b': 'Scheduled task B' },
        currentTaskTargetId: 'task-a',
      });

      expect(at('11:59').later.items).toEqual([
        expect.objectContaining({ kind: expectedKind, title: 'Scheduled task B' }),
      ]);
      expect(at('11:59').currentPrivatePlacements).toEqual([]);

      for (const nowTime of ['12:00', '12:15']) {
        const result = at(nowTime);
        expect(result.currentPrivatePlacements).toEqual([
          expect.objectContaining({
            detail: origin === 'scheduler'
              ? 'Flexible private plan · normal'
              : 'User-confirmed placement · normal',
            kind: expectedKind,
            title: 'Scheduled task B',
          }),
        ]);
        expect(result.later.items).toEqual([]);
      }

      expect(at('12:30').currentPrivatePlacements).toEqual([]);
      expect(at('12:30').later.items).toEqual([]);
    },
  );

  it('does not duplicate the selected Now task but keeps other current private and fixed facts', () => {
    const selected = privatePlacement('selected-placement', 'task-a', '12:00', '12:30', 'scheduler');
    const other = privatePlacement('other-placement', 'task-b', '12:00', '12:30', 'scheduler');
    const result = buildTodayCalmSurface({
      date,
      nowTime: '12:15',
      input: domain({
        externalCommitments: [
          fixed('one', 'Current meeting', '12:00', '12:20'),
          fixed('two', 'Overlapping appointment', '12:10', '12:40'),
        ],
      }),
      planStatus: 'available',
      plan: plan({ placements: [selected, other] }),
      titleByTargetId: { 'task-a': 'Selected task A', 'task-b': 'Scheduled task B' },
      currentTaskTargetId: 'task-a',
    });

    expect(result.currentCommitments.map((item) => [item.title, item.kind])).toEqual([
      ['Current meeting', 'fixed'],
      ['Overlapping appointment', 'fixed'],
    ]);
    expect(result.currentPrivatePlacements.map((item) => [item.title, item.kind])).toEqual([
      ['Scheduled task B', 'automatic'],
    ]);
    expect(result.currentPrivatePlacements.map((item) => item.title)).not.toContain('Selected task A');
    expect(result.later.items).toEqual([]);
  });

  it('shows current private placement context when no Now task is selected without mutating inputs', () => {
    const placement = privatePlacement('current-placement', 'task-b', '12:00', '12:30', 'scheduler');
    const input = domain();
    const savedPlan = plan({ placements: [placement] });
    const before = JSON.stringify({ input, savedPlan });

    const result = buildTodayCalmSurface({
      date,
      nowTime: '12:15',
      input,
      planStatus: 'available',
      plan: savedPlan,
      titleByTargetId: { 'task-b': 'Scheduled task B' },
    });

    expect(result.currentPrivatePlacements).toEqual([
      expect.objectContaining({ kind: 'automatic', title: 'Scheduled task B' }),
    ]);
    expect(JSON.stringify({ input, savedPlan })).toBe(before);
  });

  it('finds current fixed context and orders only factual, unelapsed Later rows', () => {
    const result = buildTodayCalmSurface({
      date,
      nowTime: '10:15',
      input: domain({
        externalCommitments: [
          fixed('elapsed', 'Morning call', '08:00', '08:30'),
          fixed('current', 'School meeting', '10:00', '10:30'),
          fixed('overlap', 'Overlapping appointment', '10:10', '10:45'),
          fixed('later', 'Dentist', '14:00', '15:00'),
        ],
        placements: [{
          id: 'manual', intentionId: 'manual-task', date, start: '13:00', end: '13:20',
          origin: 'existingUserConfirmed', sourcePlacementId: 'soft:manual', provenance: ['user'],
        }],
      }),
      planStatus: 'available',
      plan: plan({ placements: [
        {
          id: 'now-task-plan', intentionId: 'now-task', date, start: '11:00', end: '11:20',
          origin: 'scheduler', targetKind: 'intention', variantKind: 'minimum', provenance: ['scheduler'],
        },
        {
          id: 'automatic', intentionId: 'automatic-task', date, start: '12:00', end: '12:30',
          origin: 'scheduler', targetKind: 'intention', variantKind: 'normal', provenance: ['scheduler'],
        },
      ] }),
      titleByTargetId: {
        'now-task': 'Current task',
        'automatic-task': 'Write outline',
        'manual-task': 'Call the plumber',
      },
      currentTaskTargetId: 'now-task',
    });

    expect(result.currentCommitments.map((item) => item.title)).toEqual([
      'School meeting',
      'Overlapping appointment',
    ]);
    expect(result.nextBoundaryTime).toBe('10:30');
    expect(result.later.items.map((item) => [item.title, item.kind])).toEqual([
      ['Write outline', 'automatic'],
      ['Call the plumber', 'userConfirmed'],
      ['Dentist', 'fixed'],
    ]);
    expect(result.later.items.map((item) => item.title)).not.toContain('Morning call');
    expect(result.later.items.map((item) => item.title)).not.toContain('School meeting');
    expect(result.later.items.map((item) => item.title)).not.toContain('Overlapping appointment');
    expect(result.later.items.map((item) => item.title)).not.toContain('Current task');
  });

  it('does not turn capacity, ask-first, protected, work context, or blank gaps into Later rows', () => {
    const result = buildTodayCalmSurface({
      date,
      nowTime: '09:00',
      input: domain({
        dayProfiles: [{
          id: 'workday', name: 'Workday', kind: 'workday', assignedWeekdays: ['Tuesday'],
          workPeriod: { start: '09:00', end: '17:00' }, workPlanningUse: 'askFirst',
        }],
        capacityWindows: [
          {
            id: 'possible', title: 'Possible space', category: 'openCapacity',
            interval: { kind: 'recurringLocal', days: ['Tuesday'], start: '10:00', end: '11:00' },
            schedulerUse: 'available', sourceId: 'possible',
          },
          {
            id: 'ask', title: 'Ask first', category: 'familyTime',
            interval: { kind: 'recurringLocal', days: ['Tuesday'], start: '11:00', end: '12:00' },
            schedulerUse: 'askFirst', sourceId: 'ask',
          },
          {
            id: 'protected', title: 'Protected', category: 'recoveryTime',
            interval: { kind: 'recurringLocal', days: ['Tuesday'], start: '12:00', end: '13:00' },
            schedulerUse: 'unavailable', sourceId: 'protected',
          },
        ],
      }),
      planStatus: 'available',
      plan: plan(),
      titleByTargetId: {},
    });

    expect(result.later.items).toEqual([]);
    expect(result.later.remainingCount).toBe(0);
  });

  it('keeps the visible Later ledger small and reports the remaining factual count', () => {
    const placements = Array.from({ length: 6 }, (_, index) => ({
      id: `placement-${index}`,
      intentionId: `task-${index}`,
      date,
      start: `${String(10 + index).padStart(2, '0')}:00`,
      end: `${String(10 + index).padStart(2, '0')}:20`,
      origin: 'scheduler' as const,
      targetKind: 'intention' as const,
      provenance: ['scheduler'],
    }));
    const result = buildTodayCalmSurface({
      date,
      nowTime: '09:00',
      input: domain(),
      planStatus: 'available',
      plan: plan({ placements }),
      titleByTargetId: Object.fromEntries(placements.map((placement, index) => [placement.intentionId, `Task ${index}`])),
    });

    expect(result.later.items).toHaveLength(4);
    expect(result.later.remainingCount).toBe(2);
  });

  it.each(['missing', 'invalid', 'error'] as const)(
    'does not fabricate automatic Later rows when the saved plan is %s',
    (planStatus) => {
      const result = buildTodayCalmSurface({
        date,
        nowTime: '09:00',
        input: domain({ externalCommitments: [fixed('later', 'Real appointment', '14:00', '15:00')] }),
        planStatus,
        plan: null,
        titleByTargetId: {},
      });

      expect(result.later.items.map((item) => item.title)).toEqual(['Real appointment']);
      expect(result.later.planStatus).toBe(planStatus);
      expect(result.changed).toBeNull();
    },
  );

  it('formats all persisted change kinds with titles and actual repair attribution', () => {
    const result = buildTodayCalmSurface({
      date,
      nowTime: '09:00',
      input: domain(),
      planStatus: 'available',
      plan: plan({
        repair: {
          trigger: 'calendarChanged',
          reason: 'A read-only calendar commitment changed.',
          now: { date, time: '09:00', timezone: 'Australia/Perth' },
          frozenPastPlacementIds: [],
          preservedPlacementIds: [],
          undo: plan(),
          changes: [
            {
              kind: 'moved', targetKind: 'intention', targetId: 'move',
              from: { date, start: '10:00', end: '10:20', variantKind: 'normal' },
              to: { date, start: '11:00', end: '11:20', variantKind: 'normal' },
              reason: 'Moved around the new commitment.',
            },
            {
              kind: 'added', targetKind: 'rhythm', targetId: 'add',
              to: { date, start: '12:00', end: '12:10', variantKind: 'minimum' },
              reason: 'A safe placement became available.',
            },
            {
              kind: 'removed', targetKind: 'intention', targetId: 'remove',
              from: { date, start: '13:00', end: '13:30', variantKind: 'normal' },
              reason: 'It no longer fitted safely.',
            },
            {
              kind: 'variantChanged', targetKind: 'intention', targetId: 'variant',
              from: { date, start: '14:00', end: '14:20', variantKind: 'normal' },
              to: { date, start: '14:00', end: '14:05', variantKind: 'minimum' },
              reason: 'The smaller form fitted safely.',
            },
          ],
        },
      }),
      titleByTargetId: {
        move: 'Move me', add: 'Gentle reset', remove: 'Leave out', variant: 'Make smaller',
      },
    });

    expect(result.changed?.attribution).toBe('Calendar information changed the private plan.');
    expect(result.changed?.items.map((item) => item.title)).toEqual([
      'Move me', 'Gentle reset', 'Leave out', 'Make smaller',
    ]);
    expect(result.changed?.items.map((item) => item.summary)).toEqual([
      'Moved from 10:00–10:20 to 11:00–11:20.',
      'Added at 12:00–12:10.',
      'Removed from 13:00–13:30.',
      'Changed from Normal, 20 min to Minimum, 5 min.',
    ]);
    expect(JSON.stringify(result.changed)).not.toContain('targetId');
  });

  it('attributes Reduced Day only when the actual latest repair metadata says so', () => {
    const reduced = buildTodayCalmSurface({
      date,
      nowTime: '09:00',
      input: domain(),
      planStatus: 'available',
      plan: plan({ repair: {
        trigger: 'userCorrection',
        reason: 'Reduce today was applied to the current local date.',
        frozenPastPlacementIds: [], preservedPlacementIds: [], changes: [], undo: plan(),
      } }),
      titleByTargetId: {},
    });
    const laterRepair = buildTodayCalmSurface({
      date,
      nowTime: '09:00',
      input: domain({ planningPolicy: { dayMode: 'reduced', dayModeDate: date } }),
      planStatus: 'available',
      plan: plan({ repair: {
        trigger: 'completionChanged',
        reason: 'A Today task was completed.',
        frozenPastPlacementIds: [], preservedPlacementIds: [], changes: [{
          kind: 'removed', targetKind: 'intention', targetId: 'task',
          from: { date, start: '10:00', end: '10:20' }, reason: 'A Today task was completed.',
        }], undo: plan(),
      } }),
      titleByTargetId: { task: 'Finished task' },
    });

    expect(reduced.changed).toBeNull();
    expect(laterRepair.changed?.attribution).toBe('Completion changed the private plan.');
    expect(laterRepair.changed?.attribution).not.toContain('Reduced Day');
  });

  it('omits Changed when the accepted repair has no actual changes', () => {
    const result = buildTodayCalmSurface({
      date,
      nowTime: '09:00',
      input: domain(),
      planStatus: 'available',
      plan: plan({ repair: {
        trigger: 'userCorrection', reason: 'A repair was checked.',
        frozenPastPlacementIds: [], preservedPlacementIds: [], changes: [], undo: plan(),
      } }),
      titleByTargetId: {},
    });

    expect(result.changed).toBeNull();
  });

  it('is deterministic and does not mutate its inputs', () => {
    const input = domain({ externalCommitments: [fixed('later', 'Appointment', '14:00', '15:00')] });
    const savedPlan = plan();
    const before = JSON.stringify({ input, savedPlan });
    const args = {
      date,
      nowTime: '09:00',
      input,
      planStatus: 'available' as const,
      plan: savedPlan,
      titleByTargetId: {},
    };

    expect(buildTodayCalmSurface(args)).toEqual(buildTodayCalmSurface(args));
    expect(JSON.stringify({ input, savedPlan })).toBe(before);
  });
});
