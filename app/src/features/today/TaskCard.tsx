import { useState } from 'react';
import { Button, Chip } from '../../components';
import type { MockTask, TodayState } from './mockTodayData';
import { stateActionTone } from './mockTodayData';

export type TaskProgress = 'idle' | 'inProgress' | 'minimumDone';

type TaskCardProps = {
  onMarkMinimumDone: () => void;
  onStartTask: () => void;
  onStartBoost: () => void;
  progress: TaskProgress;
  task: MockTask;
  todayState: TodayState;
};

export function TaskCard({
  onMarkMinimumDone,
  onStartBoost,
  onStartTask,
  progress,
  task,
  todayState,
}: TaskCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const visibleChips = task.chips.slice(0, 2);
  const isStarted = progress === 'inProgress';
  const isComplete = progress === 'minimumDone';

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
      {isStarted ? <p className="task-card__status" role="status">In progress. Keep it small.</p> : null}
      {isComplete ? (
        <p className="task-card__status task-card__status--done" role="status">
          Minimum done. That counts.
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
          <Button onClick={onMarkMinimumDone} variant="primary">Mark minimum done</Button>
        ) : null}
        {progress === 'minimumDone' ? <Button disabled variant="primary">Minimum done</Button> : null}
        <Button onClick={onStartBoost}>Start Boost</Button>
        <Button
          aria-expanded={detailsOpen}
          aria-controls={`${task.id}-details`}
          onClick={() => setDetailsOpen((isOpen) => !isOpen)}
        >
          Details
        </Button>
      </div>
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
