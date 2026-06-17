import type { Table } from 'dexie';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  settingsSchema,
  type LifeShapeSettings,
  type Settings,
  type StartBoostSafetySettings,
} from './schemas';
import type { ThemeName } from '../app/theme';

export const SETTINGS_ID = 'settings';
export const SETTINGS_APP_VERSION = '1.4.6';

type SettingsTable = Pick<Table<Settings, string>, 'get' | 'put'>;

export type SettingsStore = {
  settings: SettingsTable;
};

export type SettingsWriteInput = {
  lifeShape: unknown;
  startBoostSafety: unknown;
  theme: unknown;
};

export type SettingsWriteResult =
  | {
      ok: true;
      settings: Settings;
    }
  | {
      errors: string[];
      ok: false;
      settings: Settings;
    };

function nowIso() {
  return new Date().toISOString();
}

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'settings';
    return `${path}: ${issue.message}`;
  });
}

export function createDefaultSettings(timestamp = nowIso()): Settings {
  return settingsSchema.parse({
    appVersion: SETTINGS_APP_VERSION,
    createdAt: timestamp,
    id: SETTINGS_ID,
    updatedAt: timestamp,
  });
}

export async function loadSettings(store: SettingsStore = getCurrentLifeRhythmDatabase()): Promise<Settings> {
  try {
    const saved = await store.settings.get(SETTINGS_ID);
    const parsed = settingsSchema.safeParse(saved);

    return parsed.success ? parsed.data : createDefaultSettings();
  } catch {
    return createDefaultSettings();
  }
}

function settingsCandidateFromInput(
  current: Settings,
  input: SettingsWriteInput,
  timestamp = nowIso(),
) {
  return {
    ...current,
    appVersion: SETTINGS_APP_VERSION,
    bedTime: (input.lifeShape as Partial<LifeShapeSettings> | undefined)?.sleepWakeAnchors?.sleep ?? current.bedTime,
    breakfastTime: (input.lifeShape as Partial<LifeShapeSettings> | undefined)?.mealAnchors?.breakfast ?? current.breakfastTime,
    dinnerTime: (input.lifeShape as Partial<LifeShapeSettings> | undefined)?.mealAnchors?.dinner ?? current.dinnerTime,
    id: SETTINGS_ID,
    lifeShape: input.lifeShape,
    lunchTime: (input.lifeShape as Partial<LifeShapeSettings> | undefined)?.mealAnchors?.lunch ?? current.lunchTime,
    startBoostSafety: input.startBoostSafety,
    theme: input.theme as ThemeName,
    updatedAt: timestamp,
    wakeTime: (input.lifeShape as Partial<LifeShapeSettings> | undefined)?.sleepWakeAnchors?.wake ?? current.wakeTime,
    workDays: (input.lifeShape as Partial<LifeShapeSettings> | undefined)?.usualWorkHours?.days ?? current.workDays,
    workEnd: (input.lifeShape as Partial<LifeShapeSettings> | undefined)?.usualWorkHours?.end ?? current.workEnd,
    workStart: (input.lifeShape as Partial<LifeShapeSettings> | undefined)?.usualWorkHours?.start ?? current.workStart,
  };
}

export async function saveSettings(
  input: SettingsWriteInput,
  store: SettingsStore = getCurrentLifeRhythmDatabase(),
): Promise<SettingsWriteResult> {
  const current = await loadSettings(store);
  const parsed = settingsSchema.safeParse(settingsCandidateFromInput(current, input));

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
      settings: current,
    };
  }

  await store.settings.put(parsed.data);

  return {
    ok: true,
    settings: parsed.data,
  };
}

export async function resetSettingsToDefaults(store: SettingsStore = getCurrentLifeRhythmDatabase()): Promise<Settings> {
  const defaults = createDefaultSettings();
  await store.settings.put(defaults);

  return defaults;
}

export type { LifeShapeSettings, Settings, StartBoostSafetySettings };
