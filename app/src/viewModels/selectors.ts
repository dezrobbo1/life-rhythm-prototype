import { themeLabels, themes } from '../app/theme';
import type {
  AppDataSnapshot,
  DayName,
  DayShapePreviewBlockViewModel,
  DayShapePreviewGroupId,
  DayShapePreviewGroupViewModel,
  DayShapePreviewViewModel,
  FutureModuleViewModel,
  HiddenEdgeViewModel,
  LifeShapeSettingsViewModel,
  LibraryViewModel,
  LibraryRhythmViewModel,
  PlanBlockViewModel,
  PlanItemViewModel,
  PlanViewModel,
  QuickPackViewModel,
  ResetActionViewModel,
  ResetViewModel,
  SafetySettingsViewModel,
  SetupViewModel,
  SnapshotActiveTask,
  SnapshotPlanBlock,
  SnapshotResetAction,
  SnapshotRhythmTemplate,
  SoftScheduleAskFirstViewModel,
  SoftScheduleSuggestionViewModel,
  SoftScheduleSuggestionsViewModel,
  TimeEdgeReentryPreviewOptions,
  TimeEdgeReentryPreviewViewModel,
  TimeEdgeReentryReviewItemViewModel,
  TaskDeadlineViewModel,
  TaskVersionViewModel,
  TaskViewModel,
  TodayState,
  TodayViewModel,
  ViewModelOptions,
} from './types';
import { futureModulePlaceholders, resetActions as defaultResetActions } from './fixtures';

const defaultTodayState: TodayState = 'Normal day';

