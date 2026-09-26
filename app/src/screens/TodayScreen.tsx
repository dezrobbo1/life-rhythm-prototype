import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, Card, EmptyState, ScreenHero } from '../components';
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
import {
  buildCurrentLiveSchedulingContext,
  ensureCurrentPrivatePlan,
  repairCurrentPrivatePlan,
} from '../data/schedulerPlanCoordinator';
import { syncScheduledRhythmOccurrencesToToday } from '../data/rhythmTodayRepository';
import { loadSchedulerPlanState } from '../data/schedulerPlanStateRepository';
import { updateUserTaskDefinition } from '../data/taskDefinitionRepository';
import { reconcileTaskDefinitionAfterWrite } from '../data/taskDefinitionPlanReconciliation';
import { undoTodayPlanChange } from '../data/reducedDayCoordinator';
import {
  loadLinkedTaskPoolItemIds,
  markTaskLifecycleNoLongerNeeded,
} from '../data/taskLifecycleRepository';
import { ReducedDayControl } from '../features/today/ReducedDayControl';
import { currentLocalDate } from '../features/plan/softPlacementDate';
import { activeTaskSchema, type ActiveTask, type ActiveTaskStatus } from '../data/schemas';
import { type MockTask } from '../features/today/mockTodayData';
import { AddTaskModal, type MockAddTaskInput } from '../features/today/AddTaskModal';
import { resolveTaskVersions } from '../features/taskPool/taskVersionInput';
import { StartBoost } from '../features/today/StartBoost';
import { TaskCard, type TaskProgress } from '../features/today/TaskCard';
import {
  buildTodayCalmSurface,
  type TodayCalmSurface,
} from '../features/today/todayCalmSurface';
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

type TodayPlanReadState =
  | { status: 'loading' }
  | {
      status: 'ready';
      calendarRepairPending: boolean;
      taskInputRepairPending: boolean;
      rhythmInputRepairPending: boolean;
      readDate: string;
      refreshAt: number;
      surface: TodayCalmSurface;
      warnings: string[];
    }
  | { status: 'contextError'; errors: string[] };

// Anchor the deadline to the read's clock, not to the later effect setup.
// Otherwise a boundary crossed while awaiting storage would be skipped.
function nextTodayRefreshAt(readStartedAt: Date, nextBoundaryTime: string | null) {
  const midnight = new Date(readStartedAt);
  midnight.setHours(24, 0, 0, 0);
  let refreshAt = midnight.getTime();

  if (nextBoundaryTime) {
    const [hours, minutes] = nextBoundaryTime.split(':').map(Number);
    const boundary = new Date(readStartedAt);
    boundary.setHours(hours, minutes, 0, 0);
    if (boundary.getTime() > readStartedAt.getTime()) {
      refreshAt = Math.min(refreshAt, boundary.getTime());
    }
  }

  return refreshAt;
}

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
  if (normalized in areaLabels) return normalized as ActiveTaskArea;
  throw new Error('Choose a listed area.');
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
  const rhythmOccurrence = Boolean(task.sourceRhythmInstanceId);
  const plannedVariantKind = task.plannedVariantKind ?? 'normal';
  const plannedVariant = task[plannedVariantKind];
  const plannedVariantLabel = `${plannedVariantKind[0].toUpperCase()}${plannedVariantKind.slice(1)}`;
  return {
    ...neutralTaskDetails(),
    area: areaLabels[task.area],
    areaIcon: 'Task',
    chips: rhythmOccurrence
      ? ['Rhythm occurrence', `${plannedVariantLabel} planned`]
      : ['Minimum counts', 'Start small'],
    fullVersion: task.full.label,
    id: task.id,
    minimumVersion: task.minimum.label,
    normalVersion: task.normal.label,
    versionMinutes: { minimum: task.minimum.minutes, normal: task.normal.minutes, full: task.full.minutes },
    purpose: task.purpose ?? (rhythmOccurrence
      ? 'One occurrence of a rhythm saved on this device.'
      : 'One Today task saved on this device.'),
    recommendedSize: rhythmOccurrence
      ? `${plannedVariantLabel} planned · ${plannedVariant.minutes} min`
      : `${task.minimum.minutes} min minimum`,
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
    whyThis: rhythmOccurrence
      ? 'This is one planned occurrence. Completing it leaves the recurring rhythm intact.'
      : taskSourceDescription(task.source),
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
  const resolved = resolveTaskVersions(input);
  if (!resolved.ok) throw new Error(resolved.error);
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
    full: resolved.versions.full,
    id: createActiveTaskId('adhoc'),
    minimum: resolved.versions.minimum,
    normal: resolved.versions.normal,
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
    <section aria-labelledby="reentry-review-title" className="reentry-review today-calm-section">
      <div className="library-subheading">
        <p className="section-label">Review</p>
        <h2 id="reentry-review-title">Needs a choice</h2>
        <p>{preview.title}</p>
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
  );
}

