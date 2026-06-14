// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { ResetScreen } from '../../screens/ResetScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Reset screen', () => {
  it('renders main reset cards', () => {
    render(<ResetScreen />);

    expect(screen.getByRole('article', { name: 'Too much today' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Move extras' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Restart with one action' })).toBeTruthy();
    expect(screen.getByText('No catch-up pile. Choose what helps now.')).toBeTruthy();
  });

  it('renders secondary options', () => {
    render(<ResetScreen />);

    expect(screen.getByRole('heading', { name: 'Review tomorrow' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Restore hidden items' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Reset whole app' })).toBeTruthy();
  });

  it('shows hidden confirmation for Too much today', async () => {
    const user = userEvent.setup();
    render(<ResetScreen />);

    const card = screen.getByRole('article', { name: 'Too much today' });
    await user.click(within(card).getByRole('button', { name: 'Too much today' }));

    expect(screen.getByRole('status').textContent).toContain('Hidden, not deleted.');
  });

  it('shows moved confirmation for Move extras', async () => {
    const user = userEvent.setup();
    render(<ResetScreen />);

    const card = screen.getByRole('article', { name: 'Move extras' });
    await user.click(within(card).getByRole('button', { name: 'Move extras' }));

    expect(screen.getByRole('status').textContent).toContain('Moved out of today.');
  });

  it('shows one selected restart action', async () => {
    const user = userEvent.setup();
    render(<ResetScreen />);

    const card = screen.getByRole('article', { name: 'Restart with one action' });
    await user.click(within(card).getByRole('button', { name: 'Restart with one action' }));

    expect(screen.getByText('Selected restart action')).toBeTruthy();
    expect(screen.getByText("Set tomorrow's first step")).toBeTruthy();
    expect(screen.getByText('One action is enough. That counts.')).toBeTruthy();
  });

  it('runs Restore hidden items as a mock action', async () => {
    const user = userEvent.setup();
    render(<ResetScreen />);

    await user.click(screen.getByRole('button', { name: 'Restore hidden items' }));

    expect(screen.getByRole('status').textContent).toContain('Hidden items are visible again.');
  });

  it('requires typed RESET before full reset can run', async () => {
    const user = userEvent.setup();
    render(<ResetScreen />);

    const confirmButton = screen.getByRole('button', { name: 'Confirm mock full reset' }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    await user.type(screen.getByLabelText('Type RESET to confirm full reset'), 'RESET');

    expect(confirmButton.disabled).toBe(false);
  });

  it('does not perform real storage writes for full reset', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    render(<ResetScreen />);

    await user.type(screen.getByLabelText('Type RESET to confirm full reset'), 'RESET');
    await user.click(screen.getByRole('button', { name: 'Confirm mock full reset' }));

    expect(screen.getByText('Mock full reset complete. No real data was cleared.')).toBeTruthy();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('keeps Setup available as a mock settings surface', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Setup' }));

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
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Reset' })).toBeTruthy();
  });
});
