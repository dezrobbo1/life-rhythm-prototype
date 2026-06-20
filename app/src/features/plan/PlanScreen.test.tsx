// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { AppSnapshotProvider } from '../../data/AppSnapshotProvider';
import { getCurrentLifeRhythmDatabase } from '../../data/localDataNamespace';
import {
  createAuthLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import {
  activeTaskSchema,
  softPlacementSchema,
  taskPoolItemSchema,
  type ActiveTask,
  type SoftPlacement,
  type TaskPoolItem,
} from '../../data/schemas';
import { loadAllSoftPlacements, saveSoftPlacement } from '../../data/softPlacementRepository';
import { getTaskPoolItem, loadTaskPoolItems, saveTaskPoolItem } from '../../data/taskPoolRepository';
import { PlanScreen } from '../../screens/PlanScreen';
import { normalDayWithOneTaskSnapshot, type AppDataSnapshot } from '../../viewModels';
import { localDateForNextSelectedDay } from './softPlacementDate';

const dayShapeSnapshot: AppDataSnapshot = {
  ...normalDayWithOneTaskSnapshot,
  settings: {
    ...normalDayWithOneTaskSnapshot.settings,
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

const softSuggestionsSnapshot: AppDataSnapshot = {
  ...dayShapeSnapshot,
  activeTasks: [
    {
      ...normalDayWithOneTaskSnapshot.activeTasks?.[0],
      deadline: {
        dueAt: '2026-06-18T15:00:00.000Z',
        timeConstraint: 'dueBy',
      },
      id: 'send-form',
      showToday: true,
      status: 'active',
      title: 'Send the form',
    },
    {
      ...normalDayWithOneTaskSnapshot.activeTasks?.[0],
      id: 'done-task',
      showToday: true,
      status: 'done',
      title: 'Already done',
    },
    {
      ...normalDayWithOneTaskSnapshot.activeTasks?.[0],
      id: 'parked-task',
      showToday: true,
      status: 'parked',
      title: 'Parked task',
    },
    {
      ...normalDayWithOneTaskSnapshot.activeTasks?.[0],
      id: 'not-today-task',
      showToday: true,
      status: 'notToday',
      title: 'Not today task',
    },
  ],
  settings: {
    ...dayShapeSnapshot.settings,
    lifeShape: {
      ...dayShapeSnapshot.settings?.lifeShape,
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
          id: 'loose-morning',
          label: 'Loose morning',
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
          days: ['Monday'],
          end: '12:00',
          id: 'monday-open-capacity',
          label: 'Monday open capacity',
          schedulerUse: 'available',
          start: '11:00',
          type: 'openCapacity',
        },
      ],
    } as NonNullable<NonNullable<AppDataSnapshot['settings']>['lifeShape']>,
  },
};

function renderPlanWithSnapshot(snapshot: AppDataSnapshot = dayShapeSnapshot) {
  return render(
    <AppSnapshotProvider snapshot={snapshot}>
      <PlanScreen />
    </AppSnapshotProvider>,
  );
}

function sectionForHeading(name: string): HTMLElement {
  const section = screen.getByRole('heading', { name }).closest('section');

  if (!section) {
    throw new Error(`Missing section for ${name}`);
  }

  return section;
}

let planNamespaceIndex = 0;

async function defaultTableCounts() {
  const database = getCurrentLifeRhythmDatabase();

  return {
    activeTasks: await database.activeTasks.count(),
    completionLog: await database.completionLog.count(),
    migrationLog: await database.migrationLog.count(),
    resetLog: await database.resetLog.count(),
    rhythmTemplates: await database.rhythmTemplates.count(),
    settings: await database.settings.count(),
    softPlacements: await database.softPlacements.count(),
    startBoostLog: await database.startBoostLog.count(),
    taskHistory: await database.taskHistory.count(),
    taskPoolItems: await database.taskPoolItems.count(),
  };
}

function validSoftPlacement(overrides: Partial<SoftPlacement> = {}): SoftPlacement {
  return softPlacementSchema.parse({
    blockId: 'monday-open-capacity',
    blockLabelSnapshot: 'Monday open capacity',
    createdAt: '2026-06-18T00:00:00.000Z',
    date: localDateForNextSelectedDay('Monday'),
    end: '12:00',
    id: 'soft-placement-send-form',
    placementSource: 'userConfirmed',
    start: '11:00',
    status: 'planned',
    taskId: 'send-form',
    taskTitleSnapshot: 'Send the form',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  });
}

function validActiveTask(overrides: Partial<ActiveTask> = {}): ActiveTask {
  return activeTaskSchema.parse({
    area: 'admin',
    createdAt: '2026-06-18T00:00:00.000Z',
    full: {
      label: 'Send and file the receipt',
      minutes: 20,
    },
    id: 'send-form',
    minimum: {
      label: 'Open the form',
      minutes: 2,
    },
    normal: {
      label: 'Send the form',
      minutes: 10,
    },
    purpose: 'Keep the admin thread visible.',
    showToday: true,
    source: 'adhoc',
    status: 'active',
    title: 'Send the form',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  });
}

function validTaskPoolItem(overrides: Partial<TaskPoolItem> = {}): TaskPoolItem {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-06-18T00:00:00.000Z',
    full: {
      label: 'File the form and close the tab',
      minutes: 20,
    },
    id: 'task-pool-captured-form',
    minimum: {
      label: 'Open the form',
      minutes: 5,
    },
    normal: {
      label: 'Fill in the first section',
      minutes: 10,
    },
    source: 'adhoc',
    status: 'captured',
    title: 'Captured form task',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  });
}

