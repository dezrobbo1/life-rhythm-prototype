// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDayShapePreviewViewModel,
  buildLibraryViewModel,
  buildPlanViewModel,
  buildResetViewModel,
  buildSetupViewModel,
  buildSoftScheduleSuggestionsViewModel,
  buildTimeEdgeReentryPreviewViewModel,
  buildTodayViewModel,
  emptyAppSnapshot,
  futureModulesDisabledSnapshot,
  libraryWithEnabledDisabledRhythmsSnapshot,
  normalDayWithOneTaskSnapshot,
  planWithFixedCommitmentsSnapshot,
  type AppDataSnapshot,
} from './index';

const dayShapeSnapshot: AppDataSnapshot = {
  settings: {
    theme: 'exhale',
    lifeShape: {
      commuteMinutes: 0,
      fixedCommitments: [],
      lowCapacityPreference: 'protect-evening',
      mealAnchors: {
        breakfast: '07:00',
        dinner: '18:00',
        lunch: '12:00',
      },
      sleepWakeAnchors: {
        sleep: '21:30',
        wake: '06:30',
      },
      timeBlocks: [
        {
          days: ['Monday'],
          end: '08:00',
          id: 'protected-morning',
          label: 'Protected morning',
          schedulerUse: 'unavailable',
          start: '07:00',
          type: 'protectedTime',
        },
        {
          days: ['Monday'],
          end: '14:00',
          id: 'recovery-after-lunch',
          label: 'Recovery after lunch',
          schedulerUse: 'unavailable',
          start: '13:00',
          type: 'recoveryTime',
        },
        {
          days: ['Monday'],
          end: '18:00',
          id: 'family-evening',
          label: 'Family evening',
          schedulerUse: 'unavailable',
          start: '17:00',
          type: 'familyTime',
        },
        {
          days: ['Monday'],
          end: '11:00',
          id: 'loose-late-morning',
          label: 'Loose late morning',
          schedulerUse: 'askFirst',
          start: '10:00',
          type: 'looseTime',
        },
        {
          days: ['Monday'],
          end: '16:00',
          id: 'household-flow',
          label: 'Household flow',
          schedulerUse: 'askFirst',
          start: '15:00',
          type: 'householdFlow',
        },
        {
          days: ['Tuesday'],
          end: '12:00',
          id: 'tuesday-window',
          label: 'Tuesday window',
          notes: 'Only if the day still has room.',
          schedulerUse: 'available',
          start: '11:00',
          type: 'openCapacity',
        },
      ],
      transitionBufferMinutes: 10,
      travelMinutes: 0,
      usualWorkHours: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        end: '16:00',
        start: '08:00',
      },
    },
  },
};

const reviewNow = '2026-06-18T12:00:00.000Z';

type SnapshotActiveTaskForTest = NonNullable<AppDataSnapshot['activeTasks']>[number];
type TimeBlockForTest = NonNullable<NonNullable<AppDataSnapshot['settings']>['lifeShape']>['timeBlocks'][number];

function timeEdgeTask(overrides: Partial<SnapshotActiveTaskForTest> = {}): SnapshotActiveTaskForTest {
  const {
    id = 'time-edge-task',
    minimum = {
      label: 'Do the smallest useful version.',
      minutes: 5,
    },
    showToday = true,
    status = 'active',
    title = 'Review form',
    ...rest
  } = overrides;

  return {
    ...rest,
    id,
    minimum,
    showToday,
    status,
    title,
  };
}

function timeBlock(overrides: Partial<TimeBlockForTest>): TimeBlockForTest {
  return {
    days: ['Monday'],
    end: '12:00',
    id: 'block',
    label: 'Block',
    schedulerUse: 'available',
    start: '11:00',
    type: 'openCapacity',
    ...overrides,
  };
}

