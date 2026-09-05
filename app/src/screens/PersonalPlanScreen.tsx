import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ScreenHero } from '../components';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import {
  ensureCurrentPrivatePlan,
  repairCurrentPrivatePlan,
  undoCurrentPrivatePlan,
  type PrivatePlanActionResult,
} from '../data/schedulerPlanCoordinator';
import { loadSoftPlacementsForDate } from '../data/softPlacementRepository';
import { loadTaskPoolItems } from '../data/taskPoolRepository';
import {
  confirmTaskPoolSoftPlacement,
  removeTaskPoolSoftPlacement,
} from '../data/taskSoftPlacementRepository';
import type { SoftPlacement, TaskPoolItem } from '../data/schemas';
import type { SchedulerPlan, SchedulerPlanChange } from '../domain/schedulingModel';
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

type PrivatePlanViewState =
  | { status: 'loading' }
  | {
      status: 'error';
      errors: string[];
    }
  | {
      status: 'ready';
      plan: SchedulerPlan;
      titleByTargetId: Record<string, string>;
      warnings: string[];
    };

type PersonalPlanScreenProps = {
  preferredPlacementDate?: string | null;
  preferredTaskId?: string | null;
};

function placementTitle(
  titleByTargetId: Record<string, string>,
  targetId: string,
) {
  return titleByTargetId[targetId] ?? 'Private task';
}

