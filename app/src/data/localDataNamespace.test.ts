import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATABASE_NAME } from './db';
import { createLifeRhythmDatabase } from './db';
import {
  createAuthLocalDataNamespace,
  getCurrentLocalDataNamespace,
  getLegacyLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
  type LocalDataNamespace,
} from './localDataNamespace';
import { loadSettings, saveSettings, type SettingsWriteInput } from './settingsRepository';
import { exportSettingsBackup } from './settingsExport';
import {
  loadActiveTodayTasks,
  loadPersistedActiveTasks,
  saveActiveTodayTask,
} from './activeTaskRepository';
import {
  loadCustomLibraryRhythms,
  saveCustomLibraryRhythm,
} from './libraryRhythmRepository';
import { exportLibraryRhythmBackup } from './libraryRhythmExport';
import {
  activeTaskSchema,
  rhythmTemplateSchema,
  type ActiveTask,
  type RhythmTemplate,
} from './schemas';

const userANamespace = createAuthLocalDataNamespace('user_alpha_trial');
const userBNamespace = createAuthLocalDataNamespace('user_beta_trial');
const namespacesToClean = [
  getLegacyLocalDataNamespace(),
  userANamespace,
  userBNamespace,
];

function validSettingsInput(overrides: Partial<SettingsWriteInput> = {}): SettingsWriteInput {
  return {
    lifeShape: {
      commuteMinutes: 20,
      fixedCommitments: [],
      lowCapacityPreference: 'minimum-first',
      mealAnchors: {
        breakfast: '07:30',
        dinner: '18:30',
        lunch: '12:30',
      },
      sleepWakeAnchors: {
        sleep: '22:00',
        wake: '06:30',
      },
      transitionBufferMinutes: 15,
      travelMinutes: 20,
      usualWorkHours: {
        end: '17:00',
        start: '09:00',
      },
    },
    startBoostSafety: {
      avoidAccountabilityPrompts: true,
      avoidFoodRewards: true,
      avoidScrollingRewards: true,
      avoidShoppingRewards: true,
      avoidStreakPressure: true,
      avoidUrgencyCountdowns: true,
    },
    theme: 'clear',
    ...overrides,
  };
}

function validActiveTask(overrides: Partial<ActiveTask> = {}): ActiveTask {
  return activeTaskSchema.parse({
    area: 'house',
    createdAt: '2026-06-18T00:00:00.000Z',
    full: {
      label: 'Clear the counter and reset one hidden edge.',
      minutes: 20,
    },
    id: 'active-user-task',
    minimum: {
      label: 'Clear one counter.',
      minutes: 5,
    },
    normal: {
      label: 'Clear the counter and collect dishes.',
      minutes: 12,
    },
    purpose: 'Keep one household re-entry point visible.',
    showToday: true,
    source: 'adhoc',
    status: 'active',
    title: 'Kitchen landing',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  });
}

function validRhythm(overrides: Partial<RhythmTemplate> = {}): RhythmTemplate {
  return rhythmTemplateSchema.parse({
    area: 'house',
    createdAt: '2026-06-18T00:00:00.000Z',
    enabled: true,
    full: {
      label: 'Clear the counter and one hidden edge.',
      minutes: 20,
    },
    id: 'custom-user-rhythm',
    minimum: {
      label: 'Clear one counter.',
      minutes: 5,
    },
    normal: {
      label: 'Clear the counter and collect dishes.',
      minutes: 12,
    },
    purpose: 'Keep one household re-entry point visible.',
    source: 'custom',
    title: 'Kitchen landing',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  });
}

async function deleteNamespaces(namespaces: LocalDataNamespace[]) {
  for (const namespace of namespaces) {
    await createLifeRhythmDatabase(namespace.databaseName).delete();
  }
}

afterEach(async () => {
  resetCurrentLocalDataNamespace();
  await deleteNamespaces(namespacesToClean);
  resetCurrentLocalDataNamespace();
  vi.restoreAllMocks();
});

