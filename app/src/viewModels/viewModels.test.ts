// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDayShapePreviewViewModel,
  buildLibraryViewModel,
  buildPlanViewModel,
  buildResetViewModel,
  buildSetupViewModel,
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
    buildLibraryViewModel(libraryWithEnabledDisabledRhythmsSnapshot);
    buildResetViewModel(normalDayWithOneTaskSnapshot);
    buildSetupViewModel(normalDayWithOneTaskSnapshot);

    expect(openSpy).not.toHaveBeenCalled();
    expect(deleteDatabaseSpy).not.toHaveBeenCalled();
  });
});
