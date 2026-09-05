import {
  deriveGate2Availability,
  externalCommitmentsFromCalendarEvents,
} from '../domain/calendarAvailability';
import { projectCurrentStateToSchedulingDomain } from '../domain/currentStateProjection';
import type {
  CandidateSchedulingInterval,
  ExternalCommitment,
  SchedulerPlan,
  SchedulerRepairNow,
  SchedulerRepairTrigger,
  SchedulingDomainModel,
  SchedulingInterval,
} from '../domain/schedulingModel';
import { readPersistedCalendarEvents } from './calendarSourceRepository';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  buildAndPersistSchedulerPlan,
  loadSchedulerPlanState,
  repairAndPersistSchedulerPlan,
  undoPersistedSchedulerRepair,
} from './schedulerPlanStateRepository';
import {
  activeTaskSchema,
  rhythmTemplateSchema,
  softPlacementSchema,
  taskPoolItemSchema,
} from './schemas';
import { loadSettingsResult } from './settingsRepository';

const DEFAULT_HORIZON_DAYS = 7;
const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

type MinuteRange = {
  start: number;
  end: number;
};

type LiveSchedulerContext = {
  input: SchedulingDomainModel;
  titleByTargetId: Record<string, string>;
  warnings: string[];
};

export type PrivatePlanActionResult =
  | {
      ok: true;
      mode: 'loaded' | 'built' | 'repaired' | 'undone';
      plan: SchedulerPlan;
      titleByTargetId: Record<string, string>;
      updatedAt: string;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

export type PrivatePlanCoordinatorOptions = {
  horizonDays?: number;
  now?: Date;
  startDate?: string;
  timezone?: string;
};

export type PrivatePlanRepairRequest = PrivatePlanCoordinatorOptions & {
  reason: string;
  trigger: SchedulerRepairTrigger;
  releasePlacementIds?: string[];
  surfacedPlacementIds?: string[];
  pinnedPlacementIds?: string[];
};

function issueMessages(
  label: string,
  issues: Array<{ message: string; path: Array<string | number> }>,
) {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? `${label}.${issue.path.join('.')}` : label;
    return `${path}: ${issue.message}`;
  });
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return `${next.getUTCFullYear().toString().padStart(4, '0')}-${(next.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${next.getUTCDate().toString().padStart(2, '0')}`;
}

function weekdayForDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function resolveTimezone(timezone?: string): string {
  if (timezone?.trim()) return timezone.trim();
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function localPointForDate(now: Date, timezone: string): SchedulerRepairNow {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
    timezone,
  };
}

function intervalRangeForDate(interval: SchedulingInterval, date: string): MinuteRange | null {
  if (interval.kind === 'datedLocal') {
    if (interval.date !== date) return null;
    return {
      start: minutesFromTime(interval.start),
      end: minutesFromTime(interval.end),
    };
  }

  if (!interval.start || !interval.end || !interval.days.includes(weekdayForDate(date))) {
    return null;
  }

  return {
    start: minutesFromTime(interval.start),
    end: minutesFromTime(interval.end),
  };
}

function commitmentRangeForDate(commitment: ExternalCommitment, date: string): MinuteRange | null {
  if (!commitment.hard) return null;
  const range = intervalRangeForDate(commitment.interval, date);
  if (!range) return null;

  return {
    start: Math.max(0, range.start - commitment.travelBeforeMinutes),
    end: Math.min(24 * 60, range.end + commitment.transitionAfterMinutes),
  };
}

function subtractRange(segments: MinuteRange[], blocker: MinuteRange): MinuteRange[] {
  const next: MinuteRange[] = [];

  for (const segment of segments) {
    if (blocker.end <= segment.start || blocker.start >= segment.end) {
      next.push(segment);
      continue;
    }

    if (segment.start < blocker.start) {
      next.push({ start: segment.start, end: Math.min(segment.end, blocker.start) });
    }
    if (blocker.end < segment.end) {
      next.push({ start: Math.max(segment.start, blocker.end), end: segment.end });
    }
  }

  return next.filter((segment) => segment.start < segment.end);
}

