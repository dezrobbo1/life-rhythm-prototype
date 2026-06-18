import { useCallback, useMemo, useState } from 'react';
import { Button, Card } from '../components';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import { loadSoftPlacementsForDate, saveSoftPlacement } from '../data/softPlacementRepository';
import { PlanBlock } from '../features/plan/PlanBlock';
import { mockPlanBlocks, type PlanBlock as PlanBlockData, type PlanItem } from '../features/plan/mockPlanData';
import { createSoftPlacementId, localDateForNextSelectedDay } from '../features/plan/softPlacementDate';
import {
  buildDayShapePreviewViewModel,
  buildPlanViewModel,
  buildSoftScheduleSuggestionsViewModel,
  dayShapePreviewDays,
  type AppDataSnapshot,
  type DayName,
  type PlanBlockViewModel,
  type PlanItemViewModel,
  type SoftScheduleSuggestionViewModel,
} from '../viewModels';

type SoftPlacementFeedback = {
  kind: 'duplicate' | 'error' | 'success';
  lines: string[];
};

function toPlanBlockState(state: PlanBlockViewModel['state']): PlanBlockData['state'] {
  if (state === 'heavy' || state === 'fixed') {
    return 'full';
  }

  if (state === 'wind down') {
    return 'wind-down';
  }

  if (state === 'light' || state === 'free' || state === 'restart point') {
    return 'light';
  }

  return 'room';
}

function toPlanItemData(item: PlanItemViewModel): PlanItem {
  return {
    area: item.area,
    hiddenEdges: item.hiddenEdges,
    id: item.id,
    softRange: item.softRange,
    suggestedAdjustment: (item as PlanItemViewModel & { suggestedAdjustment?: string }).suggestedAdjustment ??
      (item.type === 'fixed'
        ? 'Keep this fixed. Move flexible rhythms around it.'
        : 'Move later, shrink, or restart with one action.'),
    title: item.title,
    tone: item.tone,
    type: item.type,
  };
}

function toPlanBlockData(block: PlanBlockViewModel): PlanBlockData {
  return {
    id: block.id,
    items: [...block.fixedCommitments, ...block.flexibleRhythms].map(toPlanItemData),
    label: block.label,
    softTimeRange: block.softTimeRange,
    state: toPlanBlockState(block.state),
    summary: block.summary,
  };
}

function planScreenSnapshotFromProvider(snapshot: AppDataSnapshot): AppDataSnapshot {
  return {
    ...snapshot,
    planBlocks: mockPlanBlocks.map((block) => ({
      ...block,
      items: block.items.map((item) => ({
        ...item,
        hiddenEdges: item.hiddenEdges ?? [],
      })),
      state: block.state === 'room'
        ? 'planned'
        : block.state === 'full'
          ? 'heavy'
          : block.state === 'wind-down'
            ? 'wind down'
            : 'light',
    })),
  };
}

