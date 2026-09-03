import type {
  CandidateSchedulingInterval,
  CapacityWindow,
  DayProfileContext,
  ExternalCommitment,
  InternalIntention,
  InternalPlacement,
  PlacementExplanation,
  RhythmRequirement,
  SchedulerChange,
  SchedulerPlan,
  SchedulerViolation,
  SchedulingDomainModel,
  SchedulingInterval,
  SchedulingPreference,
  TaskVariant,
} from './schedulingModel';

export type SchedulerStatus = 'gate3-automatic-scheduler-v0';
export const schedulerStatus: SchedulerStatus = 'gate3-automatic-scheduler-v0';

export interface SchedulerEngine {
  buildPlan(input: SchedulingDomainModel): SchedulerPlan;
  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan;
  validatePlan(plan: SchedulerPlan, input: SchedulingDomainModel): SchedulerViolation[];
  explainPlacement(placementId: string, plan: SchedulerPlan): PlacementExplanation | null;
}

const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const priorityRank: Record<string, number> = {
  must: 0,
  important: 1,
  normal: 2,
};

type MinuteRange = {
  start: number;
  end: number;
};

type CandidateGap = {
  candidate: CandidateSchedulingInterval;
  start: number;
  end: number;
};

type SlotScore = {
  preferMatches: number;
  avoidMatches: number;
  rhythmDayPenalty: number;
  rhythmTimePenalty: number;
  date: string;
  start: number;
};

type CandidatePlacement = {
  placement: InternalPlacement;
  score: SlotScore;
};

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function weekdayForLocalDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return `${next.getUTCFullYear().toString().padStart(4, '0')}-${(next.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${next.getUTCDate().toString().padStart(2, '0')}`;
}

function intervalRangeForDate(interval: SchedulingInterval, date: string): MinuteRange | null {
  if (interval.kind === 'datedLocal') {
    if (interval.date !== date) return null;
    return {
      start: minutesFromTime(interval.start),
      end: minutesFromTime(interval.end),
    };
  }

  if (!interval.start || !interval.end || !interval.days.includes(weekdayForLocalDate(date))) {
    return null;
  }

  return {
    start: minutesFromTime(interval.start),
    end: minutesFromTime(interval.end),
  };
}

function placementRange(placement: InternalPlacement): MinuteRange {
  return {
    start: minutesFromTime(placement.start),
    end: minutesFromTime(placement.end),
  };
}

function placementMinutes(placement: InternalPlacement): number {
  const range = placementRange(placement);
  return Math.max(0, range.end - range.start);
}

function overlaps(left: MinuteRange, right: MinuteRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function contains(outer: MinuteRange, inner: MinuteRange): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

function protectedRange(window: CapacityWindow, date: string): MinuteRange | null {
  if (window.schedulerUse !== 'unavailable') return null;
  return intervalRangeForDate(window.interval, date);
}

function commitmentRange(commitment: ExternalCommitment, date: string): MinuteRange | null {
  if (!commitment.hard) return null;
  const range = intervalRangeForDate(commitment.interval, date);
  if (!range) return null;

  return {
    start: Math.max(0, range.start - commitment.travelBeforeMinutes),
    end: Math.min(24 * 60, range.end + commitment.transitionAfterMinutes),
  };
}

function targetKind(placement: InternalPlacement): 'intention' | 'rhythm' {
  return placement.targetKind ?? 'intention';
}

function rhythmIdForPlacement(placement: InternalPlacement): string {
  return placement.rhythmId ?? placement.intentionId;
}

function matchingCandidate(
  placement: InternalPlacement,
  input: SchedulingDomainModel,
): CandidateSchedulingInterval | undefined {
  const range = placementRange(placement);
  return (input.candidateIntervals ?? []).find((candidate) =>
    candidate.date === placement.date &&
    contains(
      { start: minutesFromTime(candidate.start), end: minutesFromTime(candidate.end) },
      range,
    ),
  );
}

function localPointForInstant(
  instant: string,
  timezone: string,
): { date: string; time: string } | null {
  const epoch = Date.parse(instant);
  if (!Number.isFinite(epoch)) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(new Date(epoch));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    const year = value('year');
    const month = value('month');
    const day = value('day');
    const hour = value('hour');
    const minute = value('minute');
    if (!year || !month || !day || !hour || !minute) return null;

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  } catch {
    return null;
  }
}

