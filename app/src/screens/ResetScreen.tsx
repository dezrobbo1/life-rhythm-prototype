import { useState } from 'react';
import { Button, Card } from '../components';
import { ResetActionCard } from '../features/reset/ResetActionCard';
import {
  fullResetAction,
  mainResetActions,
  restartChoices,
  secondaryResetActions,
  type ResetAction,
  type RestartChoice,
} from '../features/reset/mockResetData';
import {
  buildResetViewModel,
  type AppDataSnapshot,
  type ResetActionViewModel,
  type SnapshotResetAction,
} from '../viewModels';

function toSnapshotResetAction(action: ResetAction, group: SnapshotResetAction['group']): SnapshotResetAction {
  return {
    confirmationCopy: action.confirmationCopy,
    destructive: action.destructive,
    group,
    id: action.id,
    purpose: action.purpose,
    title: action.title,
  };
}

const resetScreenSnapshot: AppDataSnapshot = {
  resetActions: [
    ...mainResetActions.map((action) => toSnapshotResetAction(action, 'main')),
    ...secondaryResetActions.map((action) => toSnapshotResetAction(action, 'secondary')),
    toSnapshotResetAction(fullResetAction, 'destructive'),
  ],
};

const resetViewModel = buildResetViewModel(resetScreenSnapshot);

function resetActionFromViewModel(action: ResetActionViewModel): ResetAction {
  const source = [...mainResetActions, ...secondaryResetActions, fullResetAction].find((item) => item.id === action.id);

  return {
    affectedMockItemCount: source?.affectedMockItemCount ?? 0,
    boundaryNote: source?.boundaryNote ?? 'Mock only. No real data changes.',
    confirmationCopy: action.confirmationCopy,
    destructive: action.destructive,
    id: action.id as ResetAction['id'],
    purpose: action.purpose,
    recommendedWhen: source?.recommendedWhen ?? 'Use when this support helps now.',
    title: action.title,
  };
}

export function ResetScreen() {
  const [confirmation, setConfirmation] = useState('');
  const [selectedRestart, setSelectedRestart] = useState<RestartChoice | null>(null);
  const [fullResetInput, setFullResetInput] = useState('');
  const [fullResetConfirmed, setFullResetConfirmed] = useState(false);

  function runResetAction(action: ResetAction) {
    setFullResetConfirmed(false);

    if (action.id === 'restartOneAction') {
      setSelectedRestart(restartChoices[0]);
    }

    if (action.id === 'restoreHidden') {
      setSelectedRestart(null);
    }

    setConfirmation(action.confirmationCopy);
  }

  function confirmFullReset() {
    setFullResetConfirmed(true);
    setConfirmation(fullResetAction.confirmationCopy);
  }

  return (
    <div className="screen-stack reset-screen">
      <section className="reset-hero" aria-labelledby="reset-title">
        <p className="eyebrow">Re-entry surface</p>
        <h1 id="reset-title">Reset</h1>
        <p>{resetViewModel.headline}</p>
      </section>

      {confirmation ? <p className="reset-confirmation" role="status">{confirmation}</p> : null}

      <section className="reset-section" aria-labelledby="main-reset-title">
        <div className="section-heading">
          <h2 id="main-reset-title">Daily reset actions</h2>
          <p>Mock only. Nothing is saved or cleared.</p>
        </div>
        <div className="reset-card-grid">
          {resetViewModel.mainActions.map((action) => (
            <ResetActionCard action={resetActionFromViewModel(action)} key={action.id} onRunAction={runResetAction} />
          ))}
        </div>
      </section>

      {selectedRestart ? (
        <Card>
          <div className="restart-choice">
            <p className="eyebrow">Selected restart action</p>
            <h2>{selectedRestart.title}</h2>
            <p>{selectedRestart.area}</p>
            <strong>{selectedRestart.firstAction}</strong>
            <span>That counts.</span>
          </div>
        </Card>
      ) : null}

      <section className="reset-section" aria-labelledby="secondary-reset-title">
        <div className="section-heading">
          <h2 id="secondary-reset-title">Secondary options</h2>
          <p>Soft review and restore actions.</p>
        </div>
        <div className="reset-secondary-list">
          {resetViewModel.secondaryActions.map((action) => resetActionFromViewModel(action)).map((action) => (
            <article className="reset-secondary" key={action.id}>
              <div>
                <h3>{action.title}</h3>
                <p>{action.purpose}</p>
              </div>
              <Button onClick={() => runResetAction(action)}>{action.title}</Button>
            </article>
          ))}
        </div>
      </section>

      <section className="reset-danger-zone" aria-labelledby="full-reset-title">
        <div>
          <p className="eyebrow">Protected action</p>
          <h2 id="full-reset-title">{resetViewModel.destructiveAction.title}</h2>
          <p>{resetViewModel.destructiveAction.purpose}</p>
          <p>{resetActionFromViewModel(resetViewModel.destructiveAction).boundaryNote}</p>
        </div>
        <label>
          <span>Type RESET to confirm this mock action</span>
          <input
            aria-label="Type RESET to confirm full reset"
            onChange={(event) => setFullResetInput(event.target.value)}
            value={fullResetInput}
          />
        </label>
        <Button disabled={fullResetInput !== 'RESET'} onClick={confirmFullReset}>
          Confirm mock full reset
        </Button>
        {fullResetConfirmed ? <p role="status">Mock full reset complete. No real data was cleared.</p> : null}
      </section>
    </div>
  );
}
