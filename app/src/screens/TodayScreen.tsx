import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, Modal } from '../components';
import {
  mockRhythmPreview,
  mockTodayTask,
  type MockTask,
  statePlanLines,
  todayStateHints,
  todayStates,
  type TodayState,
} from '../features/today/mockTodayData';
import { AddTaskModal, type MockAddTaskInput } from '../features/today/AddTaskModal';
import { StartBoost } from '../features/today/StartBoost';
import { TaskCard, type TaskProgress } from '../features/today/TaskCard';

function createMockTask(input: MockAddTaskInput): MockTask {
  return {
    ...mockTodayTask,
    area: input.area,
    areaIcon: 'Task',
    chips: ['Minimum counts', 'Start small'],
    fullVersion: input.fullVersion || input.normalVersion || input.minimumVersion,
    id: `mock-added-${Date.now()}`,
    minimumVersion: input.minimumVersion,
    normalVersion: input.normalVersion || input.minimumVersion,
    purpose: 'A preview task added for today only.',
    recommendedSize: 'Small',
    title: input.title,
    whyThis: 'This mock task shows how a one-off add will feel before real storage is connected.',
  };
}

export function TodayScreen() {
  const [todayState, setTodayState] = useState<TodayState>('Normal day');
  const [boostOpen, setBoostOpen] = useState(false);
  const [stateChooserOpen, setStateChooserOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [nextTask, setNextTask] = useState<MockTask | null>(mockTodayTask);
  const [taskProgress, setTaskProgress] = useState<TaskProgress>('idle');
  const [completionFeedback, setCompletionFeedback] = useState('');
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  );

  function chooseTodayState(state: TodayState) {
    setTodayState(state);
    setStateChooserOpen(false);
  }

  function saveMockTask(input: MockAddTaskInput) {
    setNextTask(createMockTask(input));
    setTaskProgress('idle');
    setCompletionFeedback('Mock task added for today only. Nothing was saved.');
    setAddTaskOpen(false);
    setBoostOpen(false);
  }

  function startTask() {
    setTaskProgress('inProgress');
    setCompletionFeedback('');
  }

  function markMinimumDone() {
    setTaskProgress('minimumDone');
    setBoostOpen(false);
    setCompletionFeedback('Minimum done. That counts.');
  }

  return (
    <div className="screen-stack today-screen">
      <section className="today-hero" aria-labelledby="today-title">
        <p className="eyebrow">{todayLabel}</p>
        <h1 id="today-title">Today</h1>
        <p>One useful next action. The rest can stay light.</p>
      </section>

      <Card>
        <section aria-labelledby="today-state-summary" className="today-state-summary">
          <div>
            <h2 id="today-state-summary">Today feels: {todayState}</h2>
            <p>{todayStateHints[todayState]}</p>
          </div>
          <Button onClick={() => setStateChooserOpen(true)}>Change</Button>
        </section>
        <p className="plan-adjusted">{statePlanLines[todayState]}</p>
      </Card>

      {completionFeedback ? <p className="today-feedback" role="status">{completionFeedback}</p> : null}

      {nextTask ? (
        <>
          <section aria-label="Next useful action">
            <div className="today-action-heading">
              <p className="section-label">Next useful action</p>
            </div>
            <TaskCard
              onMarkMinimumDone={markMinimumDone}
              onStartBoost={() => setBoostOpen(true)}
              onStartTask={startTask}
              progress={taskProgress}
              task={nextTask}
              todayState={todayState}
            />
          </section>
          <Card>
            <section aria-labelledby="today-one-off-title" className="today-one-off">
              <div>
                <h2 id="today-one-off-title">Need something else today?</h2>
                <p>Add one today-only task. It will not go into Library or storage.</p>
              </div>
              <Button onClick={() => setAddTaskOpen(true)}>Add one-off</Button>
            </section>
          </Card>
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
          action={<Button onClick={() => setAddTaskOpen(true)} variant="primary">Add one-off</Button>}
          message="Choose rhythms to turn on, or add one today-only task."
          title="Choose rhythms to turn on"
        />
      )}

      <Modal onClose={() => setStateChooserOpen(false)} open={stateChooserOpen} title="How today feels">
        <div className="today-state-panel">
          <p className="lede">Choose the closest state. This only changes the preview tone.</p>
          <div aria-label="How today feels" className="today-state-grid" role="radiogroup">
            {todayStates.map((state) => (
              <button
                aria-checked={todayState === state}
                className="state-choice"
                key={state}
                onClick={() => chooseTodayState(state)}
                role="radio"
                type="button"
              >
                <strong>{state}</strong>
                <span>{todayStateHints[state]}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
      <AddTaskModal onClose={() => setAddTaskOpen(false)} onSave={saveMockTask} open={addTaskOpen} />
    </div>
  );
}
