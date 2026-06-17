export const todayStates = [
  'Normal day',
  'Behind/missed things',
  'Low energy',
  'Overstimulated',
  'Avoiding something',
  'Need restart',
  'Bored / low stimulation',
] as const;

export type TodayState = (typeof todayStates)[number];

export const todayStateHints: Record<TodayState, string> = {
  'Normal day': 'Keep the rhythm visible.',
  'Behind/missed things': 'No catch-up pile.',
  'Low energy': 'Minimum counts.',
  Overstimulated: 'Fewer inputs.',
  'Avoiding something': 'First edge only.',
  'Need restart': 'One reset step.',
  'Bored / low stimulation': 'Make it concrete.',
};

export type StartBarrier =
  | 'Too big'
  | 'Unclear first step'
  | 'Too boring'
  | 'Low energy'
  | 'Not enough time'
  | 'Emotionally hard'
  | 'Need information'
  | 'Pulled to phone';

export type MockTask = {
  id: string;
  area: string;
  areaIcon: string;
  title: string;
  purpose: string;
  recommendedSize: string;
  chips: string[];
  minimumVersion: string;
  normalVersion: string;
  fullVersion: string;
  timingReality: string;
  hiddenEdges: string[];
  timeEdge?: {
    dueAt?: string;
    expiresAfter?: string;
    fixedAt?: string;
    latestUsefulStartAt?: string;
    minimumStillUsefulAfterDeadline?: boolean;
    missedPolicy?: 'ask' | 'park' | 'notToday' | 'minimumOnly' | 'followUpPrompt' | 'hideUntilReview' | 'archiveIfExpired';
    notUsefulAfter?: string;
    timeConstraint?: 'flexible' | 'dueBy' | 'fixedAt' | 'expiresAfter';
  };
  whyThis: string;
  startBarriers: StartBarrier[];
  boostSupports: Record<StartBarrier, Array<{ id: string; label: string; detail: string }>>;
};

export const statePlanLines: Record<TodayState, string> = {
  'Normal day': 'Plan adjusted: one useful next action, then the rhythm preview stays light.',
  'Behind/missed things': 'Plan adjusted: no catch-up pile. Hidden, not deleted.',
  'Low energy': 'Plan adjusted: minimum counts and the smallest version comes first.',
  Overstimulated: 'Plan adjusted: fewer choices, quieter steps, and more room around transitions.',
  'Avoiding something': 'Plan adjusted: start with the first visible edge, not the whole task.',
  'Need restart': 'Plan adjusted: choose one reset action. Today has more room.',
  'Bored / low stimulation': 'Plan adjusted: make the first step concrete without adding pressure.',
};

export const stateActionTone: Record<TodayState, string> = {
  'Normal day': 'Start small, then continue only if it still fits.',
  'Behind/missed things': 'Pick the minimum version. That counts.',
  'Low energy': 'Use the smallest possible version and stop cleanly.',
  Overstimulated: 'Reduce inputs first, then take one contained step.',
  'Avoiding something': 'Name the first edge and touch only that part.',
  'Need restart': 'Begin again with one visible action.',
  'Bored / low stimulation': 'Make the start more specific, not bigger.',
};

export const mockTodayTask: MockTask = {
  id: 'mock-review-tomorrow',
  area: 'Home admin',
  areaIcon: 'Home',
  title: "Set tomorrow's first step",
  purpose: "Lower tomorrow's start friction before the day closes.",
  recommendedSize: '8 min',
  chips: ['Minimum counts', 'No catch-up pile'],
  minimumVersion: 'Write one first step for tomorrow.',
  normalVersion: 'Choose the first step, place one needed item, and park the rest.',
  fullVersion: "Review tomorrow's top three and clear one hidden edge.",
  timingReality: 'Best before shutdown. If the day is full, two minutes still counts.',
  hiddenEdges: ['Find the note or place to capture it', 'Decide what is hidden rather than deleted'],
  whyThis: 'A small shutdown step protects tomorrow without turning tonight into a planning session.',
  startBarriers: [
    'Too big',
    'Unclear first step',
    'Too boring',
    'Low energy',
    'Not enough time',
    'Emotionally hard',
    'Need information',
    'Pulled to phone',
  ],
  boostSupports: {
    'Too big': [
      {
        id: 'minimum-first-step',
        label: 'Use the minimum version',
        detail: 'Write one first step only.',
      },
      {
        id: 'hide-the-rest',
        label: 'Hide the rest for now',
        detail: 'Hidden, not deleted.',
      },
    ],
    'Unclear first step': [
      {
        id: 'tomorrow-open',
        label: 'Finish one sentence',
        detail: 'Start with "Tomorrow I open..." and stop there.',
      },
      {
        id: 'choose-object',
        label: 'Choose the first object',
        detail: 'Pick the physical object or screen you need first.',
      },
    ],
    'Too boring': [
      {
        id: 'two-line-note',
        label: 'Make it two lines',
        detail: 'First step, then where it lives.',
      },
      {
        id: 'change-surface',
        label: 'Change the surface',
        detail: 'Use paper, notes app, or a visible sticky note.',
      },
    ],
    'Low energy': [
      {
        id: 'sit-two-minutes',
        label: 'Use the two-minute version',
        detail: 'Sit down and stop after the smallest useful step.',
      },
      {
        id: 'already-open',
        label: 'Use what is already open',
        detail: 'Capture it in the easiest place you can already see.',
      },
    ],
    'Not enough time': [
      {
        id: 'seven-word-step',
        label: 'Write seven words',
        detail: 'Choose one task and write a short first step.',
      },
      {
        id: 'park-the-rest',
        label: 'Park the rest',
        detail: 'Everything else can wait for the next review.',
      },
    ],
    'Emotionally hard': [
      {
        id: 'gentle-truth',
        label: 'Use the gentlest truthful wording',
        detail: 'Write the first step without making it bigger.',
      },
      {
        id: 'support-condition',
        label: 'Name one support condition',
        detail: 'Capture what would make this easier to start.',
      },
    ],
    'Need information': [
      {
        id: 'missing-question',
        label: 'Write the missing question',
        detail: 'Capture the question instead of solving it now.',
      },
      {
        id: 'where-to-look',
        label: 'Name where to look first',
        detail: 'Leave a clear place to begin later.',
      },
    ],
    'Pulled to phone': [
      {
        id: 'phone-face-down',
        label: 'Set the phone face down',
        detail: 'Keep the task on one visible surface.',
      },
      {
        id: 'one-note-only',
        label: 'Open one note only',
        detail: 'Return to the first step after capture.',
      },
    ],
  },
};

export const mockRhythmPreview = [
  'Kitchen reset can wait',
  'Medication check is visible',
  'Tomorrow review stays small',
];
