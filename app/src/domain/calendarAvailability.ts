import type { DayOfWeek, Settings } from '../data/schemas';
import type { CalendarReadEvent } from './calendarAdapter';
import type { ExternalCommitment, SchedulingInterval } from './schedulingModel';

export type CandidateSchedulingInterval = {
  id: string;
  date: string;
  start: string;
  end: string;
  timezone: string;
  capacityMeaning: 'candidate-not-capacity';
  workOnly?: boolean;
  provenance: string[];
};

export type Gate2AvailabilityResult = {
  date: string;
  timezone: string;
  profileId?: string;
  usableDay?: {
    start: string;
    end: string;
    source: 'dayProfile';
  };
  externalCommitments: ExternalCommitment[];
  candidateIntervals: CandidateSchedulingInterval[];
  warnings: string[];
};

export type Gate2AvailabilityInput = {
  settings: Settings;
  calendarEvents: CalendarReadEvent[];
  calendarBeforeBusyMinutes?: number;
  calendarAfterBusyMinutes?: number;
  date: string;
  timezone: string;
  uncertaintyReserveMinutes?: number;
  minimumCandidateMinutes?: number;
};

type MinuteRange = {
  start: number;
  end: number;
  reason: string;
};

const weekdays: readonly DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function weekdayForDate(date: string): DayOfWeek {
  const [year, month, day] = date.split('-').map(Number);
  return weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, value));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return `${next.getUTCFullYear().toString().padStart(4, '0')}-${(next.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${next.getUTCDate().toString().padStart(2, '0')}`;
}

function sourceIdSegment(value: string): string {
  return encodeURIComponent(value);
}

function recurringIntervalRange(interval: SchedulingInterval, date: string): MinuteRange | null {
  if (interval.kind === 'datedLocal') {
    if (interval.date !== date) return null;
    return {
      start: minutesFromTime(interval.start),
      end: minutesFromTime(interval.end),
      reason: 'external commitment',
    };
  }

  const weekday = weekdayForDate(date);
  if (!interval.start || !interval.end || !interval.days.includes(weekday)) return null;

  return {
    start: minutesFromTime(interval.start),
    end: minutesFromTime(interval.end),
    reason: 'external commitment',
  };
}

function clipRange(range: MinuteRange, envelope: MinuteRange): MinuteRange | null {
  const start = Math.max(range.start, envelope.start);
  const end = Math.min(range.end, envelope.end);
  if (start >= end) return null;
  return { ...range, start, end };
}

function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: MinuteRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
    previous.reason = `${previous.reason}; ${range.reason}`;
  }

  return merged;
}

function fixedCommitmentsFromSettings(settings: Settings): ExternalCommitment[] {
  return settings.lifeShape.fixedCommitments.map((commitment) => ({
    id: `commitment:${commitment.id}`,
    title: commitment.label,
    source: 'settingsFixedCommitment' as const,
    sourceId: commitment.id,
    interval: {
      kind: 'recurringLocal' as const,
      days: [...commitment.days],
      start: commitment.start,
      end: commitment.end,
    },
    hard: Boolean(commitment.start && commitment.end),
    travelBeforeMinutes: commitment.travelMinutes,
    transitionAfterMinutes: commitment.bufferMinutes,
  }));
}

