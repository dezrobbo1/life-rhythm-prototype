import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { AppIcon } from '../AppIcon/AppIcon';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function Modal({ children, onClose, open, title }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const currentDialog = dialogRef.current;
    if (!currentDialog) return undefined;
    const dialogElement: HTMLElement = currentDialog;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = Array.from(dialogElement.querySelectorAll<HTMLElement>(focusableSelector));
    (focusable[0] ?? dialogElement).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const currentFocusable = Array.from(
        dialogElement.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

      if (currentFocusable.length === 0) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialogElement.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button aria-label={`Close ${title}`} className="modal__close" onClick={onClose} type="button">
            <AppIcon name="x" size={18} />
            <span>Close</span>
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
