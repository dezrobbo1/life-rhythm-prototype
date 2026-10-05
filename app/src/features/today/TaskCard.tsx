import { useEffect, useState } from 'react';
import { AppIcon, Button, Chip } from '../../components';
import type { AppIconName } from '../../components/AppIcon/AppIcon';
import type { MockTask } from './mockTodayData';

export type TaskProgress = 'idle' | 'inProgress' | 'paused' | 'minimumDone';

type TaskCardProps = {
  actionBusy?: boolean;
  onEditTask?: () => void;
  onKeepGoing: () => void;
  onMarkFullDone: () => void;
  onMarkMinimumDone: () => void;
  onMarkNormalDone: () => void;
  onNotToday: () => void;
  onParkTask: () => void;
  onPauseTask: () => void;
  onResumeTask: () => void;
  onStartTask: () => void;
  onStartBoost: () => void;
  onStopHere: () => void;
  minimumAchieved: boolean;
  minimumChoiceActive: boolean;
  progress: TaskProgress;
  task: MockTask;
};

const missedPolicyLabels: Record<NonNullable<NonNullable<MockTask['timeEdge']>['missedPolicy']>, string> = {
  archiveIfExpired: 'Archive if expired',
  ask: 'Ask me',
  followUpPrompt: 'Follow-up prompt',
  hideUntilReview: 'Hide until review',
  minimumOnly: 'Minimum only',
  notToday: 'Not today',
  park: 'Park',
};

function taskIconName(task: MockTask): AppIconName {
  const marker = `${task.areaIcon} ${task.area}`.toLowerCase();

  if (marker.includes('food') || marker.includes('meal')) return 'food';
  if (marker.includes('home') || marker.includes('house')) return 'home';
  if (marker.includes('work')) return 'work';
  if (marker.includes('move') || marker.includes('movement')) return 'movement';
  if (marker.includes('money')) return 'money';
  if (marker.includes('health') || marker.includes('sleep')) return 'health';
  if (marker.includes('emotion') || marker.includes('recovery')) return 'emotion';
  if (marker.includes('sensory')) return 'sensory';
  if (marker.includes('social')) return 'social';
  if (marker.includes('scroll') || marker.includes('phone')) return 'antiDrift';
  if (marker.includes('admin')) return 'admin';

  return 'task';
}

function formatTimeEdgeDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function timeEdgeLines(task: MockTask): string[] {
  const edge = task.timeEdge;

  if (!edge) {
    return [];
  }

  const lines: string[] = [];

  if (edge.timeConstraint === 'dueBy' && edge.dueAt) {
    lines.push(`Useful before ${formatTimeEdgeDate(edge.dueAt)}`);
  }

  if (edge.timeConstraint === 'fixedAt' && edge.fixedAt) {
    lines.push(`Tied to ${formatTimeEdgeDate(edge.fixedAt)}`);
  }

  if (edge.timeConstraint === 'expiresAfter' && edge.expiresAfter) {
    lines.push(`Useful until ${formatTimeEdgeDate(edge.expiresAfter)}`);
  }

  if (edge.latestUsefulStartAt) {
    lines.push(`Last useful start ${formatTimeEdgeDate(edge.latestUsefulStartAt)}`);
  }

  if (edge.notUsefulAfter) {
    lines.push(`Not useful after ${formatTimeEdgeDate(edge.notUsefulAfter)}`);
  }

  if (edge.minimumStillUsefulAfterDeadline) {
    lines.push('Minimum still helps');
  }

  if (edge.missedPolicy) {
    lines.push(`Re-entry choice: ${missedPolicyLabels[edge.missedPolicy]}`);
  }

  return lines.length > 0 ? [...lines, 'This helps guide private planning.'] : [];
}

