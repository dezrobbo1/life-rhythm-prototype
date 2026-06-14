import type { ReactNode } from 'react';

type EmptyStateProps = {
  action?: ReactNode;
  message: string;
  title: string;
};

export function EmptyState({ action, message, title }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

