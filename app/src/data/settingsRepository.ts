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

/**
 * The day-profile foundation is stored as its own record in the settings table
 * rather than as extra keys on the settings row.
 *
 * The settings row therefore keeps the exact shape the previous application
 * version validates with its strict settings schema, so a rollback still reads
 * and writes real user settings instead of falling back to defaults and then
 * overwriting them. Rolling forward again recovers the foundation untouched.
 * This uses the existing settings store and needs no database version change.
 */
export const DAY_PROFILE_FOUNDATION_ID = 'dayProfileFoundation';

export const SETTINGS_APP_VERSION = '1.4.6';

const profileFoundationKeys = [
  'dayProfileMigrationState',
  'dayProfiles',
  'weekdayProfileAssignments',
] as const;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasInlineProfileFoundation(row: Record<string, unknown>) {
  return profileFoundationKeys.some((key) => Object.prototype.hasOwnProperty.call(row, key));
}

/**
 * Rebuilds the in-memory settings shape from the rollback-readable settings row
 * and its sibling foundation record.
 *
 * Rows written by an earlier build of this branch still carry the foundation
 * inline. Those are read as-is and rewritten into the split shape on the next
 * persist, so no already-migrated row is stranded.
 */
function combineStoredRecords(settingsRow: unknown, foundationRow: unknown): unknown {
  if (!isRecord(settingsRow) || hasInlineProfileFoundation(settingsRow) || !isRecord(foundationRow)) {
    return settingsRow;
  }

  const foundation: Record<string, unknown> = {};

  for (const key of profileFoundationKeys) {
    if (Object.prototype.hasOwnProperty.call(foundationRow, key)) {
      foundation[key] = foundationRow[key];
    }
  }

  return { ...settingsRow, ...foundation };
}

/** The settings row exactly as the previous application version expects it. */
function settingsRowFrom(settings: Settings) {
  const {
    dayProfileMigrationState: _migrationState,
    dayProfiles: _dayProfiles,
    weekdayProfileAssignments: _assignments,
    ...rollbackReadableRow
  } = settings;

  return rollbackReadableRow as unknown as Settings;
}

function foundationRowFrom(settings: Settings) {
  return {
    appVersion: settings.appVersion,
    dayProfileMigrationState: settings.dayProfileMigrationState,
    dayProfiles: settings.dayProfiles,
    id: DAY_PROFILE_FOUNDATION_ID,
    updatedAt: settings.updatedAt,
    weekdayProfileAssignments: settings.weekdayProfileAssignments,
  } as unknown as Settings;
}

/**
 * Writes the foundation record first so an interrupted write never strips the
 * foundation from a row that still carries it inline.
 */
async function persistSettingsRecords(
  store: SettingsStore,
  settings: Settings,
  options: { rewriteSettingsRow: boolean },
) {
  await store.settings.put(foundationRowFrom(settings));

  if (options.rewriteSettingsRow) {
    await store.settings.put(settingsRowFrom(settings));
  }
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
  let savedSettingsRow: unknown;
  let savedFoundationRow: unknown;

  try {
    [savedSettingsRow, savedFoundationRow] = await Promise.all([
      store.settings.get(SETTINGS_ID),
      store.settings.get(DAY_PROFILE_FOUNDATION_ID),
    ]);
  } catch {
    return {
      conflicts: [],
      errors: ['settings: Saved settings could not be read.'],
      migrationPersisted: false,
      settings: createDefaultSettings(),
      status: 'readFailed',
    };
  }

  if (savedSettingsRow === undefined) {
    return {
      conflicts: [],
      errors: [],
      migrationPersisted: false,
      settings: createDefaultSettings(),
      status: 'defaulted',
    };
  }

  const storedInlineFoundation =
    isRecord(savedSettingsRow) && hasInlineProfileFoundation(savedSettingsRow);
  const migration = migrateSettingsDayProfileFoundation(
    combineStoredRecords(savedSettingsRow, savedFoundationRow),
  );

  if (!migration.ok) {
    return {
      conflicts: [],
      errors: migration.errors,
      migrationPersisted: false,
      settings: createDefaultSettings(),
      status: 'invalid',
    };
  }

  // Nothing to write when the foundation is already stored in the split shape.
  if (migration.status === 'unchanged' && !storedInlineFoundation) {
    return {
      conflicts: migration.conflicts,
      errors: [],
      migrationPersisted: false,
      settings: migration.settings,
      status: 'loaded',
    };
  }

  const status = migration.status === 'unchanged' ? 'loaded' : 'migrated';

  if (options.persistMigration === false) {
    return {
      conflicts: migration.conflicts,
      errors: [],
      migrationPersisted: false,
      settings: migration.settings,
      status,
    };
  }

  try {
    await persistSettingsRecords(store, migration.settings, {
      rewriteSettingsRow: storedInlineFoundation,
    });
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
    status,
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

/**
 * Life Shape is the value Setup shows and edits, so a save resolves any
 * duplicated legacy root field towards it. Conflicts are reported by
 * `loadSettingsResult` for review before this point; they are not resolved by
 * discarding the edit the user just made.
 */
function settingsCandidateFromInput(
  current: Settings,
  input: SettingsWriteInput,
  timestamp = nowIso(),
) {
  const lifeShape = input.lifeShape as Partial<LifeShapeSettings> | undefined;

  return {
    ...current,
    appVersion: SETTINGS_APP_VERSION,
    bedTime: lifeShape?.sleepWakeAnchors?.sleep ?? current.bedTime,
    breakfastTime: lifeShape?.mealAnchors?.breakfast ?? current.breakfastTime,
    dinnerTime: lifeShape?.mealAnchors?.dinner ?? current.dinnerTime,
    id: SETTINGS_ID,
    lifeShape: input.lifeShape,
    lunchTime: lifeShape?.mealAnchors?.lunch ?? current.lunchTime,
    startBoostSafety: input.startBoostSafety,
    theme: input.theme as ThemeName,
    updatedAt: timestamp,
    wakeTime: lifeShape?.sleepWakeAnchors?.wake ?? current.wakeTime,
    workDays: lifeShape?.usualWorkHours?.days ?? current.workDays,
    workEnd: lifeShape?.usualWorkHours?.end ?? current.workEnd,
    workStart: lifeShape?.usualWorkHours?.start ?? current.workStart,
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

  const parsed = settingsSchema.safeParse(settingsCandidateFromInput(current, input));

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
      settings: current,
    };
  }

  await persistSettingsRecords(store, parsed.data, { rewriteSettingsRow: true });

  return {
    ok: true,
    settings: parsed.data,
  };
}

export async function resetSettingsToDefaults(store: SettingsStore = getCurrentLifeRhythmDatabase()): Promise<Settings> {
  const defaults = createDefaultSettings();

  await persistSettingsRecords(store, defaults, { rewriteSettingsRow: true });

  return defaults;
}

export type { LifeShapeSettings, Settings, StartBoostSafetySettings };
