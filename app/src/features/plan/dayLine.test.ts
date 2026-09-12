import { describe, expect, it } from 'vitest';
import type { SchedulerPlan, SchedulingDomainModel } from '../../domain/schedulingModel';
import { buildPlanDayLine } from './dayLine';

const date = '2026-09-14';

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

describe('Gate 6C Plan Day Line', () => {
  it('puts real fixed, work, protected, user-confirmed and automatic items on one chronological line', () => {
    const result = buildPlanDayLine({
      date,
      input: domain({
        externalCommitments: [
          {
            id: 'calendar-school-run',
            title: 'School run',
            source: 'calendar',
            sourceId: 'calendar:school-run',
            interval: {
              kind: 'datedLocal',
              date,
              start: '08:15',
              end: '08:45',
              timezone: 'Australia/Perth',
            },
            hard: true,
            travelBeforeMinutes: 0,
            transitionAfterMinutes: 0,
          },
        ],
        dayProfiles: [
          {
            id: 'profile-workday',
            name: 'Workday',
            kind: 'workday',
            assignedWeekdays: ['Monday'],
            workPeriod: { start: '08:00', end: '16:00' },
            workPlanningUse: 'workRhythmsOnly',
          },
        ],
        capacityWindows: [
          {
            id: 'protected-lunch',
            title: 'Lunch reset',
            category: 'recoveryTime',
            interval: {
              kind: 'recurringLocal',
              days: ['Monday'],
              start: '12:30',
              end: '13:00',
            },
            schedulerUse: 'unavailable',
            sourceId: 'protected-lunch',
          },
          {
            id: 'ask-first-evening',
            title: 'Family buffer',
            category: 'familyTime',
            interval: {
              kind: 'recurringLocal',
              days: ['Monday'],
              start: '17:00',
              end: '18:00',
            },
            schedulerUse: 'askFirst',
            sourceId: 'ask-first-evening',
          },
          {
            id: 'explicit-open',
            title: 'Open afternoon',
            category: 'openCapacity',
            interval: {
              kind: 'recurringLocal',
              days: ['Monday'],
              start: '15:00',
              end: '16:00',
            },
            schedulerUse: 'available',
            sourceId: 'explicit-open',
          },
        ],
        placements: [
          {
            id: 'manual-call',
            intentionId: 'call-task',
            date,
            start: '14:00',
            end: '14:20',
            origin: 'existingUserConfirmed',
            sourcePlacementId: 'soft-call',
            provenance: ['user'],
          },
        ],
      }),
      plan: plan({
        placements: [
          {
            id: 'automatic-admin',
            intentionId: 'admin-task',
            date,
            start: '09:30',
            end: '10:00',
            origin: 'scheduler',
            targetKind: 'intention',
            variantKind: 'normal',
            provenance: ['scheduler'],
          },
        ],
      }),
      titleByTargetId: {
        'admin-task': 'Clear admin note',
        'call-task': 'Make the call',
      },
    });

    expect(result.items.map((item) => [item.start, item.title, item.kind])).toEqual([
      ['08:00', 'Workday', 'work'],
      ['08:15', 'School run', 'fixed'],
      ['09:30', 'Clear admin note', 'automatic'],
      ['12:30', 'Lunch reset', 'protected'],
      ['14:00', 'Make the call', 'userConfirmed'],
      ['15:00', 'Open afternoon', 'possible'],
      ['17:00', 'Family buffer', 'askFirst'],
    ]);
    expect(result.items.find((item) => item.title === 'School run')?.detail).toContain('read-only calendar');
    expect(result.items.find((item) => item.title === 'Workday')?.detail).toContain('work rhythms only');
    expect(result.items.find((item) => item.title === 'Open afternoon')?.detail).toContain('explicitly marked available');
  });

  it('uses canonical current placement state when the accepted scheduler snapshot is stale', () => {
    const result = buildPlanDayLine({
      date,
      input: domain({
        placements: [
          {
            id: 'current-user-placement',
            intentionId: 'current-task',
            date,
            start: '10:00',
            end: '10:20',
            origin: 'existingUserConfirmed',
            sourcePlacementId: 'current-user-placement',
            provenance: ['current'],
          },
        ],
      }),
      plan: plan({
        placements: [
          {
            id: 'stale-user-placement',
            intentionId: 'stale-task',
            date,
            start: '09:00',
            end: '09:20',
            origin: 'existingUserConfirmed',
            sourcePlacementId: 'stale-user-placement',
            provenance: ['stale'],
          },
          {
            id: 'scheduler-placement',
            intentionId: 'scheduler-task',
            date,
            start: '11:00',
            end: '11:20',
            origin: 'scheduler',
            provenance: ['accepted'],
          },
        ],
      }),
      titleByTargetId: {
        'current-task': 'Current user placement',
        'stale-task': 'Removed user placement',
        'scheduler-task': 'Accepted automatic placement',
      },
    });

    expect(result.items.map((item) => item.title)).toEqual([
      'Current user placement',
      'Accepted automatic placement',
    ]);
  });

  it('shows only facts that apply to the selected date', () => {
    const result = buildPlanDayLine({
      date,
      input: domain({
        externalCommitments: [
          {
            id: 'wrong-date',
            title: 'Tomorrow commitment',
            source: 'calendar',
            sourceId: 'tomorrow',
            interval: {
              kind: 'datedLocal',
              date: '2026-09-15',
              start: '09:00',
              end: '10:00',
            },
            hard: true,
            travelBeforeMinutes: 0,
            transitionAfterMinutes: 0,
          },
        ],
        dayProfiles: [
          {
            id: 'tuesday-profile',
            name: 'Tuesday workday',
            kind: 'workday',
            assignedWeekdays: ['Tuesday'],
            workPeriod: { start: '08:00', end: '16:00' },
            workPlanningUse: 'unavailable',
          },
        ],
        capacityWindows: [
          {
            id: 'tuesday-only',
            title: 'Tuesday protection',
            category: 'protectedTime',
            interval: {
              kind: 'recurringLocal',
              days: ['Tuesday'],
              start: '10:00',
              end: '11:00',
            },
            schedulerUse: 'unavailable',
            sourceId: 'tuesday-only',
          },
        ],
      }),
      plan: plan({
        placements: [
          {
            id: 'tomorrow-plan',
            intentionId: 'task-tomorrow',
            date: '2026-09-15',
            start: '11:00',
            end: '11:20',
            origin: 'scheduler',
            provenance: [],
          },
        ],
      }),
      titleByTargetId: { 'task-tomorrow': 'Tomorrow task' },
    });

    expect(result.items).toEqual([]);
  });

  it('does not manufacture a line item from an unclassified blank gap', () => {
    const result = buildPlanDayLine({
      date,
      input: domain(),
      plan: plan(),
      titleByTargetId: {},
    });

    expect(result.items).toEqual([]);
  });
});
