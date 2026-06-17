import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button, Card, EmptyState, Modal } from '../components';
import {
  createActiveTaskId,
  loadActiveTodayTasks,
  loadPersistedActiveTasks,
  saveActiveTodayTask,
  updateActiveTaskStatus,
} from '../data/activeTaskRepository';
import {
  buildActiveTaskBackupPayload,
  parseActiveTaskBackupJson,
  serializeActiveTaskBackup,
} from '../data/activeTaskBackup';
import { activeTaskSchema, type ActiveTask, type ActiveTaskStatus } from '../data/schemas';
import {
  mockTodayTask,
  type MockTask,
  todayStateHints,
  todayStates,
  type TodayState,
} from '../features/today/mockTodayData';
import { AddTaskModal, type MockAddTaskInput } from '../features/today/AddTaskModal';
import { StartBoost } from '../features/today/StartBoost';
import { TaskCard, type TaskProgress } from '../features/today/TaskCard';
import {
  buildTodayViewModel,
  type TaskViewModel,
} from '../viewModels';
import { useAppSnapshot } from '../data/AppSnapshotProvider';

type ActiveTaskArea = ActiveTask['area'];
type VisibleActiveTaskStatus = Extract<ActiveTaskStatus, 'active' | 'inProgress' | 'paused' | 'minimumDone'>;
type ActiveTaskBackupCheckPreview = {
  exportedAt: string;
  items: Array<{
    status: ActiveTaskStatus;
    title: string;
  }>;
};

const areaLabels: Record<ActiveTaskArea, string> = {
  admin: 'Admin',
  antidrift: 'Anti-scroll',
  emotion: 'Emotional recovery',
  food: 'Food',
  health: 'Health',
  house: 'Household',
  money: 'Money',
  movement: 'Movement',
  other: 'Other',
  sensory: 'Sensory load',
  social: 'Social support',
  work: 'Work',
};

function areaFromInput(value: string): ActiveTaskArea {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes('money') || normalized.includes('bill')) return 'money';
  if (normalized.includes('food') || normalized.includes('meal') || normalized.includes('breakfast')) return 'food';
  if (normalized.includes('move') || normalized.includes('exercise')) return 'movement';
  if (normalized.includes('work')) return 'work';
  if (normalized.includes('admin') || normalized.includes('paper')) return 'admin';
  if (normalized.includes('home') || normalized.includes('house')) return 'house';
  if (normalized.includes('social') || normalized.includes('message')) return 'social';
  if (normalized.includes('sensory') || normalized.includes('quiet')) return 'sensory';
  if (normalized.includes('emotion') || normalized.includes('reset')) return 'emotion';
  if (normalized.includes('health') || normalized.includes('sleep')) return 'health';
  if (normalized.includes('scroll') || normalized.includes('phone')) return 'antidrift';

  return 'other';
}

function taskFromViewModel(task: TaskViewModel | null): MockTask | null {
  if (!task) {
    return null;
  }

  return {
    ...mockTodayTask,
    area: task.area,
    areaIcon: task.area.toLowerCase().includes('home') ? 'Home' : 'Task',
    chips: task.chips,
    fullVersion: task.versions.full.text,
    hiddenEdges: task.hiddenEdges.length > 0
      ? task.hiddenEdges.map((edge) => edge.label)
      : mockTodayTask.hiddenEdges,
    id: task.id,
    minimumVersion: task.versions.minimum.text,
    normalVersion: task.versions.normal.text,
    purpose: task.purpose,
    recommendedSize: task.recommendedSize,
    title: task.title,
  };
}

function taskFromActiveTask(task: ActiveTask): MockTask {
  return {
    ...mockTodayTask,
    area: areaLabels[task.area],
    areaIcon: 'Task',
    chips: ['Minimum counts', 'Start small'],
    fullVersion: task.full.label,
    hiddenEdges: mockTodayTask.hiddenEdges,
    id: task.id,
    minimumVersion: task.minimum.label,
    normalVersion: task.normal.label,
    purpose: task.purpose ?? 'One Today task saved on this device.',
    recommendedSize: `${task.minimum.minutes} min minimum`,
    title: task.title,
    whyThis: task.source === 'library'
      ? 'This task was added from a Library rhythm by you.'
      : 'This one-off was added for today only and is not part of Library.',
  };
}