function softScheduleSnapshot(overrides: Partial<AppDataSnapshot> = {}): AppDataSnapshot {
  return {
    activeTasks: [
      timeEdgeTask({
        deadline: {
          dueAt: '2026-06-18T15:00:00.000Z',
          timeConstraint: 'dueBy',
        },
        id: 'send-form',
        title: 'Send the form',
      }),
      timeEdgeTask({
        id: 'done-task',
        status: 'done',
        title: 'Already done',
      }),
      timeEdgeTask({
        id: 'parked-task',
        status: 'parked',
        title: 'Parked task',
      }),
      timeEdgeTask({
        id: 'not-today-task',
        status: 'notToday',
        title: 'Not today task',
      }),
    ],
    settings: {
      theme: 'exhale',
      lifeShape: {
        ...dayShapeSnapshot.settings?.lifeShape,
        timeBlocks: [
          timeBlock({
            id: 'protected-morning',
            label: 'Protected morning',
            schedulerUse: 'unavailable',
            start: '07:00',
            end: '08:00',
            type: 'protectedTime',
          }),
          timeBlock({
            id: 'recovery-after-lunch',
            label: 'Recovery after lunch',
            schedulerUse: 'unavailable',
            start: '13:00',
            end: '14:00',
            type: 'recoveryTime',
          }),
          timeBlock({
            id: 'family-evening',
            label: 'Family evening',
            schedulerUse: 'unavailable',
            start: '17:00',
            end: '18:00',
            type: 'familyTime',
          }),
          timeBlock({
            id: 'loose-morning',
            label: 'Loose morning',
            schedulerUse: 'askFirst',
            start: '10:00',
            end: '11:00',
            type: 'looseTime',
          }),
          timeBlock({
            id: 'open-capacity',
            label: 'Open capacity window',
            schedulerUse: 'available',
            start: '11:00',
            end: '12:00',
            type: 'openCapacity',
          }),
        ],
      } as NonNullable<NonNullable<AppDataSnapshot['settings']>['lifeShape']>,
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('read-only view model selectors', () => {
  it('returns a safe Today empty state for an empty snapshot', () => {
    const viewModel = buildTodayViewModel(emptyAppSnapshot);

    expect(viewModel.nextUsefulAction).toBeNull();
    expect(viewModel.emptyState.title).toBe('Choose rhythms to turn on');
    expect(viewModel.emptyState.primaryActionLabel).toBe('Add one-off');
  });

  it('returns the next useful action when Today data exists', () => {
    const viewModel = buildTodayViewModel(normalDayWithOneTaskSnapshot);

    expect(viewModel.nextUsefulAction?.title).toBe("Set tomorrow's first step");
    expect(viewModel.nextUsefulAction?.source).toBe('adhoc');
    expect(viewModel.planAdjustedLine).toContain('one useful next action');
  });

  it('preserves task versions for the Today task', () => {
    const viewModel = buildTodayViewModel(normalDayWithOneTaskSnapshot);

    expect(viewModel.nextUsefulAction?.versions.minimum.text).toBe('Write one first step for tomorrow.');
    expect(viewModel.nextUsefulAction?.versions.normal.text).toBe(
      'Choose the first step, place one needed item, and park the rest.',
    );
    expect(viewModel.nextUsefulAction?.versions.full.text).toBe(
      "Review tomorrow's top three and clear one hidden edge.",
    );
  });

  it('returns no re-entry preview when no time-edge task needs review', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({
          deadline: {
            dueAt: '2026-06-18T18:00:00.000Z',
            timeConstraint: 'dueBy',
          },
        }),
      ],
    }, { now: reviewNow });

    expect(viewModel.items).toEqual([]);
  });

  it('flags dueBy tasks after their useful-before time', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({
          deadline: {
            dueAt: '2026-06-18T09:00:00.000Z',
            timeConstraint: 'dueBy',
          },
        }),
      ],
    }, { now: reviewNow });

    expect(viewModel.items[0]).toMatchObject({
      reason: 'Useful-before time has passed; choose what still helps.',
      title: 'Review form',
    });
  });

  it('flags fixedAt tasks after their fixed-time point', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({
          deadline: {
            fixedAt: '2026-06-18T09:00:00.000Z',
            timeConstraint: 'fixedAt',
          },
        }),
      ],
    }, { now: reviewNow });

    expect(viewModel.items[0]?.reason).toBe('The fixed-time point has passed; choose what still helps.');
  });

  it('flags expiresAfter tasks after their useful-until time', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({
          deadline: {
            expiresAfter: '2026-06-18T09:00:00.000Z',
            timeConstraint: 'expiresAfter',
          },
        }),
      ],
    }, { now: reviewNow });

    expect(viewModel.items[0]?.reason).toBe('This was useful until an earlier time; choose what still helps.');
  });

  it('uses minimum-oriented copy after latestUsefulStartAt but before notUsefulAfter', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({
          deadline: {
            latestUsefulStartAt: '2026-06-18T11:00:00.000Z',
            notUsefulAfter: '2026-06-18T15:00:00.000Z',
          },
        }),
      ],
    }, { now: reviewNow });

    expect(viewModel.items[0]?.reason).toBe('Minimum may be the useful version now.');
  });

  it('uses calm review copy after notUsefulAfter has passed', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({
          deadline: {
            latestUsefulStartAt: '2026-06-18T09:00:00.000Z',
            notUsefulAfter: '2026-06-18T10:00:00.000Z',
          },
        }),
      ],
    }, { now: reviewNow });

    expect(viewModel.items[0]?.reason).toBe('Original useful window has passed; choose what still helps.');
  });

  it('keeps minimum-still-helps copy when the field is present', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({
          deadline: {
            dueAt: '2026-06-18T09:00:00.000Z',
            minimumStillUsefulAfterDeadline: true,
            missedPolicy: 'minimumOnly',
            timeConstraint: 'dueBy',
          },
        }),
      ],
    }, { now: reviewNow });

    expect(viewModel.items[0]?.supportingCopy).toContain('Minimum still helps.');
    expect(viewModel.items[0]?.suggestedCopy).toBe('The minimum version may be enough now.');
    expect(viewModel.items[0]?.actionOptions).toEqual(['Park safely', 'Try the minimum', 'Mark not today']);
  });

  it('excludes completed or removed Today task states from re-entry preview', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({ id: 'done-task', status: 'done', deadline: { dueAt: '2026-06-18T09:00:00.000Z', timeConstraint: 'dueBy' } }),
        timeEdgeTask({ id: 'parked-task', status: 'parked', deadline: { dueAt: '2026-06-18T09:00:00.000Z', timeConstraint: 'dueBy' } }),
        timeEdgeTask({ id: 'not-today-task', status: 'notToday', deadline: { dueAt: '2026-06-18T09:00:00.000Z', timeConstraint: 'dueBy' } }),
      ],
    }, { now: reviewNow });

    expect(viewModel.items).toEqual([]);
  });

  it('keeps forbidden pressure wording out of re-entry preview copy', () => {
    const viewModel = buildTimeEdgeReentryPreviewViewModel({
      activeTasks: [
        timeEdgeTask({
          deadline: {
            dueAt: '2026-06-18T09:00:00.000Z',
            timeConstraint: 'dueBy',
          },
        }),
      ],
    }, { now: reviewNow });
    const text = JSON.stringify(viewModel).toLowerCase();

    expect(text).not.toMatch(/\b(overdue|late|failed|urgent|behind|missed|score|streak)\b|catch up/);
    expect(text).toContain('no catch-up pile');
  });

  it('separates fixed commitments from flexible rhythms in Plan', () => {
    const viewModel = buildPlanViewModel(planWithFixedCommitmentsSnapshot);
    const morning = viewModel.blocks[0];

    expect(morning.fixedCommitments.map((item) => item.title)).toContain('School drop-off');
    expect(morning.flexibleRhythms.map((item) => item.title)).toContain('Breakfast reset');
  });

  it('includes hidden edges without building a scheduler', () => {
    const viewModel = buildPlanViewModel(planWithFixedCommitmentsSnapshot);
    const edges = viewModel.blocks.flatMap((block) => [
      ...block.fixedCommitments.flatMap((item) => item.hiddenEdges),
      ...block.flexibleRhythms.flatMap((item) => item.hiddenEdges),
    ]);

    expect(edges.map((edge) => edge.kind)).toContain('travel');
    expect(edges.map((edge) => edge.kind)).toContain('setup');
    expect(viewModel.roomMessage.body).toContain('Fixed commitments are visible');
    expect(JSON.stringify(viewModel).toLowerCase()).not.toContain('scheduler');
  });

  it('groups Day Shape blocks by leave-alone, ask-first, and open-capacity meaning', () => {
    const viewModel = buildDayShapePreviewViewModel(dayShapeSnapshot, 'Monday');
    const leaveAlone = viewModel.groups.find((group) => group.title === 'Time to leave alone');
    const askFirst = viewModel.groups.find((group) => group.title === 'Ask first');
    const openCapacity = viewModel.groups.find((group) => group.title === 'Open capacity');

    expect(leaveAlone?.blocks.map((block) => block.type)).toEqual(['protectedTime', 'recoveryTime', 'familyTime']);
    expect(askFirst?.blocks.map((block) => block.type)).toEqual(['looseTime', 'householdFlow']);
    expect(openCapacity?.blocks).toEqual([]);
    expect(viewModel.boundaryCopy).toContain('No tasks are placed');
  });

  it('only shows Day Shape blocks that match the selected day', () => {
    const viewModel = buildDayShapePreviewViewModel(dayShapeSnapshot, 'Tuesday');
    const openCapacity = viewModel.groups.find((group) => group.title === 'Open capacity');
    const allBlockTitles = viewModel.groups.flatMap((group) => group.blocks.map((block) => block.label));

    expect(openCapacity?.blocks.map((block) => block.label)).toEqual(['Tuesday window']);
    expect(openCapacity?.blocks[0]?.notes).toBe('Only if the day still has room.');
    expect(allBlockTitles).not.toContain('Protected morning');
    expect(allBlockTitles).not.toContain('Household flow');
  });

  it('returns a clear Day Shape empty state without implying blank time is available', () => {
    const viewModel = buildDayShapePreviewViewModel(dayShapeSnapshot, 'Wednesday');

    expect(viewModel.groups.every((group) => group.blocks.length === 0)).toBe(true);
    expect(viewModel.emptyState.title).toBe('No blocks defined for Wednesday.');
    expect(viewModel.emptyState.message).toContain('Blank time stays blank');
    expect(JSON.stringify(viewModel).toLowerCase()).not.toContain('task suggestion');
  });

  it('suggests visible Today tasks into user-marked open capacity blocks only', () => {
    const viewModel = buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Monday');

    expect(viewModel.suggestions).toHaveLength(1);
    expect(viewModel.suggestions[0]).toMatchObject({
      blockLabel: 'Open capacity window',
      blockTimeRange: '11:00-12:00',
      boundaryCopy: 'No schedule created',
      taskTitle: 'Send the form',
    });
  });

  it('does not suggest into protected, recovery, or family time', () => {
    const viewModel = buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Monday');
    const suggestedBlocks = viewModel.suggestions.map((suggestion) => suggestion.blockLabel);

    expect(suggestedBlocks).not.toContain('Protected morning');
    expect(suggestedBlocks).not.toContain('Recovery after lunch');
    expect(suggestedBlocks).not.toContain('Family evening');
  });

  it('labels ask-first blocks as possibilities instead of placements', () => {
    const viewModel = buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Monday');

    expect(viewModel.askFirstPossibilities).toEqual([
      expect.objectContaining({
        blockLabel: 'Loose morning',
        meaning: 'Ask first before treating this as usable.',
        typeLabel: 'Loose time',
      }),
    ]);
    expect(viewModel.suggestions.map((suggestion) => suggestion.blockLabel)).not.toContain('Loose morning');
  });

  it('does not treat blank time as available', () => {
    const viewModel = buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Tuesday');

    expect(viewModel.suggestions).toEqual([]);
    expect(viewModel.emptyState.title).toBe('No open capacity blocks for this day.');
    expect(viewModel.emptyState.message).toBe('Life Rhythm is not treating blank time as available.');
  });

  it('excludes completed and removed task states from soft suggestions', () => {
    const viewModel = buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Monday');
    const suggestionText = JSON.stringify(viewModel);

    expect(suggestionText).not.toContain('Already done');
    expect(suggestionText).not.toContain('Parked task');
    expect(suggestionText).not.toContain('Not today task');
  });

  it('uses usefulness-window language for dueBy soft suggestion context', () => {
    const viewModel = buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Monday');

    expect(viewModel.suggestions[0]?.reason).toContain('Usefulness window');
    expect(viewModel.suggestions[0]?.reason.toLowerCase()).toContain('choose this only if it still helps');
  });

  it('keeps forbidden pressure wording out of soft suggestions', () => {
    const viewModel = buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Monday');
    const text = JSON.stringify(viewModel).toLowerCase();

    expect(text).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|optimize|productivity score)\b|catch up/,
    );
  });

  it('separates reusable Library rhythms from one-off Today tasks', () => {
    const viewModel = buildLibraryViewModel(libraryWithEnabledDisabledRhythmsSnapshot);

    expect(viewModel.reusableRhythms.map((rhythm) => rhythm.title)).not.toContain('Pay water bill');
    expect(viewModel.oneOffTodayTaskIds).toEqual(['one-off-water-bill']);
  });

  it('includes enabled and disabled Library rhythms', () => {
    const viewModel = buildLibraryViewModel(libraryWithEnabledDisabledRhythmsSnapshot);

    expect(viewModel.enabledRhythms.length).toBeGreaterThan(0);
    expect(viewModel.disabledRhythms.length).toBeGreaterThan(0);
    expect(viewModel.categories).toContain('All');
    expect(viewModel.categories).toContain('Food');
  });

  it('keeps Reset language away from shame and failure wording', () => {
    const viewModel = buildResetViewModel(normalDayWithOneTaskSnapshot);
    const text = JSON.stringify(viewModel).toLowerCase();

    expect(text).toContain('no catch-up pile');
    expect(text).not.toMatch(/failed|failure|missed again|overdue|penalty|compliance/);
  });

  it('returns Setup theme and Start Boost safety settings', () => {
    const viewModel = buildSetupViewModel(normalDayWithOneTaskSnapshot);

    expect(viewModel.selectedTheme).toBe('exhale');
    expect(viewModel.themeChoices.map((theme) => theme.id)).toEqual(['exhale', 'clear', 'grounded']);
    expect(viewModel.startBoostSafety.avoidScrollingRewards).toBe(true);
    expect(viewModel.startBoostSafety.avoidShoppingRewards).toBe(true);
  });

  it('returns future modules as inactive placeholders by default', () => {
    const viewModel = buildSetupViewModel(futureModulesDisabledSnapshot);

    expect(viewModel.futureModules.map((module) => module.label)).toEqual([
      'Rhythm Food',
      'Rhythm Move',
      'Rhythm Learn',
      'Rhythm Sleep',
      'Rhythm Work',
      'Rhythm Home',
      'Rhythm Calm',
      'Rhythm Money',
      'Rhythm Goals / Quiet Goals',
    ]);
    expect(viewModel.futureModules.every((module) => module.enabled === false)).toBe(true);
  });

  it('does not call localStorage from selectors', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    buildTodayViewModel(normalDayWithOneTaskSnapshot);
    buildDayShapePreviewViewModel(dayShapeSnapshot, 'Monday');
    buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Monday');
    buildLibraryViewModel(libraryWithEnabledDisabledRhythmsSnapshot);
    buildSetupViewModel(normalDayWithOneTaskSnapshot);

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('does not call IndexedDB or Dexie write paths from selectors', () => {
    const openSpy = vi.fn();
    const deleteDatabaseSpy = vi.fn();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: deleteDatabaseSpy,
        open: openSpy,
      },
    });

    buildTodayViewModel(normalDayWithOneTaskSnapshot);
    buildPlanViewModel(planWithFixedCommitmentsSnapshot);
    buildDayShapePreviewViewModel(dayShapeSnapshot, 'Monday');
    buildSoftScheduleSuggestionsViewModel(softScheduleSnapshot(), 'Monday');
    buildLibraryViewModel(libraryWithEnabledDisabledRhythmsSnapshot);
    buildResetViewModel(normalDayWithOneTaskSnapshot);
    buildSetupViewModel(normalDayWithOneTaskSnapshot);

    expect(openSpy).not.toHaveBeenCalled();
    expect(deleteDatabaseSpy).not.toHaveBeenCalled();
  });
});
