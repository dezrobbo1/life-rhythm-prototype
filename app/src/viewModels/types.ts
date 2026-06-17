import type { ThemeName } from '../app/theme';

export type TodayState =
  | 'Normal day'
  | 'Behind/missed things'
  | 'Low energy'
  | 'Overstimulated'
  | 'Avoiding something'
  | 'Need restart'
  | 'Bored / low stimulation';

export type TaskVersionViewModel = {
  label: 'Minimum' | 'Normal' | 'Full';
  text: string;
  minutes?: number;
};

export type TaskDeadlineViewModel = {
  timeConstraint?: 'flexible' | 'dueBy' | 'fixedAt' | 'expiresAfter';
  dueAt?: string;
  fixedAt?: string;
  expiresAfter?: string;
  latestUsefulStartAt?: string;
  notUsefulAfter?: string;
  minimumStillUsefulAfterDeadline?: boolean;
  missedPolicy?: 'ask' | 'park' | 'notToday' | 'minimumOnly' | 'followUpPrompt' | 'hideUntilReview' | 'archiveIfExpired';
};

export type TaskViewModel = {
  id: string;
  title: string;
  area: string;
  purpose: string;
  source: 'adhoc' | 'library' | 'custom';
  templateId?: string;
  recommendedSize: string;
  versions: {
    minimum: TaskVersionViewModel;
    normal: TaskVersionViewModel;
    full: TaskVersionViewModel;
  };
  chips: string[];
  hiddenEdges: HiddenEdgeViewModel[];
  deadline?: TaskDeadlineViewModel;
};

export type TodayViewModel = {
  currentState: TodayState;
  planAdjustedLine: string;
  nextUsefulAction: TaskViewModel | null;
  rhythmPreview: string[];
  emptyState: {
    title: string;
    message: string;
    primaryActionLabel: string;
  };
};

export type HiddenEdgeKind =
  | 'prep'
  | 'travel'
  | 'arrival margin'
  | 'setup'
  | 'cleanup'
  | 'transition'
  | 'decompression';

export type HiddenEdgeViewModel = {
  id: string;
  kind: HiddenEdgeKind;
  label: string;
  range: string;
};

export type PlanItemViewModel = {
  id: string;
  title: string;
  area: string;
  type: 'fixed' | 'rhythm';
  softRange: string;
  tone: string;
  hiddenEdges: HiddenEdgeViewModel[];
};

export type PlanBlockViewModel = {
  id: string;
  label: 'Morning' | 'Midday' | 'Afternoon' | 'Evening' | 'Late evening';
  softTimeRange: string;
  state: 'free' | 'light' | 'planned' | 'heavy' | 'fixed' | 'wind down' | 'restart point';
  summary: string;
  fixedCommitments: PlanItemViewModel[];
  flexibleRhythms: PlanItemViewModel[];
};

export type PlanViewModel = {
  roomMessage: {
    label: string;
    body: string;
  };
  blocks: PlanBlockViewModel[];
};

export type LibraryRhythmViewModel = {
  id: string;
  title: string;
  category: string;
  purpose: string;
  enabled: boolean;
  recommendedSize: string;
  minimumVersion: string;
  normalVersion: string;
  fullVersion: string;
  chips: string[];
};

export type QuickPackViewModel = {
  id: string;
  title: string;
  purpose: string;
  rhythmIds: string[];
};

export type LibraryViewModel = {
  categories: string[];
  reusableRhythms: LibraryRhythmViewModel[];
  enabledRhythms: LibraryRhythmViewModel[];
  disabledRhythms: LibraryRhythmViewModel[];
  quickPacks: QuickPackViewModel[];
  oneOffTodayTaskIds: string[];
  emptyState: {
    title: string;
    message: string;
  };
};

export type ResetActionViewModel = {
  id: string;
  title: string;
  purpose: string;
  confirmationCopy: string;
  destructive: boolean;
};

export type ResetViewModel = {
  headline: string;
  mainActions: ResetActionViewModel[];
  secondaryActions: ResetActionViewModel[];
  destructiveAction: ResetActionViewModel;
};

export type SafetySettingsViewModel = {
  avoidFoodRewards: boolean;
  avoidShoppingRewards: boolean;
  avoidScrollingRewards: boolean;
  avoidUrgencyCountdowns: boolean;
  avoidAccountabilityPrompts: boolean;
  avoidStreakPressure: boolean;
};

