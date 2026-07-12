import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, ScreenHero } from '../components';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import {
  loadSoftPlacementsForDate,
  markSoftPlacementRemoved,
} from '../data/softPlacementRepository';
import type { SoftPlacement } from '../data/schemas';
import { localDateForNextSelectedDay } from '../features/plan/softPlacementDate';
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

export function PersonalPlanScreen() {
  const { snapshot } = useAppSnapshot();
  const [selectedDay, setSelectedDay] = useState<DayName>('Monday');
  const [savedSoftPlacements, setSavedSoftPlacements] = useState<SoftPlacement[]>([]);
  const [removingPlacementId, setRemovingPlacementId] = useState<string | null>(null);
  const [placementFeedback, setPlacementFeedback] = useState<PlacementFeedback | null>(null);

  const dayShapePreview = useMemo(
    () => buildDayShapePreviewViewModel(snapshot, selectedDay),
    [selectedDay, snapshot],
  );
  const selectedPlacementDate = useMemo(
    () => localDateForNextSelectedDay(dayShapePreview.selectedDay),
    [dayShapePreview.selectedDay],
  );
  const hasDayShapeBlocks = dayShapePreview.groups.some((group) => group.blocks.length > 0);
  const visibleSoftPlacements = useMemo(
    () => savedSoftPlacements.filter((placement) => visibleSoftPlacementStatuses.includes(placement.status)),
    [savedSoftPlacements],
  );

  const refreshSavedSoftPlacements = useCallback(async () => {
    const placements = await loadSoftPlacementsForDate(selectedPlacementDate);
    setSavedSoftPlacements(placements);
  }, [selectedPlacementDate]);

  useEffect(() => {
    let active = true;

    setSavedSoftPlacements([]);
    setPlacementFeedback(null);

    loadSoftPlacementsForDate(selectedPlacementDate)
      .then((placements) => {
        if (active) {
          setSavedSoftPlacements(placements);
        }
      })
      .catch(() => {
        if (active) {
          setSavedSoftPlacements([]);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedPlacementDate]);

  const removeSoftPlacement = useCallback(async (placement: SoftPlacement) => {
    setRemovingPlacementId(placement.id);
    setPlacementFeedback(null);

    try {
      const result = await markSoftPlacementRemoved(placement.id);

      if (!result.ok) {
        setPlacementFeedback({
          kind: 'error',
          lines: ['Soft placement was not removed.', 'Nothing else changed.'],
        });
        return;
      }

      await refreshSavedSoftPlacements();
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
  }, [refreshSavedSoftPlacements]);

  return (
    <div className="screen-stack plan-screen personal-plan-screen">
      <ScreenHero
        className="plan-hero"
        eyebrow="Your day shape"
        icon="plan"
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
