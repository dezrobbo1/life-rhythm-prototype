import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components';
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

const visibleTaskPoolStatuses: TaskPoolItemStatus[] = [
  'captured',
  'suggested',
  'softPlaced',
  'parked',
  'notToday',
  'deferred',
];

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

export function TaskPoolPanel() {
  const [taskPoolCaptureOpen, setTaskPoolCaptureOpen] = useState(false);
  const [taskPoolFeedback, setTaskPoolFeedback] = useState<TaskPoolFeedback | null>(null);
  const [taskPoolItems, setTaskPoolItems] = useState<TaskPoolItem[]>([]);
  const [markingTaskPoolItemId, setMarkingTaskPoolItemId] = useState<string | null>(null);
  const visibleTaskPoolItems = useMemo(
    () => taskPoolItems.filter((item) => visibleTaskPoolStatuses.includes(item.status)),
    [taskPoolItems],
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

      {visibleTaskPoolItems.length > 0 ? (
        <ul className="task-pool__list">
          {visibleTaskPoolItems.map((item) => {
            const usefulWindowLines = taskPoolUsefulWindowLines(item);

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
                <Button
                  className="task-pool__item-action"
                  disabled={markingTaskPoolItemId === item.id}
                  onClick={() => void markCapturedTaskNoLongerNeeded(item)}
                >
                  {markingTaskPoolItemId === item.id ? 'Marking item' : 'No longer needed'}
                </Button>
              </li>
            );
          })}
        </ul>
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
