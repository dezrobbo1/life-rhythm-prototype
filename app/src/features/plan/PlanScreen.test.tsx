// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../../App';
import { PlanScreen } from '../../screens/PlanScreen';

afterEach(() => {
  cleanup();
});

describe('Plan screen', () => {
  it('renders all broad day blocks', () => {
    render(<PlanScreen />);

    expect(screen.getByText('Life shape preview: work hours and buffers will shape future planning.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Morning' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Midday' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Afternoon' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Evening' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Late evening' })).toBeTruthy();
  });

  it('renders fixed commitments before flexible rhythm items in a block', () => {
    render(<PlanScreen />);

    const morning = screen.getByRole('region', { name: 'Morning' });
    const fixed = within(morning).getByRole('article', { name: 'School drop-off' });
    const rhythm = within(morning).getByRole('article', { name: 'Breakfast reset' });

    expect(fixed.compareDocumentPosition(rhythm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(fixed).getByText('Fixed commitment')).toBeTruthy();
    expect(within(rhythm).getByText('Soft rhythm')).toBeTruthy();
    expect(screen.getByText('Fixed commitments are visible. Flexible rhythms can move, shrink, or restart from one action.')).toBeTruthy();
  });

  it('keeps hidden edges collapsed by default', () => {
    render(<PlanScreen />);

    expect(screen.getByRole('button', { name: 'Show hidden edges for School drop-off (4 soft edges)' })).toBeTruthy();
    expect(screen.queryByText('Find bags and water bottles')).toBeNull();
    expect(screen.queryByText('arrival margin')).toBeNull();
  });

  it('expands hidden edges for a plan item', async () => {
    const user = userEvent.setup();
    render(<PlanScreen />);

    await user.click(screen.getByRole('button', { name: 'Show hidden edges for School drop-off (4 soft edges)' }));

    expect(screen.getByText('Find bags and water bottles')).toBeTruthy();
    expect(screen.getByText('travel')).toBeTruthy();
    expect(screen.getByText('arrival margin')).toBeTruthy();
    expect(screen.getByText('transition')).toBeTruthy();
  });

  it('renders low-pressure plan controls', () => {
    render(<PlanScreen />);

    expect(screen.getAllByRole('button', { name: 'Move later' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Shrink' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Restart with one action' }).length).toBeGreaterThan(0);
  });

  it('does not expose scheduler or debug metadata', () => {
    render(<PlanScreen />);

    expect(screen.queryByText(/scheduler/i)).toBeNull();
    expect(screen.queryByText(/debug/i)).toBeNull();
    expect(screen.queryByText(/score/i)).toBeNull();
    expect(screen.queryByText(/productivity/i)).toBeNull();
  });

  it('keeps the bottom navigation available in the app shell', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Plan' }));

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy();
  });
});
