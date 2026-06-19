// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
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
    expect(document.querySelector('.app-shell')).toBeTruthy();
    expect(document.querySelector('.app-main')).toBeTruthy();
    expect(document.querySelector('.bottom-nav')).toBe(nav);

    expect(screen.queryByText(/placeholder/i)).toBeNull();
  });

  it('keeps core Setup trial surfaces available at phone width', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    window.dispatchEvent(new Event('resize'));
    render(<App />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(nav).getByRole('button', { name: 'Setup' }));

    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Trial limits' })).toBeTruthy();
    expect(screen.getByText('Use one browser, one device, and one stable URL for the trial.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Time to leave alone' })).toBeTruthy();
    expect(screen.getByLabelText('Select settings backup file')).toBeTruthy();
    expect(screen.getByLabelText('Select soft placement backup file')).toBeTruthy();
  });
});
