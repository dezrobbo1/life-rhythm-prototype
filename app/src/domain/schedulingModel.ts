import type { PreferencePrecedenceSource } from './preferencePrecedence';

export type LocalDate = string;
export type LocalTime = string;
export type Instant = string;

export type SourceRecordRef = {
  kind:
    | 'activeTask'
    | 'taskPoolItem'
    | 'rhythmTemplate'
    | 'rhythmPlan'
    | 'rhythmRecurrenceRevision'
    | 'rhythmInstance'
    | 'settings'
    | 'softPlacement';
  id: string;
};

export type TaskVariantKind = 'minimum' | 'normal' | 'full';

export type AppliedDurationLearning = {
  templateId: string;
  source: 'learned' | 'userOverride';
  schedulerMinutes: number;
  sampleCount: number;
  confidence: 'low' | 'moderate' | 'user';
  medianActualMinutes?: number;
  upperQuartileActualMinutes?: number;
};

export type DurationLearningProjection = AppliedDurationLearning & {
  savedNormalMinutes: number;
};

export type TaskVariant = {
  kind: TaskVariantKind;
  label: string;
  minutes: number;
  durationLearning?: DurationLearningProjection;
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
  planId?: string;
  recurrenceRevisionId?: string;
  rhythmInstanceId?: string;
  title: string;
  area: string;
  frequency: number;
  period: 'day' | 'week' | 'month';
  preferredDays: string[];
  preferredTime: string;
  maxPerDay: number;
  eligibilityStartDate?: LocalDate;
  eligibilityEndDate?: LocalDate;
  lifecycleState?: 'eligible' | 'today' | 'inProgress' | 'paused';
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
  workOnly?: boolean;
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
  /** Authority for precedence resolution. Existing synthetic inputs default to explicitPersistent. */
  precedenceSource?: PreferencePrecedenceSource;
  /** Absolute lifetime boundaries for per-candidate evaluation. */
  activeFrom?: Instant;
  expiresAt?: Instant;
  provenance: string;
};

export type SchedulerDayMode = 'normal' | 'reduced';

export type ReducedDayPlanningPolicy = {
  /**
   * Optional stricter caps for Reduced Day. These are product-configurable
   * trial parameters rather than ADHD-wide defaults.
   */
  maxInternalScheduledMinutesPerDay?: number;
  maxAutomaticPlacementsPerDay?: number;
  /**
   * Defaults to true when dayMode is reduced. Only scheduler-owned flexible
   * work is right-sized; time-critical, must-do, in-progress and user-owned
   * placements remain authoritative.
   */
  preferMinimumForFlexibleWork?: boolean;
  /**
   * Exact rhythm IDs permitted to use an explicit usable Minimum because of
   * Reduced Day. Missing/empty means no rhythm opt-in. Caller-supplied policy,
   * not a persisted preference; ordinary capacity-driven fallback is unchanged.
   * Requires reduced mode and preferMinimumForFlexibleWork (default true).
   */
  minimumEligibleRhythmIds?: string[];
};

export type SchedulerPlanningPolicy = {
  maxInternalScheduledMinutesPerDay?: number;
  maxAutomaticPlacementsPerDay?: number;
  dayMode?: SchedulerDayMode;
  /** Local date to which Reduced Day-specific sizing and caps apply. */
  dayModeDate?: LocalDate;
  reducedDay?: ReducedDayPlanningPolicy;
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
  rhythmTemplateId?: string;
  rhythmPlanId?: string;
  rhythmRecurrenceRevisionId?: string;
  rhythmInstanceId?: string;
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
  rhythmPlanningDates?: LocalDate[];
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
  | 'settingsChanged'
  | 'overrun'
  | 'missedStart'
  | 'completionChanged'
  | 'preferenceChanged'
  | 'durationLearningChanged'
  | 'userCorrection'
  | 'taskDefinitionChanged'
  | 'rhythmDefinitionChanged'
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
  rhythmTemplateId?: string;
  rhythmPlanId?: string;
  rhythmRecurrenceRevisionId?: string;
  rhythmInstanceId?: string;
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
  /** Preference targets actually incorporated into this accepted repair. */
  appliedPreferenceRepairTargets?: Array<{
    targetKind: SchedulingPreference['targetKind'];
    targetValue: string;
  }>;
  appliedDurationLearningTemplateIds?: string[];
  previousDurationLearningApplied?: AppliedDurationLearning[];
  /** The previous plan used a task definition that is no longer canonical. */
  taskDefinitionRepairApplied?: boolean;
  /** Rhythm configuration or occurrence eligibility changed after the prior plan. */
  rhythmDefinitionRepairApplied?: boolean;
  /** This repair incorporated pending reviewed settings authority. */
  settingsDefinitionRepairApplied?: boolean;
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
