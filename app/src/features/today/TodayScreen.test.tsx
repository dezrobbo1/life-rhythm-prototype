// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { TodayScreen } from '../../screens/TodayScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Today screen', () => {
  it('renders the Today surface', () => {
    render(<TodayScreen />);

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Today feels: Normal day' })).toBeTruthy();
    expect(screen.getByText('Next useful action')).toBeTruthy();
    expect(screen.getByText('Gentle wind-down')).toBeTruthy();
  });

  it('keeps the full Today state selector collapsed by default', () => {
    render(<TodayScreen />);

    expect(screen.queryByRole('radiogroup', { name: 'How today feels' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy();
    expect(screen.getByText('Next useful action')).toBeTruthy();
  });

  it('renders all seven Today state choices in the chooser', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Change' }));

    const stateGroup = screen.getByRole('radiogroup', { name: 'How today feels' });
    const stateChoices = within(stateGroup).getAllByRole('radio');

    expect(stateChoices).toHaveLength(7);
    expect(within(stateGroup).getByRole('radio', { name: /Normal day/ })).toBeTruthy();
    expect(within(stateGroup).getByRole('radio', { name: /Behind\/missed things/ })).toBeTruthy();
    expect(within(stateGroup).getByRole('radio', { name: /Low energy/ })).toBeTruthy();
    expect(within(stateGroup).getByRole('radio', { name: /Overstimulated/ })).toBeTruthy();
    expect(within(stateGroup).getByRole('radio', { name: /Avoiding something/ })).toBeTruthy();
    expect(within(stateGroup).getByRole('radio', { name: /Need restart/ })).toBeTruthy();
    expect(within(stateGroup).getByRole('radio', { name: /Bored \/ low stimulation/ })).toBeTruthy();
  });

  it('keeps the bottom navigation available in the app shell', () => {
    render(<App />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Setup' })).toBeTruthy();
  });

  it('updates the plan-adjusted line when the Today state changes', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.click(screen.getByRole('radio', { name: /Low energy/ }));

    expect(screen.getByText('Plan adjusted: minimum counts and the smallest version comes first.')).toBeTruthy();
    expect(screen.getByText('Use the smallest possible version and stop cleanly.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'How today feels' })).toBeNull();
  });

  it('renders the main task card with no more than two chips', () => {
    render(<TodayScreen />);

    const taskCard = screen.getByRole('article', { name: "Set tomorrow's first step" });
    const chips = within(taskCard).getAllByText(/Minimum counts|No catch-up pile/);

    expect(within(taskCard).getByText("Lower tomorrow's start friction before the day closes.")).toBeTruthy();
    expect(chips).toHaveLength(2);
  });

  it('renders the next useful action before the full state selector is opened', () => {
    render(<TodayScreen />);

    const nextAction = screen.getByText('Next useful action');

    expect(nextAction).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Low energy/ })).toBeNull();
  });

  it('shows Add one-off as a secondary today-only action', () => {
    render(<TodayScreen />);

    expect(screen.getByRole('button', { name: 'Add one-off' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
    expect(screen.getByText('Add one today-only task. It will not go into Library or storage.')).toBeTruthy();
  });

  it('keeps Add one-off out of the Next useful action heading', () => {
    render(<TodayScreen />);

    const nextAction = screen.getByRole('region', { name: 'Next useful action' });

    expect(within(nextAction).getByText('Next useful action')).toBeTruthy();
    expect(within(nextAction).queryByRole('button', { name: 'Add one-off' })).toBeNull();
  });

  it('opens task details', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByRole('heading', { name: 'Why this?' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Versions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hidden edges' })).toBeTruthy();
  });

  it('runs the Start task flow before minimum completion feedback', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    expect(screen.getByRole('button', { name: 'Start task' })).toBeTruthy();
    expect(screen.queryByText('Minimum done. That counts.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Start task' }));

    expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark minimum done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep going' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Mark minimum done' }));

    expect(screen.getAllByText('Minimum done. That counts.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Minimum done' })).toBeTruthy();
  });

  it('pauses and resumes an in-progress task', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(screen.getByText('Paused. You can restart small.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark minimum done' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Resume' }));

    expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('keeps optional normal and full versions hidden until Keep going', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    expect(screen.queryByRole('button', { name: 'Do normal version' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Do full version' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Keep going' }));

    expect(screen.getByText('Optional. Keep the minimum small, then continue only if it helps.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Normal version' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Full version' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Do normal version' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Do full version' })).toBeTruthy();
  });

  it('keeps going after minimum done with minimum-already-counts copy', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Mark minimum done' }));
    await user.click(screen.getByRole('button', { name: 'Keep going' }));

    expect(screen.getByText('Optional. Minimum already counts. Continue only if it helps.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Do normal version' }));

    expect(screen.getByText('You kept going with the normal version. Still counts either way.')).toBeTruthy();
  });

  it('can stop after opening optional continuation', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Keep going' }));
    await user.click(screen.getByRole('button', { name: 'Stop here' }));

    expect(screen.queryByRole('heading', { name: 'Normal version' })).toBeNull();
    expect(screen.getByText('Enough for now.')).toBeTruthy();
  });

  it('opens Start Boost from the task card', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));

    const dialog = screen.getByRole('dialog', { name: 'Start Boost' });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: "Set tomorrow's first step" })).toBeTruthy();
    expect(within(dialog).getByText(/Minimum:/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Read the first action/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Set up the space/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Do the 30-second start/ })).toBeTruthy();
    expect(within(dialog).getByText('What is blocking the start?')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Too big' })).toBeTruthy();
  });

  it('opens Start Boost from in-progress state', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Start Boost' }));

    expect(screen.getByRole('dialog', { name: 'Start Boost' })).toBeTruthy();
    expect(screen.getByText('In progress. Keep it small.')).toBeTruthy();
  });

  it('opens Start Boost from paused state', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await user.click(screen.getByRole('button', { name: 'Start Boost' }));

    expect(screen.getByRole('dialog', { name: 'Start Boost' })).toBeTruthy();
    expect(screen.getByText('Paused. You can restart small.')).toBeTruthy();
  });

  it('selects a mock Start Boost activation option without writing storage', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: /Read the first action/ }));

    expect(screen.getByText('Read the first action is enough to begin.')).toBeTruthy();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('shows support buttons after barrier selection', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Unclear first step' }));

    expect(screen.getByText('Choose one support')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Finish one sentence/ })).toBeTruthy();
    expect(screen.queryByText('Did that reduce friction?')).toBeNull();
  });

  it('renders feedback controls after support selection', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Low energy' }));
    await user.click(screen.getByRole('button', { name: /Use the two-minute version/ }));

    expect(screen.getByText('Did that reduce friction?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A bit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Made it harder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  });

  it('closes Start Boost after minimum completion', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Too big' }));
    expect(screen.getByText('Choose one support')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(screen.getByRole('button', { name: 'Mark minimum done' }));

    expect(screen.queryByRole('dialog', { name: 'Start Boost' })).toBeNull();
    expect(screen.getAllByText('Minimum done. That counts.').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Start Boost' })).toBeNull();
  });

  it('opens Add one-off and saves a mock in-memory Today task only', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Add one-off' }));
    expect(screen.getByText('For today only. Preview only; not saved yet.')).toBeTruthy();
    await user.type(screen.getByLabelText('Task title'), 'Pay water bill');
    await user.clear(screen.getByLabelText('Area'));
    await user.type(screen.getByLabelText('Area'), 'Money');
    await user.type(screen.getByLabelText('Minimum version'), 'Open the bill and note the due date.');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(screen.queryByRole('dialog', { name: 'Add one-off' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();
    expect(screen.getByText('Mock task added for today only. Nothing was saved.')).toBeTruthy();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('does not add a saved one-off to the Library catalogue', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Add one-off' }));
    await user.type(screen.getByLabelText('Task title'), 'Pay water bill');
    await user.clear(screen.getByLabelText('Area'));
    await user.type(screen.getByLabelText('Area'), 'Money');
    await user.type(screen.getByLabelText('Minimum version'), 'Open the bill and note the due date.');
    await user.click(screen.getByRole('button', { name: 'Save one-off' }));

    expect(screen.getByRole('article', { name: 'Pay water bill' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Library' }));

    expect(screen.queryByRole('article', { name: 'Pay water bill' })).toBeNull();
  });

  it('closes Start Boost from the modal close button', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Close Start Boost' }));

    expect(screen.queryByRole('dialog', { name: 'Start Boost' })).toBeNull();
  });
});