function localKey(date: string, time: string): string {
  return `${date}T${time}`;
}

function timingViolationsForPlacement(
  placement: InternalPlacement,
  input: SchedulingDomainModel,
): SchedulerViolation[] {
  if (placement.origin !== 'scheduler' || targetKind(placement) !== 'intention') return [];
  const intention = input.intentions.find((candidate) => candidate.id === placement.intentionId);
  if (!intention) return [];

  const candidate = matchingCandidate(placement, input);
  const timezone = placement.timezone ?? candidate?.timezone;
  if (!timezone) return [];

  const violations: SchedulerViolation[] = [];
  const startKey = localKey(placement.date, placement.start);
  const endKey = localKey(placement.date, placement.end);
  const timing = intention.timing;

  const addViolation = (message: string) => {
    violations.push({
      code: 'timing-constraint-violation',
      placementId: placement.id,
      conflictingId: intention.id,
      message,
    });
  };

  if (timing.fixedAt) {
    const fixed = localPointForInstant(timing.fixedAt, timezone);
    if (!fixed || startKey !== localKey(fixed.date, fixed.time)) {
      addViolation(`Placement ${placement.id} does not start at fixed time for ${intention.title}.`);
    }
  }

  if (timing.dueAt) {
    const due = localPointForInstant(timing.dueAt, timezone);
    const minimumAfterDeadline =
      placement.variantKind === 'minimum' && timing.minimumStillUsefulAfterDeadline === true;
    if (!due || (endKey > localKey(due.date, due.time) && !minimumAfterDeadline)) {
      addViolation(`Placement ${placement.id} finishes after the due-by edge for ${intention.title}.`);
    }
  }

  if (timing.expiresAfter) {
    const expires = localPointForInstant(timing.expiresAfter, timezone);
    if (!expires || endKey > localKey(expires.date, expires.time)) {
      addViolation(`Placement ${placement.id} finishes after the expiry edge for ${intention.title}.`);
    }
  }

  if (timing.latestUsefulStartAt) {
    const latestStart = localPointForInstant(timing.latestUsefulStartAt, timezone);
    if (!latestStart || startKey > localKey(latestStart.date, latestStart.time)) {
      addViolation(`Placement ${placement.id} starts after the latest useful start for ${intention.title}.`);
    }
  }

  if (timing.notUsefulAfter) {
    const notUsefulAfter = localPointForInstant(timing.notUsefulAfter, timezone);
    if (!notUsefulAfter || endKey > localKey(notUsefulAfter.date, notUsefulAfter.time)) {
      addViolation(`Placement ${placement.id} extends beyond the usefulness window for ${intention.title}.`);
    }
  }

  return violations;
}

function capacityViolationsForPlacement(
  placement: InternalPlacement,
  accepted: InternalPlacement[],
  input: SchedulingDomainModel,
): SchedulerViolation[] {
  if (placement.origin !== 'scheduler') return [];
  const policy = input.planningPolicy;
  if (!policy) return [];

  const violations: SchedulerViolation[] = [];
  const sameDay = accepted.filter((candidate) => candidate.date === placement.date);

  if (policy.maxInternalScheduledMinutesPerDay !== undefined) {
    const existingMinutes = sameDay.reduce((sum, candidate) => sum + placementMinutes(candidate), 0);
    if (existingMinutes + placementMinutes(placement) > policy.maxInternalScheduledMinutesPerDay) {
      violations.push({
        code: 'capacity-limit-exceeded',
        placementId: placement.id,
        message: `Placement ${placement.id} would exceed the internal scheduled-minute limit for ${placement.date}.`,
      });
    }
  }

  if (policy.maxAutomaticPlacementsPerDay !== undefined) {
    const existingAutomatic = sameDay.filter((candidate) => candidate.origin === 'scheduler').length;
    if (existingAutomatic + 1 > policy.maxAutomaticPlacementsPerDay) {
      violations.push({
        code: 'capacity-limit-exceeded',
        placementId: placement.id,
        message: `Placement ${placement.id} would exceed the automatic-placement limit for ${placement.date}.`,
      });
    }
  }

  return violations;
}

