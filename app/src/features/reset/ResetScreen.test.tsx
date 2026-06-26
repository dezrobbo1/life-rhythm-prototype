// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { activeTaskSchema, type ActiveTask, type ActiveTaskStatus } from '../../data/schemas';
import { ResetScreen } from '../../screens/ResetScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function validActiveTask(overrides: Partial<ActiveTask> = {}): ActiveTask {
  return activeTaskSchema.parse({
    area: 'house',
    createdAt: '2026-06-19T00:00:00.000Z',
    full: {
      label: 'Finish the whole task',
      minutes: 20,
    },
    id: 'active-reset-task',
    minimum: {
      label: 'Do the first small step',
      minutes: 5,
    },
    normal: {
      label: 'Do the normal version',
      minutes: 10,
    },
    purpose: 'A Today task used for reset tests.',
    showToday: true,
    source: 'adhoc',
    status: 'active',
    title: 'Reset test task',
    updatedAt: '2026-06-19T00:00:00.000Z',
    ...overrides,
  });
}

function resetHarness(initialTasks: ActiveTask[]) {
  let tasks = [...initialTasks];
  const loadTodayTasks = vi.fn(async () => tasks);
  const updateTaskStatus = vi.fn(async (taskId: string, status: ActiveTaskStatus) => {
    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      return {
        errors: ['id: Active Today task was not found.'],
        ok: false as const,
      };
    }

    const updatedTask = activeTaskSchema.parse({
      ...task,
      showToday: ['active', 'inProgress', 'paused', 'minimumDone'].includes(status),
      status,
      updatedAt: '2026-06-19T01:00:00.000Z',
    });

    tasks = tasks.map((item) => (item.id === taskId ? updatedTask : item)).filter((item) => item.showToday);

    return {
      ok: true as const,
      task: updatedTask,
      visibleToday: updatedTask.showToday,
    };
  });

  return {
    loadTodayTasks,
    updateTaskStatus,
  };
}

