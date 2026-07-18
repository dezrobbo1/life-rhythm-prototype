import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components';
import {
  bringTaskPoolItemToToday,
  markTaskLifecycleNoLongerNeeded,
} from '../../data/taskLifecycleRepository';
import { deferTaskPoolItem } from '../../data/taskPoolDeferralRepository';
import { loadAllSoftPlacements } from '../../data/softPlacementRepository';
import {
  createTaskPoolItemId,
  loadTaskPoolItems,
  saveTaskPoolItem,
} from '../../data/taskPoolRepository';
import type { SoftPlacement, TaskPoolItem, TaskPoolItemStatus } from '../../data/schemas';
import { TaskPoolCaptureModal, type TaskPoolCaptureInput } from './TaskPoolCaptureModal';
import { TaskPoolDeferModal } from './TaskPoolDeferModal';
import {
  buildTaskPoolResurfacingGroups,
  isTaskPoolItemReadyToRevisit,
  nextTaskPoolResurfacingAt,
} from './taskPoolResurfacing';

type TaskPoolFeedback = {
  kind: 'error' | 'success';
  lines: string[];
};

type TaskPoolPanelProps = {
  onOpenPlan?: (taskId: string, placementDate?: string) => void;
};

const navigableSoftPlacementStatuses = new Set<SoftPlacement['status']>([
  'planned',
  'moved',
  'completedFromToday',
]);

