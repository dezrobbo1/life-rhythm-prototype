export type LocalDate = string;
export type LocalTime = string;
export type Instant = string;

export type SourceRecordRef = {
  kind: 'activeTask' | 'taskPoolItem' | 'rhythmTemplate' | 'settings' | 'softPlacement';
  id: string;
};

export type TaskVariantKind = 'minimum' | 'normal' | 'full';

export type TaskVariant = {
  kind: TaskVariantKind;
  label: string;
  minutes: number;
};

export type IntentionTiming = {
  timeConstraint?: 'flexible' | 'dueBy' | 'fixedAt' | 'expiresAfter';
  dueAt?: Instant;
  fixedAt?: Instant;
  expiresAfter?: Instant;
  latestUsefulStartAt?: Instant;
  notUsefulAfter?: Instant;
  minimumStillUsefulAfterDeadline?: boolean;
};

export type InternalIntention = {
  id: string;
  title: string;
  area: string;
  purpose?: string;
  templateId?: string;
  taskType?: string;
  priority?: string;
  energy?: string;
  variants: TaskVariant[];
  timing: IntentionTiming;
  lifecycle: {
    activeTaskStatus?: string;
    taskPoolStatus?: string;
    bringBackAfter?: Instant;
  };
  eligibleForScheduling: boolean;
  sourceRecords: SourceRecordRef[];
};

export type RhythmRequirement = {
  id: string;
  templateId: string;
  title: string;
  area: string;
  frequency: number;
  period: 'day' | 'week' | 'month';
  preferredDays: string[];
  preferredTime: string;
  maxPerDay: number;
  variants: TaskVariant[];
  sourceRecords: SourceRecordRef[];
};

export type RecurringLocalInterval = {
  kind: 'recurringLocal';
  days: string[];
  start?: LocalTime;
  end?: LocalTime;
};

export type DatedLocalInterval = {
  kind: 'datedLocal';
  date: LocalDate;
  start: LocalTime;
  end: LocalTime;
  timezone?: string;
};

export type SchedulingInterval = RecurringLocalInterval | DatedLocalInterval;

export type ExternalCommitment = {
  id: string;
  title: string;
  source: 'settingsFixedCommitment' | 'calendar';
  sourceId: string;
  interval: SchedulingInterval;
  hard: boolean;
  travelBeforeMinutes: number;
  transitionAfterMinutes: number;
};

export type CapacityWindow = {
  id: string;
  title: string;
  category: string;
  interval: RecurringLocalInterval;
  schedulerUse: 'unavailable' | 'askFirst' | 'available';
  sourceId: string;
};

export type InternalPlacement = {
  id: string;
  intentionId: string;
  date: LocalDate;
  start: LocalTime;
  end: LocalTime;
  origin: 'existingUserConfirmed' | 'scheduler';
  sourcePlacementId?: string;
  provenance: string[];
};

export type DayProfileContext = {
  id: string;
  name: string;
  kind: 'workday' | 'nonWorkday';
  assignedWeekdays: string[];
  usableDay?: {
    start: LocalTime;
    end: LocalTime;
  };
  workPeriod?: {
    start: LocalTime;
    end: LocalTime;
  };
  workPlanningUse: string;
};

export type SchedulingDomainModel = {
  intentions: InternalIntention[];
  rhythms: RhythmRequirement[];
  externalCommitments: ExternalCommitment[];
  capacityWindows: CapacityWindow[];
  placements: InternalPlacement[];
  dayProfiles: DayProfileContext[];
};

export type SchedulerViolationCode =
  | 'unknown-intention'
  | 'placement-overlap'
  | 'protected-window-overlap'
  | 'external-commitment-overlap';

export type SchedulerViolation = {
  code: SchedulerViolationCode;
  placementId: string;
  conflictingId?: string;
  message: string;
};

export type RejectedPlacement = {
  placement: InternalPlacement;
  violations: SchedulerViolation[];
};

export type SchedulerPlan = {
  placements: InternalPlacement[];
  unscheduledIntentionIds: string[];
  rejectedExistingPlacements: RejectedPlacement[];
};

export type SchedulerChange = {
  reason: string;
  nextInput: SchedulingDomainModel;
};

export type PlacementExplanation = {
  placementId: string;
  intentionId: string;
  provenance: string[];
};
