// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(() => {
  cleanup();
});

describe('five-tab app shell', () => {
  it('renders non-placeholder content for all five tabs', async () => {
    const user = userEvent.setup();
    render(<App />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Next useful action')).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Plan' }));
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy();
    expect(screen.getByLabelText('Broad day blocks')).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Quick packs' })).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('heading', { name: 'Reset' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Daily reset actions' })).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Setup' }));
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Start Boost safety' })).toBeTruthy();

    expect(screen.queryByText(/placeholder/i)).toBeNull();
  });
});