beforeEach(() => {
  planNamespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`plan-soft-placement-test-${planNamespaceIndex}`));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('Plan screen', () => {
  it('renders all broad day blocks', () => {
    render(<PlanScreen />);

    expect(screen.getByText('Life shape preview: work hours, buffers, and protected blocks will shape future planning.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Day Shape preview' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Task pool' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Capture task' })).toBeTruthy();
    expect(screen.getByText('No captured tasks yet.')).toBeTruthy();
    expect(screen.getByText('Capture something here without adding it to Today.')).toBeTruthy();
    expect(screen.getByText('No blocks defined for Monday.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Morning' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Midday' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Afternoon' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Evening' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Late evening' })).toBeTruthy();
  });

  it('opens the task pool capture modal and keeps required fields required', async () => {
    const user = userEvent.setup();

    renderPlanWithSnapshot();

    await user.click(screen.getByRole('button', { name: 'Capture task' }));

    const dialog = screen.getByRole('dialog', { name: 'Capture task' });
    const saveButton = within(dialog).getByRole('button', { name: 'Save captured task' });

    expect(within(dialog).getByText('Safely held for later. This does not add it to Today.')).toBeTruthy();
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect(dialog.textContent?.toLowerCase() ?? '').not.toContain('calendar');
  });

  it('captures a valid task into the task pool and refreshes the Plan list only', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

    try {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: fetchSpy,
      });
      renderPlanWithSnapshot();

      await user.click(screen.getByRole('button', { name: 'Capture task' }));
      await user.type(screen.getByLabelText('Task title'), 'Order school shirts');
      await user.selectOptions(screen.getByLabelText('Area'), 'admin');
      await user.type(screen.getByLabelText('Minimum version'), 'Write the size list');
      await user.click(screen.getByRole('button', { name: /Optional details/ }));
      await user.type(screen.getByLabelText('Normal version'), 'Check prices and sizes');
      await user.type(screen.getByLabelText('Full version'), 'Order shirts and save the confirmation');
      await user.type(screen.getByLabelText('Purpose'), 'Keep the school order visible.');
      await user.type(screen.getByLabelText('Notes'), 'Use the saved size note.');
      await user.click(screen.getByRole('button', { name: /Optional useful window/ }));
      await user.type(screen.getByLabelText('Useful before'), '2026-06-20T10:30');
      await user.type(screen.getByLabelText('Useful until'), '2026-06-21T10:30');
      await user.click(screen.getByLabelText('Minimum still helps'));
      await user.click(screen.getByRole('button', { name: 'Save captured task' }));

      expect(await screen.findByText('Task captured. It is safely held.')).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Capture task' })).toBeNull();

      const taskPoolSection = sectionForHeading('Task pool');

      expect(await within(taskPoolSection).findByText('Order school shirts')).toBeTruthy();
      expect(within(taskPoolSection).getByText('Admin - Safely held')).toBeTruthy();
      expect(within(taskPoolSection).getByText('Minimum: Write the size list')).toBeTruthy();
      expect(within(taskPoolSection).getByText(/Useful before/)).toBeTruthy();
      expect(within(taskPoolSection).getByText(/Useful until/)).toBeTruthy();
      expect(within(taskPoolSection).getByText('Minimum still helps')).toBeTruthy();

      const items = await loadTaskPoolItems();
      const placements = await loadAllSoftPlacements();
      const counts = await defaultTableCounts();

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        area: 'admin',
        minimum: {
          label: 'Write the size list',
        },
        normal: {
          label: 'Check prices and sizes',
        },
        source: 'adhoc',
        status: 'captured',
        timeConstraint: 'dueBy',
        title: 'Order school shirts',
      });
      expect(items[0].minimumStillUsefulAfterDeadline).toBe(true);
      expect(placements).toHaveLength(0);
      expect(counts).toMatchObject({
        activeTasks: 0,
        completionLog: 0,
        migrationLog: 0,
        resetLog: 0,
        rhythmTemplates: 0,
        settings: 0,
        softPlacements: 0,
        startBoostLog: 0,
        taskHistory: 0,
        taskPoolItems: 1,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    } finally {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }
    }
  });

  it('does not add a captured task to Today', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Plan' }));
    await user.click(screen.getByRole('button', { name: 'Capture task' }));
    await user.type(screen.getByLabelText('Task title'), 'Task held outside Today');
    await user.type(screen.getByLabelText('Minimum version'), 'Write the first note');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));

    expect(await screen.findByText('Task captured. It is safely held.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.queryByText('Task held outside Today')).toBeNull();
    expect(await loadTaskPoolItems()).toHaveLength(1);
    expect(await getCurrentLifeRhythmDatabase().activeTasks.count()).toBe(0);
  });

  it('shows saved task pool items and hides no-longer-needed items', async () => {
    await saveTaskPoolItem(validTaskPoolItem({
      dueAt: '2026-06-20T10:30:00.000Z',
      minimumStillUsefulAfterDeadline: true,
      notUsefulAfter: '2026-06-21T10:30:00.000Z',
      timeConstraint: 'dueBy',
    }));
    await saveTaskPoolItem(validTaskPoolItem({
      id: 'task-pool-no-longer-needed',
      status: 'noLongerNeeded',
      title: 'Hidden pool item',
    }));

    renderPlanWithSnapshot();

    const taskPoolSection = sectionForHeading('Task pool');

    expect(await within(taskPoolSection).findByText('Captured form task')).toBeTruthy();
    expect(within(taskPoolSection).getByText('Admin - Safely held')).toBeTruthy();
    expect(within(taskPoolSection).getByText('Minimum: Open the form')).toBeTruthy();
    expect(within(taskPoolSection).getByText(/Useful before/)).toBeTruthy();
    expect(within(taskPoolSection).getByText(/Useful until/)).toBeTruthy();
    expect(within(taskPoolSection).getByText('Minimum still helps')).toBeTruthy();
    expect(within(taskPoolSection).queryByText('Hidden pool item')).toBeNull();
  });

  it('marks a task pool item no longer needed without deleting or touching other data', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

    await saveTaskPoolItem(validTaskPoolItem());

    try {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: fetchSpy,
      });

      renderPlanWithSnapshot();

      const taskPoolSection = sectionForHeading('Task pool');

      expect(await within(taskPoolSection).findByText('Captured form task')).toBeTruthy();

      await user.click(within(taskPoolSection).getByRole('button', { name: 'No longer needed' }));

      expect(await screen.findByText('Marked no longer needed. Nothing else changed.')).toBeTruthy();
      expect(within(taskPoolSection).queryByText('Captured form task')).toBeNull();

      const item = await getTaskPoolItem('task-pool-captured-form');
      const counts = await defaultTableCounts();

      expect(item).toMatchObject({
        id: 'task-pool-captured-form',
        status: 'noLongerNeeded',
      });
      expect(counts).toMatchObject({
        activeTasks: 0,
        completionLog: 0,
        migrationLog: 0,
        resetLog: 0,
        rhythmTemplates: 0,
        settings: 0,
        softPlacements: 0,
        startBoostLog: 0,
        taskHistory: 0,
        taskPoolItems: 1,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    } finally {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }
    }
  });

  it('keeps pressure wording out of the task pool section', async () => {
    await saveTaskPoolItem(validTaskPoolItem());

    renderPlanWithSnapshot();

    const taskPoolSection = sectionForHeading('Task pool');

    expect(await within(taskPoolSection).findByText('Captured form task')).toBeTruthy();

    const text = taskPoolSection.textContent?.toLowerCase() ?? '';

    expect(text).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|optimize|productivity score|compliance)\b|catch up/,
    );
  });

  it('groups read-only Day Shape blocks into planning categories', () => {
    renderPlanWithSnapshot();

    const leaveAlone = sectionForHeading('Time to leave alone');
    const askFirst = sectionForHeading('Ask first');
    const openCapacity = sectionForHeading('Open capacity');

    expect(within(leaveAlone).getByText('Protected morning')).toBeTruthy();
    expect(within(leaveAlone).getByText('Protected time')).toBeTruthy();
    expect(within(leaveAlone).getByText('Recovery after lunch')).toBeTruthy();
    expect(within(leaveAlone).getByText('Recovery time')).toBeTruthy();
    expect(within(leaveAlone).getByText('Family evening')).toBeTruthy();
    expect(within(leaveAlone).getByText('Family time')).toBeTruthy();
    expect(within(askFirst).getByText('Loose late morning')).toBeTruthy();
    expect(within(askFirst).getByText('Loose time')).toBeTruthy();
    expect(within(askFirst).getAllByText('Household flow')).toHaveLength(2);
    expect(within(openCapacity).getByText('No blocks in this category for Monday.')).toBeTruthy();
    expect(screen.getByText(/No tasks are placed from this preview/i)).toBeTruthy();
  });

  it('only shows Day Shape blocks for the selected day', async () => {
    const user = userEvent.setup();
    renderPlanWithSnapshot();

    expect(screen.queryByText('Tuesday window')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Selected day'), 'Tuesday');

    expect(screen.getByText('Tuesday window')).toBeTruthy();
    expect(screen.getAllByText('Open capacity').length).toBeGreaterThan(0);
    expect(screen.getByText('Only if the day still has room.')).toBeTruthy();
    expect(screen.queryByText('Protected morning')).toBeNull();
  });

  it('renders soft suggestions from open capacity blocks with user-confirmed placement action', () => {
    renderPlanWithSnapshot(softSuggestionsSnapshot);

    const section = sectionForHeading('Soft suggestions');

    expect(within(section).getByText('Suggestions only.')).toBeTruthy();
    expect(within(section).getByText('Nothing is placed from here.')).toBeTruthy();
    expect(within(section).getByText('Protected and loose time are respected.')).toBeTruthy();
    expect(within(section).getByText('Blank time is not treated as available.')).toBeTruthy();
    expect(within(section).getByText('Send the form')).toBeTruthy();
    expect(within(section).getByText('Monday open capacity - 11:00-12:00')).toBeTruthy();
    expect(within(section).getByText(/Usefulness window is visible/i)).toBeTruthy();
    expect(within(section).getByText('No schedule created')).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Add soft placement' })).toBeTruthy();
  });

  it('shows ask-first blocks as context without placing tasks there', () => {
    renderPlanWithSnapshot(softSuggestionsSnapshot);

    const section = sectionForHeading('Soft suggestions');
    const askFirst = within(section).getByRole('heading', { name: 'Ask first possibilities' }).closest('div');

    if (!askFirst) {
      throw new Error('Missing ask-first section');
    }

    expect(within(section).getByRole('heading', { name: 'Ask first possibilities' })).toBeTruthy();
    expect(within(section).getByText('Loose morning')).toBeTruthy();
    expect(within(section).getByText('Loose time - 10:00-11:00')).toBeTruthy();
    expect(within(section).getAllByText('Ask first before treating this as usable.')).toHaveLength(2);
    expect(within(section).queryByText('Protected morning - 07:00-08:00')).toBeNull();
    expect(within(section).queryByText('Recovery after lunch - 13:00-14:00')).toBeNull();
    expect(within(section).queryByText('Family evening - 17:00-18:00')).toBeNull();
    expect(within(askFirst).queryByRole('button', { name: 'Add soft placement' })).toBeNull();
  });

  it('does not show placement buttons for unavailable Day Shape blocks', () => {
    renderPlanWithSnapshot(softSuggestionsSnapshot);

    const leaveAlone = sectionForHeading('Time to leave alone');

    expect(within(leaveAlone).getByText('Protected morning')).toBeTruthy();
    expect(within(leaveAlone).queryByRole('button', { name: 'Add soft placement' })).toBeNull();
  });

  it('does not show completed or removed task states in soft suggestions', () => {
    renderPlanWithSnapshot(softSuggestionsSnapshot);

    const section = sectionForHeading('Soft suggestions');

    expect(within(section).queryByText('Already done')).toBeNull();
    expect(within(section).queryByText('Parked task')).toBeNull();
    expect(within(section).queryByText('Not today task')).toBeNull();
  });

  it('keeps blank time unavailable when no open capacity blocks match the day', async () => {
    const user = userEvent.setup();
    renderPlanWithSnapshot(softSuggestionsSnapshot);

    await user.selectOptions(screen.getByLabelText('Selected day'), 'Wednesday');

    const section = sectionForHeading('Soft suggestions');

    expect(within(section).getByText('No open capacity blocks for this day.')).toBeTruthy();
    expect(within(section).getByText('Life Rhythm is not treating blank time as available.')).toBeTruthy();
  });

  it('maps selected weekday to the next matching local date', () => {
    const thursday = new Date(2026, 5, 18, 9, 0, 0);

    expect(localDateForNextSelectedDay('Thursday', thursday)).toBe('2026-06-18');
    expect(localDateForNextSelectedDay('Monday', thursday)).toBe('2026-06-22');
  });

  it('creates one local soft placement only after the user confirms an open-capacity suggestion', async () => {
    const user = userEvent.setup();
    const expectedDate = localDateForNextSelectedDay('Monday');
    const fetchSpy = vi.fn();
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

    try {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: fetchSpy,
      });
      renderPlanWithSnapshot(softSuggestionsSnapshot);

      await user.click(screen.getByRole('button', { name: 'Add soft placement' }));

      expect(await screen.findByText('Soft placement added.')).toBeTruthy();
      expect(screen.getAllByText('No calendar event created.').length).toBeGreaterThan(0);
      expect(screen.getByText('You can remove it later.')).toBeTruthy();

      const placements = await loadAllSoftPlacements();
      const counts = await defaultTableCounts();

      expect(placements).toHaveLength(1);
      expect(placements[0]).toMatchObject({
        blockId: 'monday-open-capacity',
        blockLabelSnapshot: 'Monday open capacity',
        date: expectedDate,
        end: '12:00',
        placementSource: 'userConfirmed',
        start: '11:00',
        status: 'planned',
        taskId: 'send-form',
        taskTitleSnapshot: 'Send the form',
      });
      expect(counts).toMatchObject({
        activeTasks: 0,
        completionLog: 0,
        migrationLog: 0,
        resetLog: 0,
        rhythmTemplates: 0,
        settings: 0,
        softPlacements: 1,
        startBoostLog: 0,
        taskHistory: 0,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    } finally {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }
    }
  });

  it('does not create duplicate placements for the same task, block and date', async () => {
    const user = userEvent.setup();
    renderPlanWithSnapshot(softSuggestionsSnapshot);

    await user.click(screen.getByRole('button', { name: 'Add soft placement' }));
    expect(await screen.findByText('Soft placement added.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add soft placement' }));

    expect(await screen.findByText('This soft placement already exists.')).toBeTruthy();
    expect(screen.getByText('Nothing else changed.')).toBeTruthy();
    expect(await loadAllSoftPlacements()).toHaveLength(1);
  });

  it('shows saved soft placements for the selected day only', async () => {
    await saveSoftPlacement(validSoftPlacement());
    await saveSoftPlacement(validSoftPlacement({
      date: localDateForNextSelectedDay('Tuesday'),
      id: 'soft-placement-tuesday',
      taskId: 'tuesday-task',
      taskTitleSnapshot: 'Tuesday paperwork',
    }));

    renderPlanWithSnapshot(softSuggestionsSnapshot);

    const section = await screen.findByRole('heading', { name: 'Soft placements' });
    const placementSection = section.closest('section');

    if (!placementSection) {
      throw new Error('Missing Soft placements section');
    }

    expect(within(placementSection).getByText('Local only.')).toBeTruthy();
    expect(within(placementSection).getByText('No calendar event created.')).toBeTruthy();
    expect(within(placementSection).getByText('You can remove a placement without deleting the task.')).toBeTruthy();
    expect(await within(placementSection).findByText('Send the form')).toBeTruthy();
    expect(await within(placementSection).findByText('Monday open capacity - 11:00-12:00')).toBeTruthy();
    expect(within(placementSection).getByText('Planned')).toBeTruthy();
    expect(within(placementSection).getByText('Soft placement only')).toBeTruthy();
    expect(within(placementSection).getByRole('button', { name: 'Remove placement' })).toBeTruthy();
    expect(within(placementSection).queryByText('Tuesday paperwork')).toBeNull();
  });

  it('does not show removed soft placements as active placements', async () => {
    await saveSoftPlacement(validSoftPlacement({
      id: 'soft-placement-removed',
      status: 'removed',
    }));

    renderPlanWithSnapshot(softSuggestionsSnapshot);

    const placementSection = (await screen.findByRole('heading', { name: 'Soft placements' })).closest('section');

    if (!placementSection) {
      throw new Error('Missing Soft placements section');
    }

    expect(within(placementSection).queryByText('Monday open capacity - 11:00-12:00')).toBeNull();
    expect(within(placementSection).getByText('No saved soft placements for Monday.')).toBeTruthy();
  });

  it('removes a soft placement without deleting or changing the task', async () => {
    const user = userEvent.setup();
    const database = getCurrentLifeRhythmDatabase();
    const fetchSpy = vi.fn();
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

    await database.activeTasks.put(validActiveTask());
    await saveSoftPlacement(validSoftPlacement());

    try {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: fetchSpy,
      });

      renderPlanWithSnapshot(softSuggestionsSnapshot);

      const placementSection = (await screen.findByRole('heading', { name: 'Soft placements' })).closest('section');

      if (!placementSection) {
        throw new Error('Missing Soft placements section');
      }

      await user.click(await within(placementSection).findByRole('button', { name: 'Remove placement' }));

      expect(await screen.findByText('Soft placement removed.')).toBeTruthy();
      expect(screen.getByText('Task was not deleted.')).toBeTruthy();
      expect(screen.getByText('No calendar event changed.')).toBeTruthy();

      const placements = await loadAllSoftPlacements();
      const storedTask = await database.activeTasks.get('send-form');
      const counts = await defaultTableCounts();

      expect(placements).toHaveLength(1);
      expect(placements[0]).toMatchObject({
        id: 'soft-placement-send-form',
        status: 'removed',
      });
      expect(storedTask).toMatchObject({
        id: 'send-form',
        status: 'active',
        title: 'Send the form',
      });
      expect(within(placementSection).queryByText('Monday open capacity - 11:00-12:00')).toBeNull();
      expect(counts).toMatchObject({
        activeTasks: 1,
        completionLog: 0,
        migrationLog: 0,
        resetLog: 0,
        rhythmTemplates: 0,
        settings: 0,
        softPlacements: 1,
        startBoostLog: 0,
        taskHistory: 0,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    } finally {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }
    }
  });

  it('keeps pressure wording out of soft placements', async () => {
    await saveSoftPlacement(validSoftPlacement());

    renderPlanWithSnapshot(softSuggestionsSnapshot);

    const placementSection = (await screen.findByRole('heading', { name: 'Soft placements' })).closest('section');

    if (!placementSection) {
      throw new Error('Missing Soft placements section');
    }

    expect(await within(placementSection).findByText('Monday open capacity - 11:00-12:00')).toBeTruthy();

    const text = placementSection.textContent?.toLowerCase() ?? '';

    expect(text).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|optimize|productivity score|compliance)\b|catch up/,
    );
  });

  it('keeps the Day Shape preview read-only while changing selected days', async () => {
    const user = userEvent.setup();
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const openSpy = vi.fn();
    const deleteDatabaseSpy = vi.fn();
    const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: deleteDatabaseSpy,
        open: openSpy,
      },
    });
    renderPlanWithSnapshot();

    await user.selectOptions(screen.getByLabelText('Selected day'), 'Tuesday');

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(deleteDatabaseSpy).not.toHaveBeenCalled();

    if (originalIndexedDb) {
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
    }
  });

  it('renders fixed commitments before flexible rhythm items in a block', () => {
    render(<PlanScreen />);

    const morning = screen.getByRole('region', { name: 'Morning' });
    const fixed = within(morning).getByRole('article', { name: 'School drop-off' });
    const rhythm = within(morning).getByRole('article', { name: 'Breakfast reset' });

    expect(fixed.compareDocumentPosition(rhythm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(fixed).getByText('Fixed commitment')).toBeTruthy();
    expect(within(rhythm).getByText('Soft rhythm')).toBeTruthy();
    expect(screen.getByText('Fixed commitments are visible. Flexible rhythms can move, shrink, or restart from one action.')).toBeTruthy();
  });

  it('keeps hidden edges collapsed by default', () => {
    render(<PlanScreen />);

    expect(screen.getByRole('button', { name: 'Show hidden edges for School drop-off (4 soft edges)' })).toBeTruthy();
    expect(screen.queryByText('Find bags and water bottles')).toBeNull();
    expect(screen.queryByText('arrival margin')).toBeNull();
  });

  it('expands hidden edges for a plan item', async () => {
    const user = userEvent.setup();
    render(<PlanScreen />);

    await user.click(screen.getByRole('button', { name: 'Show hidden edges for School drop-off (4 soft edges)' }));

    expect(screen.getByText('Find bags and water bottles')).toBeTruthy();
    expect(screen.getByText('travel')).toBeTruthy();
    expect(screen.getByText('arrival margin')).toBeTruthy();
    expect(screen.getByText('transition')).toBeTruthy();
  });

  it('renders low-pressure plan controls', () => {
    render(<PlanScreen />);

    expect(screen.getAllByRole('button', { name: 'Move later' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Shrink' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Restart with one action' }).length).toBeGreaterThan(0);
  });

  it('does not expose scheduler or debug metadata', () => {
    render(<PlanScreen />);

    expect(screen.queryByText(/scheduler/i)).toBeNull();
    expect(screen.queryByText(/debug/i)).toBeNull();
    expect(screen.queryByText(/score/i)).toBeNull();
    expect(screen.queryByText(/productivity/i)).toBeNull();
  });

  it('keeps pressure wording out of soft suggestions', () => {
    renderPlanWithSnapshot(softSuggestionsSnapshot);

    const section = sectionForHeading('Soft suggestions');
    const text = section.textContent?.toLowerCase() ?? '';

    expect(text).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|optimize|productivity score)\b|catch up/,
    );
  });

  it('keeps the bottom navigation available in the app shell', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Plan' }));

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy();
  });
});
