import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  title?: string;
};

export function Card({ children, title }: CardProps) {
  return (
    <section className="card">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

