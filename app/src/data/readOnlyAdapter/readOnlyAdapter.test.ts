// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  buildLibraryViewModel,
  buildTodayViewModel,
  emptyAppSnapshot,
} from '../../viewModels';
import {
  activeTaskSchema,
  rhythmTemplateSchema,
  settingsSchema,
} from '../schemas';
import {
  getFallbackAppSnapshot,
  loadReadOnlyAppSnapshot,
  mapCurrentDataToAppSnapshot,
  mapLegacySnapshotToAppSnapshot,
} from './index';

const now = '2026-06-14T09:00:00.000Z';
const version = { label: 'Open the page', minutes: 5 };

const settings = settingsSchema.parse({
  appVersion: '1.4.6',
  createdAt: now,
  theme: 'clear',
  updatedAt: now,
});

const currentRhythm = rhythmTemplateSchema.parse({
  id: 'rhythm-review-tomorrow',
  area: 'work',
  createdAt: now,
  enabled: true,
  full: { label: "Set tomorrow's first step and close loops", minutes: 20 },
  minimum: version,
  normal: { label: 'Review tomorrow and park loose ends', minutes: 10 },
  purpose: 'Make tomorrow easier to enter.',
  schedule: {
    bestTime: 'shutdown',
    frequency: 5,
    preferredDays: ['Monday', 'Tuesday'],
    prepMinutes: 3,
  },
  title: 'Review tomorrow',
  updatedAt: now,
});

const currentOneOff = activeTaskSchema.parse({
  id: 'task-pay-water-bill',
  area: 'money',
  createdAt: now,
  full: { label: 'Pay, file receipt, close tab', minutes: 15 },
  minimum: { label: 'Open the bill and note the due date', minutes: 3 },
  normal: { label: 'Pay or park the exact next step', minutes: 10 },
  purpose: 'Today-only admin.',
  showToday: true,
  source: 'adhoc',
  status: 'active',
  title: 'Pay water bill',
  updatedAt: now,
});

describe('read-only local data adapter', () => {
  it('returns the fallback snapshot when no readable local data exists', () => {
    const snapshot = loadReadOnlyAppSnapshot();

    expect(snapshot).toEqual(getFallbackAppSnapshot());
    expect(buildTodayViewModel(snapshot).nextUsefulAction).toBeNull();
    expect(snapshot.activeTasks).toHaveLength(0);
  });

  it('maps legacy-shaped data into an app snapshot without writing', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const snapshot = mapLegacySnapshotToAppSnapshot({
      settings: { theme: 'grounded' },
      tasks: [
        {
          id: 'legacy-rhythm-breakfast',
          library: true,
          title: 'Breakfast reset',
          category: 'Food',
          purpose: 'Make the first food step visible and small.',
          minimumVersion: 'Clear one surface.',
          normalVersion: 'Clear one surface and eat.',
          fullVersion: 'Eat and set the next cue.',
          enabled: true,
        },
        {
          id: 'legacy-one-off',
          title: 'Pay water bill',
          area: 'Money',
          purpose: 'Today-only admin.',
          minimumVersion: 'Open the bill.',
          today: true,
        },
      ],
    });

    expect(snapshot.settings?.theme).toBe('grounded');
    expect(snapshot.rhythmTemplates?.map((rhythm) => rhythm.title)).toEqual(['Breakfast reset']);
    expect(snapshot.activeTasks?.map((task) => task.title)).toEqual(['Pay water bill']);
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
  });

  it('maps current-shaped data into an app snapshot without writing', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const snapshot = mapCurrentDataToAppSnapshot({
      activeTasks: [currentOneOff],
      rhythmTemplates: [currentRhythm],
      settings,
    });

    expect(snapshot.settings?.theme).toBe('clear');
    expect(snapshot.activeTasks?.[0]).toMatchObject({
      area: 'Money',
      showToday: true,
      source: 'adhoc',
      title: 'Pay water bill',
    });
    expect(snapshot.rhythmTemplates?.[0]).toMatchObject({
      area: 'Work focus',
      category: 'Work focus',
      enabled: true,
      title: 'Review tomorrow',
    });
    expect(snapshot.rhythmTemplates?.[0].schedule?.frequency).toBe(5);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('keeps one-off tasks Today-only and reusable rhythms Library-only', () => {
    const snapshot = loadReadOnlyAppSnapshot({
      currentData: {
        activeTasks: [currentOneOff],
        rhythmTemplates: [currentRhythm],
      },
    });
    const today = buildTodayViewModel(snapshot);
    const library = buildLibraryViewModel(snapshot);

    expect(today.nextUsefulAction?.title).toBe('Pay water bill');
    expect(library.oneOffTodayTaskIds).toEqual(['task-pay-water-bill']);
    expect(library.reusableRhythms.map((rhythm) => rhythm.title)).toEqual(['Review tomorrow']);
    expect(snapshot.activeTasks?.some((task) => task.templateId === currentRhythm.id)).toBe(false);
  });

  it('keeps reusable rhythms out of Today unless there is an active Today task', () => {
    const snapshot = loadReadOnlyAppSnapshot({
      currentData: {
        rhythmTemplates: [currentRhythm],
      },
    });

    expect(buildTodayViewModel(snapshot).nextUsefulAction).toBeNull();
    expect(buildLibraryViewModel(snapshot).enabledRhythms.map((rhythm) => rhythm.title)).toContain('Review tomorrow');
  });

  it('tolerates missing and partial data without crashing', () => {
    const snapshot = mapCurrentDataToAppSnapshot({
      activeTasks: [{}],
      rhythmTemplates: [{}],
      settings: {},
    });

    expect(snapshot.activeTasks?.[0].title).toBe('Untitled task');
    expect(snapshot.rhythmTemplates?.[0].title).toBe('Untitled rhythm');
    expect(() => buildTodayViewModel(snapshot)).not.toThrow();
    expect(() => buildLibraryViewModel(snapshot)).not.toThrow();
  });

  it('does not call localStorage while loading snapshots', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    loadReadOnlyAppSnapshot({
      legacySnapshot: {
        tasks: [{ title: 'Loose legacy task', today: true }],
      },
    });

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('does not perform IndexedDB or Dexie write/open calls', () => {
    const openSpy = vi.fn();
    const deleteDatabaseSpy = vi.fn();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: deleteDatabaseSpy,
        open: openSpy,
      },
    });

    loadReadOnlyAppSnapshot({
      currentData: {
        activeTasks: [currentOneOff],
        rhythmTemplates: [currentRhythm],
      },
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(deleteDatabaseSpy).not.toHaveBeenCalled();
  });

  it('returns a cloned fallback so callers cannot mutate shared fixtures', () => {
    const fallback = getFallbackAppSnapshot(emptyAppSnapshot);
    fallback.futureModules?.pop();

    expect(getFallbackAppSnapshot(emptyAppSnapshot).futureModules?.length).toBeGreaterThan(
      fallback.futureModules?.length ?? 0,
    );
  });
});