function violationsForPlacement(
  placement: InternalPlacement,
  accepted: InternalPlacement[],
  input: SchedulingDomainModel,
): SchedulerViolation[] {
  const violations: SchedulerViolation[] = [];

  if (targetKind(placement) === 'rhythm') {
    const rhythmId = rhythmIdForPlacement(placement);
    if (!input.rhythms.some((candidate) => candidate.id === rhythmId)) {
      violations.push({
        code: 'unknown-rhythm',
        placementId: placement.id,
        message: `Placement ${placement.id} references unknown rhythm ${rhythmId}.`,
      });
      return violations;
    }
  } else if (!input.intentions.some((candidate) => candidate.id === placement.intentionId)) {
    violations.push({
      code: 'unknown-intention',
      placementId: placement.id,
      message: `Placement ${placement.id} references unknown intention ${placement.intentionId}.`,
    });
    return violations;
  }

  const range = placementRange(placement);

  for (const other of accepted) {
    if (other.date !== placement.date || !overlaps(range, placementRange(other))) continue;
    violations.push({
      code: 'placement-overlap',
      placementId: placement.id,
      conflictingId: other.id,
      message: `Placement ${placement.id} overlaps private placement ${other.id}.`,
    });
  }

  for (const window of input.capacityWindows) {
    const blocked = protectedRange(window, placement.date);
    if (!blocked || !overlaps(range, blocked)) continue;
    violations.push({
      code: 'protected-window-overlap',
      placementId: placement.id,
      conflictingId: window.id,
      message: `Placement ${placement.id} overlaps protected window ${window.title}.`,
    });
  }

  for (const commitment of input.externalCommitments) {
    const blocked = commitmentRange(commitment, placement.date);
    if (!blocked || !overlaps(range, blocked)) continue;
    violations.push({
      code: 'external-commitment-overlap',
      placementId: placement.id,
      conflictingId: commitment.id,
      message: `Placement ${placement.id} overlaps commitment ${commitment.title}.`,
    });
  }

  if (placement.origin === 'scheduler' && !matchingCandidate(placement, input)) {
    violations.push({
      code: 'outside-candidate-interval',
      placementId: placement.id,
      message: `Placement ${placement.id} is outside the supplied candidate scheduling intervals.`,
    });
  }

  violations.push(...timingViolationsForPlacement(placement, input));
  violations.push(...capacityViolationsForPlacement(placement, accepted, input));

  return violations;
}

function sortPlacements(placements: InternalPlacement[]): InternalPlacement[] {
  return [...placements].sort((a, b) =>
    `${a.date}:${a.start}:${a.id}`.localeCompare(`${b.date}:${b.start}:${b.id}`),
  );
}

function validatePlanningPolicy(input: SchedulingDomainModel): void {
  const policy = input.planningPolicy;
  if (!policy) return;

  if (
    policy.maxInternalScheduledMinutesPerDay !== undefined &&
    (!Number.isFinite(policy.maxInternalScheduledMinutesPerDay) || policy.maxInternalScheduledMinutesPerDay <= 0)
  ) {
    throw new Error('maxInternalScheduledMinutesPerDay must be a finite positive number.');
  }

  if (
    policy.maxAutomaticPlacementsPerDay !== undefined &&
    (!Number.isInteger(policy.maxAutomaticPlacementsPerDay) || policy.maxAutomaticPlacementsPerDay <= 0)
  ) {
    throw new Error('maxAutomaticPlacementsPerDay must be a positive integer.');
  }
}