describe('local data namespace', () => {
  it('keeps auth-disabled local data in the existing legacy database namespace', () => {
    const legacy = getLegacyLocalDataNamespace();

    setCurrentLocalDataNamespace(legacy);

    expect(legacy).toMatchObject({
      databaseName: DATABASE_NAME,
      id: 'legacy-local',
      source: 'legacy',
    });
    expect(getCurrentLocalDataNamespace()).toEqual(legacy);
  });

  it('derives different sanitized local namespaces for signed-in users', () => {
    expect(userANamespace.source).toBe('auth');
    expect(userBNamespace.source).toBe('auth');
    expect(userANamespace.databaseName).not.toBe(userBNamespace.databaseName);
    expect(userANamespace.databaseName).not.toContain('user_alpha_trial');
    expect(userBNamespace.databaseName).not.toContain('user_beta_trial');
  });

  it('keeps user A and user B settings separate on the same browser', async () => {
    setCurrentLocalDataNamespace(userANamespace);
    await saveSettings(validSettingsInput({ theme: 'grounded' }));

    setCurrentLocalDataNamespace(userBNamespace);
    expect((await loadSettings()).theme).toBe('exhale');
    await saveSettings(validSettingsInput({ theme: 'clear' }));

    setCurrentLocalDataNamespace(userANamespace);
    expect((await loadSettings()).theme).toBe('grounded');

    setCurrentLocalDataNamespace(userBNamespace);
    expect((await loadSettings()).theme).toBe('clear');
  });

  it('keeps user A active tasks separate from user B active tasks', async () => {
    setCurrentLocalDataNamespace(userANamespace);
    await saveActiveTodayTask(validActiveTask({
      id: 'active-user-a-task',
      title: 'User A task',
    }));

    setCurrentLocalDataNamespace(userBNamespace);
    expect(await loadActiveTodayTasks()).toEqual([]);

    await saveActiveTodayTask(validActiveTask({
      id: 'active-user-b-task',
      title: 'User B task',
    }));

    setCurrentLocalDataNamespace(userANamespace);
    expect((await loadActiveTodayTasks()).map((task) => task.title)).toEqual(['User A task']);

    setCurrentLocalDataNamespace(userBNamespace);
    expect((await loadActiveTodayTasks()).map((task) => task.title)).toEqual(['User B task']);
  });

  it('keeps user A custom Library rhythms separate from user B custom Library rhythms', async () => {
    setCurrentLocalDataNamespace(userANamespace);
    await saveCustomLibraryRhythm(validRhythm({
      id: 'custom-user-a-rhythm',
      title: 'User A rhythm',
    }));

    setCurrentLocalDataNamespace(userBNamespace);
    expect(await loadCustomLibraryRhythms()).toEqual([]);

    await saveCustomLibraryRhythm(validRhythm({
      id: 'custom-user-b-rhythm',
      title: 'User B rhythm',
    }));

    setCurrentLocalDataNamespace(userANamespace);
    expect((await loadCustomLibraryRhythms()).map((rhythm) => rhythm.title)).toEqual(['User A rhythm']);

    setCurrentLocalDataNamespace(userBNamespace);
    expect((await loadCustomLibraryRhythms()).map((rhythm) => rhythm.title)).toEqual(['User B rhythm']);
  });

  it('does not delete signed-in local data when returning to the legacy signed-out namespace', async () => {
    setCurrentLocalDataNamespace(userANamespace);
    await saveSettings(validSettingsInput({ theme: 'grounded' }));
    await saveActiveTodayTask(validActiveTask({ title: 'Still here after sign out' }));

    setCurrentLocalDataNamespace(getLegacyLocalDataNamespace());
    expect((await loadSettings()).theme).toBe('exhale');
    expect(await loadActiveTodayTasks()).toEqual([]);

    setCurrentLocalDataNamespace(userANamespace);
    expect((await loadSettings()).theme).toBe('grounded');
    expect((await loadActiveTodayTasks()).map((task) => task.title)).toEqual(['Still here after sign out']);
  });

  it('does not silently merge legacy pre-auth data into signed-in local data', async () => {
    setCurrentLocalDataNamespace(getLegacyLocalDataNamespace());
    await saveSettings(validSettingsInput({ theme: 'clear' }));
    await saveActiveTodayTask(validActiveTask({ id: 'legacy-task', title: 'Legacy task' }));
    await saveCustomLibraryRhythm(validRhythm({ id: 'legacy-rhythm', title: 'Legacy rhythm' }));

    setCurrentLocalDataNamespace(userANamespace);

    expect((await loadSettings()).theme).toBe('exhale');
    expect(await loadActiveTodayTasks()).toEqual([]);
    expect(await loadCustomLibraryRhythms()).toEqual([]);
  });

  it('keeps backup/export reads scoped to the current local namespace only', async () => {
    setCurrentLocalDataNamespace(userANamespace);
    await saveSettings(validSettingsInput({ theme: 'grounded' }));
    await saveActiveTodayTask(validActiveTask({ id: 'active-user-a-task', title: 'User A task' }));
    await saveCustomLibraryRhythm(validRhythm({ id: 'custom-user-a-rhythm', title: 'User A rhythm' }));

    setCurrentLocalDataNamespace(userBNamespace);
    await saveSettings(validSettingsInput({ theme: 'clear' }));
    await saveActiveTodayTask(validActiveTask({ id: 'active-user-b-task', title: 'User B task' }));
    await saveCustomLibraryRhythm(validRhythm({ id: 'custom-user-b-rhythm', title: 'User B rhythm' }));

    const settingsBackup = await exportSettingsBackup();
    const libraryBackup = await exportLibraryRhythmBackup();
    const activeTasksForBackup = await loadPersistedActiveTasks();

    expect(settingsBackup.payload.settings.theme).toBe('clear');
    expect(libraryBackup?.payload.rhythms.map((rhythm) => rhythm.title)).toEqual(['User B rhythm']);
    expect(activeTasksForBackup.map((task) => task.title)).toEqual(['User B task']);
  });

  it('does not use fetch or localStorage while choosing local namespaces', async () => {
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const fetchSpy = vi.fn();
    const localStorage = {
      getItem: vi.fn(() => {
        throw new Error('localStorage must not be read');
      }),
      setItem: vi.fn(() => {
        throw new Error('localStorage must not be written');
      }),
    };

    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    try {
      setCurrentLocalDataNamespace(userANamespace);
      await saveSettings(validSettingsInput());
      await loadSettings();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }

      if (originalLocalStorage) {
        Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
      } else {
        Reflect.deleteProperty(globalThis, 'localStorage');
      }
    }
  });
});
