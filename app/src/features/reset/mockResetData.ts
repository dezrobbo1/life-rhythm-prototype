export type ResetActionId =
  | 'tooMuchToday'
  | 'moveExtras'
  | 'restartOneAction'
  | 'reviewTomorrow'
  | 'restoreHidden'
  | 'fullAppReset';

export type ResetAction = {
  id: ResetActionId;
  title: string;
  purpose: string;
  recommendedWhen: string;
  confirmationCopy: string;
  affectedMockItemCount: number;
  destructive: boolean;
  boundaryNote: string;
};

export type RestartChoice = {
  id: string;
  title: string;
  area: string;
  firstAction: string;
};

export const mainResetActions: ResetAction[] = [
  {
    id: 'tooMuchToday',
    title: 'Too much today',
    purpose: 'Hide the extras so the next step can breathe.',
    recommendedWhen: 'Use when the list feels bigger than the day.',
    confirmationCopy: 'Hidden, not deleted.',
    affectedMockItemCount: 4,
    destructive: false,
    boundaryNote: 'Items stay available for later review.',
  },
  {
    id: 'moveExtras',
    title: 'Move extras',
    purpose: 'Move flexible items out of today without making a catch-up pile.',
    recommendedWhen: 'Use when fixed commitments already fill the day.',
    confirmationCopy: 'Moved out of today.',
    affectedMockItemCount: 3,
    destructive: false,
    boundaryNote: 'Fixed commitments stay visible. Flexible items can return later.',
  },
  {
    id: 'restartOneAction',
    title: 'Restart with one action',
    purpose: 'Pick one small re-entry action and let that be enough.',
    recommendedWhen: 'Use when the day needs a clean re-entry point.',
    confirmationCopy: 'One action is enough. That counts.',
    affectedMockItemCount: 1,
    destructive: false,
    boundaryNote: 'Restarting does not judge the rest of the day.',
  },
];

export const secondaryResetActions: ResetAction[] = [
  {
    id: 'reviewTomorrow',
    title: 'Review tomorrow',
    purpose: "Set tomorrow's first step without pulling more into today.",
    recommendedWhen: 'Use near shutdown or when today is already full.',
    confirmationCopy: "Tomorrow's first step is visible.",
    affectedMockItemCount: 1,
    destructive: false,
    boundaryNote: 'This is a soft preview, not a schedule commitment.',
  },
  {
    id: 'restoreHidden',
    title: 'Restore hidden items',
    purpose: 'Bring hidden items back into view when there is room.',
    recommendedWhen: 'Use when the day feels lighter again.',
    confirmationCopy: 'Hidden items are visible again.',
    affectedMockItemCount: 4,
    destructive: false,
    boundaryNote: 'Restoring is optional and does not add items to Today automatically.',
  },
];

export const fullResetAction: ResetAction = {
  id: 'fullAppReset',
  title: 'Reset whole app',
  purpose: 'Protected destructive reset placeholder.',
  recommendedWhen: 'Use only when intentionally clearing app data in a future real flow.',
  confirmationCopy: 'Mock full reset confirmed. No real data was cleared.',
  affectedMockItemCount: 0,
  destructive: true,
  boundaryNote: 'This mock action never clears storage, IndexedDB, exports, or settings.',
};

export const restartChoices: RestartChoice[] = [
  {
    id: 'first-step',
    title: "Set tomorrow's first step",
    area: 'Home admin',
    firstAction: 'Write one sentence: Tomorrow I open...',
  },
  {
    id: 'clear-surface',
    title: 'Clear one surface',
    area: 'Home',
    firstAction: 'Move three visible items off the main surface.',
  },
  {
    id: 'open-file',
    title: 'Open the first file',
    area: 'Work focus',
    firstAction: 'Open the file only. Stop there if needed.',
  },
];
