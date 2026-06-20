import type { ReactNode } from 'react';
import './Surfaces.css';

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  label?: string;
};

function cx(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function QuietSection({ children, className, id, label }: SurfaceProps) {
  return (
    <section className={cx('surface-quiet-section', className)} id={id} aria-label={label}>
      {children}
    </section>
  );
}

export function PrimaryObjectSurface({ children, className, id, label }: SurfaceProps) {
  return (
    <section className={cx('surface-primary-object', className)} id={id} aria-label={label}>
      {children}
    </section>
  );
}

export function HoldingTray({ children, className, id, label }: SurfaceProps) {
  return (
    <section className={cx('surface-holding-tray', className)} id={id} aria-label={label}>
      {children}
    </section>
  );
}

export function LedgerRow({ children, className, id, label }: SurfaceProps) {
  return (
    <div className={cx('surface-ledger-row', className)} id={id} aria-label={label}>
      {children}
    </div>
  );
}

type DayBandProps = SurfaceProps & {
  variant?: 'open' | 'protected' | 'askFirst' | 'recovery' | 'neutral';
};

export function DayBand({ children, className, id, label, variant = 'neutral' }: DayBandProps) {
  return (
    <section className={cx('surface-day-band', `surface-day-band--${variant}`, className)} id={id} aria-label={label}>
      {children}
    </section>
  );
}

export function ReliefSheetSurface({ children, className, id, label }: SurfaceProps) {
  return (
    <section className={cx('surface-relief-sheet', className)} id={id} aria-label={label}>
      {children}
    </section>
  );
}
