import type {
  InternalPlacement,
  SchedulerPlan,
  SchedulingDomainModel,
  SchedulingInterval,
} from '../../domain/schedulingModel';
import { dayNameForLocalDate } from './softPlacementDate';

export type DayLineItemKind =
  | 'fixed'
  | 'work'
  | 'protected'
  | 'askFirst'
  | 'automatic'
  | 'userConfirmed'
  | 'possible';

export type DayLineItem = {
  id: string;
  kind: DayLineItemKind;
  title: string;
  start: string;
  end: string;
  detail: string;
};

export type DayLineViewModel = {
  date: string;
  items: DayLineItem[];
};

const kindOrder: Record<DayLineItemKind, number> = {
  fixed: 0,
  work: 1,
  protected: 2,
  askFirst: 3,
  userConfirmed: 4,
  automatic: 5,
  possible: 6,
};

function intervalForDate(
  interval: SchedulingInterval,
  date: string,
): { start: string; end: string } | null {
  if (interval.kind === 'datedLocal') {
    return interval.date === date
      ? { start: interval.start, end: interval.end }
      : null;
  }

  const dayName = dayNameForLocalDate(date);
  if (!dayName || !interval.start || !interval.end || !interval.days.includes(dayName)) {
    return null;
  }

  return { start: interval.start, end: interval.end };
}

function placementTargetId(placement: InternalPlacement) {
  return placement.targetKind === 'rhythm'
    ? placement.rhythmId ?? placement.intentionId
    : placement.intentionId;
}

function placementTitle(
  placement: InternalPlacement,
  titleByTargetId: Record<string, string>,
) {
  return titleByTargetId[placementTargetId(placement)] ?? 'Private task';
}

function placementDetail(placement: InternalPlacement) {
  const variant = placement.variantKind
    ? ` · ${placement.variantKind}`
    : '';

  return placement.origin === 'existingUserConfirmed'
    ? `User-confirmed placement${variant}`
    : `Flexible private plan${variant}`;
}

function workPlanningDetail(workPlanningUse: string) {
  switch (workPlanningUse) {
    case 'unavailable':
      return 'Work period · unavailable for private planning';
    case 'askFirst':
      return 'Work period · ask first before private planning';
    case 'workRhythmsOnly':
      return 'Work period · work rhythms only';
    case 'allowSuitableTasks':
      return 'Work period · suitable private tasks may be considered';
    default:
      return 'Work period';
  }
}

export function buildPlanDayLine({
  date,
  input,
  plan,
  titleByTargetId,
}: {
  date: string;
  input: SchedulingDomainModel;
  plan: SchedulerPlan | null;
  titleByTargetId: Record<string, string>;
}): DayLineViewModel {
  const dayName = dayNameForLocalDate(date);
  const items: DayLineItem[] = [];

  for (const commitment of input.externalCommitments) {
    const range = intervalForDate(commitment.interval, date);
    if (!range || !commitment.hard) continue;

    items.push({
      id: `fixed:${commitment.id}`,
      kind: 'fixed',
      title: commitment.title,
      start: range.start,
      end: range.end,
      detail: commitment.source === 'calendar'
        ? 'Read-only calendar commitment'
        : 'Saved fixed commitment',
    });
  }

  if (dayName) {
    for (const profile of input.dayProfiles) {
      if (!profile.assignedWeekdays.includes(dayName) || !profile.workPeriod) continue;

      items.push({
        id: `work:${profile.id}`,
        kind: 'work',
        title: profile.name,
        start: profile.workPeriod.start,
        end: profile.workPeriod.end,
        detail: workPlanningDetail(profile.workPlanningUse),
      });
    }

    for (const window of input.capacityWindows) {
      if (!window.interval.days.includes(dayName) || !window.interval.start || !window.interval.end) {
        continue;
      }

      const kind: DayLineItemKind = window.schedulerUse === 'unavailable'
        ? 'protected'
        : window.schedulerUse === 'askFirst'
          ? 'askFirst'
          : 'possible';
      const detail = kind === 'protected'
        ? 'Protected / unavailable time'
        : kind === 'askFirst'
          ? 'Ask first · not automatic capacity'
          : 'Possible space · explicitly marked available';

      items.push({
        id: `${kind}:${window.id}`,
        kind,
        title: window.title,
        start: window.interval.start,
        end: window.interval.end,
        detail,
      });
    }
  }

  // User-confirmed placement truth comes from the current canonical projection,
  // not from the scheduler snapshot. A lifecycle write may succeed even when a
  // best-effort repair fails, so a stale scheduler plan must not hide or revive
  // a real saved user placement on the Day Line.
  for (const placement of input.placements) {
    if (placement.origin !== 'existingUserConfirmed' || placement.date !== date) continue;

    items.push({
      id: `placement:${placement.id}`,
      kind: 'userConfirmed',
      title: placementTitle(placement, titleByTargetId),
      start: placement.start,
      end: placement.end,
      detail: placementDetail(placement),
    });
  }

  // Scheduler-owned rows remain tied to the persisted accepted plan. Ignore
  // any user-confirmed copies in that snapshot so current canonical state wins.
  for (const placement of plan?.placements ?? []) {
    if (placement.origin !== 'scheduler' || placement.date !== date) continue;

    items.push({
      id: `placement:${placement.id}`,
      kind: 'automatic',
      title: placementTitle(placement, titleByTargetId),
      start: placement.start,
      end: placement.end,
      detail: placementDetail(placement),
    });
  }

  items.sort((left, right) =>
    left.start.localeCompare(right.start) ||
    left.end.localeCompare(right.end) ||
    kindOrder[left.kind] - kindOrder[right.kind] ||
    left.title.localeCompare(right.title),
  );

  return { date, items };
}
