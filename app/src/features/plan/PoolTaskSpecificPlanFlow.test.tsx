// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import {
  createAuthLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';

let namespaceIndex = 0;

beforeEach(async () => {
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`pool-task-specific-plan-${namespaceIndex}`));

  const defaults = createDefaultSettings('2026-07-01T00:00:00.000Z');
  await saveSettings({
    lifeShape: {
      ...defaults.lifeShape,
      timeBlocks: [
        {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          end: '10:30',
          id: 'open-morning',
          label: 'Open morning capacity',
          schedulerUse: 'available',
          start: '10:00',
          type: 'openCapacity',
        },
      ],
    },
    startBoostSafety: defaults.startBoostSafety,
    theme: defaults.theme,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCurrentLocalDataNamespace();
});

async function captureTask(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: 'Capture task' }));
  await user.type(screen.getByLabelText('Task title'), title);
  await user.selectOptions(screen.getByLabelText('Area'), 'admin');
  await user.type(screen.getByLabelText('Minimum version'), `Open ${title.toLowerCase()}`);
  await user.click(screen.getByRole('button', { name: 'Save captured task' }));
  expect(await screen.findByText(title)).toBeTruthy();
}

describe('task-specific Pool to Plan routing', () => {
  it('prioritises the task whose Find soft window action was chosen', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Pool' }));
    await captureTask(user, 'Older task');
    await captureTask(user, 'Chosen task');

    const chosenRow = screen.getByText('Chosen task').closest('li');
    if (!chosenRow) throw new Error('Chosen task row was not found.');

    await user.click(within(chosenRow).getByRole('button', { name: 'Find soft window' }));

    const suggestions = (await screen.findByRole('heading', { name: 'Soft suggestions' })).closest('section');
    if (!suggestions) throw new Error('Soft suggestions section was not found.');

    expect(await within(suggestions).findByText('Chosen task')).toBeTruthy();
    expect(within(suggestions).queryByText('Older task')).toBeNull();
    expect(within(suggestions).getByText('Showing Chosen task first because you chose it in Pool.')).toBeTruthy();
  });
});
