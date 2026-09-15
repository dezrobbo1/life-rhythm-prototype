import type { ReactNode } from 'react';

type EmptyStateProps = {
  action?: ReactNode;
  headingLevel?: 2 | 3;
  message: string;
  title: string;
};

export function EmptyState({ action, headingLevel = 2, message, title }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <div className="empty-state">
      <Heading>{title}</Heading>
      <p>{message}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