function explicitAvailableCandidates(
  input: SchedulingDomainModel,
  date: string,
  timezone: string,
): CandidateSchedulingInterval[] {
  const weekday = weekdayForDate(date);
  const available = input.capacityWindows.filter(
    (window) =>
      window.schedulerUse === 'available' &&
      window.interval.days.includes(weekday) &&
      Boolean(window.interval.start && window.interval.end),
  );
  const capacityBlockers = input.capacityWindows
    .filter(
      (window) =>
        window.schedulerUse !== 'available' &&
        window.interval.days.includes(weekday) &&
        Boolean(window.interval.start && window.interval.end),
    )
    .map((window) => ({
      start: minutesFromTime(window.interval.start as string),
      end: minutesFromTime(window.interval.end as string),
    }));
  const commitmentBlockers = input.externalCommitments.flatMap((commitment) => {
    const range = commitmentRangeForDate(commitment, date);
    return range ? [range] : [];
  });
  const blockers = [...capacityBlockers, ...commitmentBlockers];
  const candidates: CandidateSchedulingInterval[] = [];

  for (const window of available) {
    let segments: MinuteRange[] = [
      {
        start: minutesFromTime(window.interval.start as string),
        end: minutesFromTime(window.interval.end as string),
      },
    ];

    for (const blocker of blockers) {
      segments = subtractRange(segments, blocker);
    }

    segments.forEach((segment, index) => {
      candidates.push({
        id: `explicit-available:${date}:${window.id}:${index}`,
        date,
        start: timeFromMinutes(segment.start),
        end: timeFromMinutes(segment.end),
        timezone,
        capacityMeaning: 'candidate-not-capacity',
        provenance: [
          `Explicit available Life Shape block: ${window.title}`,
          'Used because this day has no explicit usable-day boundary.',
          'Blank calendar time was not treated as capacity.',
        ],
      });
    });
  }

  return candidates;
}

function horizonDays(options: PrivatePlanCoordinatorOptions): number {
  const requested = options.horizonDays ?? DEFAULT_HORIZON_DAYS;
  if (!Number.isInteger(requested) || requested < 1 || requested > 31) {
    throw new Error('Private-plan horizon must be an integer from 1 to 31 days.');
  }
  return requested;
}

function titleMap(input: SchedulingDomainModel): Record<string, string> {
  return {
    ...Object.fromEntries(input.intentions.map((intention) => [intention.id, intention.title])),
    ...Object.fromEntries(input.rhythms.map((rhythm) => [rhythm.id, rhythm.title])),
  };
}

export async function buildCurrentLiveSchedulingContext(
  options: PrivatePlanCoordinatorOptions = {},
): Promise<
  | { ok: true; context: LiveSchedulerContext; now: SchedulerRepairNow }
  | { ok: false; errors: string[]; warnings: string[] }
> {
  const database = getCurrentLifeRhythmDatabase();
  const settingsResult = await loadSettingsResult(database);

  if (
    settingsResult.status === 'invalid' ||
    settingsResult.status === 'readFailed' ||
    settingsResult.status === 'migrationPersistenceFailed'
  ) {
    return {
      ok: false,
      errors: settingsResult.errors.length > 0
        ? settingsResult.errors
        : ['settings: Current settings are not safe to use for automatic planning.'],
      warnings: [],
    };
  }

  let rows: [unknown[], unknown[], unknown[], unknown[]];
  try {
    rows = await Promise.all([
      database.activeTasks.toArray(),
      database.taskPoolItems.toArray(),
      database.rhythmTemplates.toArray(),
      database.softPlacements.toArray(),
    ]);
  } catch {
    return {
      ok: false,
      errors: ['scheduler: Current local planning data could not be read.'],
      warnings: [],
    };
  }

  const [activeTaskRows, taskPoolRows, rhythmRows, softPlacementRows] = rows;
  const activeTasks = activeTaskSchema.array().safeParse(activeTaskRows);
  const taskPoolItems = taskPoolItemSchema.array().safeParse(taskPoolRows);
  const rhythmTemplates = rhythmTemplateSchema.array().safeParse(rhythmRows);
  const softPlacements = softPlacementSchema.array().safeParse(softPlacementRows);
  const errors = [
    ...(activeTasks.success ? [] : issueMessages('activeTasks', activeTasks.error.issues)),
    ...(taskPoolItems.success ? [] : issueMessages('taskPoolItems', taskPoolItems.error.issues)),
    ...(rhythmTemplates.success ? [] : issueMessages('rhythmTemplates', rhythmTemplates.error.issues)),
    ...(softPlacements.success ? [] : issueMessages('softPlacements', softPlacements.error.issues)),
  ];

  if (
    !activeTasks.success ||
    !taskPoolItems.success ||
    !rhythmTemplates.success ||
    !softPlacements.success
  ) {
    return { ok: false, errors, warnings: [] };
  }

  let timezone: string;
  let now: SchedulerRepairNow;
  let days: number;
  try {
    timezone = resolveTimezone(options.timezone);
    now = localPointForDate(options.now ?? new Date(), timezone);
    days = horizonDays(options);
  } catch {
    return {
      ok: false,
      errors: ['scheduler: Browser date, time, or timezone could not be used safely.'],
      warnings: [],
    };
  }

  const base = projectCurrentStateToSchedulingDomain({
    settings: settingsResult.settings,
    activeTasks: activeTasks.data,
    taskPoolItems: taskPoolItems.data,
    rhythmTemplates: rhythmTemplates.data,
    softPlacements: softPlacements.data,
  });
  const startDate = options.startDate ?? now.date;
  const endDate = addDays(startDate, days - 1);
  const calendarRead = await readPersistedCalendarEvents(
    {
      targetTimezone: timezone,
      windowStartDate: startDate,
      windowEndDate: endDate,
    },
    database,
  );

  if (calendarRead.status === 'invalid' || calendarRead.status === 'error') {
    return {
      ok: false,
      errors: calendarRead.errors,
      warnings: calendarRead.warnings,
    };
  }

  const calendarEvents = calendarRead.events;
  const calendarCommitments = externalCommitmentsFromCalendarEvents(calendarEvents);
  const planningBase: SchedulingDomainModel = {
    ...base,
    externalCommitments: [...base.externalCommitments, ...calendarCommitments],
  };
  const candidateIntervals: CandidateSchedulingInterval[] = [];
  const warnings: string[] = [...calendarRead.warnings.map((warning) => `Calendar: ${warning}`)];

  if (calendarRead.status === 'ok') {
    warnings.push(
      `Read-only calendar ${calendarRead.record.label} supplied ${calendarEvents.length} event${calendarEvents.length === 1 ? '' : 's'} in the current planning horizon.`,
    );
  }

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(startDate, offset);
    const availability = deriveGate2Availability({
      settings: settingsResult.settings,
      calendarEvents,
      date,
      timezone,
    });

    if (availability.usableDay) {
      candidateIntervals.push(...availability.candidateIntervals);
    } else {
      const explicitCandidates = explicitAvailableCandidates(planningBase, date, timezone);
      candidateIntervals.push(...explicitCandidates);
      if (explicitCandidates.length > 0) {
        warnings.push(
          `${date}: automatic planning stayed inside explicit available Life Shape blocks because no usable-day boundary is set.`,
        );
      }
    }

    warnings.push(...availability.warnings.map((warning) => `${date}: ${warning}`));
  }

  const input: SchedulingDomainModel = {
    ...planningBase,
    candidateIntervals,
  };

  return {
    ok: true,
    context: {
      input,
      titleByTargetId: titleMap(input),
      warnings: [...new Set(warnings)],
    },
    now,
  };
}

