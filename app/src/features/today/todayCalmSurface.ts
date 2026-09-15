import type {
  SchedulerPlan,
  SchedulerPlanChange,
  SchedulerRepairMetadata,
  SchedulingDomainModel,
} from '../../domain/schedulingModel';
import { buildPlanDayLine, type DayLineItem } from '../plan/dayLine';

export type TodayPlanStatus = 'available' | 'missing' | 'invalid' | 'error';
export type TodayLaterItemKind = 'fixed' | 'automatic' | 'userConfirmed';

export type TodayLaterItem = {
  id: string;
  kind: TodayLaterItemKind;
  title: string;
  start: string;
  end: string;
  detail: string;
};

export type TodayChangedItem = {
  kind: SchedulerPlanChange['kind'];
  title: string;
  summary: string;
  reason: string;
};

export type TodayCalmSurface = {
  currentCommitments: TodayLaterItem[];
  currentPrivatePlacements: TodayLaterItem[];
  nextBoundaryTime: string | null;
  later: {
    items: TodayLaterItem[];
    remainingCount: number;
    planStatus: TodayPlanStatus;
  };
  changed: {
    attribution: string;
    items: TodayChangedItem[];
    canUndo: boolean;
  } | null;
};

const DEFAULT_LATER_LIMIT = 4;
const undoableTodayRepairReasons = new Set([
  'Reduce today was applied to the current local date.',
  'Today returned to Normal using current live scheduling information.',
]);
const factualLaterKinds = new Set<DayLineItem['kind']>([
  'fixed',
  'automatic',
  'userConfirmed',
]);

function asLaterItem(item: DayLineItem): TodayLaterItem {
  return {
    id: item.id,
    kind: item.kind as TodayLaterItemKind,
    title: item.title,
    start: item.start,
    end: item.end,
    detail: item.detail,
  };
}

function isCurrent(item: DayLineItem, nowTime: string) {
  return item.start <= nowTime && item.end > nowTime;
}

function minutes(point: { start: string; end: string }) {
  const value = (time: string) => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };
  return value(point.end) - value(point.start);
}

function pointText(
  point: { date: string; start: string; end: string },
  surfaceDate: string,
) {
  const datePrefix = point.date === surfaceDate ? '' : `${point.date}, `;
  return `${datePrefix}${point.start}–${point.end}`;
}

function variantText(point: { start: string; end: string; variantKind?: string }) {
  const kind = point.variantKind
    ? `${point.variantKind[0].toUpperCase()}${point.variantKind.slice(1)}`
    : 'Scheduled form';
  return `${kind}, ${minutes(point)} min`;
}

function changeSummary(change: SchedulerPlanChange, surfaceDate: string) {
  if (change.kind === 'moved' && change.from && change.to) {
    return `Moved from ${pointText(change.from, surfaceDate)} to ${pointText(change.to, surfaceDate)}.`;
  }
  if (change.kind === 'added' && change.to) {
    return `Added at ${pointText(change.to, surfaceDate)}.`;
  }
  if (change.kind === 'removed' && change.from) {
    return `Removed from ${pointText(change.from, surfaceDate)}.`;
  }
  if (change.kind === 'variantChanged' && change.from && change.to) {
    return `Changed from ${variantText(change.from)} to ${variantText(change.to)}.`;
  }
  return 'The saved private plan changed.';
}

function repairAttribution(repair: SchedulerRepairMetadata) {
  const reason = repair.reason.toLowerCase();

  if (reason.includes('reduce today') || reason.includes('reduced day')) {
    return 'Reduced Day changed the private plan.';
  }
  if (reason.includes('returned to normal')) {
    return 'Returning to Normal changed the private plan.';
  }

  switch (repair.trigger) {
    case 'calendarChanged':
      return 'Calendar information changed the private plan.';
    case 'overrun':
      return 'Current work running longer changed the private plan.';
    case 'missedStart':
      return 'A planned start passing changed the private plan.';
    case 'completionChanged':
      return 'Completion changed the private plan.';
    case 'userCorrection':
      return 'A private-plan choice changed the plan.';
    case 'manualReplan':
      return 'A manual replan changed the private plan.';
    default:
      return 'The saved private plan changed.';
  }
}

function canUndoFromToday(repair: SchedulerRepairMetadata) {
  return Boolean(
    repair.undo &&
    repair.trigger === 'userCorrection' &&
    undoableTodayRepairReasons.has(repair.reason),
  );
}

function changedSurface(
  plan: SchedulerPlan | null,
  titleByTargetId: Record<string, string>,
  date: string,
): TodayCalmSurface['changed'] {
  const repair = plan?.repair;
  if (!repair || repair.changes.length === 0) return null;

  return {
    attribution: repairAttribution(repair),
    canUndo: canUndoFromToday(repair),
    items: repair.changes.map((change) => ({
      kind: change.kind,
      title: titleByTargetId[change.targetId] ?? (change.targetKind === 'rhythm' ? 'Private rhythm' : 'Private task'),
      summary: changeSummary(change, date),
      reason: change.reason,
    })),
  };
}

export function buildTodayCalmSurface({
  date,
  nowTime,
  input,
  planStatus,
  plan,
  titleByTargetId,
  currentTaskTargetId,
  laterLimit = DEFAULT_LATER_LIMIT,
}: {
  date: string;
  nowTime: string;
  input: SchedulingDomainModel;
  planStatus: TodayPlanStatus;
  plan: SchedulerPlan | null;
  titleByTargetId: Record<string, string>;
  currentTaskTargetId?: string;
  laterLimit?: number;
}): TodayCalmSurface {
  const effectivePlan = planStatus === 'available' ? plan : null;
  const line = buildPlanDayLine({ date, input, plan: effectivePlan, titleByTargetId });
  const factualItems = line.items.filter((item) => factualLaterKinds.has(item.kind));
  const currentCommitments = factualItems.filter((item) =>
    item.kind === 'fixed' && isCurrent(item, nowTime),
  );
  const currentPrivatePlacements = factualItems.filter((item) =>
    item.kind !== 'fixed' &&
    isCurrent(item, nowTime) &&
    (!currentTaskTargetId || item.targetId !== currentTaskTargetId),
  );
  const laterFacts = factualItems.filter((item) =>
    item.end > nowTime &&
    !isCurrent(item, nowTime) &&
    (!currentTaskTargetId || item.targetId !== currentTaskTargetId),
  );
  const nextBoundaryTime = factualItems
    .flatMap((item) => [item.start, item.end])
    .filter((time) => time > nowTime)
    .sort()[0] ?? null;
  const safeLimit = Number.isInteger(laterLimit) && laterLimit > 0
    ? laterLimit
    : DEFAULT_LATER_LIMIT;

  return {
    currentCommitments: currentCommitments.map(asLaterItem),
    currentPrivatePlacements: currentPrivatePlacements.map(asLaterItem),
    nextBoundaryTime,
    later: {
      items: laterFacts.slice(0, safeLimit).map(asLaterItem),
      remainingCount: Math.max(0, laterFacts.length - safeLimit),
      planStatus,
    },
    changed: planStatus === 'available'
      ? changedSurface(effectivePlan, titleByTargetId, date)
      : null,
  };
}
