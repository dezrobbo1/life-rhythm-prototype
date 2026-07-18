import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, ScreenHero } from '../components';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import { loadSoftPlacementsForDate } from '../data/softPlacementRepository';
import { loadTaskPoolItems } from '../data/taskPoolRepository';
import {
  confirmTaskPoolSoftPlacement,
  removeTaskPoolSoftPlacement,
} from '../data/taskSoftPlacementRepository';
import type { SoftPlacement, TaskPoolItem } from '../data/schemas';
import {
  buildPoolSoftSuggestions,
  type PoolSoftSuggestion,
} from '../features/plan/poolSoftSuggestions';
import {
  createSoftPlacementId,
  dayNameForLocalDate,
  localDateForNextSelectedDay,
} from '../features/plan/softPlacementDate';
import {
  buildDayShapePreviewViewModel,
  dayShapePreviewDays,
  type DayName,
} from '../viewModels';

const visibleSoftPlacementStatuses: Array<SoftPlacement['status']> = [
  'planned',
  'moved',
  'completedFromToday',
];

const softPlacementStatusLabels: Record<SoftPlacement['status'], string> = {
  completedFromToday: 'Completed from Today',
  moved: 'Moved',
  planned: 'Planned',
  removed: 'Removed',
};

type PlacementFeedback = {
  kind: 'error' | 'success';
  lines: string[];
};

type PersonalPlanScreenProps = {
  preferredPlacementDate?: string | null;
  preferredTaskId?: string | null;
};

