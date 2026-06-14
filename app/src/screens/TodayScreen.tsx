import { useMemo, useState } from 'react';
import { Button, Card, EmptyState } from '../components';
import {
  mockRhythmPreview,
  mockTodayTask,
  statePlanLines,
  todayStateHints,
  todayStates,
  type TodayState,
} from '../features/today/mockTodayData';
import { StartBoost } from '../features/today/StartBoost';
import { TaskCard } from '../features/today/TaskCard';

export function TodayScreen() {
  const [todayState, setTodayState] = useState<TodayState>('Normal day');
  const [boostOpen, setBoostOpen] = useState(false);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  );
  const nextTask = mockTodayTask;

  return (
    <div className="screen-stack today-screen">
      <section className="today-hero" aria-labelledby="today-title">
        <p className="eyebrow">{todayLabel}</p>
        <h1 id="today-title">Today</h1>
        <p>One useful next action. The rest can stay light.</p>
      </section>

      <Card>
        <section aria-labelledby="today-state-label" className="today-state-panel">
          <div className="today-state-panel__header">
            <h2 id="today-state-label">How today feels</h2>
            <span>{todayState}</span>
          </div>
          <div aria-labelledby="today-state-label" className="today-state-grid" role="radiogroup">
            {todayStates.map((state) => (
              <button
                aria-checked={todayState === state}
                className="state-choice"
                key={state}
                onClick={() => setTodayState(state)}
                role="radio"
                type="button"
              >
                <strong>{state}</strong>
                <span>{todayStateHints[state]}</span>
              </button>
            ))}
          </div>
        </section>
        <p className="plan-adjusted">{statePlanLines[todayState]}</p>
      </Card>

      {nextTask ? (
        <>
          <section aria-label="Next useful action">
            <p className="section-label">Next useful action</p>
            <TaskCard task={nextTask} todayState={todayState} onStartBoost={() => setBoostOpen(true)} />
          </section>
          <Card>
            <div className="rhythm-preview__header">
              <h2>Today rhythm preview</h2>
              <span>Compact view</span>
            </div>
            <ul className="rhythm-preview">
              {mockRhythmPreview.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
          <StartBoost open={boostOpen} task={nextTask} onClose={() => setBoostOpen(false)} />
        </>
      ) : (
        <EmptyState
          action={<Button variant="primary">Add one task</Button>}
          message="Choose rhythms to turn on, or add one task for today."
          title="Choose rhythms to turn on"
        />
      )}
    </div>
  );
}
