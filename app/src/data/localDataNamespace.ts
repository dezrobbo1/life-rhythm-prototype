import {
  DATABASE_NAME,
  createLifeRhythmDatabase,
  type LifeRhythmDatabase,
} from './db';

export type LocalDataNamespace = {
  databaseName: string;
  id: string;
  source: 'auth' | 'legacy';
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
