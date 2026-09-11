import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'primary' | 'quiet';

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  title?: string;
  variant?: CardVariant;
};

export function Card({
  children,
  className = '',
  title,
  variant = 'default',
  ...props
}: CardProps) {
  return (
    <section className={`card card--${variant} ${className}`.trim()} {...props}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
