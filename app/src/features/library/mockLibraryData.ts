export const libraryCategories = [
  'All',
  'Sleep',
  'Food',
  'Anti-scroll',
  'Household',
  'Money',
  'Movement',
  'Work focus',
  'Emotional recovery',
  'Motivation',
  'Sensory load',
  'Social support',
  'Start Boost',
] as const;

export type LibraryCategory = (typeof libraryCategories)[number];
export type RhythmCategory = Exclude<LibraryCategory, 'All'>;

export type LibraryRhythm = {
  id: string;
  title: string;
  category: RhythmCategory;
  purpose: string;
  recommendedSize: string;
  minimumVersion: string;
  normalVersion: string;
  fullVersion: string;
  enabled: boolean;
  chips: string[];
  whyThisExists: string;
  boundaryNote: string;
  categoryNote: string;
  packIds: string[];
};

export type QuickPack = {
  id: string;
  title: string;
  purpose: string;
  rhythmIds: string[];
};

export const mockLibraryRhythms: LibraryRhythm[] = [
  {
    id: 'sleep-wind-down',
    title: 'Gentle wind-down',
    category: 'Sleep',
    purpose: 'Make the last part of the day quieter.',
    recommendedSize: '5-10 min',
    minimumVersion: 'Dim one light and choose tomorrow clothes.',
    normalVersion: 'Dim lights, set tomorrow clothes, and park one open loop.',
    fullVersion: 'Prepare the room, park open loops, and choose one calm next step.',
    enabled: true,
    chips: ['Evening', 'Minimum counts'],
    whyThisExists: 'A light wind-down protects tomorrow without turning sleep into a performance goal.',
    boundaryNote: 'Sleep rhythms are self-management support, not medical advice.',
    categoryNote: 'Keep it gentle and environmental. No strict sleep targets.',
    packIds: ['evening-soft-landing'],
  },
  {
    id: 'food-breakfast-reset',
    title: 'Breakfast reset',
    category: 'Food',
    purpose: 'Make the first food step visible and small.',
    recommendedSize: '5-10 min',
    minimumVersion: 'Clear one surface and choose the easiest breakfast option.',
    normalVersion: 'Clear one surface, eat, and put two visible items away.',
    fullVersion: 'Eat, clear the surface, and set up the next food cue.',
    enabled: false,
    chips: ['Morning', 'Easy start'],
    whyThisExists: 'Food rhythms reduce decision load by making the next step visible.',
    boundaryNote: 'Food rhythms do not give nutrition, dieting, calorie, or weight advice.',
    categoryNote: 'Focus on access, visibility, and low-friction starts.',
    packIds: ['morning-basics'],
  },
  {
    id: 'anti-scroll-phone-park',
    title: 'Phone park',
    category: 'Anti-scroll',
    purpose: 'Create a clear place for the phone during one task.',
    recommendedSize: '2-5 min',
    minimumVersion: 'Put the phone face down across the room.',
    normalVersion: 'Put the phone away and leave the current task visible.',
    fullVersion: 'Set the phone aside, clear one surface, and choose the first task step.',
    enabled: false,
    chips: ['Focus', 'Visible cue'],
    whyThisExists: 'A physical phone boundary can lower pull without adding shame.',
    boundaryNote: 'Anti-scroll support stays optional and user-led.',
    categoryNote: 'Avoid urgency, guilt, or forced blocking language.',
    packIds: ['focus-without-pressure'],
  },
  {
    id: 'household-kitchen-landing',
    title: 'Kitchen landing',
    category: 'Household',
    purpose: 'Keep one household area easier to re-enter.',
    recommendedSize: '10-15 min',
    minimumVersion: 'Clear the counter only.',
    normalVersion: 'Clear the counter and put dishes in one place.',
    fullVersion: 'Clear the counter, dishes, and one hidden cleanup edge.',
    enabled: true,
    chips: ['Home', 'Can shrink'],
    whyThisExists: 'A small household reset can make the next transition easier.',
    boundaryNote: 'Household rhythms should not become a demand pile.',
    categoryNote: 'Prefer visible surfaces and minimum versions over full resets.',
    packIds: ['morning-basics', 'evening-soft-landing'],
  },
  {
    id: 'money-receipt-drop',
    title: 'Receipt drop',
    category: 'Money',
    purpose: 'Give money paperwork one safe landing place.',
    recommendedSize: '3-5 min',
    minimumVersion: 'Put receipts in one envelope or note.',
    normalVersion: 'Put receipts together and name the next money admin step.',
    fullVersion: 'Sort receipts, name the next step, and park anything complex.',
    enabled: false,
    chips: ['Admin', 'Park details'],
    whyThisExists: 'A single landing place reduces loose paper without turning into advice.',
    boundaryNote: 'Money rhythms are organisation support, not financial advice.',
    categoryNote: 'No judgement, debt advice, budgeting advice, or investment guidance.',
    packIds: ['admin-light-touch'],
  },
  {
    id: 'movement-doorway-stretch',
    title: 'Doorway stretch',
    category: 'Movement',
    purpose: 'Add a small body reset between blocks.',
    recommendedSize: '2-5 min',
    minimumVersion: 'Stand up and stretch once.',
    normalVersion: 'Stretch, drink water, and return to the next visible step.',
    fullVersion: 'Stretch, reset posture, and set up the next block.',
    enabled: false,
    chips: ['Transition', 'Low energy'],
    whyThisExists: 'A small movement cue can mark a transition without becoming a workout.',
    boundaryNote: 'Movement rhythms are not exercise prescription or rehab guidance.',
    categoryNote: 'Keep intensity optional and user-controlled.',
    packIds: ['focus-without-pressure'],
  },
  {
    id: 'work-focus-first-file',
    title: 'Open the first file',
    category: 'Work focus',
    purpose: 'Make work start with one visible object.',
    recommendedSize: '5 min',
    minimumVersion: 'Open the file or tab only.',
    normalVersion: 'Open the file and write the next sentence or action.',
    fullVersion: 'Open the file, write the next action, and close unrelated tabs.',
    enabled: true,
    chips: ['Work', 'Start small'],
    whyThisExists: 'A visible first object can reduce start ambiguity.',
    boundaryNote: 'Work rhythms are personal scaffolding, not HR or performance monitoring.',
    categoryNote: 'Avoid rankings or employer-facing claims.',
    packIds: ['focus-without-pressure'],
  },
  {
    id: 'emotion-soft-reset',
    title: 'Soft reset',
    category: 'Emotional recovery',
    purpose: 'Create one low-demand re-entry step.',
    recommendedSize: '3-8 min',
    minimumVersion: 'Name one safe next action.',
    normalVersion: 'Name one safe next action and reduce one demand.',
    fullVersion: 'Name the next action, reduce one demand, and choose a support cue.',
    enabled: false,
    chips: ['Reset', 'No pressure'],
    whyThisExists: 'Re-entry support helps the day continue without framing recovery as failure.',
    boundaryNote: 'Emotional recovery rhythms are not therapy or crisis support.',
    categoryNote: 'Use plain language and avoid diagnostic claims.',
    packIds: ['evening-soft-landing'],
  },
  {
    id: 'sensory-quiet-surface',
    title: 'Quiet surface',
    category: 'Sensory load',
    purpose: 'Reduce one visible input before the next task.',
    recommendedSize: '2-5 min',
    minimumVersion: 'Clear or cover one noisy surface.',
    normalVersion: 'Clear one surface and lower one optional input.',
    fullVersion: 'Clear a surface, lower inputs, and choose the next visible cue.',
    enabled: false,
    chips: ['Low load', 'Visual calm'],
    whyThisExists: 'Lowering one input can make the next action easier to see.',
    boundaryNote: 'Sensory support stays optional and context-led.',
    categoryNote: 'Keep controls user-led. No forced interruptions.',
    packIds: ['focus-without-pressure'],
  },
  {
    id: 'support-draft-message',
    title: 'Draft one message',
    category: 'Social support',
    purpose: 'Make reaching out smaller and private.',
    recommendedSize: '5-10 min',
    minimumVersion: 'Draft one sentence without sending it.',
    normalVersion: 'Draft the message and decide whether now is the right time.',
    fullVersion: 'Draft, edit once, and choose send or park.',
    enabled: false,
    chips: ['Social', 'Private'],
    whyThisExists: 'Drafting first makes support optional rather than pressured.',
    boundaryNote: 'Social support rhythms do not create accountability pressure.',
    categoryNote: 'No public boards, monitoring, or forced check-ins.',
    packIds: ['admin-light-touch'],
  },
];

export const mockQuickPacks: QuickPack[] = [
  {
    id: 'morning-basics',
    title: 'Morning basics',
    purpose: 'Preview a few gentle morning rhythms before enabling them.',
    rhythmIds: ['food-breakfast-reset', 'household-kitchen-landing'],
  },
  {
    id: 'focus-without-pressure',
    title: 'Focus without pressure',
    purpose: 'Enable supports that make the first work step visible.',
    rhythmIds: ['anti-scroll-phone-park', 'movement-doorway-stretch', 'work-focus-first-file', 'sensory-quiet-surface'],
  },
  {
    id: 'evening-soft-landing',
    title: 'Evening soft landing',
    purpose: 'Keep wind-down gentle without building a task pile.',
    rhythmIds: ['sleep-wind-down', 'household-kitchen-landing', 'emotion-soft-reset'],
  },
];
