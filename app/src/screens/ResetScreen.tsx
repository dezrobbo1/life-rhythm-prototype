import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, ScreenHero } from '../components';
import {
  loadActiveTodayTasks,
  updateActiveTaskStatus,
  type ActiveTaskStatusUpdateResult,
} from '../data/activeTaskRepository';
import {
  BEHAVIOUR_HISTORY_DELETE_CONFIRMATION,
  deleteBehaviourHistory,
  exportBehaviourHistory,
  type BehaviourHistoryExport,
  type DeleteBehaviourHistoryResult,
} from '../data/behaviourHistoryControl';
import type { ActiveTask, ActiveTaskStatus } from '../data/schemas';
import { getCurrentLifeRhythmDatabase } from '../data/localDataNamespace';
import { captureProfileRecoveryGeneration, readProfileView,
  StaleProfileRecoveryError, STALE_PROFILE_RECOVERY_MESSAGE } from '../data/profileRecoveryGeneration';
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
    expectedRecoveryGeneration?: number,
  ) => Promise<ActiveTaskStatusUpdateResult>;
  exportBehaviourHistoryAction?: () => Promise<BehaviourHistoryExport>;
  deleteBehaviourHistoryAction?: (confirmation: string, expectedRecoveryGeneration?: number) => Promise<DeleteBehaviourHistoryResult>;
  onBehaviourHistoryDeleted?: () => Promise<boolean>;
};

type RestartPreview = {
  area: string;
  firstAction: string;
  title: string;
  minutes: number;
};

function restartPreviewFromTask(task: ActiveTask): RestartPreview {
  return {
    area: task.area,
    firstAction: task.minimum.label,
    minutes: task.minimum.minutes,
    title: task.title,
  };
}