describe('Reset screen', () => {
  it('renders main reset cards', () => {
    render(<ResetScreen />);

    expect(screen.getByRole('article', { name: 'Narrow Today' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Park extras safely' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Restart with one action' })).toBeTruthy();
    expect(screen.getByText('No catch-up pile. Choose what helps now.')).toBeTruthy();
    expect(screen.getByText('Safe Today reset actions. Tasks are not deleted.')).toBeTruthy();
  });

  it('renders secondary options', () => {
    render(<ResetScreen />);

    expect(screen.getByRole('heading', { name: 'Review tomorrow' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Restore hidden items' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Reset whole app' })).toBeTruthy();
  });

  it('marks extra visible Today tasks notToday when Narrow Today runs', async () => {
    const user = userEvent.setup();
    const harness = resetHarness([
      validActiveTask({ id: 'active-first', title: 'First task' }),
      validActiveTask({ id: 'active-second', title: 'Second task' }),
      validActiveTask({ id: 'active-third', title: 'Third task' }),
    ]);
    render(<ResetScreen {...harness} />);

    await screen.findByText('3 visible Today tasks are available for reset.');

    const card = screen.getByRole('article', { name: 'Narrow Today' });
    await user.click(within(card).getByRole('button', { name: 'Narrow Today' }));

    await waitFor(() => expect(harness.updateTaskStatus).toHaveBeenCalledTimes(2));
    expect(harness.updateTaskStatus).not.toHaveBeenCalledWith('active-first', 'notToday');
    expect(harness.updateTaskStatus).toHaveBeenCalledWith('active-second', 'notToday');
    expect(harness.updateTaskStatus).toHaveBeenCalledWith('active-third', 'notToday');
    expect(screen.getByRole('status').textContent).toContain(
      'Today is narrowed to one next action. Extras are marked not today. No catch-up pile.',
    );
    expect(screen.getByText('1 visible Today task is available for reset.')).toBeTruthy();
  });

  it('marks extra visible Today tasks parked when Park extras safely runs', async () => {
    const user = userEvent.setup();
    const harness = resetHarness([
      validActiveTask({ id: 'active-first', title: 'First task' }),
      validActiveTask({ id: 'active-second', title: 'Second task' }),
    ]);
    render(<ResetScreen {...harness} />);

    await screen.findByText('2 visible Today tasks are available for reset.');

    const card = screen.getByRole('article', { name: 'Park extras safely' });
    await user.click(within(card).getByRole('button', { name: 'Park extras safely' }));

    await waitFor(() => expect(harness.updateTaskStatus).toHaveBeenCalledTimes(1));
    expect(harness.updateTaskStatus).not.toHaveBeenCalledWith('active-first', 'parked');
    expect(harness.updateTaskStatus).toHaveBeenCalledWith('active-second', 'parked');
    expect(screen.getByRole('status').textContent).toContain(
      'Extras are parked safely. One next action remains. No catch-up pile.',
    );
  });

  it('shows calm copy when Reset already has only one visible Today task', async () => {
    const user = userEvent.setup();
    const harness = resetHarness([
      validActiveTask({ id: 'active-first', title: 'First task' }),
    ]);
    render(<ResetScreen {...harness} />);

    await screen.findByText('1 visible Today task is available for reset.');
    await user.click(within(screen.getByRole('article', { name: 'Narrow Today' })).getByRole('button', { name: 'Narrow Today' }));

    expect(harness.updateTaskStatus).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Today already has one next action. Nothing else changed. No catch-up pile.');
  });

  it('shows the first visible Today task as the restart action', async () => {
    const user = userEvent.setup();
    const harness = resetHarness([
      validActiveTask({
        area: 'admin',
        id: 'active-paperwork',
        minimum: {
          label: 'Open the form',
          minutes: 5,
        },
        title: 'Paperwork reset',
      }),
    ]);
    render(<ResetScreen {...harness} />);

    await screen.findByText('1 visible Today task is available for reset.');
    const card = screen.getByRole('article', { name: 'Restart with one action' });
    await user.click(within(card).getByRole('button', { name: 'Restart with one action' }));

    expect(screen.getByText('Selected restart action')).toBeTruthy();
    expect(screen.getByText('Paperwork reset')).toBeTruthy();
    expect(screen.getByText('Open the form')).toBeTruthy();
    expect(screen.getByText('One action is enough. That counts.')).toBeTruthy();
  });

  it('shows calm empty copy when restart has no Today task', async () => {
    const user = userEvent.setup();
    const harness = resetHarness([]);
    render(<ResetScreen {...harness} />);

    await screen.findByText('0 visible Today tasks are available for reset.');
    const card = screen.getByRole('article', { name: 'Restart with one action' });
    await user.click(within(card).getByRole('button', { name: 'Restart with one action' }));

    expect(screen.getByRole('status').textContent).toContain('No Today task is waiting. Add one small action when ready.');
    expect(screen.queryByText('Selected restart action')).toBeNull();
  });

  it('keeps Restore hidden items preview-only', async () => {
    const user = userEvent.setup();
    render(<ResetScreen />);

    await user.click(screen.getByRole('button', { name: 'Restore hidden items' }));

    expect(screen.getByRole('status').textContent).toContain('Restore is not connected yet. Nothing changed.');
  });

  it('requires typed RESET before full reset can run', async () => {
    const user = userEvent.setup();
    render(<ResetScreen />);

    const confirmButton = screen.getByRole('button', { name: 'Confirm disabled full reset' }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    await user.type(screen.getByLabelText('Type RESET to confirm full reset'), 'RESET');

    expect(confirmButton.disabled).toBe(false);
  });

  it('does not perform real storage writes for full reset', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    render(<ResetScreen />);

    await user.type(screen.getByLabelText('Type RESET to confirm full reset'), 'RESET');
    await user.click(screen.getByRole('button', { name: 'Confirm disabled full reset' }));

    expect(screen.getAllByRole('status').some((status) =>
      status.textContent?.includes('Full app reset is not enabled for this trial. No data is cleared.'),
    )).toBe(true);
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('keeps forbidden copy out of Reset', () => {
    render(<ResetScreen />);

    expect(document.body.textContent).not.toMatch(
      /\b(overdue|late|failed|urgent|behind|score|streak|catch up|optimize|productivity score|compliance)\b/i,
    );
  });

  it('keeps Setup available as a mock settings surface', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Start Boost safety' })).toBeTruthy();
  });

  it('keeps bottom navigation available', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Pool' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Settings' })).toBeNull();

    const secondaryNav = screen.getByRole('navigation', { name: 'Secondary' });
    expect(within(secondaryNav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(secondaryNav).getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Reset' })).toBeTruthy();
  });
});
