import type {
  InternalPlacement,
  SchedulerPlan,
  SchedulingDomainModel,
  SchedulingInterval,
} from '../../domain/schedulingModel';
import { dayNameForLocalDate } from './softPlacementDate';

export type DayLineItemKind =
  | 'fixed'
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
  protected: 1,
  askFirst: 2,
  userConfirmed: 3,
  automatic: 4,
  possible: 5,
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
        ? 'Fixed commitment · read-only calendar'
        : 'Fixed commitment',
    });
  }

  if (dayName) {
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

  for (const placement of plan?.placements ?? []) {
    if (placement.date !== date) continue;

    items.push({
      id: `placement:${placement.id}`,
      kind: placement.origin === 'existingUserConfirmed' ? 'userConfirmed' : 'automatic',
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
