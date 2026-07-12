import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components';
import { bringTaskPoolItemToToday } from '../../data/taskLifecycleRepository';
import {
  createTaskPoolItemId,
  loadTaskPoolItems,
  markTaskPoolItemNoLongerNeeded,
  saveTaskPoolItem,
} from '../../data/taskPoolRepository';
import type { TaskPoolItem, TaskPoolItemStatus } from '../../data/schemas';
import { TaskPoolCaptureModal, type TaskPoolCaptureInput } from './TaskPoolCaptureModal';

type TaskPoolFeedback = {
  kind: 'error' | 'success';
  lines: string[];
};

type TaskPoolGroup = {
  helper: string;
  id: string;
  statuses: TaskPoolItemStatus[];
  title: string;
};

type TaskPoolPanelProps = {
  onOpenPlan?: () => void;
};

const taskPoolGroups: TaskPoolGroup[] = [
  {
    helper: 'Ready when you choose.',
    id: 'safely-held',
    statuses: ['captured', 'suggested', 'softPlaced'],
    title: 'Safely held',
  },
  {
    helper: 'Safe to return to when it fits.',
    id: 'parked',
    statuses: ['parked'],
    title: 'Parked',
  },
  {
    helper: 'Held for a later choice.',
    id: 'bring-back-later',
    statuses: ['deferred'],
    title: 'Bring back later',
  },
  {
    helper: 'Kept out of the current day.',
    id: 'not-today',
    statuses: ['notToday'],
    title: 'Not today',
  },
];

const visibleTaskPoolStatuses = taskPoolGroups.flatMap((group) => group.statuses);

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

export function TaskPoolPanel({ onOpenPlan }: TaskPoolPanelProps = {}) {
  const [taskPoolCaptureOpen, setTaskPoolCaptureOpen] = useState(false);
  const [taskPoolFeedback, setTaskPoolFeedback] = useState<TaskPoolFeedback | null>(null);
  const [taskPoolItems, setTaskPoolItems] = useState<TaskPoolItem[]>([]);
  const [markingTaskPoolItemId, setMarkingTaskPoolItemId] = useState<string | null>(null);
  const [movingTaskPoolItemId, setMovingTaskPoolItemId] = useState<string | null>(null);
  const visibleTaskPoolItems = useMemo(
    () => taskPoolItems.filter((item) => visibleTaskPoolStatuses.includes(item.status)),
    [taskPoolItems],
  );
  const visibleGroups = useMemo(
    () => taskPoolGroups
      .map((group) => ({
        ...group,
        items: visibleTaskPoolItems.filter((item) => group.statuses.includes(item.status)),
      }))
      .filter((group) => group.items.length > 0),
    [visibleTaskPoolItems],
  );

  const refreshTaskPoolItems = useCallback(async () => {
    const items = await loadTaskPoolItems();
    setTaskPoolItems(items);
  }, []);

  useEffect(() => {
    let active = true;

    loadTaskPoolItems()
      .then((items) => {
        if (active) {
          setTaskPoolItems(items);
        }
      })
      .catch(() => {
        if (active) {
          setTaskPoolItems([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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

  const markCapturedTaskNoLongerNeeded = useCallback(async (item: TaskPoolItem) => {
    setMarkingTaskPoolItemId(item.id);
    setTaskPoolFeedback(null);

    try {
      const result = await markTaskPoolItemNoLongerNeeded(item.id);

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
          <p className="section-label">Holding Tray</p>
          <h2 id="task-pool-title">Task Pool</h2>
          <p>Captured tasks are safely held here before they become Today actions or soft suggestions.</p>
          <p>No schedule created.</p>
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

                  return (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{taskPoolAreaLabels[item.area]} - {taskPoolStatusLabels[item.status]}</span>
                      </div>
                      <p>Minimum: {item.minimum.label}</p>
                      {usefulWindowLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                      <div className="task-pool__item-actions">
                        <Button
                          className="task-pool__today-action"
                          disabled={moving || markingTaskPoolItemId === item.id}
                          onClick={() => void moveTaskToToday(item)}
                          variant="primary"
                        >
                          {moving ? 'Adding to Today' : moveToTodayLabel(item)}
                        </Button>
                        {onOpenPlan ? (
                          <Button
                            className="task-pool__plan-action"
                            disabled={moving || markingTaskPoolItemId === item.id}
                            onClick={onOpenPlan}
                          >
                            {softWindowLabel(item)}
                          </Button>
                        ) : null}
                        <Button
                          className="task-pool__item-action"
                          disabled={moving || markingTaskPoolItemId === item.id}
                          onClick={() => void markCapturedTaskNoLongerNeeded(item)}
                        >
                          {markingTaskPoolItemId === item.id ? 'Marking item' : 'No longer needed'}
                        </Button>
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
    </section>
  );
}
