// @vitest-environment jsdom

import { useRef, useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Modal } from './Modal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function ModalHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">Open dialog</button>
      <Modal onClose={() => setOpen(false)} open={open} title="Test dialog">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Modal>
    </>
  );
}

function ReplacedOpenerHarness() {
  const [open, setOpen] = useState(false);
  const [showOpener, setShowOpener] = useState(true);
  const destination = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button ref={destination}>Plan details</button>
      {showOpener ? <button onClick={() => setOpen(true)} type="button">Move placement</button> : null}
      <Modal
        onClose={() => {
          setShowOpener(false);
          setOpen(false);
        }}
        open={open}
        returnFocusTo={() => destination.current}
        title="Move this planned time"
      >
        <button type="button">Save move</button>
        <button onClick={() => setOpen(false)} type="button">Cancel</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('moves focus inside, traps it, locks scroll, and restores the opener', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(opener);

    const closeButton = screen.getByRole('button', { name: 'Close Test dialog' });
    const lastAction = screen.getByRole('button', { name: 'Last action' });

    expect(document.activeElement).toBe(closeButton);
    expect(document.body.style.overflow).toBe('hidden');

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(lastAction);

    await user.click(closeButton);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes with Escape and returns focus', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(opener);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('returns focus to an explicit stable destination when a cross-day opener unmounts', async () => {
    const user = userEvent.setup();
    render(<ReplacedOpenerHarness />);

    await user.click(screen.getByRole('button', { name: 'Move placement' }));
    await user.click(screen.getByRole('button', { name: 'Close Move this planned time' }));

    expect(screen.queryByRole('button', { name: 'Move placement' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Plan details' }));
  });
});
