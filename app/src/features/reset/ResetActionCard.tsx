import { AppIcon, Button } from '../../components';
import type { AppIconName } from '../../components/AppIcon/AppIcon';
import type { ResetAction } from './mockResetData';

type ResetActionCardProps = {
  action: ResetAction;
  onRunAction: (action: ResetAction) => void | Promise<void>;
};

const resetActionIcons: Record<ResetAction['id'], AppIconName> = {
  moveExtras: 'backup',
  fullAppReset: 'delete',
  restartOneAction: 'restart',
  restoreHidden: 'complete',
  reviewTomorrow: 'today',
  tooMuchToday: 'windDown',
};

export function ResetActionCard({ action, onRunAction }: ResetActionCardProps) {
  return (
    <article className={`reset-card ${action.destructive ? 'reset-card--destructive' : ''}`} aria-labelledby={`${action.id}-title`}>
      <div className="reset-card__header">
        <div className="reset-card__title-row">
          <span className="reset-card__icon" aria-hidden="true">
            <AppIcon name={resetActionIcons[action.id]} size={20} />
          </span>
          <div>
            <h3 id={`${action.id}-title`}>{action.title}</h3>
            <p>{action.purpose}</p>
          </div>
        </div>
        <span>{action.destructive ? 'Not enabled' : 'Today support'}</span>
      </div>
      <p className="reset-card__when">{action.recommendedWhen}</p>
      <p className="reset-card__boundary">{action.boundaryNote}</p>
      <Button onClick={() => onRunAction(action)} variant={action.destructive ? 'secondary' : 'primary'}>
        {action.destructive ? 'Start protected reset' : action.title}
      </Button>
    </article>
  );
}
