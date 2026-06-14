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
  whyThis: string;
  startBarriers: StartBarrier[];
  boostSupports: Record<StartBarrier, string[]>;
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
      'Use the minimum version: write one first step only.',
      'Hide the rest of the plan for now. Hidden, not deleted.',
    ],
    'Unclear first step': [
      'Start with "Tomorrow I open..." and finish the sentence.',
      'Choose the first physical object or screen you need.',
    ],
    'Too boring': [
      'Make it a two-line note: first step, then where it lives.',
      'Change the surface: paper, notes app, or a visible sticky note.',
    ],
    'Low energy': [
      'Sit down and do only the two-minute version.',
      'Use the easiest capture place already open.',
    ],
    'Not enough time': [
      'Choose one task and write a seven-word first step.',
      'Park everything else for the next review.',
    ],
    'Emotionally hard': [
      'Write the gentlest truthful version of the first step.',
      'Name one support condition that would make it easier.',
    ],
    'Need information': [
      'Write the missing question instead of solving it now.',
      'Capture where you would look first later.',
    ],
    'Pulled to phone': [
      'Place the phone face down and keep the task on one visible surface.',
      'Open only the note you need, then return to the first step.',
    ],
  },
};

export const mockRhythmPreview = [
  'Kitchen reset can wait',
  'Medication check is visible',
  'Tomorrow review stays small',
];
