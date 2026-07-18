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
import { saveTaskPoolItem } from '../../data/taskPoolRepository';

let namespaceIndex = 0;

beforeEach(() => {
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`task-deferral-flow-${namespaceIndex}`));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

describe('personal task deferral and resurfacing', () => {
  it('holds a captured task until a chosen future time without moving it to Today', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Pool' }));
    await user.click(screen.getByRole('button', { name: 'Capture task' }));
    await user.type(screen.getByLabelText('Task title'), 'Send school form');
    await user.selectOptions(screen.getByLabelText('Area'), 'admin');
    await user.type(screen.getByLabelText('Minimum version'), 'Open the form');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));

    const taskPool = screen.getByRole('heading', { name: 'Captured tasks' }).closest('section');
    if (!taskPool) throw new Error('Captured tasks section was not found.');

    expect(await within(taskPool).findByText('Send school form')).toBeTruthy();
    await user.click(within(taskPool).getByText('Other choices'));
    await user.click(within(taskPool).getByRole('button', { name: 'Bring back later' }));

    expect(await screen.findByRole('heading', { name: 'Bring back later' })).toBeTruthy();
    expect((screen.getByLabelText('Bring back after') as HTMLInputElement).value).not.toBe('');
    await user.click(screen.getByRole('button', { name: 'Hold until then' }));

    expect(await screen.findByText('Nothing moves into Today automatically.')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Bring back later' })).toBeTruthy();
    expect(screen.getByText('Admin - Bring back later')).toBeTruthy();

    const database = getCurrentLifeRhythmDatabase();
    const [storedItem] = await database.taskPoolItems.toArray();

    expect(storedItem).toMatchObject({
      status: 'deferred',
      title: 'Send school form',
    });
    expect(Date.parse(storedItem.bringBackAfter ?? '')).toBeGreaterThan(Date.now());
    expect(await database.activeTasks.count()).toBe(0);
  });

  it('shows an arrived deferred task as Ready to revisit and lets the user bring it to Today', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await saveTaskPoolItem({
      area: 'admin',
      bringBackAfter: '2020-01-01T09:00:00.000Z',
      createdAt: '2020-01-01T08:00:00.000Z',
      full: { label: 'Complete the whole form', minutes: 20 },
      id: 'ready-school-form',
      minimum: { label: 'Open the form', minutes: 5 },
      normal: { label: 'Fill the first page', minutes: 10 },
      source: 'adhoc',
      status: 'deferred',
      title: 'Send school form',
      updatedAt: '2020-01-01T08:00:00.000Z',
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Pool' }));

    const readyGroup = await screen.findByRole('heading', { name: 'Ready to revisit' });
    const group = readyGroup.closest('section');
    if (!group) throw new Error('Ready to revisit group was not found.');

    expect(within(group).getByText('The time you chose has arrived. Nothing moved automatically.')).toBeTruthy();
    expect(within(group).getByText('Send school form')).toBeTruthy();
    expect(within(group).getByText('Admin - Ready to revisit')).toBeTruthy();
    await user.click(within(group).getByRole('button', { name: 'Bring to Today' }));

    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByRole('heading', { name: 'Send school form' })).toBeTruthy();

    expect(await database.taskPoolItems.get('ready-school-form')).toMatchObject({ status: 'today' });
    expect((await database.taskPoolItems.get('ready-school-form'))?.bringBackAfter).toBeUndefined();
    expect(await database.activeTasks.get('ready-school-form')).toMatchObject({
      showToday: true,
      status: 'active',
      title: 'Send school form',
    });
  });
});
