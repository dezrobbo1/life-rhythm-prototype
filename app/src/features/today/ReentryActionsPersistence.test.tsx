// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveActiveTodayTask } from '../../data/activeTaskRepository';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { bringTaskPoolItemToToday } from '../../data/taskLifecycleRepository';
import { saveTaskPoolItem } from '../../data/taskPoolRepository';
import { activeTaskSchema, taskPoolItemSchema } from '../../data/schemas';
import { TodayScreen } from '../../screens/TodayScreen';

let namespaceIndex = 0;

const minimum = { label: 'Open the bill and note the due date.', minutes: 5 };
const normal = { label: 'Open the bill and check the amount.', minutes: 20 };
const full = { label: 'Open the bill, record the amount, and pay it.', minutes: 30 };

function activeTask(overrides: Record<string, unknown> = {}) {
  return activeTaskSchema.parse({
    area: 'money',
    createdAt: '2026-09-07T00:00:00.000Z',
    full,
    id: 'active-task',
    minimum,
    normal,
    purpose: 'Keep the account current.',
    showToday: true,
    source: 'adhoc',
    status: 'active',
    title: 'Pay water bill',
    updatedAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  });
}

function poolTask(overrides: Record<string, unknown> = {}) {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-09-07T00:00:00.000Z',
    full,
    id: 'pool-task',
    minimum,
    normal,
    purpose: 'Keep this safely findable.',
    source: 'adhoc',
    status: 'captured',
    title: 'Review old form',
    updatedAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  });
}

beforeEach(() => {
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`reentry-actions-${namespaceIndex}`));
});

afterEach(async () => {
  cleanup();
  await getCurrentLifeRhythmDatabase().delete();
  resetCurrentLocalDataNamespace();
});

describe('re-entry actions through real persistence', () => {
  it('selects the exact useful Minimum without completing, cloning, or rescheduling the task', async () => {
    const user = userEvent.setup();
    const database = getCurrentLifeRhythmDatabase();
    await saveActiveTodayTask(activeTask({ id: 'current-task', title: 'Current task' }));
    await saveActiveTodayTask(activeTask({
      dueAt: '2000-09-08T03:00:00.000Z',
      id: 'missed-bill',
      minimumStillUsefulAfterDeadline: true,
      missedPolicy: 'minimumOnly',
      timeConstraint: 'dueBy',
    }));
    const before = await database.activeTasks.toArray();

    render(<TodayScreen />);

    const actions = await screen.findByLabelText('Re-entry actions for Pay water bill');
    await user.click(within(actions).getByRole('button', { name: 'Try the minimum' }));

    const selected = screen.getByRole('article', { name: 'Pay water bill' });
    expect(within(selected).getByText(/Open the bill and note the due date\./)).toBeTruthy();
    expect(within(selected).getByText('Choosing Minimum does not complete it.')).toBeTruthy();
    expect(await database.activeTasks.toArray()).toEqual(before);
    expect(await database.activeTasks.count()).toBe(2);
    expect(await database.softPlacements.count()).toBe(0);
    expect(await database.activeTasks.get('missed-bill')).toMatchObject({
      dueAt: '2000-09-08T03:00:00.000Z',
      status: 'active',
    });
    expect((await database.activeTasks.get('missed-bill'))?.minimumAchievedAt).toBeUndefined();

    cleanup();
    render(<TodayScreen />);
    expect(await screen.findByLabelText('Re-entry actions for Pay water bill')).toBeTruthy();
    expect(screen.queryByText('Choosing Minimum does not complete it.')).toBeNull();
    expect(await database.activeTasks.toArray()).toEqual(before);
  });

  it('marks an expired linked task no longer needed only after the user confirms it', async () => {
    const user = userEvent.setup();
    const database = getCurrentLifeRhythmDatabase();
    await saveTaskPoolItem(poolTask({
      expiresAfter: '2000-09-08T03:00:00.000Z',
      missedPolicy: 'archiveIfExpired',
      timeConstraint: 'expiresAfter',
    }));
    await bringTaskPoolItemToToday('pool-task');

    render(<TodayScreen />);

    const action = await screen.findByRole('button', { name: 'No longer needed' });
    expect(await database.taskPoolItems.get('pool-task')).toMatchObject({ status: 'today' });
    expect(await database.activeTasks.get('pool-task')).toMatchObject({ status: 'active' });

    await user.click(action);

    await waitFor(async () => {
      expect(await database.taskPoolItems.get('pool-task')).toMatchObject({ status: 'noLongerNeeded' });
    });
    expect(await database.activeTasks.get('pool-task')).toMatchObject({ showToday: false, status: 'skipped' });
    expect(screen.queryByRole('article', { name: 'Review old form' })).toBeNull();
    expect(await database.activeTasks.count()).toBe(1);
    expect(await database.softPlacements.count()).toBe(0);
  });

  it('parks a linked task explicitly and keeps it findable without creating tomorrow work', async () => {
    const user = userEvent.setup();
    const database = getCurrentLifeRhythmDatabase();
    await saveTaskPoolItem(poolTask({
      dueAt: '2000-09-08T03:00:00.000Z',
      missedPolicy: 'park',
      timeConstraint: 'dueBy',
    }));
    await bringTaskPoolItemToToday('pool-task');

    render(<TodayScreen />);
    await user.click(await screen.findByRole('button', { name: 'Park safely' }));

    await waitFor(async () => {
      expect(await database.activeTasks.get('pool-task')).toMatchObject({ showToday: false, status: 'parked' });
    });
    expect(await database.taskPoolItems.get('pool-task')).toMatchObject({ status: 'parked' });
    expect(await database.taskPoolItems.count()).toBe(1);
    expect(await database.activeTasks.count()).toBe(1);
    expect(await database.softPlacements.count()).toBe(0);
  });

  it('keeps a passed fixed-time opportunity factual and does not create flexible or future work', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await saveActiveTodayTask(activeTask({
      fixedAt: '2000-09-08T03:00:00.000Z',
      minimumStillUsefulAfterDeadline: false,
      missedPolicy: 'minimumOnly',
      timeConstraint: 'fixedAt',
    }));

    render(<TodayScreen />);

    expect(await screen.findByText('The original fixed-time opportunity has passed.')).toBeTruthy();
    expect(screen.getByText('It has not been converted into flexible work.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try the minimum' })).toBeNull();
    expect(await database.activeTasks.count()).toBe(1);
    expect(await database.softPlacements.count()).toBe(0);
  });
});
