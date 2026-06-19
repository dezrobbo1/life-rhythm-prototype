import type {
  AppDataSnapshot,
  FutureModuleViewModel,
  SnapshotActiveTask,
  SnapshotPlanBlock,
  SnapshotResetAction,
  SnapshotRhythmTemplate,
} from './types';

const timestamp = '2026-06-14T00:00:00.000Z';

export const futureModulePlaceholders: FutureModuleViewModel[] = [
  { id: 'rhythm-food', label: 'Rhythm Food', enabled: false, note: 'Future placeholder only.' },
  { id: 'rhythm-move', label: 'Rhythm Move', enabled: false, note: 'Future placeholder only.' },
  { id: 'rhythm-learn', label: 'Rhythm Learn', enabled: false, note: 'Future placeholder only.' },
  { id: 'rhythm-sleep', label: 'Rhythm Sleep', enabled: false, note: 'Future placeholder only.' },
  { id: 'rhythm-work', label: 'Rhythm Work', enabled: false, note: 'Future placeholder only.' },
  { id: 'rhythm-home', label: 'Rhythm Home', enabled: false, note: 'Future placeholder only.' },
  { id: 'rhythm-calm', label: 'Rhythm Calm', enabled: false, note: 'Future placeholder only.' },
  { id: 'rhythm-money', label: 'Rhythm Money', enabled: false, note: 'Future placeholder only.' },
  { id: 'rhythm-goals', label: 'Rhythm Goals / Quiet Goals', enabled: false, note: 'Future placeholder only.' },
];

export const oneTaskToday: SnapshotActiveTask = {
  id: 'today-first-step',
  title: "Set tomorrow's first step",
  area: 'Home admin',
  purpose: "Lower tomorrow's start friction before the day closes.",
  source: 'adhoc',
  showToday: true,
  status: 'active',
  minimum: { label: 'Write one first step for tomorrow.', minutes: 2 },
  normal: { label: 'Choose the first step, place one needed item, and park the rest.', minutes: 8 },
  full: { label: "Review tomorrow's top three and clear one hidden edge.", minutes: 15 },
  chips: ['Minimum counts', 'No catch-up pile'],
  hiddenEdges: [
    { id: 'capture-place', kind: 'prep', label: 'Find the capture place', range: '1-3 min' },
    { id: 'close-today', kind: 'transition', label: 'Close today before choosing tomorrow', range: '3-5 min' },
  ],
};

export const oneOffTodayTask: SnapshotActiveTask = {
  id: 'one-off-water-bill',
  title: 'Pay water bill',
  area: 'Money',
  purpose: 'A today-only admin task.',
  source: 'adhoc',
  showToday: true,
  status: 'active',
  minimum: { label: 'Open the bill and note the due date.', minutes: 3 },
  normal: { label: 'Pay the bill or park the exact next step.', minutes: 10 },
  full: { label: 'Pay, file the receipt, and clear the open tab.', minutes: 15 },
  chips: ['Today only', 'Minimum counts'],
};

export const rhythmTemplates: SnapshotRhythmTemplate[] = [
  {
    id: 'sleep-wind-down',
    title: 'Gentle wind-down',
    category: 'Sleep',
    area: 'sleep',
    purpose: 'Make the last part of the day quieter.',
    enabled: true,
    minimum: { label: 'Dim one light and choose tomorrow clothes.', minutes: 5 },
    normal: { label: 'Dim lights, set tomorrow clothes, and park one open loop.', minutes: 10 },
    full: { label: 'Prepare the room, park open loops, and choose one calm next step.', minutes: 15 },
    chips: ['Evening', 'Minimum counts'],
  },
  {
    id: 'food-breakfast-reset',
    title: 'Breakfast reset',
    category: 'Food',
    area: 'food',
    purpose: 'Make the first food step visible and small.',
    enabled: false,
    minimum: { label: 'Clear one surface and choose the easiest breakfast option.', minutes: 5 },
    normal: { label: 'Clear one surface, eat, and put two visible items away.', minutes: 10 },
    full: { label: 'Eat, clear the surface, and set up the next food cue.', minutes: 15 },
    chips: ['Morning', 'Easy start'],
  },
  {
    id: 'work-first-file',
    title: 'Open the first file',
    category: 'Work focus',
    area: 'work',
    purpose: 'Make work start with one visible object.',
    enabled: true,
    minimum: { label: 'Open the file or tab only.', minutes: 5 },
    normal: { label: 'Open the file and write the next sentence or action.', minutes: 15 },
    full: { label: 'Open the file, write the next action, and close unrelated tabs.', minutes: 25 },
    chips: ['Work', 'Start small'],
  },
];

