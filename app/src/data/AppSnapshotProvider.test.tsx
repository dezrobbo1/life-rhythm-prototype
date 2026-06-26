// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  AppSnapshotProvider,
  useAppSnapshot,
} from './AppSnapshotProvider';

function SnapshotProbe() {
  const { error, loading, snapshot, source } = useAppSnapshot();

  return (
    <output aria-label="snapshot probe">
      {source}|{loading ? 'loading' : 'ready'}|{error ? 'error' : 'ok'}|
      {snapshot.activeTasks?.[0]?.title ?? 'no task'}
    </output>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AppSnapshotProvider', () => {
  it('returns a fixture snapshot by default', () => {
    render(
      <AppSnapshotProvider>
        <SnapshotProbe />
      </AppSnapshotProvider>,
    );

    expect(screen.getByLabelText('snapshot probe').textContent).toContain('fixture|ready|ok');
    expect(screen.getByLabelText('snapshot probe').textContent).toContain("Set tomorrow's first step");
  });

  it('exposes the read-only adapter source label when adapter input is supplied', () => {
    render(
      <AppSnapshotProvider
        adapterInput={{
          currentData: {
            activeTasks: [
              {
                id: 'probe-task',
                source: 'adhoc',
                showToday: true,
                title: 'Probe task',
              },
            ],
          },
        }}
      >
        <SnapshotProbe />
      </AppSnapshotProvider>,
    );

    expect(screen.getByLabelText('snapshot probe').textContent).toContain('read-only adapter|ready|ok');
    expect(screen.getByLabelText('snapshot probe').textContent).toContain('Probe task');
  });

  it('can expose an explicit fallback source label', () => {
    render(
      <AppSnapshotProvider source="fallback">
        <SnapshotProbe />
      </AppSnapshotProvider>,
    );

    expect(screen.getByLabelText('snapshot probe').textContent).toContain('fallback|ready|ok');
  });

  it('does not call localStorage while creating the default snapshot', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(
      <AppSnapshotProvider>
        <SnapshotProbe />
      </AppSnapshotProvider>,
    );

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('does not perform IndexedDB or Dexie write/open calls', () => {
    const openSpy = vi.fn();
    const deleteDatabaseSpy = vi.fn();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: deleteDatabaseSpy,
        open: openSpy,
      },
    });

    render(
      <AppSnapshotProvider>
        <SnapshotProbe />
      </AppSnapshotProvider>,
    );

    expect(openSpy).not.toHaveBeenCalled();
    expect(deleteDatabaseSpy).not.toHaveBeenCalled();
  });

  it('keeps primary and secondary surfaces rendering through the provider path', async () => {
    const user = userEvent.setup();
    render(<App />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const secondaryNav = screen.getByRole('navigation', { name: 'Secondary' });

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Plan' }));
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Pool' }));
    expect(screen.getByRole('heading', { name: 'Pool' })).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy();

    expect(within(nav).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Settings' })).toBeNull();

    await user.click(within(secondaryNav).getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('heading', { name: 'Reset' })).toBeTruthy();

    await user.click(within(secondaryNav).getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
  });
});
