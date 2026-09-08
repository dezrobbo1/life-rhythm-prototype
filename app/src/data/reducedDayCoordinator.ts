import { scheduler } from '../domain/primaryScheduler';
import { clipSchedulingInputToNow } from '../domain/elapsedTimeCapacity';
import type {
  InternalPlacement,
  ReducedDayPlanningPolicy,
  SchedulerPlan,
  SchedulerPlanChange,
} from '../domain/schedulingModel';
import {
  buildCurrentLiveSchedulingContext,
  type PrivatePlanCoordinatorOptions,
} from './schedulerPlanCoordinator';
import {
  loadSchedulerPlanState,
  repairAndPersistSchedulerPlan,
  undoPersistedSchedulerRepair,
  type SchedulerDayModeContext,
} from './schedulerPlanStateRepository';

const reducedDayReason = 'Reduce today was applied to the current local date.';

export type ReducedDayPreviewCategory = 'stays' | 'getsSmaller' | 'moves' | 'noLongerFits';

export type ReducedDayPreviewItem = {
  category: ReducedDayPreviewCategory;
  targetId: string;
  title: string;
  detail: string;
  reason?: string;
};

export type ReducedDayPreview = {
  date: string;
  initialPlan: boolean;
  items: ReducedDayPreviewItem[];
  plan: SchedulerPlan;
};

export type ReducedDayActionOptions = PrivatePlanCoordinatorOptions & {
  reducedDay?: ReducedDayPlanningPolicy;
};

export type ReducedDayActionResult =
  | {
      ok: true;
      date: string;
      dayMode: 'normal' | 'reduced';
      plan: SchedulerPlan;
      preview: ReducedDayPreview;
      updatedAt?: string;
      warnings: string[];
    }
  | { ok: false; errors: string[]; warnings: string[] };

function targetId(placement: InternalPlacement): string {
  return placement.targetKind === 'rhythm'
    ? placement.rhythmId ?? placement.intentionId
    : placement.intentionId;
}

function minutes(point: { start: string; end: string }): number {
  const value = (time: string) => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };
  return value(point.end) - value(point.start);
}

function pointText(point: { date: string; start: string; end: string; variantKind?: string }): string {
  return `${point.date}, ${point.start}–${point.end}${point.variantKind ? ` (${point.variantKind})` : ''}`;
}

function itemFromChange(
  change: SchedulerPlanChange,
  titles: Record<string, string>,
): ReducedDayPreviewItem | null {
  const title = titles[change.targetId] ?? 'Private work';
  if (change.kind === 'variantChanged' && change.from && change.to) {
    return {
      category: 'getsSmaller',
      targetId: change.targetId,
      title,
      detail: `${minutes(change.from)} minutes → ${minutes(change.to)} minutes`,
      reason: change.reason,
    };
  }
  if (change.kind === 'moved' && change.from && change.to) {
    return {
      category: 'moves', targetId: change.targetId, title,
      detail: `${pointText(change.from)} → ${pointText(change.to)}`,
      reason: change.reason,
    };
  }
  if (change.kind === 'removed' && change.from) {
    return {
      category: 'noLongerFits', targetId: change.targetId, title,
      detail: `No safe placement after ${pointText(change.from)}.`,
      reason: change.reason,
    };
  }
  return null;
}