function placementDatesByTaskId(placements: SoftPlacement[]) {
  return placements
    .filter((placement) => navigableSoftPlacementStatuses.has(placement.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .reduce<Record<string, string>>((dates, placement) => {
      if (!dates[placement.taskId]) {
        dates[placement.taskId] = placement.date;
      }

      return dates;
    }, {});
}

const taskPoolStatusLabels: Record<TaskPoolItemStatus, string> = {
  captured: 'Safely held',
  deferred: 'Bring back later',
  noLongerNeeded: 'No longer needed',
  notToday: 'Not today',
  parked: 'Parked',
  softPlaced: 'Softly placed',
  suggested: 'Suggested',
  today: 'In Today',
};

const taskPoolAreaLabels: Record<TaskPoolItem['area'], string> = {
  admin: 'Admin',
  antidrift: 'Anti-scroll',
  emotion: 'Emotional recovery',
  food: 'Food',
  health: 'Health',
  house: 'Home',
  money: 'Money',
  movement: 'Movement',
  other: 'Other',
  sensory: 'Sensory load',
  social: 'Social',
  work: 'Work',
};

function formatTaskPoolDateTime(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function taskPoolUsefulWindowLines(item: TaskPoolItem) {
  return [
    item.dueAt ? `Useful before ${formatTaskPoolDateTime(item.dueAt)}` : '',
    item.notUsefulAfter ? `Useful until ${formatTaskPoolDateTime(item.notUsefulAfter)}` : '',
    item.minimumStillUsefulAfterDeadline ? 'Minimum still helps' : '',
    item.bringBackAfter ? `Bring back after ${formatTaskPoolDateTime(item.bringBackAfter)}` : '',
  ].filter(Boolean);
}

function moveToTodayLabel(item: TaskPoolItem) {
  return ['parked', 'notToday', 'deferred'].includes(item.status)
    ? 'Bring to Today'
    : 'Add to Today';
}

function softWindowLabel(item: TaskPoolItem) {
  return item.status === 'softPlaced' ? 'View in Plan' : 'Find soft window';
}

function deferralLabel(item: TaskPoolItem) {
  return item.status === 'deferred' ? 'Choose another time' : 'Bring back later';
}

function statusLabel(item: TaskPoolItem, nowMs: number) {
  return isTaskPoolItemReadyToRevisit(item, nowMs)
    ? 'Ready to revisit'
    : taskPoolStatusLabels[item.status];
}

export function TaskPoolPanel({ onOpenPlan }: TaskPoolPanelProps = {}) {
  const [taskPoolCaptureOpen, setTaskPoolCaptureOpen] = useState(false);
  const [taskPoolFeedback, setTaskPoolFeedback] = useState<TaskPoolFeedback | null>(null);
  const [taskPoolItems, setTaskPoolItems] = useState<TaskPoolItem[]>([]);
  const [softPlacementDates, setSoftPlacementDates] = useState<Record<string, string>>({});
  const [markingTaskPoolItemId, setMarkingTaskPoolItemId] = useState<string | null>(null);
  const [movingTaskPoolItemId, setMovingTaskPoolItemId] = useState<string | null>(null);
  const [deferringTaskPoolItemId, setDeferringTaskPoolItemId] = useState<string | null>(null);
  const [deferItem, setDeferItem] = useState<TaskPoolItem | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const visibleGroups = useMemo(
    () => buildTaskPoolResurfacingGroups(taskPoolItems, clockMs),
    [clockMs, taskPoolItems],
  );

  const refreshTaskPoolItems = useCallback(async () => {
    const [items, placements] = await Promise.all([
      loadTaskPoolItems(),
      loadAllSoftPlacements(),
    ]);
    setTaskPoolItems(items);
    setSoftPlacementDates(placementDatesByTaskId(placements));
    setClockMs(Date.now());
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      loadTaskPoolItems(),
      loadAllSoftPlacements(),
    ])
      .then(([items, placements]) => {
        if (active) {
          setTaskPoolItems(items);
          setSoftPlacementDates(placementDatesByTaskId(placements));
          setClockMs(Date.now());
        }
      })
      .catch(() => {
        if (active) {
          setTaskPoolItems([]);
          setSoftPlacementDates({});
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextResurfacingAt = nextTaskPoolResurfacingAt(taskPoolItems, clockMs);

    if (nextResurfacingAt === null) return undefined;

    const delay = Math.min(
      Math.max(nextResurfacingAt - Date.now() + 250, 250),
      2_147_000_000,
    );
    const timer = setTimeout(() => setClockMs(Date.now()), delay);

    return () => clearTimeout(timer);
  }, [clockMs, taskPoolItems]);

  const saveCapturedTask = useCallback(async (input: TaskPoolCaptureInput): Promise<boolean> => {
    setTaskPoolFeedback(null);

    const timestamp = new Date().toISOString();
    const minimum = input.minimumVersion;
    const normal = input.normalVersion || minimum;
    const full = input.fullVersion || normal;
    const result = await saveTaskPoolItem({
      area: input.area,
      createdAt: timestamp,
      full: {
        label: full,
        minutes: 20,
      },
      id: createTaskPoolItemId('captured'),
      minimum: {
        label: minimum,
        minutes: 5,
      },
      normal: {
        label: normal,
        minutes: 10,
      },
      ...(input.dueAt ? { dueAt: input.dueAt, timeConstraint: 'dueBy' } : {}),
      ...(input.minimumStillUsefulAfterDeadline ? { minimumStillUsefulAfterDeadline: true } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.notUsefulAfter ? { notUsefulAfter: input.notUsefulAfter } : {}),
      ...(input.purpose ? { purpose: input.purpose } : {}),
      source: 'adhoc',
      status: 'captured',
      title: input.title,
      updatedAt: timestamp,
    });

    if (!result.ok) {
      setTaskPoolFeedback({
        kind: 'error',
        lines: ['Task was not captured. Check the required fields.'],
      });
      return false;
    }

    await refreshTaskPoolItems();
    setTaskPoolCaptureOpen(false);
    setTaskPoolFeedback({
      kind: 'success',
      lines: ['Task captured. It is safely held.'],
    });
    return true;
  }, [refreshTaskPoolItems]);

  const moveTaskToToday = useCallback(async (item: TaskPoolItem) => {
    setMovingTaskPoolItemId(item.id);
    setTaskPoolFeedback(null);

    try {
      const result = await bringTaskPoolItemToToday(item.id);

      if (!result.ok) {
        setTaskPoolFeedback({
          kind: 'error',
          lines: ['Task was not added to Today. Nothing else changed.'],
        });
        return;
      }

      setTaskPoolItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === result.item.id ? result.item : currentItem,
        ),
      );
      setClockMs(Date.now());
      setTaskPoolFeedback({
        kind: 'success',
        lines: result.alreadyInToday
          ? ['This task is already in Today. Nothing else changed.']
          : ['Added to Today.', 'Park or mark it Not today to return it here safely.'],
      });
    } catch {
      setTaskPoolFeedback({
        kind: 'error',
        lines: ['Task was not added to Today. Nothing else changed.'],
      });
    } finally {
      setMovingTaskPoolItemId(null);
    }
  }, []);

  const saveTaskDeferral = useCallback(async (bringBackAfter: string): Promise<boolean> => {
    if (!deferItem) return false;

    setDeferringTaskPoolItemId(deferItem.id);
    setTaskPoolFeedback(null);

    try {
      const result = await deferTaskPoolItem(deferItem.id, bringBackAfter);

      if (!result.ok) {
        setTaskPoolFeedback({
          kind: 'error',
          lines: ['The task was not held for later. Nothing else changed.'],
        });
        return false;
      }

      setTaskPoolItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === result.item.id ? result.item : currentItem,
        ),
      );
      setClockMs(Date.now());
      setDeferItem(null);
      setTaskPoolFeedback({
        kind: 'success',
        lines: [
          `Held until ${formatTaskPoolDateTime(result.item.bringBackAfter ?? bringBackAfter)}.`,
          'Nothing moves into Today automatically.',
        ],
      });
      return true;
    } catch {
      setTaskPoolFeedback({
        kind: 'error',
        lines: ['The task was not held for later. Nothing else changed.'],
      });
      return false;
    } finally {
      setDeferringTaskPoolItemId(null);
    }
  }, [deferItem]);

  const markCapturedTaskNoLongerNeeded = useCallback(async (item: TaskPoolItem) => {
    setMarkingTaskPoolItemId(item.id);
    setTaskPoolFeedback(null);

    try {
      const result = await markTaskLifecycleNoLongerNeeded(item.id);

      if (result.ok) {
        setTaskPoolItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === result.item.id ? result.item : currentItem,
          ),
        );
        setTaskPoolFeedback({
          kind: 'success',
          lines: ['Marked no longer needed. Nothing else changed.'],
        });
        return;
      }

      setTaskPoolFeedback({
        kind: 'error',
        lines: ['Task pool item was not changed. Nothing else changed.'],
      });
    } catch {
      setTaskPoolFeedback({
        kind: 'error',
        lines: ['Task pool item was not changed. Nothing else changed.'],
      });
    } finally {
      setMarkingTaskPoolItemId(null);
    }
  }, []);

  return (
    <section className="task-pool task-pool--holding-tray" aria-labelledby="task-pool-title">
      <div className="task-pool__header">
        <div>
          <h2 id="task-pool-title">Captured tasks</h2>
        </div>
        <Button onClick={() => setTaskPoolCaptureOpen(true)} variant="primary">Capture task</Button>
      </div>

      {visibleGroups.length > 0 ? (
        <div className="task-pool__groups">
          {visibleGroups.map((group) => (
            <section className="task-pool__group" key={group.id} aria-labelledby={`task-pool-${group.id}`}>
              <header className="task-pool__group-header">
                <h3 id={`task-pool-${group.id}`}>{group.title}</h3>
                <p>{group.helper}</p>
              </header>
              <ul className="task-pool__list">
                {group.items.map((item) => {
                  const usefulWindowLines = taskPoolUsefulWindowLines(item);
                  const moving = movingTaskPoolItemId === item.id;
                  const deferring = deferringTaskPoolItemId === item.id;
                  const marking = markingTaskPoolItemId === item.id;
                  const busy = moving || deferring || marking;

                  return (
                    <li key={item.id}>
                      <div className="task-pool__item-summary">
                        <strong>{item.title}</strong>
                        <span>{taskPoolAreaLabels[item.area]} - {statusLabel(item, clockMs)}</span>
                      </div>
                      <p className="task-pool__item-detail">Minimum: {item.minimum.label}</p>
                      {usefulWindowLines.map((line) => (
                        <p className="task-pool__item-detail" key={line}>{line}</p>
                      ))}
                      <div className="task-pool__item-actions">
                        <Button
                          className="task-pool__today-action"
                          disabled={busy}
                          onClick={() => void moveTaskToToday(item)}
                          variant="primary"
                        >
                          {moving ? 'Adding to Today' : moveToTodayLabel(item)}
                        </Button>
                        {onOpenPlan ? (
                          <Button
                            className="task-pool__plan-action"
                            disabled={busy}
                            onClick={() => onOpenPlan(
                              item.id,
                              item.status === 'softPlaced' ? softPlacementDates[item.id] : undefined,
                            )}
                          >
                            {softWindowLabel(item)}
                          </Button>
                        ) : null}
                        <details className="task-pool__other-choices">
                          <summary>Other choices</summary>
                          <div className="task-pool__other-actions">
                            {item.status !== 'softPlaced' ? (
                              <Button
                                className="task-pool__defer-action"
                                disabled={busy}
                                onClick={() => setDeferItem(item)}
                              >
                                {deferring ? 'Holding for later' : deferralLabel(item)}
                              </Button>
                            ) : null}
                            <Button
                              className="task-pool__item-action"
                              disabled={busy}
                              onClick={() => void markCapturedTaskNoLongerNeeded(item)}
                            >
                              {marking ? 'Marking item' : 'No longer needed'}
                            </Button>
                          </div>
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="task-pool__empty">
          <h3>No captured tasks yet.</h3>
          <p>Capture something here without adding it to Today.</p>
        </div>
      )}

      {taskPoolFeedback ? (
        <div className={`task-pool__feedback task-pool__feedback--${taskPoolFeedback.kind}`} role="status">
          {taskPoolFeedback.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}

      <TaskPoolCaptureModal
        onClose={() => setTaskPoolCaptureOpen(false)}
        onSave={saveCapturedTask}
        open={taskPoolCaptureOpen}
      />
      <TaskPoolDeferModal
        item={deferItem}
        onClose={() => setDeferItem(null)}
        onSave={saveTaskDeferral}
        open={Boolean(deferItem)}
      />
    </section>
  );
}
