// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { getCurrentLifeRhythmDatabase } from '../../data/localDataNamespace';
import {
  createAuthLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { taskPoolItemSchema, type TaskPoolItem } from '../../data/schemas';
import { loadAllSoftPlacements } from '../../data/softPlacementRepository';
import { getTaskPoolItem, loadTaskPoolItems, saveTaskPoolItem } from '../../data/taskPoolRepository';
import { PoolScreen } from '../../screens/PoolScreen';

function sectionForHeading(name: string): HTMLElement {
  const section = screen.getByRole('heading', { name }).closest('section');

  if (!section) {
    throw new Error(`Missing section for ${name}`);
  }

  return section;
}

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

let poolNamespaceIndex = 0;

beforeEach(() => {
  poolNamespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`pool-screen-test-${poolNamespaceIndex}`));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('Pool screen', () => {
  it('renders the holding-tray task pool surface without Inbox language', () => {
    render(<PoolScreen />);

    expect(screen.getByRole('heading', { name: 'Pool' })).toBeTruthy();
    expect(screen.getAllByText('Holding Tray').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { name: 'Task Pool' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Capture task' })).toBeTruthy();
    expect(screen.getByText('No captured tasks yet.')).toBeTruthy();
    expect(screen.getByText('Capture something here without adding it to Today.')).toBeTruthy();

    const text = document.body.textContent?.toLowerCase() ?? '';
    expect(text).not.toContain('inbox');
    expect(text).not.toMatch(/\b(backlog|queue|debt|overdue)\b|catch up/);
  });

  it('opens the task pool capture modal and keeps required fields required', async () => {
    const user = userEvent.setup();

    render(<PoolScreen />);

    await user.click(screen.getByRole('button', { name: 'Capture task' }));

    const dialog = screen.getByRole('dialog', { name: 'Capture task' });
    const saveButton = within(dialog).getByRole('button', { name: 'Save captured task' });

    expect(within(dialog).getByText('Safely held for later. This does not add it to Today.')).toBeTruthy();
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect(dialog.textContent?.toLowerCase() ?? '').not.toContain('calendar');
  });

  it('captures a valid task into the Pool without creating Today tasks or soft placements', async () => {
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
      render(<PoolScreen />);

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

      const taskPoolSection = sectionForHeading('Task Pool');

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

    await user.click(screen.getByRole('button', { name: 'Pool' }));
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

    render(<PoolScreen />);

    const taskPoolSection = sectionForHeading('Task Pool');

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

      render(<PoolScreen />);

      const taskPoolSection = sectionForHeading('Task Pool');

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

  it('keeps pressure wording out of the Pool section', async () => {
    await saveTaskPoolItem(validTaskPoolItem());

    render(<PoolScreen />);

    const taskPoolSection = sectionForHeading('Task Pool');

    expect(await within(taskPoolSection).findByText('Captured form task')).toBeTruthy();

    const text = taskPoolSection.textContent?.toLowerCase() ?? '';

    expect(text).not.toContain('inbox');
    expect(text).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|backlog|queue|debt|optimize|productivity score|compliance)\b|catch up/,
    );
  });
});
