import type { ThemeName } from '../../app/theme';

export type AppearanceOption = {
  id: ThemeName;
  label: string;
  description: string;
};

export type SafetyToggle = {
  id:
    | 'avoidFoodRewards'
    | 'avoidShoppingRewards'
    | 'avoidScrollingRewards'
    | 'avoidUrgencyCountdowns'
    | 'avoidAccountabilityPrompts'
    | 'avoidStreakPressure';
  label: string;
  helper: string;
  defaultEnabled: boolean;
};

export type SetupAction = {
  id: string;
  label: string;
  helper: string;
};

export type LifeShapeState = {
  workStart: string;
  workEnd: string;
  commuteMinutes: string;
  fixedCommitments: string;
  transitionBuffer: string;
  breakfastAnchor: string;
  lunchAnchor: string;
  dinnerAnchor: string;
  wakeAnchor: string;
  sleepAnchor: string;
  lowCapacityPreference: string;
};

export const defaultLifeShape: LifeShapeState = {
  breakfastAnchor: '07:30',
  commuteMinutes: '20',
  dinnerAnchor: '18:30',
  fixedCommitments: 'School run, appointments, care responsibilities',
  lunchAnchor: '12:30',
  lowCapacityPreference: 'protect-evening',
  sleepAnchor: '22:00',
  transitionBuffer: '10',
  wakeAnchor: '06:30',
  workEnd: '16:30',
  workStart: '09:00',
};

export const lowCapacityPreferenceOptions = [
  { label: 'Protect evening', value: 'protect-evening' },
  { label: 'Keep mornings lighter', value: 'lighter-morning' },
  { label: 'Use minimum versions first', value: 'minimum-first' },
];

export const appearanceOptions: AppearanceOption[] = [
  {
    id: 'exhale',
    label: 'Exhale',
    description: 'Warm and quiet by default.',
  },
  {
    id: 'clear',
    label: 'Clear',
    description: 'A little sharper for contrast.',
  },
  {
    id: 'grounded',
    label: 'Grounded',
    description: 'Earthier colour balance.',
  },
];

export const safetyToggles: SafetyToggle[] = [
  {
    id: 'avoidFoodRewards',
    label: 'Avoid food rewards',
    helper: 'Start Boost will steer away from food-as-reward suggestions.',
    defaultEnabled: false,
  },
  {
    id: 'avoidShoppingRewards',
    label: 'Avoid shopping rewards',
    helper: 'Keeps spending prompts out of support options.',
    defaultEnabled: true,
  },
  {
    id: 'avoidScrollingRewards',
    label: 'Avoid scrolling rewards',
    helper: 'Keeps phone-scroll breaks out of support options.',
    defaultEnabled: true,
  },
  {
    id: 'avoidUrgencyCountdowns',
    label: 'Avoid urgency countdowns',
    helper: 'Keeps pressure timers out of Start Boost.',
    defaultEnabled: true,
  },
  {
    id: 'avoidAccountabilityPrompts',
    label: 'Avoid accountability prompts',
    helper: 'Keeps social pressure suggestions out of the flow.',
    defaultEnabled: false,
  },
  {
    id: 'avoidStreakPressure',
    label: 'Avoid streak pressure',
    helper: 'Keeps progress-pressure language out of the app.',
    defaultEnabled: true,
  },
];

export const dataActions: SetupAction[] = [
  {
    id: 'exportBackup',
    label: 'Export backup later',
    helper: 'Backup export will be wired after real settings and storage are connected.',
  },
  {
    id: 'importBackup',
    label: 'Import backup later',
    helper: 'Import will stay blocked until validation and recovery paths are ready.',
  },
  {
    id: 'exportDevTickets',
    label: 'Export dev tickets later',
    helper: 'Dev ticket export is planned for local notes only.',
  },
];

export const aboutRows = [
  { label: 'Version', value: 'Future app scaffold' },
  { label: 'Principle', value: 'Start small. Keep rhythm.' },
  { label: 'Boundary', value: 'Non-clinical self-management support. No medical claims.' },
];

export const advancedRows = [
  {
    title: 'Reset whole app',
    body: 'Real reset controls will stay protected and separate. This Setup pass does not clear data.',
  },
  {
    title: 'Storage migration',
    body: 'Migration planning remains read-only until the data gate is approved.',
  },
];
