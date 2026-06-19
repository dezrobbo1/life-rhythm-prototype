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
    title: 'Narrow Today',
    purpose: 'Keep one next action visible and move extras out of Today.',
    recommendedWhen: 'Use when the list feels bigger than the day.',
    confirmationCopy: 'Today is narrowed to one next action. Extras are marked not today. No catch-up pile.',
    affectedMockItemCount: 4,
    destructive: false,
    boundaryNote: 'Tasks are not deleted. Extras are marked not today.',
  },
  {
    id: 'moveExtras',
    title: 'Park extras safely',
    purpose: 'Hold extra Today tasks safely so one next action remains.',
    recommendedWhen: 'Use when fixed commitments already fill the day.',
    confirmationCopy: 'Extras are parked safely. One next action remains. No catch-up pile.',
    affectedMockItemCount: 3,
    destructive: false,
    boundaryNote: 'Tasks are not deleted. Parked tasks stay safely held.',
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
    purpose: 'Preview a future restore path when there is room.',
    recommendedWhen: 'Use when the day feels lighter again.',
    confirmationCopy: 'Restore is not connected yet. Nothing changed.',
    affectedMockItemCount: 4,
    destructive: false,
    boundaryNote: 'Preview only for this trial. Nothing is restored.',
  },
];

export const fullResetAction: ResetAction = {
  id: 'fullAppReset',
  title: 'Reset whole app',
  purpose: 'Protected destructive reset placeholder for a future flow.',
  recommendedWhen: 'Use only when intentionally clearing app data in a future real flow.',
  confirmationCopy: 'Full app reset is not enabled for this trial. No data is cleared.',
  affectedMockItemCount: 0,
  destructive: true,
  boundaryNote: 'Full app reset is not enabled for this trial. No data is cleared.',
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