export const dayShapePreviewDays: DayName[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const planLines: Record<TodayState, string> = {
  'Normal day': 'Plan adjusted: one useful next action, then the rhythm preview stays light.',
  'Behind/missed things': 'Plan adjusted: no catch-up pile. Hidden, not deleted.',
  'Low energy': 'Plan adjusted: minimum counts and the smallest version comes first.',
  Overstimulated: 'Plan adjusted: fewer choices, quieter steps, and more room around transitions.',
  'Avoiding something': 'Plan adjusted: start with the first visible edge, not the whole task.',
  'Need restart': 'Plan adjusted: choose one reset action. Today has more room.',
  'Bored / low stimulation': 'Plan adjusted: make the first step concrete without adding pressure.',
};

const defaultSafetySettings: SafetySettingsViewModel = {
  avoidFoodRewards: false,
  avoidShoppingRewards: false,
  avoidScrollingRewards: true,
  avoidUrgencyCountdowns: false,
  avoidAccountabilityPrompts: false,
  avoidStreakPressure: true,
};

const dayShapeTypeLabels: Record<LifeShapeSettingsViewModel['timeBlocks'][number]['type'], string> = {
  familyTime: 'Family time',
  householdFlow: 'Household flow',
  looseTime: 'Loose time',
  openCapacity: 'Open capacity',
  protectedTime: 'Protected time',
  recoveryTime: 'Recovery time',
};

const dayShapeGroupCopy: Record<DayShapePreviewGroupId, Omit<DayShapePreviewGroupViewModel, 'blocks'>> = {
  askFirst: {
    id: 'askFirst',
    meaning: 'Life Rhythm should ask before treating these blocks as usable.',
    title: 'Ask first',
  },
  available: {
    id: 'available',
    meaning: 'The user has marked these blocks as possible open capacity.',
    title: 'Open capacity',
  },
  unavailable: {
    id: 'unavailable',
    meaning: 'Life Rhythm should leave these blocks alone by default.',
    title: 'Time to leave alone',
  },
};

const schedulerUseMeanings: Record<DayShapePreviewGroupId, string> = {
  askFirst: 'Ask before using this block.',
  available: 'Available only because the user marked it that way.',
  unavailable: 'Leave this block alone by default.',
};

function safeVersion(version: SnapshotActiveTask['minimum'], label: TaskVersionViewModel['label']): TaskVersionViewModel {
  return {
    label,
    minutes: version?.minutes,
    text: version?.label || `${label} version is not set yet.`,
  };
}

function toHiddenEdges(edges: HiddenEdgeViewModel[] | undefined): HiddenEdgeViewModel[] {
  return [...(edges ?? [])];
}

function toTaskViewModel(task: SnapshotActiveTask): TaskViewModel {
  return {
    id: task.id,
    area: task.area || 'Other',
    chips: (task.chips ?? ['Minimum counts']).slice(0, 2),
    deadline: task.deadline ? { ...task.deadline } : undefined,
    hiddenEdges: toHiddenEdges(task.hiddenEdges),
    purpose: task.purpose || 'One realistic next action.',
    recommendedSize: task.minimum?.minutes ? `${task.minimum.minutes} min minimum` : 'Small',
    source: task.source || 'adhoc',
    templateId: task.templateId,
    title: task.title,
    versions: {
      minimum: safeVersion(task.minimum, 'Minimum'),
      normal: safeVersion(task.normal ?? task.minimum, 'Normal'),
      full: safeVersion(task.full ?? task.normal ?? task.minimum, 'Full'),
    },
  };
}

function isVisibleTodayTask(task: SnapshotActiveTask): boolean {
  return (
    Boolean(task.showToday) &&
    (task.status === undefined ||
      task.status === 'active' ||
      task.status === 'inProgress' ||
      task.status === 'paused' ||
      task.status === 'minimumDone')
  );
}

const reentryReviewIntro = [
  'Some tasks may need a calm review because their useful window changed.',
  'Nothing moves unless you choose.',
  'No catch-up pile.',
  'Choose later when you are ready.',
];

const reentryActionOptions: TimeEdgeReentryReviewItemViewModel['actionOptions'] = [
  'Park safely',
  'Try the minimum',
  'Mark not today',
];

function timestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function optionCopyForPolicy(policy: TaskDeadlineViewModel['missedPolicy']): string | undefined {
  if (policy === 'minimumOnly') {
    return 'The minimum version may be enough now.';
  }

  if (policy === 'park' || policy === 'hideUntilReview') {
    return 'Parking it safely is allowed.';
  }

  if (policy === 'notToday') {
    return 'Marking not today is allowed.';
  }

  if (policy === 'followUpPrompt') {
    return 'A follow-up choice can wait until you are ready.';
  }

  if (policy === 'archiveIfExpired') {
    return 'Choosing when ready is allowed.';
  }

  return undefined;
}

function buildReentryReviewItem(task: SnapshotActiveTask, nowMs: number): TimeEdgeReentryReviewItemViewModel | null {
  const deadline = task.deadline;

  if (!isVisibleTodayTask(task) || !deadline) {
    return null;
  }

  const dueAt = timestamp(deadline.dueAt);
  const fixedAt = timestamp(deadline.fixedAt);
  const expiresAfter = timestamp(deadline.expiresAfter);
  const latestUsefulStartAt = timestamp(deadline.latestUsefulStartAt);
  const notUsefulAfter = timestamp(deadline.notUsefulAfter);
  const supportingCopy: string[] = [];
  let reason = '';

  if (notUsefulAfter !== null && notUsefulAfter < nowMs) {
    reason = 'Original useful window has passed; choose what still helps.';
  } else if (
    latestUsefulStartAt !== null &&
    latestUsefulStartAt < nowMs &&
    (notUsefulAfter === null || notUsefulAfter >= nowMs)
  ) {
    reason = 'Minimum may be the useful version now.';
  } else if (deadline.timeConstraint === 'dueBy' && dueAt !== null && dueAt < nowMs) {
    reason = 'Useful-before time has passed; choose what still helps.';
  } else if (deadline.timeConstraint === 'fixedAt' && fixedAt !== null && fixedAt < nowMs) {
    reason = 'The fixed-time point has passed; choose what still helps.';
  } else if (deadline.timeConstraint === 'expiresAfter' && expiresAfter !== null && expiresAfter < nowMs) {
    reason = 'This was useful until an earlier time; choose what still helps.';
  }

  if (!reason) {
    return null;
  }

  supportingCopy.push('Still safely held.');

  if (deadline.minimumStillUsefulAfterDeadline) {
    supportingCopy.push('Minimum still helps.');
  }

  return {
    actionOptions: [...reentryActionOptions],
    id: task.id,
    reason,
    suggestedCopy: optionCopyForPolicy(deadline.missedPolicy),
    supportingCopy,
    title: task.title,
  };
}

export function buildTimeEdgeReentryPreviewViewModel(
  snapshot: AppDataSnapshot = {},
  options: TimeEdgeReentryPreviewOptions = {},
): TimeEdgeReentryPreviewViewModel {
  const nowMs = options.now ? new Date(options.now).getTime() : Date.now();
  const safeNowMs = Number.isNaN(nowMs) ? Date.now() : nowMs;

  return {
    intro: [...reentryReviewIntro],
    items: (snapshot.activeTasks ?? []).flatMap((task) => {
      const item = buildReentryReviewItem(task, safeNowMs);

      return item ? [item] : [];
    }),
    title: 'Re-entry review',
  };
}

function rhythmPreviewFromTemplates(templates: SnapshotRhythmTemplate[] | undefined, limit: number): string[] {
  return (templates ?? [])
    .filter((template) => template.enabled)
    .slice(0, limit)
    .map((template) => template.title);
}

export function buildTodayViewModel(
  snapshot: AppDataSnapshot = {},
  options: ViewModelOptions = {},
): TodayViewModel {
  const currentState = options.todayState ?? snapshot.todayState ?? defaultTodayState;
  const todayTasks = (snapshot.activeTasks ?? []).filter(isVisibleTodayTask);
  const nextUsefulAction = todayTasks.length > 0 ? toTaskViewModel(todayTasks[0]) : null;

  return {
    currentState,
    emptyState: {
      title: 'Choose rhythms to turn on',
      message: 'Choose rhythms to turn on, or add one today-only task.',
      primaryActionLabel: 'Add one-off',
    },
    nextUsefulAction,
    planAdjustedLine: planLines[currentState],
    rhythmPreview: rhythmPreviewFromTemplates(snapshot.rhythmTemplates, options.maxTodayRhythms ?? 3),
  };
}

function toPlanItem(item: PlanItemViewModel): PlanItemViewModel {
  return {
    ...item,
    hiddenEdges: toHiddenEdges(item.hiddenEdges),
  };
}

function toPlanBlock(block: SnapshotPlanBlock): PlanBlockViewModel {
  const items = (block.items ?? []).map(toPlanItem);

  return {
    fixedCommitments: items.filter((item) => item.type === 'fixed'),
    flexibleRhythms: items.filter((item) => item.type === 'rhythm'),
    id: block.id,
    label: block.label,
    softTimeRange: block.softTimeRange || 'soft range',
    state: block.state || 'light',
    summary: block.summary || 'Keep the shape visible without locking every minute.',
  };
}

export function buildPlanViewModel(snapshot: AppDataSnapshot = {}): PlanViewModel {
  return {
    blocks: (snapshot.planBlocks ?? []).map(toPlanBlock),
    roomMessage: {
      label: snapshot.planBlocks?.some((block) => block.state === 'heavy') ? 'Today may be full' : 'Today has room',
      body: 'Fixed commitments are visible. Flexible rhythms can move, shrink, or restart from one action.',
    },
  };
}

function toDayShapePreviewBlock(
  block: LifeShapeSettingsViewModel['timeBlocks'][number],
): DayShapePreviewBlockViewModel {
  return {
    end: block.end,
    id: block.id,
    label: block.label,
    notes: block.notes,
    schedulerUse: block.schedulerUse,
    schedulerUseMeaning: schedulerUseMeanings[block.schedulerUse],
    start: block.start,
    timeRange: `${block.start}-${block.end}`,
    type: block.type,
    typeLabel: dayShapeTypeLabels[block.type],
  };
}

function emptyDayShapeGroups(): DayShapePreviewGroupViewModel[] {
  return [
    { ...dayShapeGroupCopy.unavailable, blocks: [] },
    { ...dayShapeGroupCopy.askFirst, blocks: [] },
    { ...dayShapeGroupCopy.available, blocks: [] },
  ];
}

export function buildDayShapePreviewViewModel(
  snapshot: AppDataSnapshot = {},
  selectedDay: DayName = 'Monday',
): DayShapePreviewViewModel {
  const safeSelectedDay = dayShapePreviewDays.includes(selectedDay) ? selectedDay : 'Monday';
  const matchingBlocks = (snapshot.settings?.lifeShape?.timeBlocks ?? [])
    .filter((block) => block.days.includes(safeSelectedDay))
    .map(toDayShapePreviewBlock);
  const groups = emptyDayShapeGroups().map((group) => ({
    ...group,
    blocks: matchingBlocks.filter((block) => block.schedulerUse === group.id),
  }));

  return {
    boundaryCopy: 'These blocks are planning context only. No tasks are placed from this preview.',
    emptyState: {
      message: 'Blank time stays blank here. Life Rhythm is not treating it as available.',
      title: `No blocks defined for ${safeSelectedDay}.`,
    },
    groups,
    intro: 'Not every open gap is available.',
    selectedDay: safeSelectedDay,
  };
}

const softSuggestionIntro = [
  'Suggestions only.',
  'Nothing is placed from here.',
  'Protected and loose time are respected.',
  'Blank time is not treated as available.',
];

function softSuggestionReason(task: SnapshotActiveTask): string {
  const deadline = task.deadline;

  if (deadline?.latestUsefulStartAt) {
    return 'The useful-start edge is visible. Minimum may be the useful version now.';
  }

  if (deadline?.timeConstraint === 'dueBy' && deadline.dueAt) {
    return 'Usefulness window is visible. Choose this only if it still helps.';
  }

  if (deadline?.timeConstraint === 'fixedAt' && deadline.fixedAt) {
    return 'Fixed-time context is visible. This is still only a possible place.';
  }

  if (deadline?.timeConstraint === 'expiresAfter' && deadline.expiresAfter) {
    return 'Useful-until context is visible. Choose what still helps.';
  }

  if (deadline?.notUsefulAfter) {
    return 'Useful-window context is visible. This does not place the task.';
  }

  return 'This is a user-marked open-capacity block, not blank time.';
}

function toSoftAskFirstBlock(
  block: LifeShapeSettingsViewModel['timeBlocks'][number],
): SoftScheduleAskFirstViewModel {
  return {
    blockId: block.id,
    blockLabel: block.label,
    blockTimeRange: `${block.start}-${block.end}`,
    id: `ask-first-${block.id}`,
    meaning: 'Ask first before treating this as usable.',
    typeLabel: dayShapeTypeLabels[block.type],
  };
}

function toSoftSuggestion(
  task: SnapshotActiveTask,
  block: LifeShapeSettingsViewModel['timeBlocks'][number],
): SoftScheduleSuggestionViewModel {
  return {
    blockId: block.id,
    blockLabel: block.label,
    blockTimeRange: `${block.start}-${block.end}`,
    boundaryCopy: 'No schedule created',
    id: `${task.id}-${block.id}`,
    reason: softSuggestionReason(task),
    taskId: task.id,
    taskTitle: task.title,
  };
}

export function buildSoftScheduleSuggestionsViewModel(
  snapshot: AppDataSnapshot = {},
  selectedDay: DayName = 'Monday',
): SoftScheduleSuggestionsViewModel {
  const safeSelectedDay = dayShapePreviewDays.includes(selectedDay) ? selectedDay : 'Monday';
  const matchingBlocks = (snapshot.settings?.lifeShape?.timeBlocks ?? []).filter((block) =>
    block.days.includes(safeSelectedDay),
  );
  const openCapacityBlocks = matchingBlocks.filter((block) =>
    block.type === 'openCapacity' && block.schedulerUse === 'available',
  );
  const askFirstPossibilities = matchingBlocks
    .filter((block) => block.schedulerUse === 'askFirst')
    .map(toSoftAskFirstBlock);
  const visibleTasks = (snapshot.activeTasks ?? []).filter(isVisibleTodayTask);
  const suggestions = openCapacityBlocks
    .slice(0, visibleTasks.length)
    .map((block, index) => toSoftSuggestion(visibleTasks[index], block));

  return {
    askFirstPossibilities,
    emptyState: {
      message: 'Life Rhythm is not treating blank time as available.',
      title: 'No open capacity blocks for this day.',
    },
    intro: [...softSuggestionIntro],
    selectedDay: safeSelectedDay,
    suggestions,
    title: 'Soft suggestions',
  };
}

function toLibraryRhythm(template: SnapshotRhythmTemplate): LibraryRhythmViewModel {
  return {
    category: template.category || template.area || 'Other',
    chips: (template.chips ?? ['Reusable']).slice(0, 2),
    enabled: Boolean(template.enabled),
    fullVersion: template.full?.label || template.normal?.label || template.minimum?.label || 'Full version is not set yet.',
    id: template.id,
    minimumVersion: template.minimum?.label || 'Minimum version is not set yet.',
    normalVersion: template.normal?.label || template.minimum?.label || 'Normal version is not set yet.',
    purpose: template.purpose || 'Reusable rhythm template.',
    recommendedSize: template.minimum?.minutes ? `${template.minimum.minutes} min minimum` : 'Small',
    title: template.title,
  };
}

function uniqueCategories(rhythms: LibraryRhythmViewModel[]): string[] {
  return ['All', ...Array.from(new Set(rhythms.map((rhythm) => rhythm.category)))];
}

export function buildLibraryViewModel(snapshot: AppDataSnapshot = {}): LibraryViewModel {
  const reusableRhythms = (snapshot.rhythmTemplates ?? []).map(toLibraryRhythm);

  return {
    categories: uniqueCategories(reusableRhythms),
    disabledRhythms: reusableRhythms.filter((rhythm) => !rhythm.enabled),
    emptyState: {
      title: 'No rhythms yet',
      message: 'Create or enable reusable rhythms when they are useful.',
    },
    enabledRhythms: reusableRhythms.filter((rhythm) => rhythm.enabled),
    oneOffTodayTaskIds: (snapshot.activeTasks ?? [])
      .filter((task) => task.source === 'adhoc')
      .map((task) => task.id),
    quickPacks: [...(snapshot.quickPacks ?? [])] as QuickPackViewModel[],
    reusableRhythms,
  };
}

function fallbackResetAction(group: SnapshotResetAction['group']): SnapshotResetAction {
  const found = defaultResetActions.find((action) => action.group === group);

  return found ?? {
    confirmationCopy: 'That counts.',
    destructive: group === 'destructive',
    group,
    id: `${group}-placeholder`,
    purpose: 'Choose one low-pressure next step.',
    title: group === 'destructive' ? 'Reset whole app' : 'Restart with one action',
  };
}

function toResetAction(action: SnapshotResetAction): ResetActionViewModel {
  return {
    confirmationCopy: action.confirmationCopy,
    destructive: action.destructive,
    id: action.id,
    purpose: action.purpose,
    title: action.title,
  };
}

export function buildResetViewModel(snapshot: AppDataSnapshot = {}): ResetViewModel {
  const actions = snapshot.resetActions ?? defaultResetActions;

  return {
    destructiveAction: toResetAction(actions.find((action) => action.group === 'destructive') ?? fallbackResetAction('destructive')),
    headline: 'No catch-up pile. Choose what helps now.',
    mainActions: actions.filter((action) => action.group === 'main').map(toResetAction),
    secondaryActions: actions.filter((action) => action.group === 'secondary').map(toResetAction),
  };
}

function toFutureModules(modules: FutureModuleViewModel[] | undefined): FutureModuleViewModel[] {
  return (modules ?? futureModulePlaceholders).map((module) => ({
    ...module,
    enabled: Boolean(module.enabled),
  }));
}

export function buildSetupViewModel(snapshot: AppDataSnapshot = {}): SetupViewModel {
  return {
    dataPreview: {
      copy: 'Settings backup is available now. Import and wider app backup stay later-only.',
      exportAvailable: true,
      importAvailable: false,
    },
    futureModules: toFutureModules(snapshot.futureModules),
    selectedTheme: snapshot.settings?.theme ?? 'exhale',
    startBoostSafety: {
      ...defaultSafetySettings,
      ...(snapshot.settings?.startBoostSafety ?? {}),
    },
    themeChoices: themes.map((theme) => ({
      id: theme,
      label: themeLabels[theme],
    })),
  };
}
