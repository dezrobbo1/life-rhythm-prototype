import type { ReactNode } from 'react';

type ModalProps = {
  children: ReactNode;
  open: boolean;
  title: string;
};

export function Modal({ children, open, title }: ModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="modal" role="dialog">
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