function candidateGaps(
  input: SchedulingDomainModel,
  accepted: InternalPlacement[],
  allowedDates?: Set<string>,
): CandidateGap[] {
  const gaps: CandidateGap[] = [];
  const candidates = [...(input.candidateIntervals ?? [])]
    .filter((candidate) => !allowedDates || allowedDates.has(candidate.date))
    .sort((a, b) => `${a.date}:${a.start}:${a.id}`.localeCompare(`${b.date}:${b.start}:${b.id}`));

  for (const candidate of candidates) {
    const start = minutesFromTime(candidate.start);
    const end = minutesFromTime(candidate.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) continue;

    let segments: MinuteRange[] = [{ start, end }];
    for (const placement of accepted.filter((item) => item.date === candidate.date)) {
      const occupied = placementRange(placement);
      const next: MinuteRange[] = [];
      for (const segment of segments) {
        if (!overlaps(segment, occupied)) {
          next.push(segment);
          continue;
        }
        if (segment.start < occupied.start) {
          next.push({ start: segment.start, end: Math.min(segment.end, occupied.start) });
        }
        if (occupied.end < segment.end) {
          next.push({ start: Math.max(segment.start, occupied.end), end: segment.end });
        }
      }
      segments = next.filter((segment) => segment.start < segment.end);
    }

    for (const segment of segments) {
      gaps.push({ candidate, ...segment });
    }
  }

  return gaps;
}

function activeProfileForDate(input: SchedulingDomainModel, date: string): DayProfileContext | undefined {
  const weekday = weekdayForLocalDate(date);
  return input.dayProfiles.find((profile) => profile.assignedWeekdays.includes(weekday));
}

function preferenceAppliesToIntention(
  preference: SchedulingPreference,
  intention: InternalIntention,
): boolean {
  switch (preference.targetKind) {
    case 'intention':
      return preference.targetValue === intention.id;
    case 'area':
      return preference.targetValue === intention.area;
    case 'taskType':
      return preference.targetValue === intention.taskType;
    default:
      return false;
  }
}

function preferenceAppliesToRhythm(
  preference: SchedulingPreference,
  rhythm: RhythmRequirement,
): boolean {
  switch (preference.targetKind) {
    case 'rhythm':
      return preference.targetValue === rhythm.id;
    case 'area':
      return preference.targetValue === rhythm.area;
    default:
      return false;
  }
}

function preferencesForDate(
  preferences: SchedulingPreference[],
  date: string,
): SchedulingPreference[] {
  const weekday = weekdayForLocalDate(date);
  return preferences.filter((preference) =>
    !preference.days || preference.days.length === 0 || preference.days.includes(weekday),
  );
}

function preferenceRange(preference: SchedulingPreference): MinuteRange | null {
  if (!preference.start || !preference.end) return null;
  const start = minutesFromTime(preference.start);
  const end = minutesFromTime(preference.end);
  return start < end ? { start, end } : null;
}

function rhythmPreferredRange(
  rhythm: RhythmRequirement,
  candidate: CandidateSchedulingInterval,
  input: SchedulingDomainModel,
): MinuteRange | null {
  const profile = activeProfileForDate(input, candidate.date);
  const usableEnd = profile?.usableDay ? minutesFromTime(profile.usableDay.end) : 24 * 60;

  switch (rhythm.preferredTime) {
    case 'morning':
      return { start: 6 * 60, end: 12 * 60 };
    case 'midday':
      return { start: 11 * 60, end: 14 * 60 };
    case 'afternoon':
      return { start: 12 * 60, end: 17 * 60 };
    case 'evening':
      return { start: 17 * 60, end: Math.min(22 * 60, usableEnd) };
    case 'after work':
      return profile?.workPeriod
        ? { start: minutesFromTime(profile.workPeriod.end), end: usableEnd }
        : null;
    case 'shutdown': {
      if (!profile?.usableDay) return null;
      const start = minutesFromTime(profile.usableDay.start);
      return { start: Math.max(start, usableEnd - 120), end: usableEnd };
    }
    default:
      return null;
  }
}

