// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { LibraryScreen } from '../../screens/LibraryScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Library screen', () => {
  it('renders library categories', () => {
    render(<LibraryScreen />);

    const categories = screen.getByRole('list', { name: 'Library categories' });
    expect(within(categories).getByRole('button', { name: 'All' })).toBeTruthy();
    expect(within(categories).getByRole('button', { name: 'Food' })).toBeTruthy();
    expect(within(categories).getByRole('button', { name: 'Money' })).toBeTruthy();
    expect(within(categories).getByRole('button', { name: 'Start Boost' })).toBeTruthy();
  });

  it('renders rhythm catalogue cards', () => {
    render(<LibraryScreen />);

    expect(screen.getByRole('button', { name: 'Create rhythm' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create pack later' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Create rhythm makes a reusable template. Add to Today now is only for a one-off today action.')).toBeTruthy();
    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    expect(within(card).getByText('Food')).toBeTruthy();
    expect(within(card).getByText('Make the first food step visible and small.')).toBeTruthy();
    expect(within(card).getAllByText(/Morning|Easy start/)).toHaveLength(2);
    expect(screen.getByRole('article', { name: 'Open the first file' })).toBeTruthy();
  });

  it('filters rhythms by category', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.click(screen.getByRole('button', { name: 'Money' }));

    expect(screen.getByRole('article', { name: 'Receipt drop' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Breakfast reset' })).toBeNull();
  });

  it('changes enabled state in mock UI only', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    expect(within(card).getByText('Disabled')).toBeTruthy();

    await user.click(within(card).getByRole('button', { name: 'Enable rhythm' }));

    expect(within(card).getByText('Enabled')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Disable rhythm' })).toBeTruthy();
  });

  it('shows Add to Today mock confirmation without writing data', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<LibraryScreen />);

    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    await user.click(within(card).getByRole('button', { name: 'Add to Today now' }));

    expect(screen.getByRole('status').textContent).toContain('Nothing was saved or created.');
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('opens Create rhythm as a reusable preview modal', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.click(screen.getByRole('button', { name: 'Create rhythm' }));

    expect(screen.getByRole('dialog', { name: 'Create rhythm' })).toBeTruthy();
    expect(screen.getByText('Reusable rhythm. Preview only; not saved yet.')).toBeTruthy();
    expect(screen.getByLabelText('Rhythm title')).toBeTruthy();
    expect(screen.getByLabelText('Category')).toBeTruthy();
    expect(screen.getByLabelText('Purpose')).toBeTruthy();
    expect(screen.getByLabelText('Minimum version')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Enabled/ })).toBeTruthy();
  });

  it('saves a created rhythm into the in-memory Library only', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<LibraryScreen />);

    await user.click(screen.getByRole('button', { name: 'Create rhythm' }));
    await user.type(screen.getByLabelText('Rhythm title'), 'Paperwork landing');
    await user.selectOptions(screen.getByLabelText('Category'), 'Money');
    await user.type(screen.getByLabelText('Purpose'), 'Give loose paperwork one safe place.');
    await user.type(screen.getByLabelText('Minimum version'), 'Put one paper in the folder.');
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));

    expect(screen.queryByRole('dialog', { name: 'Create rhythm' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Rhythm created in preview only.');
    expect(screen.getByRole('article', { name: 'Paperwork landing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Money' }).getAttribute('aria-pressed')).toBe('true');
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('does not add a created rhythm to Today', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Library' }));
    await user.click(screen.getByRole('button', { name: 'Create rhythm' }));
    await user.type(screen.getByLabelText('Rhythm title'), 'Paperwork landing');
    await user.selectOptions(screen.getByLabelText('Category'), 'Money');
    await user.type(screen.getByLabelText('Purpose'), 'Give loose paperwork one safe place.');
    await user.type(screen.getByLabelText('Minimum version'), 'Put one paper in the folder.');
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));

    expect(screen.getByRole('article', { name: 'Paperwork landing' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.queryByRole('article', { name: 'Paperwork landing' })).toBeNull();
  });

  it('opens rhythm details disclosure', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    const card = screen.getByRole('article', { name: 'Receipt drop' });
    await user.click(within(card).getByRole('button', { name: 'Details' }));

    expect(within(card).getByRole('heading', { name: 'Why this rhythm exists' })).toBeTruthy();
    expect(within(card).getByText('Money rhythms are organisation support, not financial advice.')).toBeTruthy();
  });

  it('renders quick pack preview', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    const pack = screen.getByRole('article', { name: 'Morning basics' });
    await user.click(within(pack).getByRole('button', { name: 'Preview pack' }));

    expect(within(pack).getByText('Packs enable rhythms. Today only shows what fits.')).toBeTruthy();
    expect(within(pack).getByText('Breakfast reset')).toBeTruthy();
    expect(within(pack).getByText('Kitchen landing')).toBeTruthy();
  });

  it('shows empty state and clears filters', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.type(screen.getByRole('searchbox'), 'zzzz no match');

    expect(screen.getByText('No rhythms match this filter')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('article', { name: 'Breakfast reset' })).toBeTruthy();
  });

  it('keeps Setup available while Reset is available', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('heading', { name: 'Reset' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Setup' }));
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy();
  });

  it('keeps bottom navigation available', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Library' }));

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy();
  });
});
