import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, Card, EmptyState, Modal, ScreenHero } from '../components';
import {
  createActiveTaskId,
  loadActiveTodayTasksResult,
  loadPersistedActiveTasksResult,
  saveActiveTodayTask,
  updateActiveTaskStatus,
} from '../data/activeTaskRepository';
import {
  buildActiveTaskBackupPayload,
  parseActiveTaskBackupJson,
  serializeActiveTaskBackup,
} from '../data/activeTaskBackup';
import { repairCurrentPrivatePlan } from '../data/schedulerPlanCoordinator';
import {
  loadLinkedTaskPoolItemIds,
  markTaskLifecycleNoLongerNeeded,
} from '../data/taskLifecycleRepository';
import { ReducedDayControl } from '../features/today/ReducedDayControl';
import { activeTaskSchema, type ActiveTask, type ActiveTaskStatus } from '../data/schemas';
import {
  type MockTask,
  todayStateHints,
  todayStates,
  type TodayState,
} from '../features/today/mockTodayData';
import { AddTaskModal, type MockAddTaskInput } from '../features/today/AddTaskModal';
import { StartBoost } from '../features/today/StartBoost';
import { TaskCard, type TaskProgress } from '../features/today/TaskCard';
import {
  buildTimeEdgeReentryPreviewViewModel,
  buildTodayViewModel,
  type SnapshotActiveTask,
  type TimeEdgeReentryPreviewViewModel,
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

type TodayTasksReadState =
  | { status: 'loading' }
  | { status: 'ok' }
  | { invalidRecordCount: number; status: 'partial' }
  | { status: 'readFailed' };

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

function neutralTaskDetails(): Pick<MockTask, 'timingReality' | 'hiddenEdges' | 'startBarriers' | 'boostSupports'> {
  return {
    timingReality: '',
    hiddenEdges: [],
    startBarriers: [
      'Too big',
      'Unclear first step',
      'Too boring',
      'Low energy',
      'Not enough time',
      'Emotionally hard',
      'Need information',
      'Pulled to phone',
    ],
    boostSupports: {
      'Too big': [
        { id: 'minimum', label: 'Use the minimum version', detail: 'Start with the Minimum shown for this task.' },
        { id: 'hide-the-rest', label: 'Hide the rest for now', detail: 'Hidden, not deleted.' },
      ],
      'Unclear first step': [
        { id: 'first-step', label: 'Name the first step', detail: 'Identify the first action for this task.' },
        { id: 'choose-object', label: 'Choose the first object', detail: 'Pick the physical object or screen you need first.' },
      ],
      'Too boring': [
        { id: 'make-concrete', label: 'Make the start concrete', detail: 'Name one visible action to begin with.' },
        { id: 'change-surface', label: 'Change the surface', detail: 'Use a different workspace or tool if it helps with this task.' },
      ],
      'Low energy': [
        { id: 'minimum', label: 'Use the minimum version', detail: 'Start with the Minimum shown for this task.' },
        { id: 'already-open', label: 'Use what is already open', detail: 'Use what is already within reach if it helps with this task.' },
      ],
      'Not enough time': [
        { id: 'minimum', label: 'Use the minimum version', detail: 'Check whether the Minimum shown for this task fits the time available.' },
        { id: 'park-the-rest', label: 'Park the rest', detail: 'Everything else can wait for the next review.' },
      ],
      'Emotionally hard': [
        { id: 'gentle-truth', label: 'Use the gentlest truthful wording', detail: 'Write the first step without making it bigger.' },
        { id: 'support-condition', label: 'Name one support condition', detail: 'Capture what would make this easier to start.' },
      ],
      'Need information': [
        { id: 'missing-question', label: 'Write the missing question', detail: 'Capture the question instead of solving it now.' },
        { id: 'where-to-look', label: 'Name where to look first', detail: 'Leave a clear place to begin later.' },
      ],
      'Pulled to phone': [
        { id: 'phone-face-down', label: 'Set the phone face down', detail: 'Keep the task on one visible surface.' },
        { id: 'one-surface', label: 'Keep only what you need open', detail: 'Return to the first action for this task.' },
      ],
    },
  };
}

function taskSourceDescription(source: ActiveTask['source']): string {
  return source === 'library'
    ? 'This task was added from a Library rhythm by you.'
    : source === 'adhoc'
      ? 'This one-off was added for today only and is not part of Library.'
      : 'This is a custom task.';
}

function taskFromViewModel(task: TaskViewModel | null): MockTask | null {
  if (!task) {
    return null;
  }

  return {
    ...neutralTaskDetails(),
    area: task.area,
    areaIcon: task.area.toLowerCase().includes('home') ? 'Home' : 'Task',
    chips: task.chips,
    fullVersion: task.versions.full.text,
    hiddenEdges: task.hiddenEdges.map((edge) => edge.label),
    id: task.id,
    minimumVersion: task.versions.minimum.text,
    normalVersion: task.versions.normal.text,
    purpose: task.purpose,
    recommendedSize: task.recommendedSize,
    timeEdge: task.deadline,
    title: task.title,
    whyThis: taskSourceDescription(task.source),
  };
}

function taskFromActiveTask(task: ActiveTask): MockTask {
  return {
    ...neutralTaskDetails(),
    area: areaLabels[task.area],
    areaIcon: 'Task',
    chips: ['Minimum counts', 'Start small'],
    fullVersion: task.full.label,
    id: task.id,
    minimumVersion: task.minimum.label,
    normalVersion: task.normal.label,
    purpose: task.purpose ?? 'One Today task saved on this device.',
    recommendedSize: `${task.minimum.minutes} min minimum`,
    timeEdge: {
      dueAt: task.dueAt,
      expiresAfter: task.expiresAfter,
      fixedAt: task.fixedAt,
      latestUsefulStartAt: task.latestUsefulStartAt,
      minimumStillUsefulAfterDeadline: task.minimumStillUsefulAfterDeadline,
      missedPolicy: task.missedPolicy,
      notUsefulAfter: task.notUsefulAfter,
      timeConstraint: task.timeConstraint,
    },
    title: task.title,
    whyThis: taskSourceDescription(task.source),
  };
}

function snapshotFromActiveTask(task: ActiveTask): SnapshotActiveTask {
  return {
    area: areaLabels[task.area],
    deadline: {
      dueAt: task.dueAt,
      expiresAfter: task.expiresAfter,
      fixedAt: task.fixedAt,
      latestUsefulStartAt: task.latestUsefulStartAt,
      minimumStillUsefulAfterDeadline: task.minimumStillUsefulAfterDeadline,
      missedPolicy: task.missedPolicy,
      notUsefulAfter: task.notUsefulAfter,
      timeConstraint: task.timeConstraint,
    },
    full: task.full,
    id: task.id,
    minimum: task.minimum,
    minimumAchievedAt: task.minimumAchievedAt,
    normal: task.normal,
    purpose: task.purpose,
    showToday: task.showToday,
    source: task.source,
    status: task.status,
    templateId: task.templateId,
    title: task.title,
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

async function repairPrivatePlanAfterTodayChange(
  trigger: 'completionChanged' | 'userCorrection',
  reason: string,
) {
  try {
    await repairCurrentPrivatePlan({ trigger, reason });
  } catch {
    // The user-owned Today change is already saved. Scheduler maintenance is best-effort here.
  }
}

function createOneOffActiveTask(input: MockAddTaskInput): ActiveTask {
  const timestamp = new Date().toISOString();
  const minimum = input.minimumVersion;
  const normal = input.normalVersion || minimum;
  const full = input.fullVersion || normal;
  const timeEdgeFields = {
    ...(input.timeConstraint ? { timeConstraint: input.timeConstraint } : {}),
    ...(input.dueAt ? { dueAt: input.dueAt } : {}),
    ...(input.fixedAt ? { fixedAt: input.fixedAt } : {}),
    ...(input.expiresAfter ? { expiresAfter: input.expiresAfter } : {}),
    ...(input.latestUsefulStartAt ? { latestUsefulStartAt: input.latestUsefulStartAt } : {}),
    ...(input.notUsefulAfter ? { notUsefulAfter: input.notUsefulAfter } : {}),
    ...(input.minimumStillUsefulAfterDeadline ? { minimumStillUsefulAfterDeadline: true } : {}),
    ...(input.missedPolicy ? { missedPolicy: input.missedPolicy } : {}),
  };

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
    ...timeEdgeFields,
    title: input.title,
    updatedAt: timestamp,
  });
}

type ReentryReviewPreviewProps = {
  feedbackById: Record<string, string>;
  onMarkNotToday: (taskId: string) => void;
  onNoLongerNeeded: (taskId: string) => void;
  onParkSafely: (taskId: string) => void;
  onReviewLater: (taskId: string) => void;
  onTryMinimum: (taskId: string) => void;
  preview: TimeEdgeReentryPreviewViewModel;
};

function ReentryReviewPreview({
  feedbackById,
  onMarkNotToday,
  onNoLongerNeeded,
  onParkSafely,
  onReviewLater,
  onTryMinimum,
  preview,
}: ReentryReviewPreviewProps) {
  if (preview.items.length === 0) {
    return null;
  }

  function handleAction(taskId: string, action: TimeEdgeReentryPreviewViewModel['items'][number]['actionOptions'][number]) {
    if (action === 'Park safely') {
      onParkSafely(taskId);
      return;
    }

    if (action === 'Mark not today') {
      onMarkNotToday(taskId);
      return;
    }

    if (action === 'No longer needed') {
      onNoLongerNeeded(taskId);
      return;
    }

    if (action === 'Keep for review') {
      onReviewLater(taskId);
      return;
    }

    onTryMinimum(taskId);
  }

  return (
    <Card>
      <section aria-labelledby="reentry-review-title" className="reentry-review">
        <div className="library-subheading">
          <h2 id="reentry-review-title">{preview.title}</h2>
          {preview.intro.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <ul className="reentry-review__items">
          {preview.items.map((item) => (
            <li key={item.id} className="reentry-review__item">
              <div>
                <h3>{item.title}</h3>
                <p>{item.reason}</p>
                <p className="reentry-review__support">{item.usefulness}</p>
                {item.supportingCopy.map((line) => (
                  <p key={line} className="reentry-review__support">{line}</p>
                ))}
                {item.suggestedCopy ? (
                  <p className="reentry-review__support">{item.suggestedCopy}</p>
                ) : null}
              </div>
              <div aria-label={`Re-entry actions for ${item.title}`} className="reentry-review__options">
                {item.actionOptions.map((option) => (
                  <Button
                    key={option}
                    onClick={() => handleAction(item.id, option)}
                    variant={item.recommendedAction === option ? 'primary' : 'secondary'}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              {feedbackById[item.id] ? (
                <p className="reentry-review__support" role="status">
                  {feedbackById[item.id]}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}

export function TodayScreen() {
  const { snapshot } = useAppSnapshot();
  const initialTodayViewModel = useMemo(() => buildTodayViewModel(snapshot), [snapshot]);
  const hasInitialTodayTask = Boolean(initialTodayViewModel.nextUsefulAction);
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
  const [mockMinimumAchieved, setMockMinimumAchieved] = useState(false);
  const [completionFeedback, setCompletionFeedback] = useState('');
  const [reentryFeedbackById, setReentryFeedbackById] = useState<Record<string, string>>({});
  const [linkedTaskPoolItemIds, setLinkedTaskPoolItemIds] = useState<string[]>([]);
  const [minimumChoiceTaskId, setMinimumChoiceTaskId] = useState<string | null>(null);
  const [backupFeedback, setBackupFeedback] = useState('');
  const [backupCheckJson, setBackupCheckJson] = useState('');
  const [backupCheckErrors, setBackupCheckErrors] = useState<string[]>([]);
  const [backupCheckPreview, setBackupCheckPreview] = useState<ActiveTaskBackupCheckPreview | null>(null);
  const [todayTasksReadState, setTodayTasksReadState] = useState<TodayTasksReadState>({ status: 'loading' });
  const [todayTasksReadAttempt, setTodayTasksReadAttempt] = useState(0);
  const taskWriteGenerationRef = useRef(0);
  const todayViewModel = useMemo(
    () => buildTodayViewModel(snapshot, { todayState }),
    [snapshot, todayState],
  );
  const reentryReviewPreview = useMemo(
    () =>
      buildTimeEdgeReentryPreviewViewModel({
        activeTasks: activeTasks.map(snapshotFromActiveTask),
      }, {
        noLongerNeededTaskIds: linkedTaskPoolItemIds,
      }),
    [activeTasks, linkedTaskPoolItemIds],
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
      if (status === 'minimumDone') setMockMinimumAchieved(true);
      setCompletionFeedback(feedback);
      if (status === 'minimumDone') setBoostOpen(false);
      return;
    }

    taskWriteGenerationRef.current += 1;
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
    if (status === 'minimumDone') {
      setBoostOpen(false);
      setMinimumChoiceTaskId(null);
    }
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

    taskWriteGenerationRef.current += 1;
    const result = await updateActiveTaskStatus(nextActiveTask.id, status);

    if (!result.ok) {
      setCompletionFeedback('Task state was not saved. Try again.');
      return;
    }

    refreshPersistedTasks(result.task, feedback);
    await repairPrivatePlanAfterTodayChange(
      status === 'done' ? 'completionChanged' : 'userCorrection',
      status === 'done'
        ? 'A Today task was completed.'
        : 'A Today choice changed which private work remains active.',
    );
  }

  async function applyReentryStatus(
    taskId: string,
    status: Extract<ActiveTaskStatus, 'parked' | 'notToday'>,
    feedback: string,
  ) {
    taskWriteGenerationRef.current += 1;
    const result = await updateActiveTaskStatus(taskId, status);

    if (!result.ok) {
      setCompletionFeedback('Task state was not saved. Try again.');
      return;
    }

    const updatedTasks = activeTasks.map((task) =>
      task.id === result.task.id ? result.task : task,
    );
    const visibleTasks = updatedTasks.filter(isVisibleActiveTask);

    setActiveTasks(updatedTasks);
    setMinimumChoiceTaskId((id) => id === taskId ? null : id);
    setCompletionFeedback(feedback);
    setBoostOpen(false);
    setReentryFeedbackById((feedbackById) => {
      const nextFeedback = { ...feedbackById };
      delete nextFeedback[taskId];
      return nextFeedback;
    });

    if (nextActiveTask?.id === taskId || !nextActiveTask) {
      showPersistedTask(visibleTasks[0] ?? null);
    }

    await repairPrivatePlanAfterTodayChange(
      'userCorrection',
      'A re-entry choice changed which private work remains active.',
    );
  }

  useEffect(() => {
    let active = true;
    const writeGenerationAtReadStart = taskWriteGenerationRef.current;

    setTodayTasksReadState({ status: 'loading' });

    loadActiveTodayTasksResult().then(async (result) => {
      if (!active) return;

      if (result.status === 'readFailed') {
        setTodayTasksReadState({ status: 'readFailed' });
        return;
      }

      const tasks = result.items;
      const completedReadState: TodayTasksReadState = result.status === 'partial'
        ? { invalidRecordCount: result.invalidRecordCount, status: 'partial' }
        : { status: 'ok' };

      if (tasks.length === 0) {
        if (taskWriteGenerationRef.current === writeGenerationAtReadStart) {
          setActiveTasks([]);
          setLinkedTaskPoolItemIds([]);
          if (!hasInitialTodayTask) showPersistedTask(null);
        }
        setTodayTasksReadState(completedReadState);
        return;
      }

      const linkedIds = await loadLinkedTaskPoolItemIds(tasks.map((task) => task.id));
      if (!active) return;

      if (taskWriteGenerationRef.current === writeGenerationAtReadStart) {
        setActiveTasks(tasks);
        setLinkedTaskPoolItemIds(linkedIds);
        showPersistedTask(tasks[0]);
        setCompletionFeedback('');
        setBoostOpen(false);
      }
      setTodayTasksReadState(completedReadState);
    }).catch(() => {
      if (active) setTodayTasksReadState({ status: 'readFailed' });
    });

    return () => {
      active = false;
    };
  }, [hasInitialTodayTask, todayTasksReadAttempt]);

  async function saveOneOffTask(input: MockAddTaskInput): Promise<boolean> {
    let candidate: ActiveTask;

    try {
      candidate = createOneOffActiveTask(input);
    } catch {
      setCompletionFeedback('One-off was not saved. Check the time edge or required fields.');
      return false;
    }

    taskWriteGenerationRef.current += 1;
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

    await repairPrivatePlanAfterTodayChange(
      'userCorrection',
      'A private one-off task was added from Today.',
    );

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

  async function markNormalDone() {
    await moveCurrentTaskOutOfToday('done', 'Normal done. That task is out of Today. No catch-up pile.');
  }

  async function markFullDone() {
    await moveCurrentTaskOutOfToday('done', 'Full done. That task is out of Today. No catch-up pile.');
  }

  async function parkTask() {
    await moveCurrentTaskOutOfToday('parked', 'Parked. It is safely held. No catch-up pile.');
  }

  async function notToday() {
    await moveCurrentTaskOutOfToday('notToday', 'Not today. It is out of the current list. No catch-up pile.');
  }

  async function parkReentryTask(taskId: string) {
    await applyReentryStatus(taskId, 'parked', 'Parked safely. Still safely held. No catch-up pile.');
  }

  async function markReentryTaskNotToday(taskId: string) {
    await applyReentryStatus(taskId, 'notToday', 'Marked not today. Still safely held. No catch-up pile.');
  }

  function tryReentryMinimum(taskId: string) {
    const task = activeTasks.find((candidate) => candidate.id === taskId);
    if (!task || task.minimumAchievedAt || task.status === 'minimumDone') return;

    showPersistedTask(task);
    setMinimumChoiceTaskId(taskId);
    setReentryFeedbackById((feedbackById) => ({
      ...feedbackById,
      [taskId]: 'Minimum selected. It has not been completed.',
    }));
  }

  function keepReentryTaskForReview(taskId: string) {
    setReentryFeedbackById((feedbackById) => ({
      ...feedbackById,
      [taskId]: 'Still safely held. Nothing changed.',
    }));
  }

  async function markReentryTaskNoLongerNeeded(taskId: string) {
    taskWriteGenerationRef.current += 1;
    const result = await markTaskLifecycleNoLongerNeeded(taskId);

    if (!result.ok || !result.task) {
      setCompletionFeedback('Task state was not saved. Try again.');
      return;
    }

    const updatedTasks = activeTasks.map((task) =>
      task.id === result.task?.id ? result.task : task,
    );
    const visibleTasks = updatedTasks.filter(isVisibleActiveTask);

    setActiveTasks(updatedTasks);
    setLinkedTaskPoolItemIds((ids) => ids.filter((id) => id !== taskId));
    setMinimumChoiceTaskId((id) => id === taskId ? null : id);
    setCompletionFeedback('No longer needed. It is out of Today. No catch-up pile.');
    setReentryFeedbackById((feedbackById) => {
      const nextFeedback = { ...feedbackById };
      delete nextFeedback[taskId];
      return nextFeedback;
    });

    if (nextActiveTask?.id === taskId || !nextActiveTask) {
      showPersistedTask(visibleTasks[0] ?? null);
    }

    await repairPrivatePlanAfterTodayChange(
      'userCorrection',
      'A user confirmed that a re-entry task is no longer needed.',
    );
  }

  async function exportTodayTasksBackup() {
    const result = await loadPersistedActiveTasksResult();

    if (result.status === 'readFailed') {
      setBackupFeedback('Saved Today tasks could not be loaded for backup. Nothing stored on this device was changed.');
      return;
    }

    if (result.status === 'partial') {
      setBackupFeedback('Today tasks backup was not created because some saved task data could not be read. Nothing stored on this device was changed.');
      return;
    }

    const tasks = result.items;

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
    setBackupFeedback('This Today tasks backup could not be used. Nothing changed on this device.');
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
      setBackupFeedback('This Today tasks backup could not be used. Nothing changed on this device.');
    }
  }

  return (
    <div className="screen-stack today-screen">
      <ScreenHero
        className="today-hero"
        eyebrow={todayLabel}
        tagline="One useful next action. The rest can stay light."
        title="Today"
        titleId="today-title"
      />

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

      {todayTasksReadState.status === 'partial' ? (
        <Card>
          <section
            aria-label="Saved Today task warning"
            className="surface-read-state surface-read-state--warning"
            role="status"
          >
            <h2>Some saved Today task data could not be read.</h2>
            <p>{todayTasksReadState.invalidRecordCount} saved task {todayTasksReadState.invalidRecordCount === 1 ? 'record was' : 'records were'} left unchanged.</p>
            <p>Nothing stored on this device was changed.</p>
            <Button onClick={() => setTodayTasksReadAttempt((attempt) => attempt + 1)}>Retry</Button>
          </section>
        </Card>
      ) : null}

      {todayTasksReadState.status === 'readFailed' && nextTask ? (
        <Card>
          <section
            aria-labelledby="today-local-read-warning-title"
            className="surface-read-state surface-read-state--warning"
            role="alert"
          >
            <h2 id="today-local-read-warning-title">Your saved Today tasks could not be loaded.</h2>
            <p>The independently loaded task remains available. Nothing stored on this device was changed.</p>
            <Button onClick={() => setTodayTasksReadAttempt((attempt) => attempt + 1)}>Retry</Button>
          </section>
        </Card>
      ) : null}

      {todayTasksReadState.status === 'loading' && nextTask ? (
        <p aria-busy="true" className="surface-read-state__inline" role="status">
          Loading your saved Today tasks...
        </p>
      ) : null}

      {todayTasksReadState.status === 'loading' && !nextTask ? (
        <Card>
          <section aria-busy="true" className="surface-read-state" role="status">
            <h2>Loading your saved Today tasks...</h2>
          </section>
        </Card>
      ) : todayTasksReadState.status === 'readFailed' && !nextTask ? (
        <Card>
          <section aria-labelledby="today-read-failed-title" className="surface-read-state surface-read-state--error" role="alert">
            <h2 id="today-read-failed-title">Your saved Today tasks could not be loaded.</h2>
            <p>Nothing stored on this device was changed.</p>
            <Button onClick={() => setTodayTasksReadAttempt((attempt) => attempt + 1)}>Retry</Button>
          </section>
        </Card>
      ) : nextTask ? (
        <>
          <section aria-label="Next useful action">
            <div className="today-action-heading">
              <p className="section-label">Next useful action</p>
            </div>
            <TaskCard
              minimumChoiceActive={minimumChoiceTaskId === nextTask.id}
              minimumAchieved={nextActiveTask
                ? Boolean(nextActiveTask.minimumAchievedAt || nextActiveTask.status === 'minimumDone')
                : mockMinimumAchieved}
              onKeepGoing={keepGoing}
              onMarkFullDone={markFullDone}
              onMarkMinimumDone={markMinimumDone}
              onMarkNormalDone={markNormalDone}
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
            <ReducedDayControl />
          </section>
          <ReentryReviewPreview
            feedbackById={reentryFeedbackById}
            onMarkNotToday={markReentryTaskNotToday}
            onNoLongerNeeded={markReentryTaskNoLongerNeeded}
            onParkSafely={parkReentryTask}
            onReviewLater={keepReentryTaskForReview}
            onTryMinimum={tryReentryMinimum}
            preview={reentryReviewPreview}
          />
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
      ) : todayTasksReadState.status === 'partial' ? (
        <Card>
          <section aria-labelledby="today-partial-capture-title" className="today-one-off">
            <div>
              <h2 id="today-partial-capture-title">Add a readable task for today</h2>
              <p>Unreadable saved rows remain unchanged while you add a separate today-only task.</p>
            </div>
            <Button onClick={() => setAddTaskOpen(true)} variant="primary">Add one-off</Button>
          </section>
        </Card>
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
            <p>Creates a local backup file for Today tasks only.</p>
            <p>It does not include Library rhythms, settings, or soft placements.</p>
          </div>
          <Button onClick={exportTodayTasksBackup}>Export Today tasks backup</Button>
        </section>
        <section aria-labelledby="today-backup-check-title" className="library-backup-checker">
          <div className="library-subheading">
            <h2 id="today-backup-check-title">Check Today tasks backup</h2>
            <p>Check only. Paste or select a Today tasks backup.</p>
            <p>Restore is not connected yet.</p>
          </div>
          <label className="library-backup-field">
            <span>Paste backup text</span>
            <textarea
              aria-label="Today task backup text"
              onChange={(event) => {
                setBackupCheckJson(event.target.value);
                setBackupCheckErrors([]);
                setBackupCheckPreview(null);
              }}
              placeholder="Paste a Today tasks backup file here."
              rows={6}
              value={backupCheckJson}
            />
            <small>Checking does not restore tasks or change this device.</small>
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
