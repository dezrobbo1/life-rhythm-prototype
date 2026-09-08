// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { saveActiveTodayTask } from '../../data/activeTaskRepository';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { activeTaskSchema } from '../../data/schemas';
import { TodayScreen } from '../../screens/TodayScreen';

describe('Minimum achievement persistence', () => {
  afterEach(async () => {
    cleanup();
    await getCurrentLifeRhythmDatabase().delete();
    resetCurrentLocalDataNamespace();
  });

  it('reconstructs Minimum achievement after Keep going and a Today reload', async () => {
    const namespace = createAuthLocalDataNamespace('minimum-achievement-integration');
    setCurrentLocalDataNamespace(namespace);
    const database = getCurrentLifeRhythmDatabase();
    const task = activeTaskSchema.parse({
      area: 'money',
      createdAt: '2026-09-08T00:00:00.000Z',
      full: { label: 'Pay the bill and file the receipt.', minutes: 20 },
      id: 'active-pay-water-bill',
      minimum: { label: 'Open the bill.', minutes: 5 },
      normal: { label: 'Check the amount and due date.', minutes: 10 },
      purpose: 'Keep the payment visible.',
      showToday: true,
      source: 'adhoc',
      status: 'active',
      title: 'Pay water bill',
      updatedAt: '2026-09-08T00:00:00.000Z',
    });

    await saveActiveTodayTask(task, database);
    const user = userEvent.setup();
    const firstRender = render(<TodayScreen />);

    await user.click(await screen.findByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await screen.findAllByText('Minimum done. That counts.');
    await user.click(await screen.findByRole('button', { name: 'Keep going' }));

    await waitFor(async () => {
      expect(await database.activeTasks.get(task.id)).toMatchObject({ status: 'inProgress' });
    });

    firstRender.unmount();
    const continuedRender = render(<TodayScreen />);

    expect(await screen.findByText('Minimum already counts.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark minimum done' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(async () => {
      expect(await database.activeTasks.get(task.id)).toMatchObject({
        minimumAchievedAt: expect.any(String),
        status: 'paused',
      });
    });

    continuedRender.unmount();
    const pausedRender = render(<TodayScreen />);
    expect(await screen.findByText('Paused. Minimum already counts.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark minimum done' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(async () => {
      expect(await database.activeTasks.get(task.id)).toMatchObject({
        minimumAchievedAt: expect.any(String),
        status: 'inProgress',
      });
    });

    pausedRender.unmount();
    render(<TodayScreen />);
    expect(await screen.findByText('Minimum already counts.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(screen.getByRole('button', { name: 'Mark normal done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark full done' })).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Stop here' })[0]);

    await waitFor(async () => {
      expect(await database.activeTasks.get(task.id)).toMatchObject({
        minimumAchievedAt: expect.any(String),
        showToday: false,
        status: 'done',
      });
    });
  });
});