function slotPreferenceScore(
  range: MinuteRange,
  date: string,
  preferences: SchedulingPreference[],
): { preferMatches: number; avoidMatches: number; matchedPreferenceIds: string[] } {
  let preferMatches = 0;
  let avoidMatches = 0;
  const matchedPreferenceIds: string[] = [];

  for (const preference of preferencesForDate(preferences, date)) {
    const preferredRange = preferenceRange(preference);
    const matches = preferredRange
      ? preference.relation === 'prefer'
        ? contains(preferredRange, range)
        : overlaps(preferredRange, range)
      : true;
    if (!matches) continue;

    matchedPreferenceIds.push(preference.id);
    if (preference.relation === 'prefer') preferMatches += 1;
    else avoidMatches += 1;
  }

  return { preferMatches, avoidMatches, matchedPreferenceIds };
}

function candidateStarts(
  gap: CandidateGap,
  minutes: number,
  preferences: SchedulingPreference[],
  rhythmPreferred?: MinuteRange | null,
  fixedStart?: number,
): number[] {
  const starts = new Set<number>();
  const fits = (start: number) => gap.start <= start && start + minutes <= gap.end;

  if (fits(gap.start)) starts.add(gap.start);
  if (fixedStart !== undefined && fits(fixedStart)) starts.add(fixedStart);

  for (const preference of preferencesForDate(preferences, gap.candidate.date)) {
    const range = preferenceRange(preference);
    if (!range) continue;
    const start = preference.relation === 'prefer'
      ? Math.max(gap.start, range.start)
      : Math.max(gap.start, range.end);
    if (fits(start)) starts.add(start);
  }

  if (rhythmPreferred) {
    const start = Math.max(gap.start, rhythmPreferred.start);
    if (start + minutes <= Math.min(gap.end, rhythmPreferred.end)) starts.add(start);
  }

  return [...starts].sort((a, b) => a - b);
}

function compareScores(left: SlotScore, right: SlotScore): number {
  return (
    right.preferMatches - left.preferMatches ||
    left.avoidMatches - right.avoidMatches ||
    left.rhythmDayPenalty - right.rhythmDayPenalty ||
    left.rhythmTimePenalty - right.rhythmTimePenalty ||
    left.date.localeCompare(right.date) ||
    left.start - right.start
  );
}

function orderedVariants(variants: TaskVariant[]): TaskVariant[] {
  const rank = { normal: 0, minimum: 1, full: 2 } as const;
  return [...variants].sort((left, right) => rank[left.kind] - rank[right.kind]);
}

function fixedStartForCandidate(
  intention: InternalIntention,
  candidate: CandidateSchedulingInterval,
): number | undefined {
  if (!intention.timing.fixedAt) return undefined;
  const fixed = localPointForInstant(intention.timing.fixedAt, candidate.timezone);
  if (!fixed || fixed.date !== candidate.date) return Number.NaN;
  return minutesFromTime(fixed.time);
}

function placementProvenance(
  candidate: CandidateSchedulingInterval,
  variant: TaskVariant,
  matchedPreferences: SchedulingPreference[],
  extra: string[],
): string[] {
  const provenance = [
    'Automatically placed by the deterministic Gate 3 scheduler.',
    `Used the ${variant.kind} form (${variant.minutes} minutes).`,
    `Placed inside candidate interval ${candidate.id}; hard and protected constraints remained authoritative.`,
    ...extra,
  ];

  for (const preference of matchedPreferences.slice(0, 2)) {
    provenance.push(`Matched explicit preference ${preference.id}: ${preference.provenance}`);
  }

  return provenance;
}