export function ResetScreen({
  loadTodayTasks = loadActiveTodayTasks,
  updateTaskStatus = (id, status, generation) => updateActiveTaskStatus(id, status,
    getCurrentLifeRhythmDatabase(), generation),
  exportBehaviourHistoryAction = exportBehaviourHistory,
  deleteBehaviourHistoryAction = (confirmation, generation) => deleteBehaviourHistory(
    confirmation, getCurrentLifeRhythmDatabase(), generation),
  onBehaviourHistoryDeleted,
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
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [visibleTodayTasks, setVisibleTodayTasks] = useState<ActiveTask[]>([]);
  const [visibleTaskGeneration, setVisibleTaskGeneration] = useState<number | null>(null);
  const [selectedRestart, setSelectedRestart] = useState<RestartPreview | null>(null);
  const [behaviourDeleteInput, setBehaviourDeleteInput] = useState('');
  // This destructive control has its own rendered-profile authority. Refreshing
  // Today tasks cannot silently authorize a confirmation typed before restore.
  const [behaviourHistoryViewGeneration, setBehaviourHistoryViewGeneration] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    captureProfileRecoveryGeneration(getCurrentLifeRhythmDatabase()).then((generation) => {
      if (active) setBehaviourHistoryViewGeneration(generation);
    }).catch(() => {
      if (active) setConfirmation('Behaviour history could not be read safely. Try again.');
    });
    return () => { active = false; };
  }, []);

  async function refreshVisibleTodayTasks() {
    const { generation, value: tasks } = await readProfileView(getCurrentLifeRhythmDatabase(), loadTodayTasks);
    setVisibleTodayTasks(tasks);
    setVisibleTaskGeneration(generation);
    return { tasks, generation };
  }

  useEffect(() => {
    let active = true;

    readProfileView(getCurrentLifeRhythmDatabase(), loadTodayTasks).then(({ value: tasks, generation }) => {
      if (active) {
        setVisibleTodayTasks(tasks);
        setVisibleTaskGeneration(generation);
      }
    }).catch(() => { if (active) { setVisibleTaskGeneration(null); setConfirmation('Today tasks could not be read. Try again.'); } });

    return () => {
      active = false;
    };
  }, [loadTodayTasks]);

  async function updateExtras(
    status: Extract<ActiveTaskStatus, 'notToday' | 'parked'>,
    successCopy: string,
  ) {
    let currentTasks = visibleTodayTasks;
    let generation = visibleTaskGeneration;
    if (generation === null) {
      ({ tasks: currentTasks, generation } = await refreshVisibleTodayTasks());
    }
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

    let results: ActiveTaskStatusUpdateResult[];
    try {
      results = await Promise.all(extraTasks.map((task) => updateTaskStatus(task.id, status, generation ?? undefined)));
    } catch (error) {
      if (error instanceof StaleProfileRecoveryError) {
        setVisibleTaskGeneration(null);
        setConfirmation(STALE_PROFILE_RECOVERY_MESSAGE);
        await refreshVisibleTodayTasks();
        return;
      }
      throw error;
    }

    if (results.some((result) => !result.ok)) {
      const { tasks: refreshedTasks } = await refreshVisibleTodayTasks();

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
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    try {
      await performResetAction(action);
    } catch {
      setConfirmation('Relief could not finish. Check Today before trying again. Nothing was deleted.');
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  async function performResetAction(action: ResetAction) {

    if (action.id === 'tooMuchToday') {
      await updateExtras('notToday', action.confirmationCopy);
      return;
    }

    if (action.id === 'moveExtras') {
      await updateExtras('parked', action.confirmationCopy);
      return;
    }

    if (action.id === 'restartOneAction') {
      const currentTasks = visibleTaskGeneration !== null ? visibleTodayTasks : (await refreshVisibleTodayTasks()).tasks;
      const [firstTask] = currentTasks;

      setSelectedRestart(firstTask ? restartPreviewFromTask(firstTask) : null);
      setConfirmation(firstTask ? 'Restart preview only. No task was started or completed.' : 'No Today task is waiting. Add one small action when ready.');
      return;
    }

    if (action.id === 'restoreHidden') {
      setSelectedRestart(null);
      setConfirmation(action.confirmationCopy);
      return;
    }

    setConfirmation(action.confirmationCopy);
  }

  async function exportLocalBehaviourHistory() {
    try {
      const exported = await exportBehaviourHistoryAction();
      const url = URL.createObjectURL(new Blob([exported.json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.download = exported.fileName;
      anchor.href = url;
      anchor.click();
      URL.revokeObjectURL(url);
      setConfirmation(
        exported.eventCount === 1
          ? 'Exported 1 behaviour event as local JSON.'
          : `Exported ${exported.eventCount} behaviour events as local JSON.`,
      );
    } catch {
      setConfirmation('Behaviour history could not be exported. Nothing was changed.');
    }
  }

  async function deleteLocalBehaviourHistory() {
    if (behaviourHistoryViewGeneration === null) return;
    const result = await deleteBehaviourHistoryAction(behaviourDeleteInput, behaviourHistoryViewGeneration);
    if (!result.ok) {
      setConfirmation(result.errors.join(' '));
      if (result.errors.includes(STALE_PROFILE_RECOVERY_MESSAGE)) {
        setBehaviourDeleteInput('');
        setBehaviourHistoryViewGeneration(null);
        try {
          setBehaviourHistoryViewGeneration(await captureProfileRecoveryGeneration(getCurrentLifeRhythmDatabase()));
        } catch {
          setConfirmation('Behaviour history could not be read safely. Try again.');
        }
      }
      return;
    }

    setBehaviourDeleteInput('');
    const planReconciled = result.deletedCount === 0 || !onBehaviourHistoryDeleted
      ? true
      : await onBehaviourHistoryDeleted();
    const countCopy = result.deletedCount === 1
      ? 'Deleted 1 behaviour event.'
      : `Deleted ${result.deletedCount} behaviour events.`;
    setConfirmation(
      planReconciled
        ? `${countCopy} Derived duration evidence was removed and any existing flexible plan is up to date. Tasks, settings, and calendars were not changed.`
        : `${countCopy} Derived duration evidence was removed, but the flexible plan still needs updating. Tasks, settings, and calendars were not changed.`,
    );
  }

  return (
    <div className="screen-stack reset-screen">
      <ScreenHero
        className="reset-hero"
        eyebrow="Today support"
        tagline={resetViewModel.headline}
        title="Relief"
        titleId="reset-title"
      />

      {confirmation ? <p className="reset-confirmation" role="status">{confirmation}</p> : null}

      <section className="reset-section" aria-labelledby="main-reset-title">
        <div className="section-heading">
          <h2 id="main-reset-title">Daily reset actions</h2>
          <p>Safe Today reset actions. Tasks are not deleted.</p>
          <p>These choices change Today task visibility. Reduce today on Today previews the scheduler’s Reduced Day policy.</p>
        </div>
        <p className="setup-note">
          {visibleTodayTasks.length === 1
            ? '1 visible Today task is available for reset.'
            : `${visibleTodayTasks.length} visible Today tasks are available for reset.`}
        </p>
        <div className="reset-card-grid">
          {resetViewModel.mainActions.map((action) => (
            <ResetActionCard action={resetActionFromViewModel(action)} key={action.id} busy={busy}
              onRunAction={runResetAction}
              variant={(visibleTodayTasks.length > 1 ? action.id === 'tooMuchToday' : action.id === 'restartOneAction') ? 'primary' : 'secondary'}
              consequence={action.id === 'restartOneAction'
                ? 'Preview the first task’s authored Minimum. This does not start or complete it.'
                : visibleTaskGeneration === null ? 'Read Today before making a choice. Nothing is deleted.'
                : visibleTodayTasks.length > 1
                  ? `Keeps ${visibleTodayTasks[0].title}. ${visibleTodayTasks.length - 1} extra task(s) will be ${action.id === 'tooMuchToday' ? 'marked not today' : 'parked'}. Nothing is deleted.`
                  : visibleTodayTasks.length === 1 ? 'Today already has one action. Nothing else will change.'
                  : 'No Today tasks are waiting. Nothing will change.'} />
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
            <span>{selectedRestart.minutes} min · Preview only</span>
          </div>
        </Card>
      ) : null}

      <details className="relief-history-disclosure" open={historyOpen}
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
        <summary>Behaviour history controls</summary>
        <div hidden={!historyOpen}>
      <section className="reset-behaviour-history" aria-labelledby="behaviour-history-title">
        <div>
          <p className="eyebrow">Local data control</p>
          <h2 id="behaviour-history-title">Behaviour history</h2>
          <p>Export the observed-event ledger as JSON, or delete only that ledger from this device.</p>
          <p>Tasks, settings, calendar data, and legacy task history are not changed. Removing evidence can update flexible plan durations.</p>
        </div>
        <Button onClick={exportLocalBehaviourHistory}>Export behaviour history</Button>
        <label>
          <span>Type {BEHAVIOUR_HISTORY_DELETE_CONFIRMATION} to delete this ledger</span>
          <input
            aria-label={`Type ${BEHAVIOUR_HISTORY_DELETE_CONFIRMATION} to delete behaviour history`}
            disabled={behaviourHistoryViewGeneration === null}
            onChange={(event) => setBehaviourDeleteInput(event.target.value)}
            value={behaviourDeleteInput}
          />
        </label>
        <Button
          disabled={behaviourHistoryViewGeneration === null || behaviourDeleteInput !== BEHAVIOUR_HISTORY_DELETE_CONFIRMATION}
          onClick={deleteLocalBehaviourHistory}
        >
          Delete behaviour history
        </Button>
      </section>

        </div>
      </details>
    </div>
  );
}
