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

describe('primary app shell navigation', () => {
  it('renders non-placeholder content for the primary tabs and secondary surfaces', async () => {
    const user = userEvent.setup();
    render(<App />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });

    expect(screen.getByText('Personal trial')).toBeTruthy();
    expect(screen.getByText('Start small. Keep rhythm.')).toBeTruthy();
    expect(document.querySelector('.brand-mark')).toBeTruthy();
    expect(document.querySelector('.brand-mark svg')).toBeTruthy();
    expect(document.querySelectorAll('.bottom-nav__icon')).toHaveLength(4);
    expect(document.querySelectorAll('.bottom-nav__icon .app-icon')).toHaveLength(4);

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Next useful action')).toBeTruthy();
    expect(document.querySelector('.today-hero .screen-hero__mark')).toBeTruthy();
    expect(document.querySelector('.today-hero .screen-hero__mark .app-icon')).toBeTruthy();
    expect(document.querySelector('.task-card__marker .app-icon')).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Plan' }));
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy();
    expect(screen.getByLabelText('Broad day blocks')).toBeTruthy();
    expect(document.querySelector('.plan-hero .screen-hero__mark')).toBeTruthy();
    expect(document.querySelector('.plan-block__icon .app-icon')).toBeTruthy();
    expect(document.querySelector('.plan-item__icon .app-icon')).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Pool' }));
    expect(screen.getByRole('heading', { name: 'Pool' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Task Pool' })).toBeTruthy();
    expect(document.querySelector('.pool-hero .screen-hero__mark')).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Quick packs' })).toBeTruthy();
    expect(document.querySelector('.library-hero .screen-hero__mark')).toBeTruthy();
    expect(document.querySelector('.library-card__icon .app-icon')).toBeTruthy();

    const secondaryNav = screen.getByRole('navigation', { name: 'Secondary' });

    expect(within(nav).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Settings' })).toBeNull();

    await user.click(within(secondaryNav).getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('heading', { name: 'Reset' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Daily reset actions' })).toBeTruthy();
    expect(document.querySelector('.reset-hero .screen-hero__mark')).toBeTruthy();
    expect(document.querySelector('.reset-card__icon .app-icon')).toBeTruthy();

    await user.click(within(secondaryNav).getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Start Boost safety' })).toBeTruthy();
    expect(document.querySelector('.setup-hero .screen-hero__mark')).toBeTruthy();
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
    const secondaryNav = screen.getByRole('navigation', { name: 'Secondary' });

    await user.click(within(secondaryNav).getByRole('button', { name: 'Settings' }));

    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Pool' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(within(secondaryNav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(secondaryNav).getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Trial limits' })).toBeTruthy();
    expect(screen.getByText('Use one browser, one device, and one stable URL for the trial.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Time to leave alone' })).toBeTruthy();
    expect(screen.getByLabelText('Select settings backup file')).toBeTruthy();
    expect(screen.getByLabelText('Select soft placement backup file')).toBeTruthy();
  });
});
