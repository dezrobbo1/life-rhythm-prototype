import { useMemo, useState } from 'react';
import { Card } from '../components';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import { PlanBlock } from '../features/plan/PlanBlock';
import { mockPlanBlocks, type PlanBlock as PlanBlockData, type PlanItem } from '../features/plan/mockPlanData';
import {
  buildDayShapePreviewViewModel,
  buildPlanViewModel,
  dayShapePreviewDays,
  type AppDataSnapshot,
  type DayName,
  type PlanBlockViewModel,
  type PlanItemViewModel,
} from '../viewModels';

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
  const planViewModel = useMemo(
    () => buildPlanViewModel(planScreenSnapshotFromProvider(snapshot)),
    [snapshot],
  );
  const dayShapePreview = useMemo(
    () => buildDayShapePreviewViewModel(snapshot, selectedDay),
    [selectedDay, snapshot],
  );
  const hasDayShapeBlocks = dayShapePreview.groups.some((group) => group.blocks.length > 0);

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
      <div className="plan-blocks" aria-label="Broad day blocks">
        {planViewModel.blocks.map((block) => (
          <PlanBlock block={toPlanBlockData(block)} key={block.id} />
        ))}
      </div>
    </div>
  );
}
