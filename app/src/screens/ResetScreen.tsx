import { useEffect, useMemo, useState } from 'react';
import { Button, Card, ScreenHero } from '../components';
import {
  loadActiveTodayTasks,
  updateActiveTaskStatus,
  type ActiveTaskStatusUpdateResult,
} from '../data/activeTaskRepository';
import type { ActiveTask, ActiveTaskStatus } from '../data/schemas';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import { ResetActionCard } from '../features/reset/ResetActionCard';
import {
  fullResetAction,
  mainResetActions,
  secondaryResetActions,
  type ResetAction,
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

function resetActionFromViewModel(action: ResetActionViewModel): ResetAction {
  const source = [...mainResetActions, ...secondaryResetActions, fullResetAction].find((item) => item.id === action.id);

  return {
    affectedMockItemCount: source?.affectedMockItemCount ?? 0,
    boundaryNote: source?.boundaryNote ?? 'Preview only. No real data changes.',
    confirmationCopy: action.confirmationCopy,
    destructive: action.destructive,
    id: action.id as ResetAction['id'],
    purpose: action.purpose,
    recommendedWhen: source?.recommendedWhen ?? 'Use when this support helps now.',
    title: action.title,
  };
}

type ResetScreenProps = {
  loadTodayTasks?: () => Promise<ActiveTask[]>;
  updateTaskStatus?: (
    taskId: string,
    status: ActiveTaskStatus,
  ) => Promise<ActiveTaskStatusUpdateResult>;
};

type RestartPreview = {
  area: string;
  firstAction: string;
  title: string;
};

function restartPreviewFromTask(task: ActiveTask): RestartPreview {
  return {
    area: task.area,
    firstAction: task.minimum.label,
    title: task.title,
  };
}

export function ResetScreen({
  loadTodayTasks = loadActiveTodayTasks,
  updateTaskStatus = updateActiveTaskStatus,
}: ResetScreenProps = {}) {
  const { snapshot } = useAppSnapshot();
  const resetViewModel = useMemo(
    () =>
      buildResetViewModel({
        ...snapshot,
        ...resetScreenSnapshot,
      }),
    [snapshot],
  );
  const [confirmation, setConfirmation] = useState('');
  const [visibleTodayTasks, setVisibleTodayTasks] = useState<ActiveTask[]>([]);
  const [selectedRestart, setSelectedRestart] = useState<RestartPreview | null>(null);
  const [fullResetInput, setFullResetInput] = useState('');
  const [fullResetConfirmed, setFullResetConfirmed] = useState(false);

  async function refreshVisibleTodayTasks() {
    const tasks = await loadTodayTasks();

    setVisibleTodayTasks(tasks);

    return tasks;
  }

  useEffect(() => {
    let active = true;

    loadTodayTasks().then((tasks) => {
      if (active) {
        setVisibleTodayTasks(tasks);
      }
    });

    return () => {
      active = false;
    };
  }, [loadTodayTasks]);

  async function updateExtras(
    status: Extract<ActiveTaskStatus, 'notToday' | 'parked'>,
    successCopy: string,
  ) {
    const currentTasks = visibleTodayTasks.length > 0 ? visibleTodayTasks : await refreshVisibleTodayTasks();
    const [firstTask, ...extraTasks] = currentTasks;

    setSelectedRestart(null);

    if (!firstTask) {
      setVisibleTodayTasks([]);
      setConfirmation('No Today task is waiting. Add one small action when ready.');
      return;
    }

    if (extraTasks.length === 0) {
      setVisibleTodayTasks([firstTask]);
      setConfirmation('Today already has one next action. Nothing else changed. No catch-up pile.');
      return;
    }

    const results = await Promise.all(extraTasks.map((task) => updateTaskStatus(task.id, status)));

    if (results.some((result) => !result.ok)) {
      const refreshedTasks = await refreshVisibleTodayTasks();

      setConfirmation(
        refreshedTasks.length > 1
          ? 'Reset action could not update every extra task. Nothing was deleted.'
          : 'Today has one next action. Nothing was deleted.',
      );
      return;
    }

    setVisibleTodayTasks([firstTask]);
    setConfirmation(successCopy);
  }

  async function runResetAction(action: ResetAction) {
    setFullResetConfirmed(false);

    if (action.id === 'tooMuchToday') {
      await updateExtras('notToday', action.confirmationCopy);
      return;
    }

    if (action.id === 'moveExtras') {
      await updateExtras('parked', action.confirmationCopy);
      return;
    }

    if (action.id === 'restartOneAction') {
      const currentTasks = visibleTodayTasks.length > 0 ? visibleTodayTasks : await refreshVisibleTodayTasks();
      const [firstTask] = currentTasks;

      setSelectedRestart(firstTask ? restartPreviewFromTask(firstTask) : null);
      setConfirmation(firstTask ? action.confirmationCopy : 'No Today task is waiting. Add one small action when ready.');
      return;
    }

    if (action.id === 'restoreHidden') {
      setSelectedRestart(null);
      setConfirmation(action.confirmationCopy);
      return;
    }

    setConfirmation(action.confirmationCopy);
  }

  function confirmFullReset() {
    setFullResetConfirmed(true);
    setConfirmation(fullResetAction.confirmationCopy);
  }

  return (
    <div className="screen-stack reset-screen">
      <ScreenHero
        className="reset-hero"
        eyebrow="Re-entry surface"
        tagline={resetViewModel.headline}
        title="Reset"
        titleId="reset-title"
      />

      {confirmation ? <p className="reset-confirmation" role="status">{confirmation}</p> : null}

      <section className="reset-section" aria-labelledby="main-reset-title">
        <div className="section-heading">
          <h2 id="main-reset-title">Daily reset actions</h2>
          <p>Safe Today reset actions. Tasks are not deleted.</p>
        </div>
        <p className="setup-note">
          {visibleTodayTasks.length === 1
            ? '1 visible Today task is available for reset.'
            : `${visibleTodayTasks.length} visible Today tasks are available for reset.`}
        </p>
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
          <p>Soft review and preview-only restore actions.</p>
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
          <span>Type RESET to confirm this disabled trial action</span>
          <input
            aria-label="Type RESET to confirm full reset"
            onChange={(event) => setFullResetInput(event.target.value)}
            value={fullResetInput}
          />
        </label>
        <Button disabled={fullResetInput !== 'RESET'} onClick={confirmFullReset}>
          Confirm disabled full reset
        </Button>
        {fullResetConfirmed ? <p role="status">Full app reset is not enabled for this trial. No data is cleared.</p> : null}
      </section>
    </div>
  );
}