export async function ensureCurrentPrivatePlan(
  options: PrivatePlanCoordinatorOptions = {},
): Promise<PrivatePlanActionResult> {
  const saved = await loadSchedulerPlanState();

  if (saved.status === 'invalid' || saved.status === 'error') {
    return { ok: false, errors: saved.errors, warnings: [] };
  }

  const live = await buildCurrentLiveSchedulingContext(options);
  if (!live.ok) return live;

  if (saved.status === 'ok') {
    return {
      ok: true,
      mode: 'loaded',
      plan: saved.plan,
      titleByTargetId: live.context.titleByTargetId,
      updatedAt: saved.updatedAt,
      warnings: live.context.warnings,
    };
  }

  const built = await buildAndPersistSchedulerPlan(live.context.input);
  if (!built.ok) {
    return { ok: false, errors: built.errors, warnings: live.context.warnings };
  }

  return {
    ok: true,
    mode: built.mode,
    plan: built.plan,
    titleByTargetId: live.context.titleByTargetId,
    updatedAt: built.updatedAt,
    warnings: live.context.warnings,
  };
}

export async function repairCurrentPrivatePlan(
  request: PrivatePlanRepairRequest,
): Promise<PrivatePlanActionResult> {
  const live = await buildCurrentLiveSchedulingContext(request);
  if (!live.ok) return live;

  const repaired = await repairAndPersistSchedulerPlan({
    nextInput: live.context.input,
    reason: request.reason,
    trigger: request.trigger,
    now: live.now,
    ...(request.releasePlacementIds ? { releasePlacementIds: request.releasePlacementIds } : {}),
    ...(request.surfacedPlacementIds ? { surfacedPlacementIds: request.surfacedPlacementIds } : {}),
    ...(request.pinnedPlacementIds ? { pinnedPlacementIds: request.pinnedPlacementIds } : {}),
  });

  if (!repaired.ok) {
    return { ok: false, errors: repaired.errors, warnings: live.context.warnings };
  }

  return {
    ok: true,
    mode: repaired.mode,
    plan: repaired.plan,
    titleByTargetId: live.context.titleByTargetId,
    updatedAt: repaired.updatedAt,
    warnings: live.context.warnings,
  };
}

export async function undoCurrentPrivatePlan(
  options: PrivatePlanCoordinatorOptions = {},
): Promise<PrivatePlanActionResult> {
  const live = await buildCurrentLiveSchedulingContext(options);
  if (!live.ok) return live;

  const undone = await undoPersistedSchedulerRepair();
  if (!undone.ok) {
    return { ok: false, errors: undone.errors, warnings: live.context.warnings };
  }

  return {
    ok: true,
    mode: undone.mode,
    plan: undone.plan,
    titleByTargetId: live.context.titleByTargetId,
    updatedAt: undone.updatedAt,
    warnings: live.context.warnings,
  };
}