export type LifeShapeSettingsViewModel = {
  usualWorkHours: {
    days: string[];
    start: string;
    end: string;
  };
  commuteMinutes: number;
  travelMinutes: number;
  fixedCommitments: Array<{
    id: string;
    label: string;
    days: string[];
    start?: string;
    end?: string;
    travelMinutes: number;
    bufferMinutes: number;
  }>;
  transitionBufferMinutes: number;
  mealAnchors: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
  sleepWakeAnchors: {
    wake: string;
    sleep: string;
  };
  lowCapacityPreference: 'protect-evening' | 'lighter-morning' | 'minimum-first';
  timeBlocks: Array<{
    id: string;
    label: string;
    type: 'protectedTime' | 'recoveryTime' | 'looseTime' | 'householdFlow' | 'familyTime' | 'openCapacity';
    days: string[];
    start: string;
    end: string;
    notes?: string;
    schedulerUse: 'unavailable' | 'askFirst' | 'available';
  }>;
};

export type FutureModuleId =
  | 'rhythm-food'
  | 'rhythm-move'
  | 'rhythm-learn'
  | 'rhythm-sleep'
  | 'rhythm-work'
  | 'rhythm-home'
  | 'rhythm-calm'
  | 'rhythm-money'
  | 'rhythm-goals';

export type FutureModuleViewModel = {
  id: FutureModuleId;
  label: string;
  enabled: boolean;
  note: string;
};

export type SetupViewModel = {
  selectedTheme: ThemeName;
  themeChoices: Array<{
    id: ThemeName;
    label: string;
  }>;
  startBoostSafety: SafetySettingsViewModel;
  dataPreview: {
    exportAvailable: boolean;
    importAvailable: boolean;
    copy: string;
  };
  futureModules: FutureModuleViewModel[];
};

export type SnapshotTaskVersion = {
  label: string;
  minutes?: number;
};

export type SnapshotSchedule = {
  fixedTime?: string;
  targetDate?: string;
  prepMinutes?: number;
  travelMinutes?: number;
  cleanupMinutes?: number;
  transitionMinutes?: number;
  frequency?: number;
  preferredDays?: string[];
};

export type SnapshotActiveTask = {
  id: string;
  title: string;
  area?: string;
  purpose?: string;
  source?: 'adhoc' | 'library' | 'custom';
  templateId?: string;
  showToday?: boolean;
  status?: 'active' | 'inProgress' | 'paused' | 'minimumDone' | 'done' | 'parked' | 'skipped' | 'notToday';
  minimum?: SnapshotTaskVersion;
  normal?: SnapshotTaskVersion;
  full?: SnapshotTaskVersion;
  schedule?: SnapshotSchedule;
  chips?: string[];
  hiddenEdges?: HiddenEdgeViewModel[];
  deadline?: TaskDeadlineViewModel;
};

export type SnapshotRhythmTemplate = {
  id: string;
  title: string;
  category?: string;
  area?: string;
  purpose?: string;
  enabled?: boolean;
  minimum?: SnapshotTaskVersion;
  normal?: SnapshotTaskVersion;
  full?: SnapshotTaskVersion;
  schedule?: SnapshotSchedule;
  chips?: string[];
};

export type SnapshotPlanBlock = {
  id: string;
  label: PlanBlockViewModel['label'];
  softTimeRange?: string;
  state?: PlanBlockViewModel['state'];
  summary?: string;
  items?: PlanItemViewModel[];
};

export type SnapshotResetAction = ResetActionViewModel & {
  group: 'main' | 'secondary' | 'destructive';
};

export type SnapshotSettings = {
  theme?: ThemeName;
  startBoostSafety?: Partial<SafetySettingsViewModel>;
  lifeShape?: LifeShapeSettingsViewModel;
};

export type AppDataSnapshot = {
  settings?: SnapshotSettings;
  todayState?: TodayState;
  activeTasks?: SnapshotActiveTask[];
  rhythmTemplates?: SnapshotRhythmTemplate[];
  quickPacks?: QuickPackViewModel[];
  planBlocks?: SnapshotPlanBlock[];
  resetActions?: SnapshotResetAction[];
  futureModules?: FutureModuleViewModel[];
};

export type ViewModelOptions = {
  todayState?: TodayState;
  maxTodayRhythms?: number;
};