export function externalCommitmentsFromCalendarEvents(events: CalendarReadEvent[], beforeMinutes = 0, afterMinutes = 0): ExternalCommitment[] {
  const commitments: ExternalCommitment[] = [];

  const addSpillover = (
    event: CalendarReadEvent,
    encodedSourceId: string,
    edge: 'before' | 'after',
    date: string,
    startMinutes: number,
    endMinutes: number,
  ) => {
    if (startMinutes >= endMinutes) return;
    commitments.push({
      id: `calendar:${event.adapterId}:${encodedSourceId}:spacing:${edge}:${date}`,
      title: event.title,
      source: 'calendar',
      sourceId: event.sourceEventId,
      interval: {
        kind: 'datedLocal',
        date,
        start: timeFromMinutes(startMinutes),
        end: timeFromMinutes(endMinutes),
        timezone: event.timezone,
      },
      hard: true,
      travelBeforeMinutes: 0,
      transitionAfterMinutes: 0,
    });
  };

  for (const event of events) {
    if (!event.busy) continue;
    const encodedSourceId = sourceIdSegment(event.sourceEventId);

    if (event.allDay) {
      let date = event.start.date;
      while (date < event.end.date) {
        commitments.push({
          id: `calendar:${event.adapterId}:${encodedSourceId}:${date}`,
          title: event.title,
          source: 'calendar',
          sourceId: event.sourceEventId,
          interval: {
            kind: 'datedLocal',
            date,
            start: '00:00',
            end: '24:00',
            timezone: event.timezone,
          },
          hard: true,
          travelBeforeMinutes: 0,
          transitionAfterMinutes: 0,
        });
        date = addDays(date, 1);
      }
      if (beforeMinutes > 0) {
        addSpillover(event, encodedSourceId, 'before', addDays(event.start.date, -1), 24 * 60 - beforeMinutes, 24 * 60);
      }
      if (afterMinutes > 0) {
        addSpillover(event, encodedSourceId, 'after', event.end.date, 0, afterMinutes);
      }
      continue;
    }

    if (!event.start.time || !event.end.time) continue;

    const eventStartMinutes = minutesFromTime(event.start.time);
    const eventEndMinutes = minutesFromTime(event.end.time);
    const sameDayBefore = Math.min(beforeMinutes, eventStartMinutes);
    const beforeSpill = beforeMinutes - sameDayBefore;
    const endHasOwnFragment = eventEndMinutes > 0;
    const sameDayAfter = endHasOwnFragment ? Math.min(afterMinutes, 24 * 60 - eventEndMinutes) : 0;
    const afterSpill = afterMinutes - sameDayAfter;

    let date = event.start.date;
    while (date <= event.end.date) {
      const isStart = date === event.start.date;
      const isEnd = date === event.end.date;
      const start = isStart ? event.start.time : '00:00';
      const end = isEnd ? event.end.time : '24:00';

      if (minutesFromTime(start) < minutesFromTime(end)) {
        commitments.push({
          id: `calendar:${event.adapterId}:${encodedSourceId}:${date}:${start}`,
          title: event.title,
          source: 'calendar',
          sourceId: event.sourceEventId,
          interval: {
            kind: 'datedLocal',
            date,
            start,
            end,
            timezone: event.timezone,
          },
          hard: true,
          travelBeforeMinutes: isStart ? sameDayBefore : 0,
          transitionAfterMinutes: isEnd && endHasOwnFragment ? sameDayAfter : 0,
        });
      }

      if (isEnd) break;
      date = addDays(date, 1);
    }

    if (beforeSpill > 0) {
      addSpillover(event, encodedSourceId, 'before', addDays(event.start.date, -1), 24 * 60 - beforeSpill, 24 * 60);
    }
    if (afterSpill > 0) {
      const afterDate = eventEndMinutes === 0 ? event.end.date : addDays(event.end.date, 1);
      addSpillover(event, encodedSourceId, 'after', afterDate, 0, afterSpill);
    }
  }

  return commitments.sort((left, right) => left.id.localeCompare(right.id));
}

function profileContext(settings: Settings, date: string) {
  const weekday = weekdayForDate(date);
  const assignment = settings.weekdayProfileAssignments.find((candidate) => candidate.weekday === weekday);
  const profile = assignment
    ? settings.dayProfiles.find((candidate) => candidate.id === assignment.profileId)
    : undefined;

  const usableDay = settings.dayProfileMigrationState.reviewState === 'reviewedAndEnabled' && profile?.usableDay
    ? { ...profile.usableDay, source: 'dayProfile' as const }
    : undefined;

  const workPeriod = profile?.workPeriod ? { ...profile.workPeriod } : undefined;

  return {
    weekday,
    profile,
    usableDay,
    workPeriod,
  };
}

