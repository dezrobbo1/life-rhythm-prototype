import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { AppIcon } from '../AppIcon/AppIcon';

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function Modal({ children, onClose, open, title }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <section aria-labelledby={titleId} aria-modal="true" className="modal" role="dialog">
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
