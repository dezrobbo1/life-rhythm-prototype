import { useEffect, useState } from 'react';
import { Button, Chip } from '../../components';
import type { MockTask, TodayState } from './mockTodayData';
import { stateActionTone } from './mockTodayData';

export type TaskProgress = 'idle' | 'inProgress' | 'paused' | 'minimumDone';

type TaskCardProps = {
  onKeepGoing: () => void;
  onMarkMinimumDone: () => void;
  onNotToday: () => void;
  onParkTask: () => void;
  onPauseTask: () => void;
  onResumeTask: () => void;
  onStartTask: () => void;
  onStartBoost: () => void;
  onStopHere: () => void;
  progress: TaskProgress;
  task: MockTask;
  todayState: TodayState;
};

export function TaskCard({
  onKeepGoing,
  onMarkMinimumDone,
  onNotToday,
  onParkTask,
  onPauseTask,
  onResumeTask,
  onStartBoost,
  onStartTask,
  onStopHere,
  progress,
  task,
  todayState,
}: TaskCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [keepGoingOpen, setKeepGoingOpen] = useState(false);
  const [continuedAfterMinimum, setContinuedAfterMinimum] = useState(false);
  const [continuationFeedback, setContinuationFeedback] = useState('');
  const visibleChips = task.chips.slice(0, 2);
  const isInProgress = progress === 'inProgress';
  const isPaused = progress === 'paused';
  const isMinimumDone = progress === 'minimumDone';

  useEffect(() => {
    setKeepGoingOpen(false);
    setContinuedAfterMinimum(false);
    setContinuationFeedback('');
  }, [task.id]);

  function chooseContinuation(version: 'normal' | 'full') {
    setContinuationFeedback(
      version === 'normal'
        ? 'You kept going with the normal version. Still counts either way.'
        : 'You kept going with the full version. Still counts either way.',
    );
  }

  function toggleKeepGoing() {
    if (isMinimumDone) {
      setContinuedAfterMinimum(true);
      onKeepGoing();
    }

    setKeepGoingOpen((isOpen) => !isOpen);
  }

  function stopHere() {
    if (continuedAfterMinimum) {
      onStopHere();
      return;
    }

    setKeepGoingOpen(false);
    setContinuationFeedback('Enough for now.');
  }

  return (
    <article className="task-card" aria-labelledby={`${task.id}-title`}>
      <div className="task-card__area">
        <span className="task-card__marker" aria-hidden="true">
          {task.areaIcon}
        </span>
        <span>{task.area}</span>
      </div>
      <div className="task-card__header">
        <div>
          <h2 id={`${task.id}-title`}>{task.title}</h2>
          <p>{task.purpose}</p>
        </div>
        <span className="task-card__size">{task.recommendedSize}</span>
      </div>
      <p className="task-card__tone">{stateActionTone[todayState]}</p>
      {isInProgress ? <p className="task-card__status" role="status">In progress. Keep it small.</p> : null}
      {isPaused ? <p className="task-card__status" role="status">Paused. You can restart small.</p> : null}
      {isMinimumDone ? (
        <p className="task-card__status task-card__status--done" role="status">
          Minimum done. That counts.
        </p>
      ) : null}
      {continuationFeedback ? (
        <p className="task-card__status task-card__status--done" role="status">
          {continuationFeedback}
        </p>
      ) : null}
      <div className="chip-row task-card__chips" aria-label="Task cues">
        {visibleChips.map((chip) => (
          <Chip key={chip}>{chip}</Chip>
        ))}
      </div>
      <div className="task-card__actions">
        {progress === 'idle' ? (
          <Button onClick={onStartTask} variant="primary">Start task</Button>
        ) : null}
        {progress === 'inProgress' ? (
          <>
            <Button onClick={onMarkMinimumDone} variant="primary">Mark minimum done</Button>
            <Button onClick={onPauseTask}>Pause</Button>
            <Button onClick={toggleKeepGoing}>Keep going</Button>
          </>
        ) : null}
        {progress === 'paused' ? (
          <>
            <Button onClick={onResumeTask} variant="primary">Resume</Button>
            <Button onClick={onMarkMinimumDone}>Mark minimum done</Button>
          </>
        ) : null}
        {progress === 'minimumDone' ? (
          <>
            <Button disabled variant="primary">Minimum done</Button>
            <Button onClick={toggleKeepGoing}>Keep going</Button>
            <Button onClick={onStopHere}>Stop here</Button>
            <Button onClick={onParkTask}>Park</Button>
            <Button onClick={onNotToday}>Not today</Button>
          </>
        ) : null}
        {progress !== 'minimumDone' ? <Button onClick={onStartBoost}>Start Boost</Button> : null}
        <Button
          aria-expanded={detailsOpen}
          aria-controls={`${task.id}-details`}
          onClick={() => setDetailsOpen((isOpen) => !isOpen)}
        >
          Details
        </Button>
      </div>
      {keepGoingOpen ? (
        <section className="task-card__continuation" aria-labelledby={`${task.id}-continuation-title`}>
          <div>
            <h3 id={`${task.id}-continuation-title`}>Optional next versions</h3>
            <p>
              {isMinimumDone || continuedAfterMinimum
                ? 'Optional. Minimum already counts. Continue only if it helps.'
                : 'Optional. Keep the minimum small, then continue only if it helps.'}
            </p>
          </div>
          <div className="task-card__version-options">
            <article>
              <h4>Normal version</h4>
              <p>{task.normalVersion}</p>
              <Button onClick={() => chooseContinuation('normal')}>Do normal version</Button>
            </article>
            <article>
              <h4>Full version</h4>
              <p>{task.fullVersion}</p>
              <Button onClick={() => chooseContinuation('full')}>Do full version</Button>
            </article>
          </div>
          {!isMinimumDone || continuedAfterMinimum ? <Button onClick={stopHere}>Stop here</Button> : null}
        </section>
      ) : null}
      {detailsOpen ? (
        <div className="task-card__details" id={`${task.id}-details`}>
          <section>
            <h3>Why this?</h3>
            <p>{task.whyThis}</p>
          </section>
          <section>
            <h3>Versions</h3>
            <dl>
              <div>
                <dt>Minimum</dt>
                <dd>{task.minimumVersion}</dd>
              </div>
              <div>
                <dt>Normal</dt>
                <dd>{task.normalVersion}</dd>
              </div>
              <div>
                <dt>Full</dt>
                <dd>{task.fullVersion}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Timing reality</h3>
            <p>{task.timingReality}</p>
          </section>
          <section>
            <h3>Hidden edges</h3>
            <ul>
              {task.hiddenEdges.map((edge) => (
                <li key={edge}>{edge}</li>
              ))}
            </ul>
          </section>
          <div className="task-card__quiet-actions" aria-label="Placeholder task actions">
            <button type="button">Edit later</button>
            <button type="button">Move later</button>
            <button type="button">Hide later</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