function previewFromPlans(
  before: SchedulerPlan | undefined,
  after: SchedulerPlan,
  titles: Record<string, string>,
  date: string,
): ReducedDayPreview {
  if (!before) {
    return { date, initialPlan: true, items: [], plan: after };
  }

  const changedIds = new Set((after.repair?.changes ?? []).map((change) => change.targetId));
  const items = (after.repair?.changes ?? [])
    .map((change) => itemFromChange(change, titles))
    .filter((item): item is ReducedDayPreviewItem => Boolean(item));

  for (const placement of after.placements) {
    const id = targetId(placement);
    const previous = before.placements.find((candidate) => targetId(candidate) === id);
    if (!previous || changedIds.has(id) ||
        previous.date !== placement.date || previous.start !== placement.start ||
        previous.end !== placement.end || previous.variantKind !== placement.variantKind) continue;
    items.push({
      category: 'stays', targetId: id, title: titles[id] ?? 'Private work',
      detail: pointText(placement),
    });
  }

  const newlyUnscheduled = [
    ...after.unscheduledIntentionIds.filter((id) => !before.unscheduledIntentionIds.includes(id)),
    ...after.unscheduledRhythmIds.filter((id) => !before.unscheduledRhythmIds.includes(id)),
  ];
  for (const id of newlyUnscheduled) {
    if (items.some((item) => item.category === 'noLongerFits' && item.targetId === id)) continue;
    items.push({
      category: 'noLongerFits', targetId: id, title: titles[id] ?? 'Private work',
      detail: 'The scheduler could not find a safe placement.',
    });
  }

  return { date, initialPlan: false, items, plan: after };
}

function reducedPolicy(date: string, reducedDay?: ReducedDayPlanningPolicy) {
  return {
    dayMode: 'reduced' as const,
    dayModeDate: date,
    reducedDay: {
      minimumEligibleRhythmIds: [],
      ...reducedDay,
    },
  };
}

async function proposedReducedDay(options: ReducedDayActionOptions) {
  const firstLive = await buildCurrentLiveSchedulingContext({ ...options, readOnly: true });
  if (!firstLive.ok) return firstLive;
  const policy = reducedPolicy(firstLive.now.date, options.reducedDay);
  const live = await buildCurrentLiveSchedulingContext({ ...options, planningPolicy: policy, readOnly: true });
  if (!live.ok) return live;
  const saved = await loadSchedulerPlanState();
  if (saved.status === 'invalid' || saved.status === 'error') {
    return { ok: false as const, errors: saved.errors, warnings: live.context.warnings };
  }

  const safeInput = clipSchedulingInputToNow(live.context.input, live.now);
  const before = saved.status === 'ok' ? saved.plan : undefined;
  const plan = before
    ? scheduler.repairPlan(before, {
        nextInput: safeInput,
        now: live.now,
        reason: reducedDayReason,
        trigger: 'userCorrection',
      })
    : scheduler.buildPlan(safeInput);
  const violations = scheduler.validatePlan(plan, safeInput);
  if (violations.length > 0) {
    return {
      ok: false as const,
      errors: violations.map((violation) => violation.message),
      warnings: live.context.warnings,
    };
  }

  return {
    ok: true as const,
    before,
    live,
    policy,
    preview: previewFromPlans(before, plan, live.context.titleByTargetId, live.now.date),
  };
}

export async function previewReduceToday(
  options: ReducedDayActionOptions = {},
): Promise<ReducedDayActionResult> {
  const proposed = await proposedReducedDay(options);
  if (!proposed.ok) return proposed;
  return {
    ok: true,
    date: proposed.live.now.date,
    dayMode: 'reduced',
    plan: proposed.preview.plan,
    preview: proposed.preview,
    warnings: proposed.live.context.warnings,
  };
}

export async function applyReduceToday(
  options: ReducedDayActionOptions = {},
): Promise<ReducedDayActionResult> {
  // Rebuild everything at click time. The earlier preview is never accepted as input.
  const proposed = await proposedReducedDay(options);
  if (!proposed.ok) return proposed;
  const context: SchedulerDayModeContext = { dayMode: 'reduced', date: proposed.live.now.date };
  const saved = await repairAndPersistSchedulerPlan({
    nextInput: proposed.live.context.input,
    now: proposed.live.now,
    reason: reducedDayReason,
    trigger: 'userCorrection',
  }, undefined, undefined, context);
  if (!saved.ok) return { ok: false, errors: saved.errors, warnings: proposed.live.context.warnings };
  return {
    ok: true,
    date: proposed.live.now.date,
    dayMode: 'reduced',
    plan: saved.plan,
    preview: previewFromPlans(proposed.before, saved.plan, proposed.live.context.titleByTargetId, proposed.live.now.date),
    updatedAt: saved.updatedAt,
    warnings: proposed.live.context.warnings,
  };
}

