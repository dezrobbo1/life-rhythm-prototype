// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { rhythmTemplateSchema } from '../../data/schemas';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';

let namespaceIndex = 0;
const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

beforeEach(async () => {
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate6-daily-loop-${namespaceIndex}`));

  const defaults = createDefaultSettings('2026-09-21T08:00:00.000Z');
  const settings = await saveSettings({
    lifeShape: {
      ...defaults.lifeShape,
      fixedCommitments: [{
        bufferMinutes: 0,
        days: [...allDays],
        end: '19:00',
        id: 'family-call',
        label: 'Family call',
        start: '18:30',
        travelMinutes: 0,
      }],
      timeBlocks: [
        {
          days: [...allDays],
          end: '17:30',
          id: 'quiet-reset',
          label: 'Quiet reset',
          schedulerUse: 'unavailable',
          start: '17:00',
          type: 'protectedTime',
        },
        {
          days: [...allDays],
          end: '18:00',
          id: 'ask-first',
          label: 'Ask first',
          schedulerUse: 'askFirst',
          start: '17:30',
          type: 'looseTime',
        },
        {
          days: [...allDays],
          end: '20:00',
          id: 'evening-capacity',
          label: 'Evening capacity',
          schedulerUse: 'available',
          start: '18:00',
          type: 'openCapacity',
        },
      ],
    },
    startBoostSafety: defaults.startBoostSafety,
    theme: defaults.theme,
  });
  expect(settings.ok).toBe(true);

  await getCurrentLifeRhythmDatabase().rhythmTemplates.put(rhythmTemplateSchema.parse({
    area: 'health',
    createdAt: '2026-09-21T08:00:00.000Z',
    enabled: true,
    full: { label: 'Take a full reset walk', minutes: 20 },
    id: 'daily-reset-rhythm',
    minimum: { label: 'Step outside', minutes: 5 },
    normal: { label: 'Take a short reset walk', minutes: 10 },
    schedule: { frequency: 1, period: 'day' },
    source: 'custom',
    title: 'Reset walk',
    updatedAt: '2026-09-21T08:00:00.000Z',
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetCurrentLocalDataNamespace();
});

describe('Gate 6 connected daily loop', () => {
  it('captures safely, plans factual work, preserves Minimum, and returns the task to Held without debt', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Now' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Later' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Changed' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await user.type(screen.getByLabelText('Task title'), 'Pack the school bag');
    await user.type(screen.getByLabelText('Smallest useful action'), 'Put the bag by the door');
    await user.type(screen.getByLabelText('Minutes for this action'), '5');
    await user.click(screen.getByRole('button', { name: /Optional details/ }));
    await user.type(screen.getByLabelText('Normal version'), 'Pack tomorrow’s essentials');
    await user.type(screen.getByLabelText('Normal minutes'), '10');
    await user.type(screen.getByLabelText('Full version'), 'Pack and check the timetable');
    await user.type(screen.getByLabelText('Full minutes'), '20');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));

    expect(await screen.findByText('Task captured. Held outside Today. Life Rhythm can privately plan it when it fits.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(await getCurrentLifeRhythmDatabase().activeTasks.count()).toBe(0);
    expect(await getCurrentLifeRhythmDatabase().softPlacements.count()).toBe(0);
    expect(await getCurrentLifeRhythmDatabase().calendarSources.count()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Held' }));
    const captured = screen.getByRole('heading', { name: 'Captured tasks' }).closest('section');
    if (!captured) throw new Error('Captured Held section was not found.');
    expect(await within(captured).findByText('Pack the school bag')).toBeTruthy();
    await user.click(within(captured).getByRole('button', { name: 'Add to Today' }));
    await vi.waitFor(async () => {
      expect(await getCurrentLifeRhythmDatabase().activeTasks.count()).toBe(1);
    });
    expect(await screen.findByText('Added to Today.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Plan' }));
    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeTruthy();
    const selectedDay = screen.getByLabelText('Selected day') as HTMLSelectElement;
    const dayLine = await screen.findByRole('list', { name: `${selectedDay.value} Day Line` });
    expect(within(dayLine).getByText('Quiet reset')).toBeTruthy();
    expect(screen.getAllByText('Ask first').length).toBeGreaterThan(0);
    const details = screen.getByText('Plan details').closest('details');
    expect(details?.open).toBe(false);
    await user.click(screen.getByText('Plan details'));
    expect(details?.open).toBe(true);
    expect(await screen.findByRole('heading', { name: 'Flexible plan' })).toBeTruthy();
    await user.click(screen.getByText('Plan details'));
    expect(details?.open).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByRole('heading', { name: 'Pack the school bag' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Later' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    expect((await screen.findAllByText('Minimum done. That counts.')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Keep going' }));
    expect((await screen.findAllByText('Minimum already counts.')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('Paused. Minimum already counts.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect((await screen.findAllByText('Minimum already counts.')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Park' }));
    expect(await screen.findByText('Parked. It is safely held. No catch-up pile.')).toBeTruthy();

    const activeTask = (await getCurrentLifeRhythmDatabase().activeTasks.toArray())[0];
    expect(activeTask).toMatchObject({
      minimumAchievedAt: expect.any(String),
      showToday: false,
      status: 'parked',
      title: 'Pack the school bag',
    });
    const heldTask = (await getCurrentLifeRhythmDatabase().taskPoolItems.toArray())
      .find((item) => item.title === 'Pack the school bag');
    expect(heldTask).toMatchObject({ status: 'parked' });
    expect(await getCurrentLifeRhythmDatabase().rhythmTemplates.count()).toBe(1);
  });
  it('corrects private work from Day Line with maintenance closed and returns Move focus', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Today' });
    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await user.type(screen.getByLabelText('Task title'), 'Contextual correction');
    await user.type(screen.getByLabelText('Smallest useful action'), 'Open the note');
    await user.type(screen.getByLabelText('Minutes for this action'), '5');
    await user.click(screen.getByRole('button', { name: 'Save captured task' }));
    await screen.findByText('Task captured. Held outside Today. Life Rhythm can privately plan it when it fits.');
    await user.click(screen.getByRole('button', { name: 'Plan' }));
    const line = await screen.findByRole('list', { name: /Day Line/ });
    const row = (await within(line).findByText('Contextual correction')).closest('li')!;
    await user.click(await within(row).findByText('Correct Contextual correction'));
    const move = within(row).getByRole('button', { name: 'Move' });
    expect(screen.getByText('Plan details').closest('details')?.open).toBe(false);
    expect(within(row).getByRole('button', { name: 'Protect this time' })).toBeTruthy();
    await user.click(move);
    const dialog = screen.getByRole('dialog', { name: 'Move this planned time' });
    expect(within(dialog).getByLabelText('Move date')).toBeTruthy();
    expect(within(dialog).getByLabelText('Move start time')).toBeTruthy();
    expect(within(dialog).getByText(/Keeps the current 5-minute form/)).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(move);
    await user.click(move);
    await user.clear(screen.getByLabelText('Move start time'));
    await user.type(screen.getByLabelText('Move start time'), '18:30');
    await user.click(screen.getByRole('button', { name: 'Save move' }));
    expect(await within(screen.getByRole('dialog')).findByRole('status')).toBeTruthy();
    expect(await getCurrentLifeRhythmDatabase().softPlacements.count()).toBe(0);
    await user.clear(screen.getByLabelText('Move start time'));
    await user.type(screen.getByLabelText('Move start time'), '19:10');
    vi.setSystemTime(new Date(2026, 9, 5, 9, 2));
    await user.click(screen.getByRole('button', { name: 'Save move' }));
    await screen.findByText('Placement moved.');
    expect(screen.queryByRole('dialog')).toBeNull();
    const saved = await getCurrentLifeRhythmDatabase().softPlacements.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ start: '19:10', end: '19:15', correctionKind: 'move' });
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Correct Contextual correction'));
    expect(screen.getByText('Plan details').closest('details')?.open).toBe(false);
  });

});