export function TaskCard({
  actionBusy = false,
  onEditTask,
  onKeepGoing,
  onMarkFullDone,
  onMarkMinimumDone,
  onMarkNormalDone,
  onNotToday,
  onParkTask,
  onPauseTask,
  onResumeTask,
  onStartBoost,
  onStartTask,
  onStopHere,
  minimumAchieved,
  minimumChoiceActive,
  progress,
  task,
}: TaskCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [keepGoingOpen, setKeepGoingOpen] = useState(false);
  const visibleChips = task.chips.slice(0, 2);
  const visibleTimeEdgeLines = timeEdgeLines(task);
  const isInProgress = progress === 'inProgress';
  const isPaused = progress === 'paused';
  const isMinimumDone = progress === 'minimumDone';
  const minimumCounts = minimumAchieved || isMinimumDone;

  useEffect(() => {
    setKeepGoingOpen(false);
  }, [task.id]);

  function toggleKeepGoing() {
    if (isMinimumDone) {
      onKeepGoing();
    }

    setKeepGoingOpen((isOpen) => !isOpen);
  }

  return (
    <article className="task-card" aria-labelledby={`${task.id}-title`}>
      <div className="task-card__area">
        <span className="task-card__marker" aria-hidden="true">
          <AppIcon name={taskIconName(task)} size={18} />
        </span>
        <span>{task.area}</span>
      </div>
      <div className="task-card__header">
        <div>
          <h3 id={`${task.id}-title`}>{task.title}</h3>
          <p>{task.purpose}</p>
        </div>
        <span className="task-card__size">{task.recommendedSize}</span>
      </div>
      {visibleTimeEdgeLines.length > 0 ? (
        <div className="task-card__time-edge" aria-label="Time edge">
          {visibleTimeEdgeLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ) : null}
      {isInProgress ? (
        <p className="task-card__status" role="status">
          {minimumCounts ? 'Minimum already counts.' : 'In progress. Keep it small.'}
        </p>
      ) : null}
      {isPaused ? (
        <p className="task-card__status" role="status">
          {minimumCounts ? 'Paused. Minimum already counts.' : 'Paused. You can restart small.'}
        </p>
      ) : null}
      {isMinimumDone ? (
        <p className="task-card__status task-card__status--done" role="status">
          Minimum done. That counts.
        </p>
      ) : null}
      {minimumChoiceActive ? (
        <div className="task-card__status task-card__status--choice" role="status">
          <strong>Try the Minimum: {task.minimumVersion}</strong>
          <span>{task.recommendedSize}</span>
          <span>Choosing Minimum does not complete it.</span>
        </div>
      ) : null}
      {!minimumChoiceActive ? <p className="task-card__first-step">
        Minimum: {task.minimumVersion}{task.versionMinutes ? ` · ${task.versionMinutes.minimum} min` : ''}
      </p> : null}
      <div className="chip-row task-card__chips" aria-label="Task cues">
        {visibleChips.map((chip) => (
          <Chip key={chip}>{chip}</Chip>
        ))}
      </div>
      <div className="task-card__actions">
        <div className="task-card__primary-action">
          {progress === 'idle' ? <Button disabled={actionBusy} onClick={onStartTask} variant="primary">Start task</Button> : null}
          {isPaused ? <Button disabled={actionBusy} onClick={onResumeTask} variant="primary">Resume</Button> : null}
          {isInProgress && !minimumCounts ? <Button disabled={actionBusy} onClick={onMarkMinimumDone} variant="primary">Mark minimum done</Button> : null}
          {(isMinimumDone || (isInProgress && minimumCounts)) ? <Button disabled={actionBusy} onClick={onStopHere} variant="primary">Stop here</Button> : null}
        </div>
        <div className="task-card__secondary-actions">
          {isInProgress ? <Button disabled={actionBusy} onClick={onPauseTask}>Pause</Button> : null}
          {isPaused && !minimumCounts ? <Button disabled={actionBusy} onClick={onMarkMinimumDone}>Mark minimum done</Button> : null}
          {(isInProgress || isMinimumDone) ? <Button disabled={actionBusy} onClick={toggleKeepGoing} aria-expanded={keepGoingOpen}>Keep going</Button> : null}
          {isPaused && minimumCounts ? <Button disabled={actionBusy} onClick={onStopHere}>Stop here</Button> : null}
          <Button disabled={actionBusy} onClick={onParkTask} variant="quiet">Park</Button>
          <Button disabled={actionBusy} onClick={onNotToday} variant="quiet">Not today</Button>
          {!isMinimumDone ? <Button disabled={actionBusy} onClick={onStartBoost}>Start Boost</Button> : null}
          <Button aria-expanded={detailsOpen} aria-controls={`${task.id}-details`}
            onClick={() => setDetailsOpen((isOpen) => !isOpen)}>Details</Button>
        </div>
      </div>
      {keepGoingOpen ? (
        <section className="task-card__continuation" aria-labelledby={`${task.id}-continuation-title`}>
          <div>
            <h4 id={`${task.id}-continuation-title`}>Optional next versions</h4>
            <p>
              {minimumCounts
                ? 'Optional. Minimum already counts. Continue only if it helps.'
                : 'Optional. Keep the minimum small, then continue only if it helps.'}
            </p>
          </div>
          <div className="task-card__version-options">
            <article>
              <h5>Normal version</h5>
              <p>{task.normalVersion}</p>
              <Button disabled={actionBusy} onClick={onMarkNormalDone}>Mark normal done</Button>
            </article>
            <article>
              <h5>Full version</h5>
              <p>{task.fullVersion}</p>
              <Button disabled={actionBusy} onClick={onMarkFullDone}>Mark full done</Button>
            </article>
          </div>
          {!minimumCounts ? <Button disabled={actionBusy} onClick={onStopHere}>Stop here</Button> : null}
        </section>
      ) : null}
      {detailsOpen ? (
        <div className="task-card__details" id={`${task.id}-details`}>
          <section>
            <h4>Why this?</h4>
            <p>{task.whyThis}</p>
          </section>
          <section>
            <h4>Versions</h4>
            <dl>
              <div>
                <dt>Minimum</dt>
                <dd><span>{task.minimumVersion}</span>{task.versionMinutes ? ` · ${task.versionMinutes.minimum} min` : ''}</dd>
              </div>
              <div>
                <dt>Normal</dt>
                <dd><span>{task.normalVersion}</span>{task.versionMinutes ? ` · ${task.versionMinutes.normal} min` : ''}</dd>
              </div>
              <div>
                <dt>Full</dt>
                <dd><span>{task.fullVersion}</span>{task.versionMinutes ? ` · ${task.versionMinutes.full} min` : ''}</dd>
              </div>
            </dl>
          </section>
          {task.timingReality.trim() ? <section>
            <h4>Timing reality</h4>
            <p>{task.timingReality}</p>
          </section> : null}
          {task.hiddenEdges.length > 0 ? <section>
            <h4>Hidden edges</h4>
            <ul>
              {task.hiddenEdges.map((edge) => (
                <li key={edge}>{edge}</li>
              ))}
            </ul>
          </section> : null}
          {onEditTask ? <Button disabled={actionBusy} onClick={onEditTask}>Edit task</Button> : null}

        </div>
      ) : null}
    </article>
  );
}
