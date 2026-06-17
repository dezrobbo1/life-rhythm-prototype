import {
  DATABASE_NAME,
  createLifeRhythmDatabase,
  type LifeRhythmDatabase,
} from './db';
import {
  activeTaskSchema,
  rhythmTemplateSchema,
  settingsSchema,
  type Settings,
} from './schemas';

export type LocalDataNamespace = {
  databaseName: string;
  id: string;
  source: 'auth' | 'legacy';
};

export type LegacyLocalDataInspection = {
  activeTaskCount: number;
  customRhythmCount: number;
  hasActiveTasks: boolean;
  hasChangedSettings: boolean;
  hasCustomLibraryRhythms: boolean;
  hasLegacyLocalData: boolean;
};

export const LEGACY_LOCAL_DATA_NAMESPACE: LocalDataNamespace = {
  databaseName: DATABASE_NAME,
  id: 'legacy-local',
  source: 'legacy',
};

const databaseCache = new Map<string, LifeRhythmDatabase>();

let currentNamespace = LEGACY_LOCAL_DATA_NAMESPACE;

function hashNamespaceValue(value: string) {
  let hash = 0x811c9dc5;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function getLegacyLocalDataNamespace(): LocalDataNamespace {
  return LEGACY_LOCAL_DATA_NAMESPACE;
}

export function createAuthLocalDataNamespace(userId: string): LocalDataNamespace {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return LEGACY_LOCAL_DATA_NAMESPACE;
  }

  const hashedUserId = hashNamespaceValue(normalizedUserId);
  const id = `auth-${hashedUserId}`;

  return {
    databaseName: `${DATABASE_NAME}-${id}`,
    id,
    source: 'auth',
  };
}

export function getCurrentLocalDataNamespace(): LocalDataNamespace {
  return currentNamespace;
}

export function setCurrentLocalDataNamespace(namespace: LocalDataNamespace) {
  currentNamespace = namespace;
}

export function resetCurrentLocalDataNamespace() {
  currentNamespace = LEGACY_LOCAL_DATA_NAMESPACE;
}

export function getLifeRhythmDatabaseForNamespace(namespace: LocalDataNamespace) {
  const existing = databaseCache.get(namespace.databaseName);

  if (existing) {
    return existing;
  }

  const database = createLifeRhythmDatabase(namespace.databaseName);
  databaseCache.set(namespace.databaseName, database);

  return database;
}

export function getCurrentLifeRhythmDatabase() {
  return getLifeRhythmDatabaseForNamespace(currentNamespace);
}

function settingsComparableFields(settings: Settings) {
  return {
    bedTime: settings.bedTime,
    breakfastTime: settings.breakfastTime,
    dinnerTime: settings.dinnerTime,
    lifeShape: settings.lifeShape,
    lunchTime: settings.lunchTime,
    startBoostSafety: settings.startBoostSafety,
    theme: settings.theme,
    wakeTime: settings.wakeTime,
    workDays: settings.workDays,
    workEnd: settings.workEnd,
    workStart: settings.workStart,
  };
}

function createDefaultComparableSettings() {
  return settingsSchema.parse({
    appVersion: '1.4.6',
    createdAt: '2026-01-01T00:00:00.000Z',
    id: 'settings',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

function hasSettingsChangedFromDefaults(input: unknown) {
  const parsed = settingsSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  return JSON.stringify(settingsComparableFields(parsed.data)) !== JSON.stringify(settingsComparableFields(createDefaultComparableSettings()));
}

async function localDatabaseExists(databaseName: string) {
  if (
    typeof indexedDB === 'undefined' ||
    typeof indexedDB.databases !== 'function'
  ) {
    return true;
  }

  try {
    const databases = await indexedDB.databases();

    return databases.some((database) => database.name === databaseName);
  } catch {
    return true;
  }
}

export async function inspectLegacyLocalData(): Promise<LegacyLocalDataInspection> {
  try {
    if (!(await localDatabaseExists(LEGACY_LOCAL_DATA_NAMESPACE.databaseName))) {
      return {
        activeTaskCount: 0,
        customRhythmCount: 0,
        hasActiveTasks: false,
        hasChangedSettings: false,
        hasCustomLibraryRhythms: false,
        hasLegacyLocalData: false,
      };
    }

    const database = getLifeRhythmDatabaseForNamespace(LEGACY_LOCAL_DATA_NAMESPACE);
    const [savedSettings, rhythmTemplates, activeTasks] = await Promise.all([
      database.settings.get('settings'),
      database.rhythmTemplates.toArray(),
      database.activeTasks.toArray(),
    ]);

    const hasChangedSettings = hasSettingsChangedFromDefaults(savedSettings);
    const customRhythmCount = rhythmTemplates.filter((rhythm) => {
      const parsed = rhythmTemplateSchema.safeParse(rhythm);

      return parsed.success && parsed.data.source === 'custom';
    }).length;
    const activeTaskCount = activeTasks.filter((task) => {
      const parsed = activeTaskSchema.safeParse(task);

      return parsed.success && (parsed.data.source === 'adhoc' || parsed.data.source === 'library');
    }).length;

    return {
      activeTaskCount,
      customRhythmCount,
      hasActiveTasks: activeTaskCount > 0,
      hasChangedSettings,
      hasCustomLibraryRhythms: customRhythmCount > 0,
      hasLegacyLocalData: hasChangedSettings || customRhythmCount > 0 || activeTaskCount > 0,
    };
  } catch {
    return {
      activeTaskCount: 0,
      customRhythmCount: 0,
      hasActiveTasks: false,
      hasChangedSettings: false,
      hasCustomLibraryRhythms: false,
      hasLegacyLocalData: false,
    };
  }
}