function findPlacementForIntention(
  intention: InternalIntention,
  accepted: InternalPlacement[],
  input: SchedulingDomainModel,
): InternalPlacement | null {
  const applicablePreferences = (input.preferences ?? []).filter((preference) =>
    preferenceAppliesToIntention(preference, intention),
  );

  for (const variant of orderedVariants(intention.variants)) {
    const placements: CandidatePlacement[] = [];

    for (const gap of candidateGaps(input, accepted)) {
      const fixedStart = fixedStartForCandidate(intention, gap.candidate);
      if (Number.isNaN(fixedStart)) continue;

      for (const start of candidateStarts(gap, variant.minutes, applicablePreferences, null, fixedStart)) {
        const end = start + variant.minutes;
        const range = { start, end };
        const scoreParts = slotPreferenceScore(range, gap.candidate.date, applicablePreferences);
        const matchedPreferences = applicablePreferences.filter((preference) =>
          scoreParts.matchedPreferenceIds.includes(preference.id),
        );
        const timingExtra: string[] = [];
        if (intention.timing.timeConstraint && intention.timing.timeConstraint !== 'flexible') {
          timingExtra.push(`Respected the ${intention.timing.timeConstraint} timing constraint.`);
        }
        if (variant.kind === 'minimum') {
          timingExtra.push('Minimum Done was used only after no valid normal-sized placement fit.');
        }

        const placement: InternalPlacement = {
          id: `scheduler:intention:${encodeURIComponent(intention.id)}:${gap.candidate.date}:${timeFromMinutes(start)}`,
          intentionId: intention.id,
          targetKind: 'intention',
          date: gap.candidate.date,
          start: timeFromMinutes(start),
          end: timeFromMinutes(end),
          timezone: gap.candidate.timezone,
          origin: 'scheduler',
          variantKind: variant.kind,
          provenance: placementProvenance(gap.candidate, variant, matchedPreferences, timingExtra),
        };

        if (violationsForPlacement(placement, accepted, input).length > 0) continue;

        placements.push({
          placement,
          score: {
            preferMatches: scoreParts.preferMatches,
            avoidMatches: scoreParts.avoidMatches,
            rhythmDayPenalty: 0,
            rhythmTimePenalty: 0,
            date: gap.candidate.date,
            start,
          },
        });
      }
    }

    placements.sort((left, right) => compareScores(left.score, right.score));
    if (placements[0]) return placements[0].placement;
  }

  return null;
}

function mondayForDate(date: string): string {
  const weekday = weekdayForLocalDate(date);
  const sundayIndex = weekdayNames.indexOf(weekday as (typeof weekdayNames)[number]);
  const mondayBased = (sundayIndex + 6) % 7;
  return addDays(date, -mondayBased);
}

function rhythmPeriodKey(rhythm: RhythmRequirement, date: string): string {
  if (rhythm.period === 'day') return date;
  if (rhythm.period === 'month') return date.slice(0, 7);
  return mondayForDate(date);
}

function rhythmPlacementsInPeriod(
  rhythm: RhythmRequirement,
  periodKey: string,
  placements: InternalPlacement[],
): InternalPlacement[] {
  return placements.filter((placement) =>
    targetKind(placement) === 'rhythm' &&
    rhythmIdForPlacement(placement) === rhythm.id &&
    rhythmPeriodKey(rhythm, placement.date) === periodKey,
  );
}