export async function returnTodayToNormal(
  options: PrivatePlanCoordinatorOptions = {},
): Promise<ReducedDayActionResult> {
  const live = await buildCurrentLiveSchedulingContext({
    ...options,
    planningPolicy: { dayMode: 'normal' },
  });
  if (!live.ok) return live;
  const current = await loadSchedulerPlanState();
  if (current.status === 'invalid' || current.status === 'error') {
    return { ok: false, errors: current.errors, warnings: live.context.warnings };
  }
  const before = current.status === 'ok' ? current.plan : undefined;
  const reducedPlacementsToday = before?.placements
    .filter((placement) =>
      placement.origin === 'scheduler' &&
      placement.date === live.now.date &&
      placement.variantKind === 'minimum' &&
      placement.provenance.includes('Reduced Day used the explicit minimum form for flexible private work.'),
    )
    .map((placement) => placement.id);
  const saved = await repairAndPersistSchedulerPlan({
    nextInput: live.context.input,
    now: live.now,
    reason: 'Today returned to Normal using current live scheduling information.',
    trigger: 'userCorrection',
    ...(reducedPlacementsToday?.length ? { releasePlacementIds: reducedPlacementsToday } : {}),
  }, undefined, undefined, null);
  if (!saved.ok) return { ok: false, errors: saved.errors, warnings: live.context.warnings };
  return {
    ok: true,
    date: live.now.date,
    dayMode: 'normal',
    plan: saved.plan,
    preview: previewFromPlans(before, saved.plan, live.context.titleByTargetId, live.now.date),
    updatedAt: saved.updatedAt,
    warnings: live.context.warnings,
  };
}

export async function undoTodayPlanChange(
  options: PrivatePlanCoordinatorOptions = {},
): Promise<ReducedDayActionResult> {
  const live = await buildCurrentLiveSchedulingContext(options);
  if (!live.ok) return live;
  const current = await loadSchedulerPlanState();
  if (current.status !== 'ok') {
    return current.status === 'missing'
      ? { ok: false, errors: ['There is no saved private plan to undo.'], warnings: live.context.warnings }
      : { ok: false, errors: current.errors, warnings: live.context.warnings };
  }
  const undone = await undoPersistedSchedulerRepair();
  if (!undone.ok) return { ok: false, errors: undone.errors, warnings: live.context.warnings };
  const reduced = undone.dayModeContext?.date === live.now.date;
  return {
    ok: true,
    date: live.now.date,
    dayMode: reduced ? 'reduced' : 'normal',
    plan: undone.plan,
    preview: previewFromPlans(current.plan, undone.plan, live.context.titleByTargetId, live.now.date),
    updatedAt: undone.updatedAt,
    warnings: live.context.warnings,
  };
}

export async function loadTodayDayMode(
  options: PrivatePlanCoordinatorOptions = {},
): Promise<
  | { ok: true; date: string; dayMode: 'normal' | 'reduced'; plan?: SchedulerPlan; preview?: ReducedDayPreview }
  | { ok: false; errors: string[] }
> {
  const live = await buildCurrentLiveSchedulingContext(options);
  if (!live.ok) return { ok: false, errors: live.errors };
  const saved = await loadSchedulerPlanState();
  if (saved.status === 'invalid' || saved.status === 'error') return { ok: false, errors: saved.errors };
  const reduced = saved.status === 'ok' && saved.dayModeContext?.date === live.now.date;
  return {
    ok: true,
    date: live.now.date,
    dayMode: reduced ? 'reduced' : 'normal',
    ...(saved.status === 'ok' ? { plan: saved.plan } : {}),
    ...(reduced && saved.status === 'ok'
      ? {
          preview: previewFromPlans(
            saved.plan.repair?.undo,
            saved.plan,
            live.context.titleByTargetId,
            live.now.date,
          ),
        }
      : {}),
  };
}