function progressFromActiveTaskStatus(status: VisibleActiveTaskStatus): TaskProgress {
  if (status === 'inProgress') return 'inProgress';
  if (status === 'paused') return 'paused';
  if (status === 'minimumDone') return 'minimumDone';

  return 'idle';
}

function isVisibleActiveTaskStatus(status: ActiveTaskStatus): status is VisibleActiveTaskStatus {
  return status === 'active' || status === 'inProgress' || status === 'paused' || status === 'minimumDone';
}

function isVisibleActiveTask(task: ActiveTask) {
  return task.showToday && isVisibleActiveTaskStatus(task.status);
}

function fileDate(timestamp: string) {
  return timestamp.slice(0, 10);
}

function downloadJsonFile(fileName: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createOneOffActiveTask(input: MockAddTaskInput): ActiveTask {
  const timestamp = new Date().toISOString();
  const minimum = input.minimumVersion;
  const normal = input.normalVersion || minimum;
  const full = input.fullVersion || normal;

  return activeTaskSchema.parse({
    area: areaFromInput(input.area),
    createdAt: timestamp,
    full: {
      label: full,
      minutes: 20,
    },
    id: createActiveTaskId('adhoc'),
    minimum: {
      label: minimum,
      minutes: 5,
    },
    normal: {
      label: normal,
      minutes: 10,
    },
    purpose: 'Today-only task added by you.',
    showToday: true,
    source: 'adhoc',
    status: 'active',
    title: input.title,
    updatedAt: timestamp,
  });
}

export function TodayScreen() {
  const { snapshot } = useAppSnapshot();
  const initialTodayViewModel = useMemo(() => buildTodayViewModel(snapshot), [snapshot]);
  const [todayState, setTodayState] = useState<TodayState>('Normal day');
  const [boostOpen, setBoostOpen] = useState(false);
  const [stateChooserOpen, setStateChooserOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [nextTask, setNextTask] = useState<MockTask | null>(() =>
    taskFromViewModel(initialTodayViewModel.nextUsefulAction),
  );
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [nextActiveTask, setNextActiveTask] = useState<ActiveTask | null>(null);
  const [taskProgress, setTaskProgress] = useState<TaskProgress>('idle');
  const [completionFeedback, setCompletionFeedback] = useState('');
  const [backupFeedback, setBackupFeedback] = useState('');
  const [backupCheckJson, setBackupCheckJson] = useState('');
  const [backupCheckErrors, setBackupCheckErrors] = useState<string[]>([]);
  const [backupCheckPreview, setBackupCheckPreview] = useState<ActiveTaskBackupCheckPreview | null>(null);
  const todayViewModel = useMemo(
    () => buildTodayViewModel(snapshot, { todayState }),
    [snapshot, todayState],
  );
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

  function showPersistedTask(task: ActiveTask | null) {
    setNextActiveTask(task);

    if (!task) {
      setNextTask(null);
      setTaskProgress('idle');
      return;
    }

    if (!isVisibleActiveTaskStatus(task.status)) {
      setNextTask(null);
      setTaskProgress('idle');
      return;
    }

    setNextTask(taskFromActiveTask(task));
    setTaskProgress(progressFromActiveTaskStatus(task.status));
  }

  function refreshPersistedTasks(updatedTask: ActiveTask, feedback: string) {
    const updatedTasks = activeTasks.map((task) =>
      task.id === updatedTask.id ? updatedTask : task,
    );
    const visibleTasks = updatedTasks.filter(isVisibleActiveTask);

    setActiveTasks(updatedTasks);
    setCompletionFeedback(feedback);
    setBoostOpen(false);
    showPersistedTask(visibleTasks[0] ?? null);
  }

  async function persistProgress(
    status: ActiveTaskStatus,
    progress: TaskProgress,
    feedback = '',
  ) {
    if (!nextActiveTask) {
      setTaskProgress(progress);
      setCompletionFeedback(feedback);
      if (status === 'minimumDone') setBoostOpen(false);
      return;
    }

    const result = await updateActiveTaskStatus(nextActiveTask.id, status);

    if (!result.ok) {
      setCompletionFeedback('Task state was not saved. Try again.');
      return;
    }

    const updatedTasks = activeTasks.map((task) =>
      task.id === result.task.id ? result.task : task,
    );

    setActiveTasks(updatedTasks);
    setNextActiveTask(result.task);
    setTaskProgress(progress);
    setCompletionFeedback(feedback);
    if (status === 'minimumDone') setBoostOpen(false);
  }

  async function moveCurrentTaskOutOfToday(
    status: Extract<ActiveTaskStatus, 'done' | 'parked' | 'skipped' | 'notToday'>,
    feedback: string,
  ) {
    if (!nextActiveTask) {
      setNextTask(null);
      setTaskProgress('idle');
      setCompletionFeedback(feedback);
      setBoostOpen(false);
      return;
    }

    const result = await updateActiveTaskStatus(nextActiveTask.id, status);

    if (!result.ok) {
      setCompletionFeedback('Task state was not saved. Try again.');
      return;
    }

    refreshPersistedTasks(result.task, feedback);
  }

  useEffect(() => {
    let active = true;

    loadActiveTodayTasks().then((tasks) => {
      if (!active || tasks.length === 0) return;

      setActiveTasks(tasks);
      showPersistedTask(tasks[0]);
      setCompletionFeedback('');
      setBoostOpen(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function saveOneOffTask(input: MockAddTaskInput): Promise<boolean> {
    const candidate = createOneOffActiveTask(input);
    const result = await saveActiveTodayTask(candidate);

    if (!result.ok) {
      setCompletionFeedback('One-off was not saved. Check the required fields.');
      return false;
    }

    setNextTask(taskFromActiveTask(result.task));
    setNextActiveTask(result.task);
    setActiveTasks((tasks) => [result.task, ...tasks.filter((task) => task.id !== result.task.id)]);
    setTaskProgress('idle');
    setCompletionFeedback('One-off saved to Today on this device. It will not go into Library.');
    setAddTaskOpen(false);
    setBoostOpen(false);

    return true;
  }

  async function startTask() {
    await persistProgress('inProgress', 'inProgress');
  }

  async function pauseTask() {
    await persistProgress('paused', 'paused');
  }

  async function resumeTask() {
    await persistProgress('inProgress', 'inProgress');
  }

  async function markMinimumDone() {
    await persistProgress('minimumDone', 'minimumDone', 'Minimum done. That counts.');
  }

  async function keepGoing() {
    await persistProgress('inProgress', 'inProgress');
  }

  async function stopHere() {
    await moveCurrentTaskOutOfToday('done', 'Stopped here. That task is out of Today. No catch-up pile.');
  }

  async function parkTask() {
    await moveCurrentTaskOutOfToday('parked', 'Parked. It is safely held. No catch-up pile.');
  }

  async function notToday() {
    await moveCurrentTaskOutOfToday('notToday', 'Not today. It is out of the current list. No catch-up pile.');
  }

  async function exportTodayTasksBackup() {
    const tasks = await loadPersistedActiveTasks();

    if (tasks.length === 0) {
      setBackupFeedback('No saved Today tasks to export yet.');
      return;
    }

    try {
      const exportedAt = new Date().toISOString();
      const payload = buildActiveTaskBackupPayload(tasks, exportedAt);
      const json = serializeActiveTaskBackup(payload);

      downloadJsonFile(`life-rhythm-today-tasks-backup-${fileDate(exportedAt)}.json`, json);
      setBackupFeedback('Today tasks backup created on this device.');
    } catch {
      setBackupFeedback('Today tasks backup could not be created.');
    }
  }

  function checkTodayTasksBackup() {
    const result = parseActiveTaskBackupJson(backupCheckJson);

    if (result.ok) {
      setBackupCheckErrors([]);
      setBackupCheckPreview({
        exportedAt: result.preview.exportedAt,
        items: result.payload.activeTasks.map((task) => ({
          status: task.status,
          title: task.title,
        })),
      });
      setBackupFeedback('Today tasks backup looks valid. Restore is not connected yet.');
      return;
    }

    setBackupCheckErrors(result.errors);
    setBackupCheckPreview(null);
    setBackupFeedback('This Today tasks backup could not be used.');
  }

  async function readTodayTasksBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    try {
      setBackupCheckJson(await file.text());
      setBackupCheckErrors([]);
      setBackupCheckPreview(null);
      setBackupFeedback('Today tasks backup loaded. Choose Check Today tasks backup.');
    } catch {
      setBackupCheckErrors(['backup: Today tasks backup file could not be read.']);
      setBackupCheckPreview(null);
      setBackupFeedback('This Today tasks backup could not be used.');
    }
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
            <h2 id="today-state-summary">Today feels: {todayViewModel.currentState}</h2>
            <p>{todayStateHints[todayState]}</p>
          </div>
          <Button onClick={() => setStateChooserOpen(true)}>Change</Button>
        </section>
        <p className="plan-adjusted">{todayViewModel.planAdjustedLine}</p>
      </Card>

      {completionFeedback ? <p className="today-feedback" role="status">{completionFeedback}</p> : null}

      {nextTask ? (
        <>
          <section aria-label="Next useful action">
            <div className="today-action-heading">
              <p className="section-label">Next useful action</p>
            </div>
            <TaskCard
              onKeepGoing={keepGoing}
              onMarkMinimumDone={markMinimumDone}
              onNotToday={notToday}
              onParkTask={parkTask}
              onPauseTask={pauseTask}
              onResumeTask={resumeTask}
              onStartBoost={() => setBoostOpen(true)}
              onStartTask={startTask}
              onStopHere={stopHere}
              progress={taskProgress}
              task={nextTask}
              todayState={todayState}
            />
          </section>
          <Card>
            <section aria-labelledby="today-one-off-title" className="today-one-off">
              <div>
                <h2 id="today-one-off-title">Need something else today?</h2>
                <p>Add one today-only task. It will not go into Library.</p>
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
              {todayViewModel.rhythmPreview.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
          <StartBoost open={boostOpen} task={nextTask} onClose={() => setBoostOpen(false)} />
        </>
      ) : (
        <EmptyState
          action={<Button onClick={() => setAddTaskOpen(true)} variant="primary">{todayViewModel.emptyState.primaryActionLabel}</Button>}
          message={todayViewModel.emptyState.message}
          title={todayViewModel.emptyState.title}
        />
      )}

      <Card>
        <section aria-labelledby="today-backup-title" className="today-one-off">
          <div>
            <h2 id="today-backup-title">Today task backup</h2>
            <p>This backup includes Today tasks only. It does not include Library rhythms or settings.</p>
          </div>
          <Button onClick={exportTodayTasksBackup}>Export Today tasks backup</Button>
        </section>
        <section aria-labelledby="today-backup-check-title" className="library-backup-checker">
          <div className="library-subheading">
            <h2 id="today-backup-check-title">Check Today tasks backup</h2>
            <p>Checking a backup does not change anything on this device. Restore is not connected yet.</p>
          </div>
          <label className="library-backup-field">
            <span>Today task backup JSON</span>
            <textarea
              aria-label="Today task backup JSON"
              onChange={(event) => {
                setBackupCheckJson(event.target.value);
                setBackupCheckErrors([]);
                setBackupCheckPreview(null);
              }}
              placeholder="Paste a Today tasks backup JSON file here."
              rows={6}
              value={backupCheckJson}
            />
            <small>This checks Today task backups only. It does not restore tasks.</small>
          </label>
          <div className="library-backup-actions">
            <label className="library-file-picker">
              <span>Select Today tasks backup file</span>
              <input
                accept="application/json,.json"
                aria-label="Select Today tasks backup file"
                onChange={readTodayTasksBackupFile}
                type="file"
              />
            </label>
            <Button onClick={checkTodayTasksBackup}>Check Today tasks backup</Button>
          </div>
          {backupCheckPreview ? (
            <dl aria-label="Today task backup preview" className="library-backup-preview">
              <div>
                <dt>Tasks</dt>
                <dd>{backupCheckPreview.items.length}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{backupCheckPreview.exportedAt}</dd>
              </div>
              <div>
                <dt>Titles and statuses</dt>
                <dd>
                  {backupCheckPreview.items.length > 0
                    ? backupCheckPreview.items.map((task) => `${task.title} (${task.status})`).join(', ')
                    : 'No task titles in backup.'}
                </dd>
              </div>
            </dl>
          ) : null}
          {backupCheckErrors.length > 0 ? (
            <div className="library-validation-summary">
              <strong>Backup check notes</strong>
              <p>Nothing changed on this device. The first items to review are below.</p>
              <ul aria-label="Today task backup errors" className="library-validation-list">
                {backupCheckErrors.slice(0, 3).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        {backupFeedback ? <p className="today-feedback" role="status">{backupFeedback}</p> : null}
      </Card>

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
      <AddTaskModal onClose={() => setAddTaskOpen(false)} onSave={saveOneOffTask} open={addTaskOpen} />
    </div>
  );
}