function findPlacementForRhythm(
  rhythm: RhythmRequirement,
  accepted: InternalPlacement[],
  input: SchedulingDomainModel,
  occurrenceIndex: number,
  allowedDates: Set<string>,
): InternalPlacement | null {
  const applicablePreferences = (input.preferences ?? []).filter((preference) =>
    preferenceAppliesToRhythm(preference, rhythm),
  );

  for (const variant of orderedVariants(rhythm.variants)) {
    const placements: CandidatePlacement[] = [];

    for (const gap of candidateGaps(input, accepted, allowedDates)) {
      const existingOnDay = accepted.filter((placement) =>
        placement.date === gap.candidate.date &&
        targetKind(placement) === 'rhythm' &&
        rhythmIdForPlacement(placement) === rhythm.id,
      ).length;
      if (existingOnDay >= rhythm.maxPerDay) continue;

      const preferredRange = rhythmPreferredRange(rhythm, gap.candidate, input);
      const preferredDay = rhythm.preferredDays.length === 0 ||
        rhythm.preferredDays.includes(weekdayForLocalDate(gap.candidate.date));

      for (const start of candidateStarts(gap, variant.minutes, applicablePreferences, preferredRange)) {
        const end = start + variant.minutes;
        const range = { start, end };
        const scoreParts = slotPreferenceScore(range, gap.candidate.date, applicablePreferences);
        const matchedPreferences = applicablePreferences.filter((preference) =>
          scoreParts.matchedPreferenceIds.includes(preference.id),
        );
        const preferredTime = !preferredRange || contains(preferredRange, range);
        const extra = [
          `Scheduled occurrence ${occurrenceIndex + 1} for the ${rhythm.period} rhythm requirement.`,
        ];
        if (preferredDay) extra.push('Used a preferred rhythm day when feasible.');
        if (preferredRange && preferredTime) extra.push(`Matched the rhythm preferred time: ${rhythm.preferredTime}.`);
        if (variant.kind === 'minimum') {
          extra.push('Minimum Done was used only after no valid normal-sized rhythm placement fit.');
        }

        const placement: InternalPlacement = {
          id: `scheduler:rhythm:${encodeURIComponent(rhythm.id)}:${occurrenceIndex + 1}:${gap.candidate.date}:${timeFromMinutes(start)}`,
          intentionId: rhythm.id,
          targetKind: 'rhythm',
          rhythmId: rhythm.id,
          date: gap.candidate.date,
          start: timeFromMinutes(start),
          end: timeFromMinutes(end),
          timezone: gap.candidate.timezone,
          origin: 'scheduler',
          variantKind: variant.kind,
          provenance: placementProvenance(gap.candidate, variant, matchedPreferences, extra),
        };

        if (violationsForPlacement(placement, accepted, input).length > 0) continue;

        placements.push({
          placement,
          score: {
            preferMatches: scoreParts.preferMatches,
            avoidMatches: scoreParts.avoidMatches,
            rhythmDayPenalty: preferredDay ? 0 : 1,
            rhythmTimePenalty: preferredTime ? 0 : 1,
            date: gap.candidate.date,
            start,
          },
        });
      }
    }

    placements.sort((left, right) => compareScores(left.score, right.score));
    if (placements[0]) return placements[0].placement;
  }

  return null;
}