type TodayScreenProps = {
  planRevision?: number;
};

export function TodayScreen({ planRevision = 0 }: TodayScreenProps = {}) {
  const { snapshot } = useAppSnapshot();
  const initialTodayViewModel = useMemo(() => buildTodayViewModel(snapshot), [snapshot]);
  const hasInitialTodayTask = Boolean(initialTodayViewModel.nextUsefulAction);
  const [boostOpen, setBoostOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<ActiveTask | null>(null);
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
  const [todayPlanReadState, setTodayPlanReadState] = useState<TodayPlanReadState>({ status: 'loading' });
  const [todayPlanReadAttempt, setTodayPlanReadAttempt] = useState(0);
  const [calendarRepairRetryBusy, setCalendarRepairRetryBusy] = useState(false);
  const [calendarRepairRetryError, setCalendarRepairRetryError] = useState('');
  const [planUndoBusy, setPlanUndoBusy] = useState(false);
  const [planUndoError, setPlanUndoError] = useState('');
  const [reducedDayRefreshVersion, setReducedDayRefreshVersion] = useState(0);
  const [todayDisplayClock, setTodayDisplayClock] = useState(() => new Date());
  const todayDisplayClockRef = useRef(todayDisplayClock);
  const taskWriteGenerationRef = useRef(0);
  const planReadGenerationRef = useRef(0);
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
      }).format(todayDisplayClock),
    [todayDisplayClock],
  );

  function refreshTodayPlanFacts() {
    const now = new Date();
    // Date presentation must recover even when optional plan reads fail or
    // Retry runs before a suspended timer. Do not reset mode on same-day reads.
    if (currentLocalDate(now) !== currentLocalDate(todayDisplayClockRef.current)) {
      setReducedDayRefreshVersion((version) => version + 1);
    }
    todayDisplayClockRef.current = now;
    setTodayDisplayClock(now);
    planReadGenerationRef.current += 1;
    setTodayPlanReadAttempt((attempt) => attempt + 1);
  }

  async function retryPendingCalendarRepair() {
    setCalendarRepairRetryBusy(true);
    setCalendarRepairRetryError('');

    try {
      const repaired = await repairCurrentPrivatePlan({
        reason: 'Retry the saved calendar change using current scheduling information.',
        trigger: 'calendarChanged',
      });
      if (!repaired.ok) {
        setCalendarRepairRetryError(repaired.errors.join(' '));
      }
    } catch {
      setCalendarRepairRetryError('The flexible private plan could not be repaired.');
    } finally {
      setCalendarRepairRetryBusy(false);
      refreshTodayPlanFacts();
    }
  }

  async function retryPendingTaskInputRepair() {
    setCalendarRepairRetryBusy(true);
    setCalendarRepairRetryError('');
    try {
      const repaired = await repairCurrentPrivatePlan({
        reason: 'Retry the corrected task definition using current scheduling information.',
        trigger: 'taskDefinitionChanged',
      });
      if (!repaired.ok) setCalendarRepairRetryError(repaired.errors.join(' '));
    } catch {
      setCalendarRepairRetryError('The flexible private plan could not be updated.');
    } finally {
      setCalendarRepairRetryBusy(false);
      refreshTodayPlanFacts();
    }
  }

  async function retryPendingRhythmInputRepair() {
    setCalendarRepairRetryBusy(true);
    setCalendarRepairRetryError('');
    try {
      const repaired = await repairCurrentPrivatePlan({
        reason: 'Retry the saved rhythm change using current scheduling information.',
        trigger: 'rhythmDefinitionChanged',
      });
      if (!repaired.ok) setCalendarRepairRetryError(repaired.errors.join(' '));
    } catch {
      setCalendarRepairRetryError('The flexible private plan could not be updated.');
    } finally {
      setCalendarRepairRetryBusy(false);
      refreshTodayPlanFacts();
    }
  }

  async function repairAndRefreshPrivatePlanAfterTodayChange(
    trigger: 'completionChanged' | 'userCorrection',
    reason: string,
  ) {
    await repairPrivatePlanAfterTodayChange(trigger, reason);
    refreshTodayPlanFacts();
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
    if (result.task.sourceRhythmInstanceId) {
      await repairAndRefreshPrivatePlanAfterTodayChange(
        'userCorrection',
        'A rhythm occurrence changed its current execution state.',
      );
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
    await repairAndRefreshPrivatePlanAfterTodayChange(
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

    await repairAndRefreshPrivatePlanAfterTodayChange(
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

  useEffect(() => {
    const generation = planReadGenerationRef.current + 1;
    planReadGenerationRef.current = generation;
    const readStartedAt = new Date();
    const readDate = currentLocalDate(readStartedAt);
    let active = true;

    setTodayPlanReadState({ status: 'loading' });

    Promise.all([
      buildCurrentLiveSchedulingContext({
        horizonDays: 1,
        planningPolicy: { dayMode: 'normal' },
        readOnly: true,
      }),
      loadSchedulerPlanState(),
    ]).then(async ([live, saved]) => {
      if (!active || planReadGenerationRef.current !== generation) return;

      let currentSaved = saved;
      if (saved.status === 'ok' && saved.plan.placements.some((placement) =>
        placement.targetKind === 'rhythm' && placement.rhythmInstanceId && placement.date === readDate,
      )) {
        const synced = await syncScheduledRhythmOccurrencesToToday(saved.plan, readDate);
        if (!synced.ok) throw new Error(synced.errors.join(' '));
        if (synced.mutated) {
          setTodayTasksReadAttempt((attempt) => attempt + 1);
          const reconciled = await ensureCurrentPrivatePlan();
          if (!reconciled.ok) throw new Error(reconciled.errors.join(' '));
          currentSaved = await loadSchedulerPlanState();
        }
      }

      // A suspended read may finish on another local date. Do not install
      // yesterday's snapshot and then wait until tomorrow to refresh it.
      const completedAt = new Date();
      if (currentLocalDate(completedAt) !== readDate) {
        refreshTodayPlanFacts();
        return;
      }

      if (!live.ok) {
        setTodayPlanReadState({ status: 'contextError', errors: live.errors });
        return;
      }

      const calendarRepairPending = currentSaved.status === 'ok' && Boolean(currentSaved.calendarRepairPendingAt);
      const taskInputRepairPending = currentSaved.status === 'ok' && Boolean(currentSaved.taskInputRepairPendingAt);
      const rhythmInputRepairPending = currentSaved.status === 'ok' && Boolean(currentSaved.rhythmInputRepairPendingAt);
      const planStatus = currentSaved.status === 'ok'
        ? calendarRepairPending || taskInputRepairPending || rhythmInputRepairPending
          ? 'error' as const
          : 'available' as const
        : currentSaved.status;
      const surface = buildTodayCalmSurface({
        date: live.now.date,
        nowTime: live.now.time,
        input: live.context.input,
        planStatus,
        plan: currentSaved.status === 'ok' && !calendarRepairPending && !taskInputRepairPending && !rhythmInputRepairPending
          ? currentSaved.plan
          : null,
        titleByTargetId: live.context.titleByTargetId,
        currentTaskTargetId: nextActiveTask?.id ?? nextTask?.id,
      });

      const refreshAt = nextTodayRefreshAt(readStartedAt, surface.nextBoundaryTime);
      if (refreshAt <= completedAt.getTime()) {
        refreshTodayPlanFacts();
        return;
      }

      setTodayPlanReadState({
        status: 'ready',
        calendarRepairPending,
        taskInputRepairPending,
        rhythmInputRepairPending,
        readDate,
        refreshAt,
        surface,
        warnings: live.context.warnings,
      });
    }).catch(() => {
      if (active && planReadGenerationRef.current === generation) {
        setTodayPlanReadState({
          status: 'contextError',
          errors: ['Today’s plan context could not be read.'],
        });
      }
    });

    return () => {
      active = false;
    };
  }, [nextActiveTask?.id, nextTask?.id, planRevision, todayPlanReadAttempt]);

  useEffect(() => {
    // A date-boundary timer exists in loading/error states too. A ready plan
    // may refine that deadline to an earlier factual placement boundary.
    const displayedClock = todayDisplayClockRef.current;
    const readDate = todayPlanReadState.status === 'ready'
      ? todayPlanReadState.readDate
      : currentLocalDate(displayedClock);
    const refreshAt = todayPlanReadState.status === 'ready'
      ? todayPlanReadState.refreshAt
      : nextTodayRefreshAt(displayedClock, null);
    const now = new Date();

    // Preserve expired deadlines, including a day change while no plan was
    // ready. The refresh path compares the actual date with the displayed one.
    if (currentLocalDate(displayedClock) !== currentLocalDate(now) ||
        readDate !== currentLocalDate(now) || refreshAt <= now.getTime()) {
      refreshTodayPlanFacts();
      return undefined;
    }

    const timeout = window.setTimeout(
      refreshTodayPlanFacts,
      Math.max(1, refreshAt - now.getTime()),
    );

    return () => window.clearTimeout(timeout);
  }, [todayPlanReadState]);

  async function saveOneOffTask(input: MockAddTaskInput): Promise<boolean> {
    let candidate: ActiveTask;

    try {
      candidate = createOneOffActiveTask(input);
    } catch {
      setCompletionFeedback('One-off was not saved. Check the time edge or required fields.');
      return false;
    }

    taskWriteGenerationRef.current += 1;
    let result;
    try {
      result = await saveActiveTodayTask(candidate);
    } catch {
      setCompletionFeedback('One-off was not saved. Check device storage.');
      return false;
    }

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

    try {
      const repaired = await repairCurrentPrivatePlan({
        trigger: 'taskDefinitionChanged',
        reason: 'A private one-off task was added from Today.',
      });
      if (!repaired.ok) setCompletionFeedback('One-off saved. The private plan needs updating.');
    } catch {
      setCompletionFeedback('One-off saved. The private plan needs updating.');
    }
    refreshTodayPlanFacts();

    return true;
  }

  async function saveCorrectedOneOff(input: MockAddTaskInput): Promise<boolean | string> {
    if (!editTask) return 'Reopen the task before editing.';
    const parsed = resolveTaskVersions(input);
    if (!parsed.ok) {
      setCompletionFeedback(parsed.error);
      return parsed.error;
    }
    taskWriteGenerationRef.current += 1;
    const saved = await updateUserTaskDefinition(editTask.id, editTask.updatedAt, 'today', {
      title: input.title,
      area: areaFromInput(input.area),
      ...parsed.versions,
      ...(editTask.purpose ? { purpose: editTask.purpose } : {}),
      ...(input.timeConstraint ? { timeConstraint: input.timeConstraint } : {}),
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      ...(input.fixedAt ? { fixedAt: input.fixedAt } : {}),
      ...(input.expiresAfter ? { expiresAfter: input.expiresAfter } : {}),
      ...(input.latestUsefulStartAt ? { latestUsefulStartAt: input.latestUsefulStartAt } : {}),
      ...(input.notUsefulAfter ? { notUsefulAfter: input.notUsefulAfter } : {}),
      ...(input.minimumStillUsefulAfterDeadline ? { minimumStillUsefulAfterDeadline: true } : {}),
      ...(input.missedPolicy ? { missedPolicy: input.missedPolicy } : {}),
    });
    if (!saved.ok || !saved.task) return saved.ok
      ? 'Task correction could not be saved.'
      : saved.errors.join(' ');
    setEditTask(null);
    setActiveTasks((current) => current.map((task) => task.id === saved.task!.id ? saved.task! : task));
    if (nextActiveTask?.id === saved.task.id) showPersistedTask(saved.task);
    const repaired = await reconcileTaskDefinitionAfterWrite('A user corrected a Today task definition.');
    setCompletionFeedback(repaired.ok
      ? 'Task corrected. The private plan is up to date.'
      : `Task corrected. The private plan needs updating. ${repaired.message ?? ''}`);
    refreshTodayPlanFacts();
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

    await repairAndRefreshPrivatePlanAfterTodayChange(
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

  function handleReducedDayPlanChanged() {
    refreshTodayPlanFacts();
  }

  async function undoLatestPrivatePlanChange() {
    if (planUndoBusy) return;

    setPlanUndoBusy(true);
    setPlanUndoError('');
    const result = await undoTodayPlanChange();
    setPlanUndoBusy(false);

    if (!result.ok) {
      setPlanUndoError(result.errors[0] ?? 'The latest private-plan change could not be undone.');
      return;
    }

    setCompletionFeedback('The latest private-plan change was undone.');
    setReducedDayRefreshVersion((version) => version + 1);
    refreshTodayPlanFacts();
  }

  const todayPlanSurface = todayPlanReadState.status === 'ready'
    ? todayPlanReadState.surface
    : null;

  return (
    <div className="screen-stack today-screen">
      <ScreenHero
        className="today-hero"
        eyebrow={todayLabel}
        tagline="One useful next action. The rest can stay light."
        title="Today"
        titleId="today-title"
      />

      {completionFeedback ? <p className="today-feedback" role="status">{completionFeedback}</p> : null}

      <section aria-labelledby="today-now-title" className="today-calm-section today-now">
        <div className="today-calm-section__heading">
          <p className="section-label">Current focus</p>
          <h2 id="today-now-title">Now</h2>
        </div>

        {todayPlanSurface?.currentCommitments.map((commitment) => (
          <div aria-label="Current fixed commitment" className="today-now__commitment surface-ledger-row" key={commitment.id}>
            <div className="surface-ledger-row__main">
              <strong>{commitment.title}</strong>
              <span>{commitment.detail}</span>
            </div>
            <span className="surface-ledger-row__meta surface-time">
              {commitment.start}–{commitment.end}
            </span>
          </div>
        ))}

        {todayPlanSurface?.currentPrivatePlacements.length ? (
          <section aria-label="Scheduled for this time" className="today-now__scheduled">
            <p className="section-label">Scheduled for this time</p>
            <div className="surface-ledger today-now__scheduled-list">
              {todayPlanSurface.currentPrivatePlacements.map((item) => (
                <div className={`surface-ledger-row today-now__commitment today-now__commitment--${item.kind}`} key={item.id}>
                  <div className="surface-ledger-row__main">
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <span className="surface-ledger-row__meta surface-time">
                    {item.start}–{item.end}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {todayTasksReadState.status === 'partial' ? (
          <section
            aria-label="Saved Today task warning"
            className="surface-read-state surface-read-state--warning"
            role="status"
          >
            <h3>Some saved Today task data could not be read.</h3>
            <p>{todayTasksReadState.invalidRecordCount} saved task {todayTasksReadState.invalidRecordCount === 1 ? 'record was' : 'records were'} left unchanged.</p>
            <p>Nothing stored on this device was changed.</p>
            <Button onClick={() => setTodayTasksReadAttempt((attempt) => attempt + 1)}>Retry</Button>
          </section>
        ) : null}

        {todayTasksReadState.status === 'readFailed' && nextTask ? (
          <section
            aria-labelledby="today-local-read-warning-title"
            className="surface-read-state surface-read-state--warning"
            role="alert"
          >
            <h3 id="today-local-read-warning-title">Your saved Today tasks could not be loaded.</h3>
            <p>The independently loaded task remains available. Nothing stored on this device was changed.</p>
            <Button onClick={() => setTodayTasksReadAttempt((attempt) => attempt + 1)}>Retry</Button>
          </section>
        ) : null}

        {todayTasksReadState.status === 'loading' && nextTask ? (
          <p aria-busy="true" className="surface-read-state__inline" role="status">
            Loading your saved Today tasks...
          </p>
        ) : null}

        {todayTasksReadState.status === 'loading' && !nextTask ? (
          <Card variant="primary">
          <section aria-busy="true" className="surface-read-state" role="status">
            <h3>Loading your saved Today tasks...</h3>
          </section>
          </Card>
        ) : todayTasksReadState.status === 'readFailed' && !nextTask ? (
          <Card variant="primary">
          <section aria-labelledby="today-read-failed-title" className="surface-read-state surface-read-state--error" role="alert">
            <h3 id="today-read-failed-title">Your saved Today tasks could not be loaded.</h3>
            <p>Nothing stored on this device was changed.</p>
            <Button onClick={() => setTodayTasksReadAttempt((attempt) => attempt + 1)}>Retry</Button>
          </section>
          </Card>
        ) : nextTask ? (
          <>
            <TaskCard
              onEditTask={nextActiveTask?.source === 'adhoc' ? () => setEditTask(nextActiveTask) : undefined}
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
            />
            {activeTasks.some((task) => isVisibleActiveTask(task) && task.source === 'adhoc' && task.id !== nextActiveTask?.id) ? (
              <section aria-label="Other saved Today tasks" className="today-other-tasks">
                <h3>Other saved Today tasks</h3>
                <ul>
                  {activeTasks.filter((task) => isVisibleActiveTask(task) && task.source === 'adhoc' && task.id !== nextActiveTask?.id)
                    .map((task) => (
                      <li key={task.id}>
                        <span>{task.title} · Minimum {task.minimum.minutes} min</span>
                        <Button onClick={() => setEditTask(task)}>Edit task</Button>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}
            <div className="today-now__secondary surface-actions">
              <Button onClick={() => setAddTaskOpen(true)} variant="quiet">Add one-off</Button>
              <span>Add one today-only task. It will not go into Library.</span>
            </div>
          </>
        ) : todayTasksReadState.status === 'partial' ? (
          <Card variant="primary">
          <section aria-labelledby="today-partial-capture-title" className="today-one-off">
            <div>
              <h3 id="today-partial-capture-title">Add a readable task for today</h3>
              <p>Unreadable saved rows remain unchanged while you add a separate today-only task.</p>
            </div>
            <Button onClick={() => setAddTaskOpen(true)} variant="primary">Add one-off</Button>
          </section>
          </Card>
        ) : (
          <Card variant="primary">
            <EmptyState
              action={<Button onClick={() => setAddTaskOpen(true)} variant="primary">{initialTodayViewModel.emptyState.primaryActionLabel}</Button>}
              headingLevel={3}
              message={initialTodayViewModel.emptyState.message}
              title={initialTodayViewModel.emptyState.title}
            />
          </Card>
        )}

        <ReducedDayControl
          onPlanChanged={handleReducedDayPlanChanged}
          refreshVersion={reducedDayRefreshVersion}
          showUndo={Boolean(
            todayPlanReadState.status === 'ready' &&
            todayPlanSurface?.later.planStatus === 'available' &&
            !todayPlanSurface.changed
          )}
        />
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

      <section aria-labelledby="today-later-title" className="today-calm-section today-later">
        <div className="today-calm-section__heading">
          <p className="section-label">Recorded next</p>
          <h2 id="today-later-title">Later</h2>
        </div>
        {todayPlanReadState.status === 'loading' ? (
          <p aria-busy="true" className="surface-read-state__inline" role="status">Reading today’s recorded plan...</p>
        ) : todayPlanReadState.status === 'contextError' ? (
          <div className="surface-read-state surface-read-state--error" role="alert">
            <h3>Later and Changed could not be read.</h3>
            <p>Now remains available. Nothing stored on this device was changed.</p>
            <Button onClick={refreshTodayPlanFacts}>Retry</Button>
          </div>
        ) : (
          <>
            {todayPlanReadState.calendarRepairPending ? (
              <div className="surface-read-state surface-read-state--error" role="alert">
                <h3>The flexible private plan needs repair after a calendar change.</h3>
                <p>Now remains available. Fixed and user-confirmed facts can still appear, but automatic private placements are hidden until repair succeeds.</p>
                {calendarRepairRetryError ? <p>{calendarRepairRetryError}</p> : null}
                <Button
                  disabled={calendarRepairRetryBusy}
                  onClick={() => { void retryPendingCalendarRepair(); }}
                >
                  {calendarRepairRetryBusy ? 'Repairing...' : 'Retry repair'}
                </Button>
              </div>
            ) : todayPlanSurface?.later.planStatus === 'invalid' || todayPlanSurface?.later.planStatus === 'error' ? (
              todayPlanReadState.rhythmInputRepairPending ? (
                <div className="surface-read-state surface-read-state--error" role="alert">
                  <h3>The flexible private plan needs updating after a rhythm change.</h3>
                  <p>Today work remains available. Automatic placements are hidden until the plan is repaired.</p>
                  {calendarRepairRetryError ? <p>{calendarRepairRetryError}</p> : null}
                  <Button disabled={calendarRepairRetryBusy} onClick={() => { void retryPendingRhythmInputRepair(); }}>
                    {calendarRepairRetryBusy ? 'Updating...' : 'Retry repair'}
                  </Button>
                </div>
              ) : todayPlanReadState.taskInputRepairPending ? (
                <div className="surface-read-state surface-read-state--error" role="alert">
                  <h3>The flexible private plan needs updating after a task change.</h3>
                  <p>Today tasks remain available. Automatic placements are hidden until the plan is repaired.</p>
                  {calendarRepairRetryError ? <p>{calendarRepairRetryError}</p> : null}
                  <Button disabled={calendarRepairRetryBusy} onClick={() => { void retryPendingTaskInputRepair(); }}>
                    {calendarRepairRetryBusy ? 'Updating...' : 'Retry repair'}
                  </Button>
                </div>
              ) :
              <div className="surface-read-state surface-read-state--error" role="alert">
                <h3>The saved private plan could not be read.</h3>
                <p>Fixed and user-confirmed facts can still appear. Flexible Later items and Changed are unavailable.</p>
                <Button onClick={refreshTodayPlanFacts}>Retry</Button>
              </div>
            ) : null}
            {todayPlanSurface?.later.planStatus === 'missing' ? (
              <p className="surface-copy">No saved private plan is available. Fixed and user-confirmed facts can still appear.</p>
            ) : null}
            {todayPlanReadState.warnings.length > 0 ? (
              <div className="surface-read-state surface-read-state--warning" role="status">
                <h3>Some calendar or planning facts could not be shown.</h3>
                <p>Review Plan before relying on this list. Nothing stored on this device was changed.</p>
              </div>
            ) : null}
            {todayPlanSurface && todayPlanSurface.later.items.length > 0 ? (
              <ul aria-label="Later today" className="surface-ledger today-calm-ledger">
                {todayPlanSurface.later.items.map((item) => (
                  <li className={`surface-ledger-row today-calm-ledger__row today-calm-ledger__row--${item.kind}`} key={item.id}>
                    <div className="surface-ledger-row__main">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <span className="surface-ledger-row__meta surface-time">{item.start}–{item.end}</span>
                  </li>
                ))}
              </ul>
            ) : todayPlanSurface?.later.planStatus === 'available' && todayPlanReadState.warnings.length === 0 ? (
              <p className="surface-copy">Nothing else is recorded for later today.</p>
            ) : null}
            {todayPlanSurface && todayPlanSurface.later.remainingCount > 0 ? (
              <p className="today-later__more">+{todayPlanSurface.later.remainingCount} more in Plan</p>
            ) : null}
            <p className="today-later__boundary">Only recorded commitments and accepted private placements appear here. Blank gaps are not availability.</p>
          </>
        )}
      </section>

      {todayPlanSurface?.changed ? (
        <section aria-labelledby="today-changed-title" className="today-calm-section today-changed">
          <div className="today-calm-section__heading">
            <p className="section-label">Latest saved repair</p>
            <h2 id="today-changed-title">Changed</h2>
            <p>{todayPlanSurface.changed.attribution}</p>
          </div>
          <ul aria-label="Latest private-plan changes" className="surface-ledger today-calm-ledger">
            {todayPlanSurface.changed.items.map((item, index) => (
              <li className="surface-ledger-row today-calm-ledger__row" key={`${item.kind}:${item.title}:${index}`}>
                <div className="surface-ledger-row__main">
                  <strong>{item.title}</strong>
                  <span>{item.summary}</span>
                  <small>{item.reason}</small>
                </div>
              </li>
            ))}
          </ul>
          {todayPlanSurface.changed.canUndo ? (
            <div className="surface-actions">
              <Button disabled={planUndoBusy} onClick={() => void undoLatestPrivatePlanChange()}>
                {planUndoBusy ? 'Restoring' : 'Undo last change'}
              </Button>
            </div>
          ) : null}
          {planUndoError ? <p className="reduced-day-control__error" role="alert">{planUndoError}</p> : null}
        </section>
      ) : null}

      <details className="today-recovery">
        <summary>More / Recovery</summary>
        <div className="today-recovery__content">
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
                <div><dt>Tasks</dt><dd>{backupCheckPreview.items.length}</dd></div>
                <div><dt>Created</dt><dd>{backupCheckPreview.exportedAt}</dd></div>
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
                  {backupCheckErrors.slice(0, 3).map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
          {backupFeedback ? <p className="today-feedback" role="status">{backupFeedback}</p> : null}
        </div>
      </details>

      {nextTask ? <StartBoost open={boostOpen} task={nextTask} onClose={() => setBoostOpen(false)} /> : null}
      <AddTaskModal onClose={() => setAddTaskOpen(false)} onSave={saveOneOffTask} open={addTaskOpen} />
      {editTask ? <AddTaskModal
        key={editTask.id}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSave={saveCorrectedOneOff}
        open
      /> : null}
    </div>
  );
}
