import { themeLabels, themes } from '../app/theme';
import type {
  AppDataSnapshot,
  FutureModuleViewModel,
  HiddenEdgeViewModel,
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
  TaskVersionViewModel,
  TaskViewModel,
  TodayState,
  TodayViewModel,
  ViewModelOptions,
} from './types';
import { futureModulePlaceholders, resetActions as defaultResetActions } from './fixtures';

const defaultTodayState: TodayState = 'Normal day';

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
  return task.status !== 'completed' && task.status !== 'archived' && Boolean(task.showToday);
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