function timingEdge(intention: InternalIntention): number {
  const candidates = [
    intention.timing.fixedAt,
    intention.timing.dueAt,
    intention.timing.expiresAfter,
    intention.timing.latestUsefulStartAt,
    intention.timing.notUsefulAfter,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return candidates.length > 0 ? Math.min(...candidates) : Number.POSITIVE_INFINITY;
}

function intentionSort(left: InternalIntention, right: InternalIntention): number {
  const timingRank = (intention: InternalIntention) => {
    switch (intention.timing.timeConstraint) {
      case 'fixedAt':
        return 0;
      case 'dueBy':
        return 1;
      case 'expiresAfter':
        return 2;
      default:
        return intention.timing.latestUsefulStartAt || intention.timing.notUsefulAfter ? 3 : 4;
    }
  };

  return (
    timingRank(left) - timingRank(right) ||
    timingEdge(left) - timingEdge(right) ||
    (priorityRank[left.priority ?? 'normal'] ?? 3) - (priorityRank[right.priority ?? 'normal'] ?? 3) ||
    left.id.localeCompare(right.id)
  );
}

function scheduleIntentions(
  intentions: InternalIntention[],
  accepted: InternalPlacement[],
  input: SchedulingDomainModel,
): void {
  const scheduled = new Set(
    accepted
      .filter((placement) => targetKind(placement) === 'intention')
      .map((placement) => placement.intentionId),
  );

  for (const intention of [...intentions].sort(intentionSort)) {
    if (!intention.eligibleForScheduling || scheduled.has(intention.id)) continue;
    const placement = findPlacementForIntention(intention, accepted, input);
    if (!placement) continue;
    accepted.push(placement);
    scheduled.add(intention.id);
  }
}

function scheduleRhythms(
  rhythms: RhythmRequirement[],
  accepted: InternalPlacement[],
  input: SchedulingDomainModel,
): string[] {
  const candidateDates = [...new Set((input.candidateIntervals ?? []).map((candidate) => candidate.date))].sort();
  const unscheduled = new Set<string>();

  for (const rhythm of [...rhythms].sort((a, b) => a.id.localeCompare(b.id))) {
    const periodDates = new Map<string, string[]>();
    for (const date of candidateDates) {
      const key = rhythmPeriodKey(rhythm, date);
      const dates = periodDates.get(key) ?? [];
      dates.push(date);
      periodDates.set(key, dates);
    }

    for (const [periodKey, dates] of periodDates) {
      const existing = rhythmPlacementsInPeriod(rhythm, periodKey, accepted);
      let remaining = Math.max(0, rhythm.frequency - existing.length);
      let occurrenceIndex = existing.length;
      const allowedDates = new Set(dates);

      while (remaining > 0) {
        const placement = findPlacementForRhythm(
          rhythm,
          accepted,
          input,
          occurrenceIndex,
          allowedDates,
        );
        if (!placement) {
          unscheduled.add(rhythm.id);
          break;
        }
        accepted.push(placement);
        occurrenceIndex += 1;
        remaining -= 1;
      }
    }
  }

  return [...unscheduled].sort();
}

function isFirstPassIntention(intention: InternalIntention): boolean {
  return intention.timing.timeConstraint === 'fixedAt' ||
    intention.timing.timeConstraint === 'dueBy' ||
    intention.timing.timeConstraint === 'expiresAfter' ||
    Boolean(intention.timing.latestUsefulStartAt) ||
    Boolean(intention.timing.notUsefulAfter) ||
    intention.priority === 'must';
}

export class DeterministicScheduler implements SchedulerEngine {
  buildPlan(input: SchedulingDomainModel): SchedulerPlan {
    validatePlanningPolicy(input);

    const accepted: InternalPlacement[] = [];
    const rejectedExistingPlacements: SchedulerPlan['rejectedExistingPlacements'] = [];

    for (const placement of sortPlacements(input.placements)) {
      const violations = violationsForPlacement(placement, accepted, input);
      if (violations.length > 0) {
        rejectedExistingPlacements.push({ placement, violations });
        continue;
      }
      accepted.push(placement);
    }

    const firstPass = input.intentions.filter(isFirstPassIntention);
    const laterPass = input.intentions.filter((intention) => !isFirstPassIntention(intention));
    scheduleIntentions(firstPass, accepted, input);
    const unscheduledRhythmIds = scheduleRhythms(input.rhythms, accepted, input);
    scheduleIntentions(laterPass, accepted, input);

    const scheduledIntentionIds = new Set(
      accepted
        .filter((placement) => targetKind(placement) === 'intention')
        .map((placement) => placement.intentionId),
    );
    const unscheduledIntentionIds = input.intentions
      .filter((intention) => intention.eligibleForScheduling && !scheduledIntentionIds.has(intention.id))
      .map((intention) => intention.id)
      .sort();

    return {
      placements: sortPlacements(accepted),
      unscheduledIntentionIds,
      unscheduledRhythmIds,
      rejectedExistingPlacements,
    };
  }

  repairPlan(_currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    // Gate 3 still rebuilds through the stable seam. Gate 4 adds partial repair and schedule inertia.
    return this.buildPlan(change.nextInput);
  }

  validatePlan(plan: SchedulerPlan, input: SchedulingDomainModel): SchedulerViolation[] {
    validatePlanningPolicy(input);
    const violations: SchedulerViolation[] = [];
    const accepted: InternalPlacement[] = [];

    for (const placement of sortPlacements(plan.placements)) {
      violations.push(...violationsForPlacement(placement, accepted, input));
      accepted.push(placement);
    }

    return violations;
  }

  explainPlacement(placementId: string, plan: SchedulerPlan): PlacementExplanation | null {
    const placement = plan.placements.find((candidate) => candidate.id === placementId);
    if (!placement) return null;

    return {
      placementId: placement.id,
      intentionId: placement.intentionId,
      ...(placement.targetKind ? { targetKind: placement.targetKind } : {}),
      ...(placement.variantKind ? { variantKind: placement.variantKind } : {}),
      provenance: [...placement.provenance],
    };
  }
}

export const scheduler: SchedulerEngine = new DeterministicScheduler();
