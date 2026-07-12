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
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';
import { saveSoftPlacement } from '../../data/softPlacementRepository';
import { softPlacementSchema, taskPoolItemSchema } from '../../data/schemas';
import { localDateForNextSelectedDay } from './softPlacementDate';

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

  it('opens View in Plan on the actual soft-placement day', async () => {
    const database = getCurrentLifeRhythmDatabase();
    const placementDate = localDateForNextSelectedDay('Tuesday');

    await database.taskPoolItems.put(taskPoolItemSchema.parse({
      area: 'admin',
      createdAt: '2026-07-01T00:00:00.000Z',
      full: { label: 'Complete the whole form', minutes: 20 },
      id: 'placed-task',
      minimum: { label: 'Open the form', minutes: 5 },
      normal: { label: 'Fill the first page', minutes: 10 },
      source: 'adhoc',
      status: 'softPlaced',
      title: 'Placed task',
      updatedAt: '2026-07-12T00:00:00.000Z',
    }));
    await saveSoftPlacement(softPlacementSchema.parse({
      blockId: 'open-morning',
      blockLabelSnapshot: 'Open morning capacity',
      createdAt: '2026-07-12T00:00:00.000Z',
      date: placementDate,
      end: '10:30',
      id: 'soft-placement-placed-task',
      placementSource: 'userConfirmed',
      start: '10:00',
      status: 'planned',
      taskId: 'placed-task',
      taskTitleSnapshot: 'Placed task',
      updatedAt: '2026-07-12T00:00:00.000Z',
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Pool' }));
    const taskRow = (await screen.findByText('Placed task')).closest('li');
    if (!taskRow) throw new Error('Placed task row was not found.');

    await user.click(within(taskRow).getByRole('button', { name: 'View in Plan' }));

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeTruthy();
    expect((screen.getByLabelText('Selected day') as HTMLSelectElement).value).toBe('Tuesday');

    const placements = (await screen.findByRole('heading', { name: 'Soft placements' })).closest('section');
    if (!placements) throw new Error('Soft placements section was not found.');

    expect(await within(placements).findByText('Placed task')).toBeTruthy();
    expect(within(placements).getByText('Open morning capacity · 10:00-10:30')).toBeTruthy();
  });
});