export const planWithFixedCommitmentsAndHiddenEdges: SnapshotPlanBlock[] = [
  {
    id: 'morning',
    label: 'Morning',
    softTimeRange: 'about 6:30-12:00',
    state: 'planned',
    summary: 'One fixed point, then a light rhythm.',
    items: [
      {
        id: 'school-dropoff',
        title: 'School drop-off',
        area: 'Family',
        type: 'fixed',
        softRange: 'around 8:15-9:00',
        tone: 'Leave space around the edges.',
        hiddenEdges: [
          { id: 'dropoff-prep', kind: 'prep', label: 'Find bags and water bottles', range: '10-15 min' },
          { id: 'dropoff-travel', kind: 'travel', label: 'Drive and park', range: '15-25 min' },
          { id: 'dropoff-arrival', kind: 'arrival margin', label: 'Walk in and settle', range: '5-10 min' },
        ],
      },
      {
        id: 'breakfast-reset',
        title: 'Breakfast reset',
        area: 'Food',
        type: 'rhythm',
        softRange: '5-10 min',
        tone: 'Minimum counts.',
        hiddenEdges: [
          { id: 'breakfast-setup', kind: 'setup', label: 'Clear one surface', range: '2-5 min' },
          { id: 'breakfast-cleanup', kind: 'cleanup', label: 'Put away visible items', range: '3-5 min' },
        ],
      },
    ],
  },
];

export const resetActions: SnapshotResetAction[] = [
  {
    id: 'tooMuchToday',
    group: 'main',
    title: 'Narrow Today',
    purpose: 'Keep one next action visible and move extras out of Today.',
    confirmationCopy: 'Today is narrowed to one next action. Extras are marked not today. No catch-up pile.',
    destructive: false,
  },
  {
    id: 'moveExtras',
    group: 'main',
    title: 'Park extras safely',
    purpose: 'Hold extra Today tasks safely so one next action remains.',
    confirmationCopy: 'Extras are parked safely. One next action remains. No catch-up pile.',
    destructive: false,
  },
  {
    id: 'restartOneAction',
    group: 'main',
    title: 'Restart with one action',
    purpose: 'Pick one small re-entry action and let that be enough.',
    confirmationCopy: 'One action is enough. That counts.',
    destructive: false,
  },
  {
    id: 'reviewTomorrow',
    group: 'secondary',
    title: 'Review tomorrow',
    purpose: "Set tomorrow's first step without pulling more into today.",
    confirmationCopy: "Tomorrow's first step is visible.",
    destructive: false,
  },
  {
    id: 'fullAppReset',
    group: 'destructive',
    title: 'Reset whole app',
    purpose: 'Protected destructive reset placeholder for a future flow.',
    confirmationCopy: 'Full app reset is not enabled for this trial. No data is cleared.',
    destructive: true,
  },
];

export const emptyAppSnapshot: AppDataSnapshot = {
  settings: {
    theme: 'exhale',
  },
  activeTasks: [],
  rhythmTemplates: [],
  planBlocks: [],
  resetActions,
  futureModules: futureModulePlaceholders,
};

export const normalDayWithOneTaskSnapshot: AppDataSnapshot = {
  settings: {
    theme: 'exhale',
    startBoostSafety: {
      avoidFoodRewards: false,
      avoidShoppingRewards: true,
      avoidScrollingRewards: true,
      avoidUrgencyCountdowns: true,
      avoidAccountabilityPrompts: false,
      avoidStreakPressure: true,
    },
  },
  todayState: 'Normal day',
  activeTasks: [oneTaskToday],
  rhythmTemplates,
  quickPacks: [
    {
      id: 'morning-basics',
      title: 'Morning basics',
      purpose: 'Enable gentle morning rhythms without creating a task pile.',
      rhythmIds: ['food-breakfast-reset'],
    },
  ],
  planBlocks: planWithFixedCommitmentsAndHiddenEdges,
  resetActions,
  futureModules: futureModulePlaceholders,
};

export const overloadedDaySnapshot: AppDataSnapshot = {
  ...normalDayWithOneTaskSnapshot,
  todayState: 'Behind/missed things',
  activeTasks: [
    oneTaskToday,
    oneOffTodayTask,
    {
      ...oneTaskToday,
      id: 'today-extra',
      title: 'Move flexible extras',
      purpose: 'Reduce today without creating a catch-up pile.',
      minimum: { label: 'Hide one flexible extra.', minutes: 2 },
      normal: { label: 'Move two extras out of today.', minutes: 5 },
      full: { label: 'Move extras and choose one restart point.', minutes: 10 },
    },
  ],
};

export const libraryWithEnabledDisabledRhythmsSnapshot: AppDataSnapshot = {
  ...normalDayWithOneTaskSnapshot,
  activeTasks: [oneOffTodayTask],
  rhythmTemplates,
};

export const planWithFixedCommitmentsSnapshot: AppDataSnapshot = {
  ...normalDayWithOneTaskSnapshot,
  planBlocks: planWithFixedCommitmentsAndHiddenEdges,
};

export const futureModulesDisabledSnapshot: AppDataSnapshot = {
  ...emptyAppSnapshot,
  futureModules: futureModulePlaceholders,
};

export const fixtureGeneratedAt = timestamp;