export function PersonalPlanScreen({
  preferredPlacementDate = null,
  preferredTaskId = null,
}: PersonalPlanScreenProps = {}) {
  const { snapshot } = useAppSnapshot();
  const [selectedDay, setSelectedDay] = useState<DayName>(
    () => dayNameForLocalDate(preferredPlacementDate) ?? 'Monday',
  );
  const [selectedPlacementDateOverride, setSelectedPlacementDateOverride] = useState<string | null>(
    preferredPlacementDate,
  );
  const [savedSoftPlacements, setSavedSoftPlacements] = useState<SoftPlacement[]>([]);
  const [taskPoolItems, setTaskPoolItems] = useState<TaskPoolItem[]>([]);
  const [placingSuggestionId, setPlacingSuggestionId] = useState<string | null>(null);
  const [removingPlacementId, setRemovingPlacementId] = useState<string | null>(null);
  const [placementFeedback, setPlacementFeedback] = useState<PlacementFeedback | null>(null);

  const dayShapePreview = useMemo(
    () => buildDayShapePreviewViewModel(snapshot, selectedDay),
    [selectedDay, snapshot],
  );
  const selectedPlacementDate = useMemo(
    () => selectedPlacementDateOverride ?? localDateForNextSelectedDay(dayShapePreview.selectedDay),
    [dayShapePreview.selectedDay, selectedPlacementDateOverride],
  );
  const hasDayShapeBlocks = dayShapePreview.groups.some((group) => group.blocks.length > 0);
  const askFirstBlocks = dayShapePreview.groups.find((group) => group.id === 'askFirst')?.blocks ?? [];
  const visibleSoftPlacements = useMemo(
    () => savedSoftPlacements.filter((placement) => visibleSoftPlacementStatuses.includes(placement.status)),
    [savedSoftPlacements],
  );
  const preferredTask = useMemo(
    () => taskPoolItems.find((item) => item.id === preferredTaskId) ?? null,
    [preferredTaskId, taskPoolItems],
  );
  const poolSoftSuggestions = useMemo(
    () => buildPoolSoftSuggestions({
      existingPlacements: savedSoftPlacements,
      items: taskPoolItems,
      preferredTaskId,
      selectedDate: selectedPlacementDate,
      selectedDay: dayShapePreview.selectedDay,
      timeBlocks: snapshot.settings?.lifeShape?.timeBlocks ?? [],
    }),
    [
      dayShapePreview.selectedDay,
      preferredTaskId,
      savedSoftPlacements,
      selectedPlacementDate,
      snapshot.settings,
      taskPoolItems,
    ],
  );

  const refreshPlanData = useCallback(async () => {
    const [placements, items] = await Promise.all([
      loadSoftPlacementsForDate(selectedPlacementDate),
      loadTaskPoolItems(),
    ]);

    setSavedSoftPlacements(placements);
    setTaskPoolItems(items);
  }, [selectedPlacementDate]);

  useEffect(() => {
    let active = true;

    setSavedSoftPlacements([]);
    setTaskPoolItems([]);
    setPlacementFeedback(null);

    Promise.all([
      loadSoftPlacementsForDate(selectedPlacementDate),
      loadTaskPoolItems(),
    ])
      .then(([placements, items]) => {
        if (active) {
          setSavedSoftPlacements(placements);
          setTaskPoolItems(items);
        }
      })
      .catch(() => {
        if (active) {
          setSavedSoftPlacements([]);
          setTaskPoolItems([]);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedPlacementDate]);

  useEffect(() => {
    setSelectedDay(dayNameForLocalDate(preferredPlacementDate) ?? 'Monday');
    setSelectedPlacementDateOverride(preferredPlacementDate);
  }, [preferredPlacementDate]);

  const addSoftPlacement = useCallback(async (suggestion: PoolSoftSuggestion) => {
    setPlacingSuggestionId(suggestion.id);
    setPlacementFeedback(null);

    try {
      const result = await confirmTaskPoolSoftPlacement({
        blockEnd: suggestion.blockEnd,
        blockId: suggestion.blockId,
        blockLabel: suggestion.blockLabel,
        blockStart: suggestion.blockStart,
        date: suggestion.date,
        id: createSoftPlacementId({
          blockId: suggestion.blockId,
          date: suggestion.date,
          taskId: suggestion.taskId,
        }),
        taskId: suggestion.taskId,
      });

      if (!result.ok) {
        setPlacementFeedback({
          kind: 'error',
          lines: ['Soft placement was not added.', 'Nothing else changed.'],
        });
        return;
      }

      await refreshPlanData();
      setPlacementFeedback({
        kind: 'success',
        lines: ['Soft placement added.', 'No calendar event created.', 'You can remove it later.'],
      });
    } catch {
      setPlacementFeedback({
        kind: 'error',
        lines: ['Soft placement was not added.', 'Nothing else changed.'],
      });
    } finally {
      setPlacingSuggestionId(null);
    }
  }, [refreshPlanData]);

  const removeSoftPlacement = useCallback(async (placement: SoftPlacement) => {
    setRemovingPlacementId(placement.id);
    setPlacementFeedback(null);

    try {
      const result = await removeTaskPoolSoftPlacement(placement.id);

      if (!result.ok) {
        setPlacementFeedback({
          kind: 'error',
          lines: ['Soft placement was not removed.', 'Nothing else changed.'],
        });
        return;
      }

      await refreshPlanData();
      setPlacementFeedback({
        kind: 'success',
        lines: ['Soft placement removed.', 'Task was not deleted.', 'No calendar event changed.'],
      });
    } catch {
      setPlacementFeedback({
        kind: 'error',
        lines: ['Soft placement was not removed.', 'Nothing else changed.'],
      });
    } finally {
      setRemovingPlacementId(null);
    }
  }, [refreshPlanData]);

  const suggestionEmptyTitle = poolSoftSuggestions.openCapacityBlockCount === 0
    ? `No open capacity blocks for ${dayShapePreview.selectedDay}.`
    : poolSoftSuggestions.eligibleTaskCount === 0
      ? 'No safely held tasks need a soft window.'
      : 'No held task fits the available block.';
  const suggestionEmptyMessage = poolSoftSuggestions.openCapacityBlockCount === 0
    ? 'Blank time stays blank. Add an open-capacity block in Settings only when it is genuinely available.'
    : poolSoftSuggestions.eligibleTaskCount === 0
      ? 'Capture or return a task to Pool when you want help finding a possible place.'
      : 'The minimum version or useful window does not fit. Nothing was placed.';

  return (
    <div className="screen-stack plan-screen personal-plan-screen">
      <ScreenHero
        className="plan-hero"
        eyebrow="Your day shape"
        tagline="Plan with the time you marked as protected, loose, or open."
        title="Plan"
        titleId="plan-title"
      />

      <Card>
        <section className="day-shape-preview" aria-labelledby="personal-day-shape-title">
          <div className="day-shape-preview__header">
            <div>
              <p className="section-label">Planning boundaries</p>
              <h2 id="personal-day-shape-title">Day Shape</h2>
              <p>{dayShapePreview.intro}</p>
              <p>{dayShapePreview.boundaryCopy}</p>
            </div>
            <label className="day-shape-preview__select">
              <span>Selected day</span>
              <select
                onChange={(event) => {
                  setSelectedDay(event.target.value as DayName);
                  setSelectedPlacementDateOverride(null);
                }}
                value={dayShapePreview.selectedDay}
              >
                {dayShapePreviewDays.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasDayShapeBlocks ? (
            <div className="day-shape-preview__groups">
              {dayShapePreview.groups.map((group) => (
                <section
                  className="day-shape-preview__group"
                  key={group.id}
                  aria-labelledby={`personal-day-shape-${group.id}`}
                >
                  <div className="day-shape-preview__group-header">
                    <h3 id={`personal-day-shape-${group.id}`}>{group.title}</h3>
                    <p>{group.meaning}</p>
                  </div>
                  {group.blocks.length > 0 ? (
                    <ul>
                      {group.blocks.map((block) => (
                        <li key={block.id}>
                          <div>
                            <strong>{block.label}</strong>
                            <span>{block.typeLabel}</span>
                          </div>
                          <p>{block.timeRange}</p>
                          <p>{block.schedulerUseMeaning}</p>
                          {block.notes ? <p className="day-shape-preview__notes">{block.notes}</p> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="day-shape-preview__quiet">
                      No blocks in this category for {dayShapePreview.selectedDay}.
                    </p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="day-shape-preview__empty">
              <h3>{dayShapePreview.emptyState.title}</h3>
              <p>{dayShapePreview.emptyState.message}</p>
              <p>Add protected, loose, ask-first, or open-capacity blocks in Settings when useful.</p>
            </div>
          )}
        </section>
      </Card>

      <Card>
        <section className="soft-suggestions" aria-labelledby="personal-soft-suggestions-title">
          <div className="soft-suggestions__header">
            <p className="section-label">User-confirmed possibilities</p>
            <h2 id="personal-soft-suggestions-title">Soft suggestions</h2>
            <p>Suggestions only. Nothing is placed unless you choose it.</p>
            <p>Only blocks you marked as open capacity are considered.</p>
            {preferredTask ? <p>Showing {preferredTask.title} first because you chose it in Pool.</p> : null}
          </div>

          {poolSoftSuggestions.suggestions.length > 0 ? (
            <ul className="soft-suggestions__list">
              {poolSoftSuggestions.suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <div>
                    <strong>{suggestion.taskTitle}</strong>
                    <span>{suggestion.blockLabel} · {suggestion.blockTimeRange}</span>
                  </div>
                  <p>Minimum: {suggestion.minimumLabel} · {suggestion.minimumMinutes} min</p>
                  <p>{suggestion.reason}</p>
                  <p>{suggestion.boundaryCopy}</p>
                  <Button
                    className="soft-suggestions__placement-action"
                    disabled={placingSuggestionId === suggestion.id}
                    onClick={() => void addSoftPlacement(suggestion)}
                    variant="primary"
                  >
                    {placingSuggestionId === suggestion.id ? 'Adding placement' : 'Add soft placement'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="soft-suggestions__empty">
              <h3>{suggestionEmptyTitle}</h3>
              <p>{suggestionEmptyMessage}</p>
            </div>
          )}

          {askFirstBlocks.length > 0 ? (
            <div className="soft-suggestions__ask-first">
              <h3>Ask-first time remains protected</h3>
              <p>Life Rhythm will not suggest or place tasks here without a separate future confirmation flow.</p>
              <ul>
                {askFirstBlocks.map((block) => (
                  <li key={block.id}>
                    <strong>{block.label}</strong>
                    <span>{block.timeRange}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </Card>

      <Card>
        <section className="soft-placements" aria-labelledby="personal-soft-placements-title">
          <div className="soft-placements__header">
            <p className="section-label">Local placement notes</p>
            <h2 id="personal-soft-placements-title">Soft placements</h2>
            <p>Nothing is placed automatically. A soft placement is local and is not a calendar event.</p>
          </div>

          {visibleSoftPlacements.length > 0 ? (
            <ul className="soft-placements__list">
              {visibleSoftPlacements.map((placement) => (
                <li key={placement.id}>
                  <div>
                    <strong>{placement.taskTitleSnapshot}</strong>
                    <span>{placement.blockLabelSnapshot} · {placement.start}-{placement.end}</span>
                  </div>
                  <p>{softPlacementStatusLabels[placement.status]}</p>
                  <Button
                    className="soft-placements__remove-action"
                    disabled={removingPlacementId === placement.id}
                    onClick={() => void removeSoftPlacement(placement)}
                  >
                    {removingPlacementId === placement.id ? 'Removing placement' : 'Remove placement'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="soft-placements__empty">
              <h3>No saved soft placements for {dayShapePreview.selectedDay}.</h3>
              <p>Blank time stays blank until you explicitly confirm a placement.</p>
            </div>
          )}

          {placementFeedback ? (
            <div className={`soft-suggestions__feedback soft-suggestions__feedback--${placementFeedback.kind}`} role="status">
              {placementFeedback.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </section>
      </Card>
    </div>
  );
}
