import type { Table } from 'dexie';
import {
  migrateSettingsDayProfileFoundation,
  type LegacySettingsConflict,
} from './dayProfileMigration';
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

export type SettingsLoadResult = {
  conflicts: LegacySettingsConflict[];
  errors: string[];
  migrationPersisted: boolean;
  settings: Settings;
  status:
    | 'defaulted'
    | 'invalid'
    | 'loaded'
    | 'migrated'
    | 'migrationPersistenceFailed'
    | 'readFailed';
};

type SettingsLoadOptions = {
  persistMigration?: boolean;
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

export async function loadSettingsResult(
  store: SettingsStore = getCurrentLifeRhythmDatabase(),
  options: SettingsLoadOptions = {},
): Promise<SettingsLoadResult> {
  let saved: unknown;

  try {
    saved = await store.settings.get(SETTINGS_ID);
  } catch {
    return {
      conflicts: [],
      errors: ['settings: Saved settings could not be read.'],
      migrationPersisted: false,
      settings: createDefaultSettings(),
      status: 'readFailed',
    };
  }

  if (saved === undefined) {
    return {
      conflicts: [],
      errors: [],
      migrationPersisted: false,
      settings: createDefaultSettings(),
      status: 'defaulted',
    };
  }

  const migration = migrateSettingsDayProfileFoundation(saved);

  if (!migration.ok) {
    return {
      conflicts: [],
      errors: migration.errors,
      migrationPersisted: false,
      settings: createDefaultSettings(),
      status: 'invalid',
    };
  }

  if (migration.status === 'unchanged') {
    return {
      conflicts: migration.conflicts,
      errors: [],
      migrationPersisted: false,
      settings: migration.settings,
      status: 'loaded',
    };
  }

  if (options.persistMigration === false) {
    return {
      conflicts: migration.conflicts,
      errors: [],
      migrationPersisted: false,
      settings: migration.settings,
      status: 'migrated',
    };
  }

  try {
    await store.settings.put(migration.settings);
  } catch {
    return {
      conflicts: migration.conflicts,
      errors: ['settings: Day-profile migration could not be saved; the original row was left unchanged.'],
      migrationPersisted: false,
      settings: migration.settings,
      status: 'migrationPersistenceFailed',
    };
  }

  return {
    conflicts: migration.conflicts,
    errors: [],
    migrationPersisted: true,
    settings: migration.settings,
    status: 'migrated',
  };
}

export async function loadSettings(store: SettingsStore = getCurrentLifeRhythmDatabase()): Promise<Settings> {
  return (await loadSettingsResult(store)).settings;
}

export async function loadSettingsForBackup(
  store: SettingsStore = getCurrentLifeRhythmDatabase(),
): Promise<SettingsLoadResult> {
  return loadSettingsResult(store, { persistMigration: false });
}

function settingsCandidateFromInput(
  current: Settings,
  input: SettingsWriteInput,
  conflicts: LegacySettingsConflict[],
  timestamp = nowIso(),
) {
  const lifeShape = input.lifeShape as Partial<LifeShapeSettings> | undefined;
  const conflictedFields = new Set(conflicts.map((conflict) => conflict.field));
  const preserveConflict = <T>(field: string, nextValue: T | undefined, currentValue: T) => {
    return conflictedFields.has(field)
      ? currentValue
      : nextValue ?? currentValue;
  };

  return {
    ...current,
    appVersion: SETTINGS_APP_VERSION,
    bedTime: preserveConflict('bedTime', lifeShape?.sleepWakeAnchors?.sleep, current.bedTime),
    breakfastTime: preserveConflict(
      'breakfastTime',
      lifeShape?.mealAnchors?.breakfast,
      current.breakfastTime,
    ),
    dinnerTime: preserveConflict('dinnerTime', lifeShape?.mealAnchors?.dinner, current.dinnerTime),
    id: SETTINGS_ID,
    lifeShape: input.lifeShape,
    lunchTime: preserveConflict('lunchTime', lifeShape?.mealAnchors?.lunch, current.lunchTime),
    startBoostSafety: input.startBoostSafety,
    theme: input.theme as ThemeName,
    updatedAt: timestamp,
    wakeTime: preserveConflict('wakeTime', lifeShape?.sleepWakeAnchors?.wake, current.wakeTime),
    workDays: preserveConflict('workDays', lifeShape?.usualWorkHours?.days, current.workDays),
    workEnd: preserveConflict('workEnd', lifeShape?.usualWorkHours?.end, current.workEnd),
    workStart: preserveConflict('workStart', lifeShape?.usualWorkHours?.start, current.workStart),
  };
}

export async function saveSettings(
  input: SettingsWriteInput,
  store: SettingsStore = getCurrentLifeRhythmDatabase(),
): Promise<SettingsWriteResult> {
  const loadResult = await loadSettingsResult(store);
  const current = loadResult.settings;

  if (
    loadResult.status === 'invalid' ||
    loadResult.status === 'migrationPersistenceFailed' ||
    loadResult.status === 'readFailed'
  ) {
    return {
      errors: loadResult.errors,
      ok: false,
      settings: current,
    };
  }

  const parsed = settingsSchema.safeParse(
    settingsCandidateFromInput(current, input, loadResult.conflicts),
  );

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
