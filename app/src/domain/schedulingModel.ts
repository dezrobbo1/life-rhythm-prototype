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

export type CandidateSchedulingInterval = {
  id: string;
  date: LocalDate;
  start: LocalTime;
  end: LocalTime;
  timezone: string;
  capacityMeaning: 'candidate-not-capacity';
  provenance: string[];
};

export type SchedulingPreference = {
  id: string;
  targetKind: 'intention' | 'rhythm' | 'area' | 'taskType';
  targetValue: string;
  relation: 'prefer' | 'avoid';
  days?: string[];
  start?: LocalTime;
  end?: LocalTime;
  provenance: string;
};

export type SchedulerPlanningPolicy = {
  maxInternalScheduledMinutesPerDay?: number;
  maxAutomaticPlacementsPerDay?: number;
};

export type InternalPlacement = {
  id: string;
  intentionId: string;
  date: LocalDate;
  start: LocalTime;
  end: LocalTime;
  timezone?: string;
  origin: 'existingUserConfirmed' | 'scheduler';
  sourcePlacementId?: string;
  targetKind?: 'intention' | 'rhythm';
  rhythmId?: string;
  variantKind?: TaskVariantKind;
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
  candidateIntervals?: CandidateSchedulingInterval[];
  preferences?: SchedulingPreference[];
  planningPolicy?: SchedulerPlanningPolicy;
};

export type SchedulerViolationCode =
  | 'unknown-intention'
  | 'unknown-rhythm'
  | 'placement-overlap'
  | 'protected-window-overlap'
  | 'external-commitment-overlap'
  | 'outside-candidate-interval'
  | 'timing-constraint-violation'
  | 'capacity-limit-exceeded';

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

export type SchedulerPlanSnapshot = {
  placements: InternalPlacement[];
  unscheduledIntentionIds: string[];
  unscheduledRhythmIds: string[];
  rejectedExistingPlacements: RejectedPlacement[];
};

export type SchedulerRepairTrigger =
  | 'calendarChanged'
  | 'overrun'
  | 'missedStart'
  | 'completionChanged'
  | 'userCorrection'
  | 'manualReplan';

export type SchedulerRepairNow = {
  date: LocalDate;
  time: LocalTime;
  timezone: string;
};

export type SchedulerPlacementPoint = {
  date: LocalDate;
  start: LocalTime;
  end: LocalTime;
  variantKind?: TaskVariantKind;
};

export type SchedulerPlanChangeKind = 'moved' | 'added' | 'removed' | 'variantChanged';

export type SchedulerPlanChange = {
  kind: SchedulerPlanChangeKind;
  targetKind: 'intention' | 'rhythm';
  targetId: string;
  from?: SchedulerPlacementPoint;
  to?: SchedulerPlacementPoint;
  reason: string;
};

export type SchedulerRepairMetadata = {
  trigger?: SchedulerRepairTrigger;
  reason: string;
  now?: SchedulerRepairNow;
  frozenPastPlacementIds: string[];
  preservedPlacementIds: string[];
  changes: SchedulerPlanChange[];
  undo: SchedulerPlanSnapshot;
};

export type SchedulerPlan = SchedulerPlanSnapshot & {
  repair?: SchedulerRepairMetadata;
};

export type SchedulerChange = {
  reason: string;
  nextInput: SchedulingDomainModel;
  trigger?: SchedulerRepairTrigger;
  now?: SchedulerRepairNow;
  releasePlacementIds?: string[];
  surfacedPlacementIds?: string[];
  pinnedPlacementIds?: string[];
};

export type PlacementExplanation = {
  placementId: string;
  intentionId: string;
  targetKind?: 'intention' | 'rhythm';
  variantKind?: TaskVariantKind;
  provenance: string[];
};
