import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import { Button, ScreenHero } from '../components';
import { buildCurrentLiveSchedulingContext } from '../data/schedulerPlanCoordinator';
import { loadSchedulerPlanState } from '../data/schedulerPlanStateRepository';
import { buildPlanDayLine, type DayLineViewModel } from '../features/plan/dayLine';
import {
  dayNameForLocalDate,
  localDateForNextSelectedDay,
} from '../features/plan/softPlacementDate';
import { dayShapePreviewDays, type DayName } from '../viewModels';
import { PersonalPlanScreen } from './PersonalPlanScreen';

type PlanDayLineScreenProps = {
  preferredPlacementDate?: string | null;
  preferredTaskId?: string | null;
};

type DayLineState =
  | { status: 'loading' }
  | { status: 'ready'; viewModel: DayLineViewModel }
  | { status: 'error'; errors: string[] };

const dayLineKindLabels = {
  fixed: 'Fixed commitment',
  protected: 'Protected time',
  askFirst: 'Ask first',
  automatic: 'Flexible plan',
  userConfirmed: 'Your placement',
  possible: 'Possible space',
} as const;

export function PlanDayLineScreen({
  preferredPlacementDate = null,
  preferredTaskId = null,
}: PlanDayLineScreenProps = {}) {
  const [selectedDay, setSelectedDay] = useState<DayName>(
    () => dayNameForLocalDate(preferredPlacementDate) ?? 'Monday',
  );
  const [selectedPlacementDateOverride, setSelectedPlacementDateOverride] = useState<string | null>(
    preferredPlacementDate,
  );
  const [dayLineState, setDayLineState] = useState<DayLineState>({ status: 'loading' });
  const [retryVersion, setRetryVersion] = useState(0);

  const selectedDate = useMemo(
    () => selectedPlacementDateOverride ?? localDateForNextSelectedDay(selectedDay),
    [selectedDay, selectedPlacementDateOverride],
  );

  useEffect(() => {
    setSelectedDay(dayNameForLocalDate(preferredPlacementDate) ?? 'Monday');
    setSelectedPlacementDateOverride(preferredPlacementDate);
  }, [preferredPlacementDate]);

  useEffect(() => {
    setDayLineState({ status: 'loading' });

    const subscription = liveQuery(async (): Promise<DayLineState> => {
      const [live, savedPlan] = await Promise.all([
        buildCurrentLiveSchedulingContext({
          horizonDays: 1,
          readOnly: true,
          startDate: selectedDate,
        }),
        loadSchedulerPlanState(),
      ]);

      if (!live.ok) {
        return {
          status: 'error',
          errors: live.errors.length > 0
            ? live.errors
            : ['Day Line data could not be read safely.'],
        };
      }

      if (savedPlan.status === 'invalid' || savedPlan.status === 'error') {
        return { status: 'error', errors: savedPlan.errors };
      }

      return {
        status: 'ready',
        viewModel: buildPlanDayLine({
          date: selectedDate,
          input: live.context.input,
          plan: savedPlan.status === 'ok' ? savedPlan.plan : null,
          titleByTargetId: live.context.titleByTargetId,
        }),
      };
    }).subscribe({
      next: (state) => setDayLineState(state),
      error: () => {
        setDayLineState({
          status: 'error',
          errors: ['Day Line data could not be read. Nothing stored on this device was changed.'],
        });
      },
    });

    return () => subscription.unsubscribe();
  }, [retryVersion, selectedDate]);

  return (
    <div className="gate6-plan-surface">
      <ScreenHero
        className="plan-hero"
        tagline="See what is fixed, protected and flexibly planned without opening the scheduling machinery."
        title="Plan"
        titleId="plan-title"
      />

      <section className="plan-day-line" aria-labelledby="plan-day-line-title">
        <div className="plan-day-line__header">
          <div>
            <p className="section-label">Day Line</p>
            <h2 id="plan-day-line-title">{selectedDay}</h2>
            <p>
              Recorded commitments, protected time and private placements for this day.
              Blank gaps stay unclassified.
            </p>
          </div>

          <label className="plan-day-line__select">
            <span>Selected day</span>
            <select
              onChange={(event) => {
                setSelectedDay(event.target.value as DayName);
                setSelectedPlacementDateOverride(null);
              }}
              value={selectedDay}
            >
              {dayShapePreviewDays.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </label>
        </div>

        {dayLineState.status === 'loading' ? (
          <div className="surface-status" aria-busy="true" role="status">
            <p>Reading the shape of this day...</p>
          </div>
        ) : dayLineState.status === 'error' ? (
          <div className="surface-status surface-status--error" role="alert">
            <strong>Day Line could not be loaded.</strong>
            <p>The detailed Plan below remains available. Nothing stored on this device was changed.</p>
            <Button onClick={() => setRetryVersion((value) => value + 1)}>Retry Day Line</Button>
          </div>
        ) : dayLineState.viewModel.items.length > 0 ? (
          <ol className="surface-ledger plan-day-line__ledger" aria-label={`${selectedDay} Day Line`}>
            {dayLineState.viewModel.items.map((item) => (
              <li
                className={`surface-ledger-row plan-day-line__row plan-day-line__row--${item.kind}`}
                key={item.id}
              >
                <span className="surface-time plan-day-line__time">{item.start}–{item.end}</span>
                <div className="surface-ledger-row__main">
                  <strong>{item.title}</strong>
                  <span>{dayLineKindLabels[item.kind]} · {item.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="plan-day-line__empty">
            <strong>No fixed, protected or planned items are recorded for {selectedDay}.</strong>
            <p>Blank time is not treated as available capacity.</p>
          </div>
        )}

        <p className="plan-day-line__boundary">
          Only explicit available blocks can represent possible planning space. Empty calendar gaps do not.
        </p>
      </section>

      <div className="gate6-plan-surface__details" aria-label="Detailed Plan controls">
        <PersonalPlanScreen
          preferredPlacementDate={selectedDate}
          preferredTaskId={preferredTaskId}
        />
      </div>
    </div>
  );
}
