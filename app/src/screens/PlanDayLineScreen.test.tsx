// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const coordinatorMocks = vi.hoisted(() => ({
  buildCurrentLiveSchedulingContext: vi.fn(),
}));

const schedulerStateMocks = vi.hoisted(() => ({
  loadSchedulerPlanState: vi.fn(),
}));

vi.mock('dexie', () => ({
  liveQuery: (query: () => Promise<unknown>) => ({
    subscribe: ({ next, error }: { next: (value: unknown) => void; error: () => void }) => {
      let active = true;
      void query().then(
        (value) => {
          if (active) next(value);
        },
        () => {
          if (active) error();
        },
      );
      return {
        unsubscribe: () => {
          active = false;
        },
      };
    },
  }),
}));

vi.mock('../data/schedulerPlanCoordinator', () => coordinatorMocks);
vi.mock('../data/schedulerPlanStateRepository', () => schedulerStateMocks);
vi.mock('./PersonalPlanScreen', () => ({
  PersonalPlanScreen: ({ preferredPlacementDate }: { preferredPlacementDate?: string | null }) => (
    <div data-testid="personal-plan-proxy">Detailed Plan {preferredPlacementDate}</div>
  ),
}));

import {
  currentLocalDate,
  dayNameForLocalDate,
  localDateForNextSelectedDay,
} from '../features/plan/softPlacementDate';
import { PlanDayLineScreen } from './PlanDayLineScreen';

const mondayDate = '2026-09-14';

const liveInput = {
  intentions: [],
  rhythms: [],
  externalCommitments: [
    {
      id: 'school-run',
      title: 'School run',
      source: 'calendar' as const,
      sourceId: 'calendar:school-run',
      interval: {
        kind: 'recurringLocal' as const,
        days: ['Monday'],
        start: '08:00',
        end: '08:30',
      },
      hard: true,
      travelBeforeMinutes: 0,
      transitionAfterMinutes: 0,
    },
  ],
  capacityWindows: [
    {
      id: 'protected-morning',
      title: 'Protected morning',
      category: 'protectedTime',
      interval: {
        kind: 'recurringLocal' as const,
        days: ['Monday'],
        start: '07:00',
        end: '08:00',
      },
      schedulerUse: 'unavailable' as const,
      sourceId: 'protected-morning',
    },
  ],
  placements: [],
  dayProfiles: [],
};

const savedPlan = {
  placements: [
    {
      id: 'auto-admin',
      intentionId: 'admin-task',
      date: mondayDate,
      start: '09:00',
      end: '09:20',
      origin: 'scheduler' as const,
      targetKind: 'intention' as const,
      variantKind: 'minimum' as const,
      provenance: [],
    },
  ],
  rejectedExistingPlacements: [],
  unscheduledIntentionIds: [],
  unscheduledRhythmIds: [],
};

beforeEach(() => {
  coordinatorMocks.buildCurrentLiveSchedulingContext.mockResolvedValue({
    ok: true,
    context: {
      input: liveInput,
      titleByTargetId: { 'admin-task': 'Clear admin note' },
      warnings: [],
    },
    now: {
      date: mondayDate,
      time: '08:00',
      timezone: 'Australia/Perth',
    },
  });
  schedulerStateMocks.loadSchedulerPlanState.mockResolvedValue({
    status: 'ok',
    plan: savedPlan,
    updatedAt: '2026-09-14T00:00:00.000Z',
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Gate 6C Plan Day Line screen', () => {
  it('opens on the browser current local date when no Pool-to-Plan date was supplied', async () => {
    const today = currentLocalDate();
    const todayName = dayNameForLocalDate(today);

    render(<PlanDayLineScreen />);

    await waitFor(() => {
      expect(coordinatorMocks.buildCurrentLiveSchedulingContext).toHaveBeenCalledWith({
        horizonDays: 1,
        readOnly: true,
        startDate: today,
      });
    });
    expect((screen.getByLabelText('Selected day') as HTMLSelectElement).value).toBe(todayName);
    expect(screen.getByTestId('personal-plan-proxy').textContent).toContain(today);
  });

  it('shows one truthful day ledger and keeps the detailed Plan on the same selected date', async () => {
    render(<PlanDayLineScreen preferredPlacementDate={mondayDate} />);

    expect(await screen.findByText('School run')).toBeTruthy();
    expect(screen.getByText('Protected morning')).toBeTruthy();
    expect(screen.getByText('Clear admin note')).toBeTruthy();
    expect(screen.getByText(/Blank gaps stay unclassified/)).toBeTruthy();
    expect(screen.getByTestId('personal-plan-proxy').textContent).toContain(mondayDate);
    expect(coordinatorMocks.buildCurrentLiveSchedulingContext).toHaveBeenCalledWith({
      horizonDays: 1,
      readOnly: true,
      startDate: mondayDate,
    });
  });

  it('uses the Day Line day selector as the date authority for the detailed Plan', async () => {
    const user = userEvent.setup();
    render(<PlanDayLineScreen preferredPlacementDate={mondayDate} />);

    await screen.findByText('School run');
    await user.selectOptions(screen.getByLabelText('Selected day'), 'Tuesday');
    const expectedTuesday = localDateForNextSelectedDay('Tuesday');

    await waitFor(() => {
      expect(screen.getByTestId('personal-plan-proxy').textContent).toContain(expectedTuesday);
    });
    expect(coordinatorMocks.buildCurrentLiveSchedulingContext).toHaveBeenLastCalledWith({
      horizonDays: 1,
      readOnly: true,
      startDate: expectedTuesday,
    });
  });

  it('fails visibly without replacing detailed Plan and can retry the read-only Day Line', async () => {
    const user = userEvent.setup();
    coordinatorMocks.buildCurrentLiveSchedulingContext
      .mockResolvedValueOnce({
        ok: false,
        errors: ['calendar: Saved read-only calendar could not be read.'],
        warnings: [],
      })
      .mockResolvedValueOnce({
        ok: true,
        context: {
          input: liveInput,
          titleByTargetId: { 'admin-task': 'Clear admin note' },
          warnings: [],
        },
        now: {
          date: mondayDate,
          time: '08:00',
          timezone: 'Australia/Perth',
        },
      });

    render(<PlanDayLineScreen preferredPlacementDate={mondayDate} />);

    expect((await screen.findByRole('alert')).textContent).toContain('Day Line could not be loaded.');
    expect(screen.getByTestId('personal-plan-proxy')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry Day Line' }));

    expect(await screen.findByText('School run')).toBeTruthy();
    expect(coordinatorMocks.buildCurrentLiveSchedulingContext).toHaveBeenCalledTimes(2);
  });
});
