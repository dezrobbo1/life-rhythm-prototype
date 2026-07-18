// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { getTaskPoolItem } from '../../data/taskPoolRepository';

let lifecycleNamespaceIndex = 0;

beforeEach(() => {
  lifecycleNamespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`task-lifecycle-flow-${lifecycleNamespaceIndex}`));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('personal task lifecycle flow', () => {
  it('captures, adds to Today, parks, returns, and marks a task Not today', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Pool' }));
    await user.click(screen.getByRole('button', { name: 'Capture task' }));
    await user.type(screen.getByLabelText('Task title'), 'Send school form');
    await user.selectOptions(screen.getByLabelText('Area'), 'admin');
    await user.type(screen.getByLabelText('Minimum version'), 'Open the form');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));

    const taskPool = screen.getByRole('heading', { name: 'Captured tasks' }).closest('section');

    if (!taskPool) {
      throw new Error('Captured tasks section was not found.');
    }

    expect(await within(taskPool).findByText('Send school form')).toBeTruthy();
    await user.click(within(taskPool).getByRole('button', { name: 'Add to Today' }));
    expect(await screen.findByText('Added to Today.')).toBeTruthy();
    expect(within(taskPool).queryByText('Send school form')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByRole('heading', { name: 'Send school form' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Park' }));

    expect(await screen.findByText('Parked. It is safely held. No catch-up pile.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Pool' }));
    expect(await screen.findByText('Send school form')).toBeTruthy();
    expect(screen.getByText('Admin - Parked')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Bring to Today' }));

    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByRole('heading', { name: 'Send school form' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await user.click(await screen.findByRole('button', { name: 'Not today' }));

    expect(await screen.findByText('Not today. It is out of the current list. No catch-up pile.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Pool' }));
    expect(await screen.findByText('Send school form')).toBeTruthy();
    expect(screen.getByText('Admin - Not today')).toBeTruthy();

    expect(await getTaskPoolItem((await getCurrentLifeRhythmDatabase().taskPoolItems.toArray())[0].id)).toMatchObject({
      status: 'notToday',
      title: 'Send school form',
    });
    expect(await getCurrentLifeRhythmDatabase().activeTasks.toArray()).toEqual([
      expect.objectContaining({
        showToday: false,
        status: 'notToday',
        title: 'Send school form',
      }),
    ]);
  });
});