export function PlanScreen() {
  const { snapshot } = useAppSnapshot();
  const [selectedDay, setSelectedDay] = useState<DayName>('Monday');
  const [placementFeedback, setPlacementFeedback] = useState<SoftPlacementFeedback | null>(null);
  const [placingSuggestionId, setPlacingSuggestionId] = useState<string | null>(null);
  const planViewModel = useMemo(
    () => buildPlanViewModel(planScreenSnapshotFromProvider(snapshot)),
    [snapshot],
  );
  const dayShapePreview = useMemo(
    () => buildDayShapePreviewViewModel(snapshot, selectedDay),
    [selectedDay, snapshot],
  );
  const softSuggestions = useMemo(
    () => buildSoftScheduleSuggestionsViewModel(snapshot, selectedDay),
    [selectedDay, snapshot],
  );
  const hasDayShapeBlocks = dayShapePreview.groups.some((group) => group.blocks.length > 0);
  const hasSoftSuggestions = softSuggestions.suggestions.length > 0;
  const addSoftPlacement = useCallback(async (suggestion: SoftScheduleSuggestionViewModel) => {
    const date = localDateForNextSelectedDay(softSuggestions.selectedDay);

    setPlacingSuggestionId(suggestion.id);
    setPlacementFeedback(null);

    try {
      const existingPlacements = await loadSoftPlacementsForDate(date);
      const alreadyExists = existingPlacements.some((placement) =>
        placement.taskId === suggestion.taskId &&
        placement.blockId === suggestion.blockId &&
        placement.date === date,
      );

      if (alreadyExists) {
        setPlacementFeedback({
          kind: 'duplicate',
          lines: ['This soft placement already exists.', 'Nothing else changed.'],
        });
        return;
      }

      const timestamp = new Date().toISOString();
      const result = await saveSoftPlacement({
        blockId: suggestion.blockId,
        blockLabelSnapshot: suggestion.blockLabel,
        createdAt: timestamp,
        date,
        end: suggestion.blockEnd,
        id: createSoftPlacementId({
          blockId: suggestion.blockId,
          date,
          taskId: suggestion.taskId,
        }),
        placementSource: 'userConfirmed',
        start: suggestion.blockStart,
        status: 'planned',
        taskId: suggestion.taskId,
        taskTitleSnapshot: suggestion.taskTitle,
        updatedAt: timestamp,
      });

      if (result.ok) {
        setPlacementFeedback({
          kind: 'success',
          lines: ['Soft placement added.', 'No calendar event created.', 'You can remove it later.'],
        });
        return;
      }

      if (result.errors.some((error) => error.includes('already exists'))) {
        setPlacementFeedback({
          kind: 'duplicate',
          lines: ['This soft placement already exists.', 'Nothing else changed.'],
        });
        return;
      }

      setPlacementFeedback({
        kind: 'error',
        lines: ['Soft placement was not added.', 'Nothing else changed.'],
      });
    } catch {
      setPlacementFeedback({
        kind: 'error',
        lines: ['Soft placement was not added.', 'Nothing else changed.'],
      });
    } finally {
      setPlacingSuggestionId(null);
    }
  }, [softSuggestions.selectedDay]);

  return (
    <div className="screen-stack plan-screen">
      <section className="plan-hero" aria-labelledby="plan-title">
        <p className="eyebrow">Soft rhythm scaffold</p>
        <h1 id="plan-title">Plan</h1>
        <p>Plan the shape of your day, not every minute.</p>
      </section>
      <Card>
        <div className="plan-room-message">
          <div>
            <h2>{planViewModel.roomMessage.label}</h2>
            <p>{planViewModel.roomMessage.body}</p>
            <p className="plan-life-shape-preview">
              Life shape preview: work hours, buffers, and protected blocks will shape future planning.
            </p>
          </div>
          <span>Power underneath. Calm on the surface.</span>
        </div>
      </Card>
      <Card>
        <section className="day-shape-preview" aria-labelledby="day-shape-preview-title">
          <div className="day-shape-preview__header">
            <div>
              <p className="section-label">Read-only day shape</p>
              <h2 id="day-shape-preview-title">Day Shape preview</h2>
              <p>{dayShapePreview.intro}</p>
              <p>{dayShapePreview.boundaryCopy}</p>
            </div>
            <label className="day-shape-preview__select">
              <span>Selected day</span>
              <select
                onChange={(event) => setSelectedDay(event.target.value as DayName)}
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
                <section className="day-shape-preview__group" key={group.id} aria-labelledby={`day-shape-${group.id}`}>
                  <div className="day-shape-preview__group-header">
                    <h3 id={`day-shape-${group.id}`}>{group.title}</h3>
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
                    <p className="day-shape-preview__quiet">No blocks in this category for {dayShapePreview.selectedDay}.</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="day-shape-preview__empty">
              <h3>{dayShapePreview.emptyState.title}</h3>
              <p>{dayShapePreview.emptyState.message}</p>
            </div>
          )}
        </section>
      </Card>
      <Card>
        <section className="soft-suggestions" aria-labelledby="soft-suggestions-title">
          <div className="soft-suggestions__header">
            <p className="section-label">Read-only planning context</p>
            <h2 id="soft-suggestions-title">{softSuggestions.title}</h2>
            {softSuggestions.intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          {hasSoftSuggestions ? (
            <ul className="soft-suggestions__list">
              {softSuggestions.suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <div>
                    <strong>{suggestion.taskTitle}</strong>
                    <span>{suggestion.blockLabel} - {suggestion.blockTimeRange}</span>
                  </div>
                  <p>{suggestion.reason}</p>
                  <p>{suggestion.boundaryCopy}</p>
                  <Button
                    className="soft-suggestions__placement-action"
                    disabled={placingSuggestionId === suggestion.id}
                    onClick={() => void addSoftPlacement(suggestion)}
                  >
                    {placingSuggestionId === suggestion.id ? 'Adding placement' : 'Add soft placement'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="soft-suggestions__empty">
              <h3>{softSuggestions.emptyState.title}</h3>
              <p>{softSuggestions.emptyState.message}</p>
            </div>
          )}

          {placementFeedback ? (
            <div className={`soft-suggestions__feedback soft-suggestions__feedback--${placementFeedback.kind}`} role="status">
              {placementFeedback.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}

          {softSuggestions.askFirstPossibilities.length > 0 ? (
            <div className="soft-suggestions__ask-first">
              <h3>Ask first possibilities</h3>
              <ul>
                {softSuggestions.askFirstPossibilities.map((possibility) => (
                  <li key={possibility.id}>
                    <strong>{possibility.blockLabel}</strong>
                    <span>{possibility.typeLabel} - {possibility.blockTimeRange}</span>
                    <p>{possibility.meaning}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </Card>
      <div className="plan-blocks" aria-label="Broad day blocks">
        {planViewModel.blocks.map((block) => (
          <PlanBlock block={toPlanBlockData(block)} key={block.id} />
        ))}
      </div>
    </div>
  );
}
