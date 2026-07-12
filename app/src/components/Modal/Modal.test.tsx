// @vitest-environment jsdom

import { useState } from 'react';
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
});
