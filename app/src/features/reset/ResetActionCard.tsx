import { Button } from '../../components';
import type { ResetAction } from './mockResetData';

type ResetActionCardProps = {
  action: ResetAction;
  onRunAction: (action: ResetAction) => void;
};

export function ResetActionCard({ action, onRunAction }: ResetActionCardProps) {
  return (
    <article className={`reset-card ${action.destructive ? 'reset-card--destructive' : ''}`} aria-labelledby={`${action.id}-title`}>
      <div className="reset-card__header">
        <div>
          <h3 id={`${action.id}-title`}>{action.title}</h3>
          <p>{action.purpose}</p>
        </div>
        <span>{action.affectedMockItemCount === 1 ? '1 mock item' : `${action.affectedMockItemCount} mock items`}</span>
      </div>
      <p className="reset-card__when">{action.recommendedWhen}</p>
      <p className="reset-card__boundary">{action.boundaryNote}</p>
      <Button onClick={() => onRunAction(action)} variant={action.destructive ? 'secondary' : 'primary'}>
        {action.destructive ? 'Start protected reset' : action.title}
      </Button>
    </article>
  );
}