function genericCandidateWorkPeriodIsRestricted(
  workPlanningUse: Settings['dayProfiles'][number]['workPlanningUse'] | undefined,
): boolean {
  // Gate 2 emits generic candidate intervals, not task-specific work eligibility.
  // Only allowSuitableTasks can safely expose the core work period as a generic
  // candidate; workRhythmsOnly needs rhythm identity, askFirst needs a decision,
  // and unavailable is blocked outright.
  return workPlanningUse !== 'allowSuitableTasks';
}

function validateCandidateOptions(input: Gate2AvailabilityInput): void {
  if (
    input.uncertaintyReserveMinutes !== undefined &&
    (!Number.isFinite(input.uncertaintyReserveMinutes) || input.uncertaintyReserveMinutes < 0)
  ) {
    throw new Error('uncertaintyReserveMinutes must be a finite non-negative number.');
  }

  if (
    input.minimumCandidateMinutes !== undefined &&
    (!Number.isFinite(input.minimumCandidateMinutes) || input.minimumCandidateMinutes <= 0)
  ) {
    throw new Error('minimumCandidateMinutes must be a finite positive number.');
  }
}

export function deriveGate2Availability(input: Gate2AvailabilityInput): Gate2AvailabilityResult {
  validateCandidateOptions(input);

  const warnings: string[] = [];
  const minimumCandidateMinutes = input.minimumCandidateMinutes ?? 15;
  const uncertaintyReserveMinutes = input.uncertaintyReserveMinutes ?? 0;
  const context = profileContext(input.settings, input.date);
  const externalCommitments = [
    ...fixedCommitmentsFromSettings(input.settings),
    ...externalCommitmentsFromCalendarEvents(input.calendarEvents, input.calendarBeforeBusyMinutes, input.calendarAfterBusyMinutes),
  ];

  if (!context.profile) {
    warnings.push(`No day profile is assigned to ${context.weekday}; inferred candidate intervals were not generated.`);
    return {
      date: input.date,
      timezone: input.timezone,
      externalCommitments,
      candidateIntervals: [],
      warnings,
    };
  }

  if (!context.usableDay) {
    warnings.push('The assigned day profile has no explicit usable-day boundary; inferred candidate intervals were not generated.');
    return {
      date: input.date,
      timezone: input.timezone,
      profileId: context.profile.id,
      externalCommitments,
      candidateIntervals: [],
      warnings,
    };
  }

  const usableStart = minutesFromTime(context.usableDay.start);
  const usableEnd = minutesFromTime(context.usableDay.end);

  if (usableStart >= usableEnd) {
    warnings.push('Overnight usable-day envelopes are not supported by the Gate 2 candidate-interval slice yet.');
    return {
      date: input.date,
      timezone: input.timezone,
      profileId: context.profile.id,
      usableDay: context.usableDay,
      externalCommitments,
      candidateIntervals: [],
      warnings,
    };
  }

  const envelope: MinuteRange = {
    start: usableStart,
    end: usableEnd,
    reason: 'usable day',
  };
  const blockers: MinuteRange[] = [];

  if (
    context.workPeriod &&
    genericCandidateWorkPeriodIsRestricted(context.profile.workPlanningUse)
  ) {
    blockers.push({
      start: minutesFromTime(context.workPeriod.start),
      end: minutesFromTime(context.workPeriod.end),
      reason: `work period (${context.profile.workPlanningUse})`,
    });
  }

  if (context.profile.kind === 'workday' && context.workPeriod && input.settings.dayProfileMigrationState.reviewState === 'reviewedAndEnabled') {
    const boundary = context.profile.workBoundaryMinutes;
    if (boundary) {
      blockers.push({
        start: Math.max(0, minutesFromTime(context.workPeriod.start) - boundary.beforeTravel - boundary.beforeTransition),
        end: minutesFromTime(context.workPeriod.start),
        reason: 'reviewed before-work travel and transition',
      });
      blockers.push({
        start: minutesFromTime(context.workPeriod.end),
        end: Math.min(1440, minutesFromTime(context.workPeriod.end) + boundary.afterTravel + boundary.afterTransition),
        reason: 'reviewed after-work travel and transition',
      });
    }
  }

  for (const block of input.settings.lifeShape.timeBlocks) {
    if (!block.days.includes(context.weekday) || block.schedulerUse === 'available') continue;
    blockers.push({
      start: minutesFromTime(block.start),
      end: minutesFromTime(block.end),
      reason: `${block.label} (${block.schedulerUse})`,
    });
  }

  for (const commitment of externalCommitments) {
    if (!commitment.hard) continue;
    const range = recurringIntervalRange(commitment.interval, input.date);
    if (!range) continue;
    blockers.push({
      start: Math.max(0, range.start - commitment.travelBeforeMinutes),
      end: Math.min(24 * 60, range.end + commitment.transitionAfterMinutes),
      reason: commitment.source === 'calendar' ? `calendar: ${commitment.title}` : `commitment: ${commitment.title}`,
    });
  }

  const clipped = blockers
    .map((range) => clipRange(range, envelope))
    .filter((range): range is MinuteRange => Boolean(range));
  const merged = mergeRanges(clipped);
  const gaps: CandidateSchedulingInterval[] = [];
  let cursor = envelope.start;

  const addGap = (rawStart: number, rawEnd: number) => {
    const endWithReserve = rawEnd - uncertaintyReserveMinutes;
    if (endWithReserve - rawStart < minimumCandidateMinutes) return;

    const start = timeFromMinutes(rawStart);
    const end = timeFromMinutes(endWithReserve);
    gaps.push({
      id: `candidate:${input.date}:${start}-${end}`,
      date: input.date,
      start,
      end,
      timezone: input.timezone,
      capacityMeaning: 'candidate-not-capacity',
      provenance: [
        'Inside an explicit day-profile usable-day boundary.',
        'Known hard commitments, generic-task-restricted work time, protected time and ask-first time were removed.',
        uncertaintyReserveMinutes > 0
          ? `${uncertaintyReserveMinutes} minutes of uncertainty reserve were kept at the end of this gap.`
          : 'No extra uncertainty reserve was applied.',
        'This is a candidate scheduling interval, not a claim that blank calendar time is productive capacity.',
      ],
    });
  };

  for (const blocker of merged) {
    if (cursor < blocker.start) addGap(cursor, blocker.start);
    cursor = Math.max(cursor, blocker.end);
  }

  if (cursor < envelope.end) addGap(cursor, envelope.end);

  if (context.profile.workPlanningUse === 'workRhythmsOnly' && context.workPeriod) {
    const workRange = clipRange({
      start: minutesFromTime(context.workPeriod.start),
      end: minutesFromTime(context.workPeriod.end),
      reason: 'explicit work-only period',
    }, envelope);
    if (workRange) {
      const safeBlockers = mergeRanges(blockers.filter((blocker) => !blocker.reason.startsWith('work period'))
        .map((blocker) => clipRange(blocker, workRange))
        .filter((blocker): blocker is MinuteRange => Boolean(blocker)));
      let start = workRange.start;
      const addWorkGap = (end: number) => {
        if (end - uncertaintyReserveMinutes - start < minimumCandidateMinutes) return;
        const from = timeFromMinutes(start);
        const to = timeFromMinutes(end - uncertaintyReserveMinutes);
        gaps.push({ id: `candidate:work:${input.date}:${from}-${to}`, date: input.date,
          start: from, end: to, timezone: input.timezone, capacityMeaning: 'candidate-not-capacity', workOnly: true,
          provenance: ['Reviewed work-only period; only explicitly classified work intentions or rhythms may use it.',
            'Known commitments and protected time were removed.'] });
      };
      for (const blocker of safeBlockers) {
        if (start < blocker.start) addWorkGap(blocker.start);
        start = Math.max(start, blocker.end);
      }
      if (start < workRange.end) addWorkGap(workRange.end);
    }
  }

  return {
    date: input.date,
    timezone: input.timezone,
    profileId: context.profile.id,
    usableDay: context.usableDay,
    externalCommitments,
    candidateIntervals: gaps,
    warnings,
  };
}