function formatChangedLine(
  change: SchedulerPlanChange,
  titleByTargetId: Record<string, string>,
) {
  const title = placementTitle(titleByTargetId, change.targetId);
  const from = change.from
    ? `${change.from.date} ${change.from.start}-${change.from.end}`
    : null;
  const to = change.to
    ? `${change.to.date} ${change.to.start}-${change.to.end}`
    : null;

  switch (change.kind) {
    case 'added':
      return `${title} was added${to ? ` at ${to}` : ''}.`;
    case 'removed':
      return `${title} was removed${from ? ` from ${from}` : ''}.`;
    case 'variantChanged':
      return `${title} changed form${to ? ` at ${to}` : ''}.`;
    case 'moved':
    default:
      return `${title} moved${from ? ` from ${from}` : ''}${to ? ` to ${to}` : ''}.`;
  }
}

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
  const [privatePlanState, setPrivatePlanState] = useState<PrivatePlanViewState>({ status: 'loading' });
  const [privatePlanBusy, setPrivatePlanBusy] = useState<'refresh' | 'undo' | null>(null);
  const [privatePlanFeedback, setPrivatePlanFeedback] = useState<string | null>(null);

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
  const automaticPlacements = useMemo(() => {
    if (privatePlanState.status !== 'ready') return [];
    return privatePlanState.plan.placements.filter(
      (placement) =>
        placement.origin === 'scheduler' &&
        placement.date === selectedPlacementDate,
    );
  }, [privatePlanState, selectedPlacementDate]);
  const changedItems = privatePlanState.status === 'ready'
    ? privatePlanState.plan.repair?.changes ?? []
    : [];

  const applyPrivatePlanResult = useCallback((result: PrivatePlanActionResult) => {
    if (!result.ok) {
      setPrivatePlanState({
        status: 'error',
        errors: result.errors,
      });
      return false;
    }

    setPrivatePlanState({
      status: 'ready',
      plan: result.plan,
      titleByTargetId: result.titleByTargetId,
      warnings: result.warnings,
    });
    return true;
  }, []);

  const refreshPlanData = useCallback(async () => {
    const [placements, items] = await Promise.all([
      loadSoftPlacementsForDate(selectedPlacementDate),
      loadTaskPoolItems(),
    ]);

    setSavedSoftPlacements(placements);
    setTaskPoolItems(items);
  }, [selectedPlacementDate]);

  const repairAfterUserPlacementChange = useCallback(async () => {
    const result = await repairCurrentPrivatePlan({
      reason: 'A user-confirmed private placement changed.',
      trigger: 'userCorrection',
    });

    return applyPrivatePlanResult(result);
  }, [applyPrivatePlanResult]);

  useEffect(() => {
    let active = true;

    setPrivatePlanState({ status: 'loading' });
    setPrivatePlanFeedback(null);

    ensureCurrentPrivatePlan()
      .then((result) => {
        if (active) applyPrivatePlanResult(result);
      })
      .catch(() => {
        if (active) {
          setPrivatePlanState({
            status: 'error',
            errors: ['Private plan could not be loaded. Saved scheduler state was left unchanged.'],
          });
        }
      });

    return () => {
      active = false;
    };
  }, [applyPrivatePlanResult]);

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

  const refreshPrivatePlan = useCallback(async () => {
    setPrivatePlanBusy('refresh');
    setPrivatePlanFeedback(null);

    try {
      const result = await repairCurrentPrivatePlan({
        reason: 'You asked Life Rhythm to refresh flexible private work.',
        trigger: 'manualReplan',
      });
      const applied = applyPrivatePlanResult(result);
      setPrivatePlanFeedback(
        applied
          ? 'Flexible private work was refreshed. External calendar events were not changed.'
          : 'Private plan was not changed.',
      );
    } catch {
      setPrivatePlanFeedback('Private plan was not changed.');
    } finally {
      setPrivatePlanBusy(null);
    }
  }, [applyPrivatePlanResult]);

  const undoPrivatePlan = useCallback(async () => {
    setPrivatePlanBusy('undo');
    setPrivatePlanFeedback(null);

    try {
      const result = await undoCurrentPrivatePlan();
      const applied = applyPrivatePlanResult(result);
      setPrivatePlanFeedback(
        applied
          ? 'The previous private plan was restored.'
          : 'The previous private plan could not be restored.',
      );
    } catch {
      setPrivatePlanFeedback('The previous private plan could not be restored.');
    } finally {
      setPrivatePlanBusy(null);
    }
  }, [applyPrivatePlanResult]);

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
          lines: ['User-confirmed placement was not added.', 'Nothing else changed.'],
        });
        return;
      }

      await refreshPlanData();
      const repaired = await repairAfterUserPlacementChange();
      setPlacementFeedback({
        kind: 'success',
        lines: [
          'User-confirmed placement added.',
          'No calendar event created.',
          repaired ? 'Flexible automatic placements were checked around it.' : 'The automatic private plan could not update; the placement is still saved.',
        ],
      });
    } catch {
      setPlacementFeedback({
        kind: 'error',
        lines: ['User-confirmed placement was not added.', 'Nothing else changed.'],
      });
    } finally {
      setPlacingSuggestionId(null);
    }
  }, [refreshPlanData, repairAfterUserPlacementChange]);

  const removeSoftPlacement = useCallback(async (placement: SoftPlacement) => {
    setRemovingPlacementId(placement.id);
    setPlacementFeedback(null);

    try {
      const result = await removeTaskPoolSoftPlacement(placement.id);

      if (!result.ok) {
        setPlacementFeedback({
          kind: 'error',
          lines: ['User-confirmed placement was not removed.', 'Nothing else changed.'],
        });
        return;
      }

      await refreshPlanData();
      const repaired = await repairAfterUserPlacementChange();
      setPlacementFeedback({
        kind: 'success',
        lines: [
          'User-confirmed placement removed.',
          'Task was not deleted. No calendar event changed.',
          repaired ? 'Flexible automatic placements were checked again.' : 'The automatic private plan could not update; the removal is still saved.',
        ],
      });
    } catch {
      setPlacementFeedback({
        kind: 'error',
        lines: ['User-confirmed placement was not removed.', 'Nothing else changed.'],
      });
    } finally {
      setRemovingPlacementId(null);
    }
  }, [refreshPlanData, repairAfterUserPlacementChange]);

  const suggestionEmptyTitle = poolSoftSuggestions.openCapacityBlockCount === 0
    ? `No open capacity blocks for ${dayShapePreview.selectedDay}.`
    : poolSoftSuggestions.eligibleTaskCount === 0
      ? 'No safely held tasks need a manual window.'
      : 'No held task fits the available block.';
  const suggestionEmptyMessage = poolSoftSuggestions.openCapacityBlockCount === 0
    ? 'Blank time stays blank. Add an open-capacity block in Settings only when it is genuinely available.'
    : poolSoftSuggestions.eligibleTaskCount === 0
      ? 'Capture or return a task to Pool when you want a manual placement option.'
      : 'The minimum version or useful window does not fit. Nothing was manually placed.';

  return (
    <div className="screen-stack plan-screen personal-plan-screen">
      <ScreenHero
        className="plan-hero"
        tagline="Life Rhythm maintains flexible private work around the boundaries you set."
        title="Plan"
        titleId="plan-title"
      />

      <section
        className="private-plan plan-section plan-section--private"
        aria-labelledby="personal-private-plan-title"
      >
        <div className="soft-placements__header">
          <p className="section-label">Automatic private plan</p>
          <h2 id="personal-private-plan-title">Private plan</h2>
          <div className="plan-section__guidance">
            <p>
              Life Rhythm can place flexible private work inside usable or explicitly available time.
              It does not create, move, or cancel external calendar events.
            </p>
          </div>
        </div>

        {privatePlanState.status === 'loading' ? (
          <div className="soft-placements__empty" role="status">
            <h3>Preparing the private plan.</h3>
          </div>
        ) : privatePlanState.status === 'error' ? (
          <div className="soft-suggestions__feedback soft-suggestions__feedback--error" role="alert">
            <h3>Private plan needs attention.</h3>
            {privatePlanState.errors.map((error) => <p key={error}>{error}</p>)}
            <p>Saved scheduler state was left unchanged.</p>
          </div>
        ) : automaticPlacements.length > 0 ? (
          <ul className="soft-placements__list">
            {automaticPlacements.map((placement) => {
              const targetId = placement.targetKind === 'rhythm'
                ? placement.rhythmId ?? placement.intentionId
                : placement.intentionId;
              return (
                <li key={placement.id}>
                  <div className="soft-placements__item-copy">
                    <div>
                      <strong>{placementTitle(privatePlanState.titleByTargetId, targetId)}</strong>
                      <span>{placement.start}-{placement.end}</span>
                    </div>
                    <p>
                      Automatic private placement
                      {placement.variantKind ? ` · ${placement.variantKind}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="soft-placements__empty">
            <h3>No automatic private placements for {dayShapePreview.selectedDay}.</h3>
            <p>Blank time is not assumed to be usable capacity.</p>
          </div>
        )}

        <div className="button-row">
          <Button
            disabled={privatePlanBusy !== null || privatePlanState.status === 'loading'}
            onClick={() => void refreshPrivatePlan()}
          >
            {privatePlanBusy === 'refresh' ? 'Refreshing plan' : 'Refresh flexible plan'}
          </Button>
        </div>

        {privatePlanState.status === 'ready' && privatePlanState.warnings.length > 0 ? (
          <details className="plan-section__details">
            <summary>Planning notes</summary>
            <ul>
              {privatePlanState.warnings.slice(0, 4).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {privatePlanFeedback ? <p role="status">{privatePlanFeedback}</p> : null}
      </section>

      <section
        className="private-plan-changed plan-section plan-section--changed"
        aria-labelledby="personal-private-plan-changed-title"
      >
        <div className="soft-placements__header">
          <p className="section-label">Recent automatic repair</p>
          <h2 id="personal-private-plan-changed-title">Changed</h2>
          <div className="plan-section__guidance">
            <p>Only the latest private-plan repair is shown here.</p>
          </div>
        </div>

        {privatePlanState.status === 'ready' && changedItems.length > 0 ? (
          <ul className="soft-placements__list">
            {changedItems.map((change, index) => (
              <li key={`${change.targetKind}:${change.targetId}:${change.kind}:${index}`}>
                <div className="soft-placements__item-copy">
                  <strong>{formatChangedLine(change, privatePlanState.titleByTargetId)}</strong>
                  <p>{change.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="soft-placements__empty">
            <h3>No recent automatic changes.</h3>
          </div>
        )}

        {privatePlanState.status === 'ready' && privatePlanState.plan.repair?.undo ? (
          <Button
            disabled={privatePlanBusy !== null}
            onClick={() => void undoPrivatePlan()}
          >
            {privatePlanBusy === 'undo' ? 'Restoring plan' : 'Undo last repair'}
          </Button>
        ) : null}
      </section>

      <section
        className="day-shape-preview plan-section plan-section--day-shape"
        aria-labelledby="personal-day-shape-title"
      >
          <div className="day-shape-preview__header">
            <div>
              <p className="section-label">Planning boundaries</p>
              <h2 id="personal-day-shape-title">Day Shape</h2>
              <p>{dayShapePreview.intro} {dayShapePreview.boundaryCopy}</p>
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
                  className={`day-shape-preview__group day-shape-preview__group--${group.id}`}
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
                          <div className="day-shape-preview__block-main">
                            <strong>{block.label}</strong>
                            <span>{block.typeLabel}</span>
                          </div>
                          <div className="day-shape-preview__block-context">
                            <p className="day-shape-preview__time">{block.timeRange}</p>
                            <p>{block.schedulerUseMeaning}</p>
                            {block.notes ? <p className="day-shape-preview__notes">{block.notes}</p> : null}
                          </div>
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

      <section
        className="soft-suggestions plan-section plan-section--suggestions"
        aria-labelledby="personal-soft-suggestions-title"
      >
          <div className="soft-suggestions__header">
            <p className="section-label">Optional manual choices</p>
            <h2 id="personal-soft-suggestions-title">Soft suggestions</h2>
            <div className="plan-section__guidance">
              <p>
                The automatic private plan runs separately. These suggestions remain available when you want to choose a specific open-capacity block yourself.
              </p>
              {preferredTask ? (
                <p className="plan-section__context">
                  Showing {preferredTask.title} first because you chose it in Pool.
                </p>
              ) : null}
            </div>
          </div>

          {poolSoftSuggestions.suggestions.length > 0 ? (
            <ul className="soft-suggestions__list">
              {poolSoftSuggestions.suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <div className="soft-suggestions__item-copy">
                    <div>
                      <strong>{suggestion.taskTitle}</strong>
                      <span>{suggestion.blockLabel} · {suggestion.blockTimeRange}</span>
                    </div>
                    <p>Minimum: {suggestion.minimumLabel} · {suggestion.minimumMinutes} min</p>
                    <p>{suggestion.reason}</p>
                  </div>
                  <Button
                    className="soft-suggestions__placement-action"
                    disabled={placingSuggestionId === suggestion.id}
                    onClick={() => void addSoftPlacement(suggestion)}
                    variant="primary"
                  >
                    {placingSuggestionId === suggestion.id ? 'Adding placement' : 'Add manual placement'}
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
              <p>Life Rhythm will not automatically place tasks here. A separate explicit choice is required.</p>
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

      <section
        className="soft-placements plan-section plan-section--placements"
        aria-labelledby="personal-soft-placements-title"
      >
          <div className="soft-placements__header">
            <p className="section-label">Manual private placements</p>
            <h2 id="personal-soft-placements-title">User-confirmed placements</h2>
            <div className="plan-section__guidance">
              <p>
                These are placements you chose yourself. They stay separate from automatic scheduler placements and do not create calendar events.
              </p>
            </div>
          </div>

          {visibleSoftPlacements.length > 0 ? (
            <ul className="soft-placements__list">
              {visibleSoftPlacements.map((placement) => (
                <li key={placement.id}>
                  <div className="soft-placements__item-copy">
                    <div>
                      <strong>{placement.taskTitleSnapshot}</strong>
                      <span>{placement.blockLabelSnapshot} · {placement.start}-{placement.end}</span>
                    </div>
                    <p>{softPlacementStatusLabels[placement.status]}</p>
                  </div>
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
              <h3>No user-confirmed placements for {dayShapePreview.selectedDay}.</h3>
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
    </div>
  );
}
