// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../../App';
import { TodayScreen } from '../../screens/TodayScreen';

afterEach(() => {
  cleanup();
});

describe('Today screen', () => {
  it('renders the Today surface', () => {
    render(<TodayScreen />);

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'How today feels' })).toBeTruthy();
    expect(screen.getByText('Next useful action')).toBeTruthy();
  });

  it('renders all seven Today state choices', () => {
    render(<TodayScreen />);

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

    await user.click(screen.getByRole('radio', { name: /Low energy/ }));

    expect(screen.getByText('Plan adjusted: minimum counts and the smallest version comes first.')).toBeTruthy();
    expect(screen.getByText('Use the smallest possible version and stop cleanly.')).toBeTruthy();
  });

  it('renders the main task card with no more than two chips', () => {
    render(<TodayScreen />);

    const taskCard = screen.getByRole('article', { name: "Set tomorrow's first step" });
    const chips = within(taskCard).getAllByText(/Minimum counts|No catch-up pile/);

    expect(within(taskCard).getByText("Lower tomorrow's start friction before the day closes.")).toBeTruthy();
    expect(chips).toHaveLength(2);
  });

  it('opens task details', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByRole('heading', { name: 'Why this?' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Versions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hidden edges' })).toBeTruthy();
  });

  it('opens Start Boost from the task card', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));

    expect(screen.getByRole('dialog', { name: 'Start Boost' })).toBeTruthy();
    expect(screen.getByText('What is blocking the start?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Too big' })).toBeTruthy();
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

  it('closes Start Boost from the modal close button', async () => {
    const user = userEvent.setup();
    render(<TodayScreen />);

    await user.click(screen.getByRole('button', { name: 'Start Boost' }));
    await user.click(screen.getByRole('button', { name: 'Close Start Boost' }));

    expect(screen.queryByRole('dialog', { name: 'Start Boost' })).toBeNull();
  });
});
