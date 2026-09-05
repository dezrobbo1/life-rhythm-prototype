import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase, DATABASE_VERSION } from './db';
import { parseImportJson, validateImportData } from './exportImport';
import { inspectAndPlanLegacyV146, inspectLegacyV146, LEGACY_V146_KEY } from './migrations';
import { migrateSettingsDayProfileFoundation } from './dayProfileMigration';
import {
  ALL_WEEKDAYS,
  NON_WORKDAY_PROFILE_ID,
  WORKDAY_PROFILE_ID,
  activeTaskSchema,
  appExportSchema,
  lifeShapeSettingsSchema,
  rhythmTemplateSchema,
  softPlacementSchema,
  legacySettingsSchema,
  settingsSchema,
  startBoostSafetySettingsSchema,
  taskPoolItemSchema,
  themeNameSchema,
  type AppExport,
  type DayOfWeek,
  type LegacySettings,
} from './schemas';

const now = '2026-06-14T09:00:00.000Z';
const today = '2026-06-14';

const version = {
  label: 'Open the document',
  minutes: 5,
};

const settings = settingsSchema.parse({
  appVersion: '1.4.6',
  createdAt: now,
  updatedAt: now,
});

const rhythmTemplate = rhythmTemplateSchema.parse({
  id: 'template-1',
  source: 'custom',
  title: 'Review tomorrow',
  area: 'work',
  minimum: version,
  normal: { label: 'Review tomorrow and park loose ends', minutes: 10 },
  full: { label: "Set tomorrow's first step and close loops", minutes: 20 },
  enabled: true,
  createdAt: now,
  updatedAt: now,
});

const activeTask = activeTaskSchema.parse({
  id: 'task-1',
  templateId: rhythmTemplate.id,
  source: 'library',
  title: rhythmTemplate.title,
  area: rhythmTemplate.area,
  minimum: rhythmTemplate.minimum,
  normal: rhythmTemplate.normal,
  full: rhythmTemplate.full,
  showToday: true,
  createdAt: now,
  updatedAt: now,
});

const softPlacement = softPlacementSchema.parse({
  id: 'placement-1',
  taskId: activeTask.id,
  taskTitleSnapshot: activeTask.title,
  date: today,
  blockId: 'open-capacity-morning',
  blockLabelSnapshot: 'Open capacity',
  start: '10:00',
  end: '10:30',
  placementSource: 'userConfirmed',
  createdAt: now,
  updatedAt: now,
  status: 'planned',
});

const taskPoolItem = taskPoolItemSchema.parse({
  id: 'task-pool-1',
  source: 'adhoc',
  title: 'Captured admin task',
  area: 'admin',
  status: 'captured',
  minimum: version,
  normal: version,
  full: version,
  createdAt: now,
  updatedAt: now,
});

const validExport: AppExport = appExportSchema.parse({
  format: 'life-rhythm-app-export',
  exportedAt: now,
  appVersion: '1.4.6',
  settings,
  rhythmTemplates: [rhythmTemplate],
  activeTasks: [activeTask],
  taskHistory: [
    {
      id: 'history-1',
      taskId: activeTask.id,
      eventType: 'created',
      occurredAt: now,
      summary: 'Created task',
    },
  ],
  completionLog: [
    {
      id: 'completion-1',
      taskId: activeTask.id,
      templateId: rhythmTemplate.id,
      completedAt: now,
      localDate: today,
      mode: 'Minimum',
      area: 'work',
      plannedMinutes: 5,
    },
  ],
  resetLog: [
    {
      id: 'reset-1',
      occurredAt: now,
      localDate: today,
      action: 'restartOneAction',
      summary: 'Restarted with one action',
      affectedTaskIds: [activeTask.id],
    },
  ],
  startBoostLog: [
    {
      id: 'boost-1',
      taskId: activeTask.id,
      templateId: rhythmTemplate.id,
      barrier: 'unclear',
      supportId: 'tiny',
      result: 'bit',
      usedAt: now,
    },
  ],
  devTickets: [
    {
      id: 'ticket-1',
      title: 'Placeholder issue',
      type: 'Review note',
      priority: 'Medium',
      area: 'Task model',
      appVersion: '1.4.6',
      createdAt: now,
      updatedAt: now,
    },
  ],
  migrationLog: [
    {
      id: 'migration-1',
      sourceKey: LEGACY_V146_KEY,
      inspectedAt: now,
      status: 'planned',
      summary: 'Read-only plan created',
      counts: {
        settings: 1,
        rhythmTemplates: 1,
        activeTasks: 1,
        taskHistory: 1,
        completionLogs: 1,
        resetLogs: 1,
        startBoostLogs: 1,
        devTickets: 1,
      },
    },
  ],
});

describe('future data schemas', () => {
  it('validates settings, rhythm templates and active tasks', () => {
    expect(settings.theme).toBe('exhale');
    expect(settings.lifeShape.transitionBufferMinutes).toBe(10);
    expect(settings.dayProfiles.map((profile) => profile.id)).toEqual([
      WORKDAY_PROFILE_ID,
      NON_WORKDAY_PROFILE_ID,
    ]);
    expect(settings.weekdayProfileAssignments).toHaveLength(7);
    expect(new Set(settings.weekdayProfileAssignments.map((assignment) => assignment.weekday)).size).toBe(7);
    expect(
      settings.weekdayProfileAssignments
        .filter((assignment) => assignment.profileId === WORKDAY_PROFILE_ID)
        .map((assignment) => assignment.weekday),
    ).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(settings.dayProfiles.every((profile) => profile.usableDay === undefined)).toBe(true);
    expect(settings.dayProfiles[1].workPeriod).toBeUndefined();
    expect(settings.dayProfileMigrationState.reviewState).toBe('notStarted');
    expect(rhythmTemplate.enabled).toBe(true);
    expect(activeTask.source).toBe('library');
    expect(softPlacement.placementSource).toBe('userConfirmed');
    expect(taskPoolItem.status).toBe('captured');
  });

  it('rejects duplicate profile identities, kinds, weekdays, and missing profile references', () => {
    const duplicateProfiles = settingsSchema.safeParse({
      ...settings,
      dayProfiles: [settings.dayProfiles[0], settings.dayProfiles[0]],
    });
    const duplicateWeekday = settingsSchema.safeParse({
      ...settings,
      weekdayProfileAssignments: settings.weekdayProfileAssignments.map((assignment) =>
        assignment.weekday === 'Sunday'
          ? { ...assignment, weekday: 'Saturday' }
          : assignment,
      ),
    });
    const missingReference = settingsSchema.safeParse({
      ...settings,
      weekdayProfileAssignments: settings.weekdayProfileAssignments.map((assignment) =>
        assignment.weekday === 'Monday'
          ? { ...assignment, profileId: 'missing-profile' }
          : assignment,
      ),
    });
    const unknownKind = settingsSchema.safeParse({
      ...settings,
      dayProfiles: settings.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? { ...profile, kind: 'shiftDay' }
          : profile,
      ),
    });

    expect(duplicateProfiles.success).toBe(false);
    expect(duplicateWeekday.success).toBe(false);
    expect(missingReference.success).toBe(false);
    expect(unknownKind.success).toBe(false);
  });

  it('rejects invalid profile work-use values and invalid local time ranges', () => {
    const invalidPlanningUse = settingsSchema.safeParse({
      ...settings,
      dayProfiles: settings.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? { ...profile, workPlanningUse: 'automatic' }
          : profile,
      ),
    });
    const invalidWorkPeriod = settingsSchema.safeParse({
      ...settings,
      dayProfiles: settings.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? { ...profile, workPeriod: { end: '09:00', start: '17:00' } }
          : profile,
      ),
    });
    const invalidUsableDay = settingsSchema.safeParse({
      ...settings,
      dayProfiles: settings.dayProfiles.map((profile) =>
        profile.kind === 'nonWorkday'
          ? { ...profile, usableDay: { end: '08:00', start: '22:00' } }
          : profile,
      ),
    });

    expect(invalidPlanningUse.success).toBe(false);
    expect(invalidWorkPeriod.success).toBe(false);
    expect(invalidUsableDay.success).toBe(false);
  });

  it('validates theme preferences', () => {
    expect(themeNameSchema.parse('clear')).toBe('clear');
    expect(themeNameSchema.safeParse('warm-cream').success).toBe(false);
  });

  it('validates Start Boost safety settings with defaults', () => {
    const safety = startBoostSafetySettingsSchema.parse({
      avoidFoodRewards: true,
      avoidShoppingRewards: true,
    });

    expect(safety.avoidFoodRewards).toBe(true);
    expect(safety.avoidShoppingRewards).toBe(true);
    expect(safety.avoidScrollingRewards).toBe(true);
    expect(safety.avoidStreakPressure).toBe(true);
  });

  it('validates Life Shape settings', () => {
    const lifeShape = lifeShapeSettingsSchema.parse({
      usualWorkHours: {
        days: ['Monday', 'Tuesday', 'Wednesday'],
        start: '09:00',
        end: '17:00',
      },
      commuteMinutes: 25,
      travelMinutes: 15,
      fixedCommitments: [
        {
          id: 'school-run',
          label: 'School run',
          days: ['Monday', 'Tuesday'],
          start: '08:00',
          end: '08:45',
          travelMinutes: 10,
          bufferMinutes: 5,
        },
      ],
      transitionBufferMinutes: 15,
      mealAnchors: {
        breakfast: '07:30',
        lunch: '12:30',
        dinner: '18:30',
      },
      sleepWakeAnchors: {
        wake: '06:30',
        sleep: '22:00',
      },
      lowCapacityPreference: 'minimum-first',
    });

    expect(lifeShape.usualWorkHours.start).toBe('09:00');
    expect(lifeShape.fixedCommitments[0].label).toBe('School run');
    expect(lifeShape.lowCapacityPreference).toBe('minimum-first');
  });

  it('rejects invalid work hours safely', () => {
    const result = lifeShapeSettingsSchema.safeParse({
      usualWorkHours: {
        start: '18:00',
        end: '09:00',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'usualWorkHours.end')).toBe(true);
    }
  });

  it('rejects invalid travel and buffer values safely', () => {
    const lifeShapeResult = lifeShapeSettingsSchema.safeParse({
      commuteMinutes: -1,
      travelMinutes: 481,
      transitionBufferMinutes: 181,
    });
    const commitmentResult = lifeShapeSettingsSchema.safeParse({
      fixedCommitments: [
        {
          id: 'too-wide',
          label: 'Too wide',
          travelMinutes: 481,
          bufferMinutes: 181,
        },
      ],
    });

    expect(lifeShapeResult.success).toBe(false);
    expect(commitmentResult.success).toBe(false);
  });

  it('fills missing optional Life Shape fields with safe defaults', () => {
    const lifeShape = lifeShapeSettingsSchema.parse({});

    expect(lifeShape.usualWorkHours.days).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(lifeShape.usualWorkHours.start).toBe('08:00');
    expect(lifeShape.usualWorkHours.end).toBe('16:00');
    expect(lifeShape.commuteMinutes).toBe(0);
    expect(lifeShape.travelMinutes).toBe(0);
    expect(lifeShape.fixedCommitments).toEqual([]);
    expect(lifeShape.transitionBufferMinutes).toBe(10);
    expect(lifeShape.mealAnchors).toEqual({
      breakfast: '07:00',
      lunch: '12:00',
      dinner: '18:00',
    });
    expect(lifeShape.sleepWakeAnchors).toEqual({
      wake: '06:30',
      sleep: '21:30',
    });
    expect(lifeShape.lowCapacityPreference).toBe('protect-evening');
    expect(lifeShape.timeBlocks).toEqual([]);
  });

  it('validates Life Shape protected time blocks with type-specific scheduler defaults', () => {
    const lifeShape = lifeShapeSettingsSchema.parse({
      timeBlocks: [
        {
          days: ['Monday', 'Wednesday'],
          end: '12:00',
          id: 'protected-writing',
          label: 'Protected writing space',
          start: '10:00',
          type: 'protectedTime',
        },
        {
          days: ['Saturday'],
          end: '16:00',
          id: 'loose-saturday',
          label: 'Loose Saturday time',
          start: '14:00',
          type: 'looseTime',
        },
        {
          days: ['Friday'],
          end: '11:00',
          id: 'open-capacity',
          label: 'Open capacity',
          start: '10:30',
          type: 'openCapacity',
        },
      ],
    });

    expect(lifeShape.timeBlocks).toEqual([
      expect.objectContaining({
        id: 'protected-writing',
        schedulerUse: 'unavailable',
        type: 'protectedTime',
      }),
      expect.objectContaining({
        id: 'loose-saturday',
        schedulerUse: 'askFirst',
        type: 'looseTime',
      }),
      expect.objectContaining({
        id: 'open-capacity',
        schedulerUse: 'available',
        type: 'openCapacity',
      }),
    ]);
  });

  it('rejects invalid Life Shape time blocks safely', () => {
    const invalidRange = lifeShapeSettingsSchema.safeParse({
      timeBlocks: [
        {
          days: ['Monday'],
          end: '11:00',
          id: 'backwards',
          label: 'Backwards',
          start: '12:00',
          type: 'protectedTime',
        },
      ],
    });
    const invalidDay = lifeShapeSettingsSchema.safeParse({
      timeBlocks: [
        {
          days: ['Funday'],
          end: '12:00',
          id: 'bad-day',
          label: 'Bad day',
          start: '11:00',
          type: 'looseTime',
        },
      ],
    });
    const unknownField = lifeShapeSettingsSchema.safeParse({
      timeBlocks: [
        {
          days: ['Monday'],
          end: '12:00',
          id: 'unknown-field',
          label: 'Unknown field',
          scheduleIntoThis: true,
          start: '11:00',
          type: 'openCapacity',
        },
      ],
    });

    expect(invalidRange.success).toBe(false);
    expect(invalidDay.success).toBe(false);
    expect(unknownField.success).toBe(false);
  });

  it('does not call storage write APIs during settings validation', () => {
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const clear = vi.fn();
    const indexedDbOpen = vi.fn();
    const indexedDbDelete = vi.fn();

    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          clear,
          removeItem,
          setItem,
        },
      });
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: {
          deleteDatabase: indexedDbDelete,
          open: indexedDbOpen,
        },
      });

      settingsSchema.parse({
        appVersion: '1.4.6',
        theme: 'grounded',
        startBoostSafety: {
          avoidShoppingRewards: true,
        },
        lifeShape: {
          usualWorkHours: {
            start: '09:00',
            end: '17:00',
          },
        },
        createdAt: now,
        updatedAt: now,
      });
    } finally {
      if (localStorageDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'localStorage');
      }
      if (indexedDbDescriptor) {
        Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'indexedDB');
      }
    }

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(indexedDbOpen).not.toHaveBeenCalled();
    expect(indexedDbDelete).not.toHaveBeenCalled();
  });

  it('rejects library active tasks without template references', () => {
    const result = activeTaskSchema.safeParse({
      id: 'task-missing-template',
      source: 'library',
      title: 'Library task without template',
      area: 'work',
      minimum: version,
      normal: version,
      full: version,
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'templateId')).toBe(true);
    }
  });

  it('accepts a flexible active task without deadline fields', () => {
    const result = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-flexible',
    });

    expect(result.success).toBe(true);
  });

  it('accepts active task deadline fields that match their time constraint', () => {
    const dueBy = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-due-by',
      dueAt: '2026-06-17T08:00:00.000Z',
      timeConstraint: 'dueBy',
    });
    const fixedAt = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-fixed-at',
      fixedAt: '2026-06-17T09:00:00.000Z',
      timeConstraint: 'fixedAt',
    });
    const expiresAfter = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-expires-after',
      expiresAfter: '2026-06-17T17:00:00.000Z',
      timeConstraint: 'expiresAfter',
    });

    expect(dueBy.success).toBe(true);
    expect(fixedAt.success).toBe(true);
    expect(expiresAfter.success).toBe(true);
  });

  it('rejects active task deadline fields that do not match their time constraint', () => {
    const dueAtOnFlexible = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-flexible-with-due-at',
      dueAt: '2026-06-17T08:00:00.000Z',
      timeConstraint: 'flexible',
    });
    const fixedAtOnDueBy = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-due-by-with-fixed-at',
      fixedAt: '2026-06-17T09:00:00.000Z',
      timeConstraint: 'dueBy',
    });
    const expiresAfterOnDueBy = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-due-by-with-expires-after',
      expiresAfter: '2026-06-17T17:00:00.000Z',
      timeConstraint: 'dueBy',
    });

    expect(dueAtOnFlexible.success).toBe(false);
    expect(fixedAtOnDueBy.success).toBe(false);
    expect(expiresAfterOnDueBy.success).toBe(false);
  });

  it('rejects invalid deadline windows and missed policies', () => {
    const invalidWindow = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-invalid-window',
      latestUsefulStartAt: '2026-06-17T18:00:00.000Z',
      notUsefulAfter: '2026-06-17T17:00:00.000Z',
      timeConstraint: 'dueBy',
      dueAt: '2026-06-17T19:00:00.000Z',
    });
    const invalidMissedPolicy = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-invalid-missed-policy',
      missedPolicy: 'pressure' as never,
    });
    const invalidIso = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-invalid-iso',
      dueAt: '2026-02-31T08:00:00.000Z',
      timeConstraint: 'dueBy',
    });

    expect(invalidWindow.success).toBe(false);
    expect(invalidMissedPolicy.success).toBe(false);
    expect(invalidIso.success).toBe(false);
  });

  it('rejects unknown active task deadline fields', () => {
    const result = activeTaskSchema.safeParse({
      ...activeTask,
      id: 'task-unknown-deadline-field',
      deadlineAt: '2026-06-17T08:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('Unrecognized key'))).toBe(true);
    }
  });

  it('validates soft placement records without task-placement side effects', () => {
    const valid = softPlacementSchema.safeParse({
      ...softPlacement,
      id: 'placement-valid-copy',
    });
    const invalidRange = softPlacementSchema.safeParse({
      ...softPlacement,
      end: '10:00',
      id: 'placement-invalid-range',
      start: '10:30',
    });
    const invalidSource = softPlacementSchema.safeParse({
      ...softPlacement,
      id: 'placement-invalid-source',
      placementSource: 'scheduler',
    });
    const unknownField = softPlacementSchema.safeParse({
      ...softPlacement,
      id: 'placement-unknown-field',
      calendarEventId: 'calendar-event',
    });

    expect(valid.success).toBe(true);
    expect(invalidRange.success).toBe(false);
    expect(invalidSource.success).toBe(false);
    expect(unknownField.success).toBe(false);
  });

  it('defines Dexie tables for each schema group', () => {
    const db = createLifeRhythmDatabase('life-rhythm-test-schema-only');

    expect(DATABASE_VERSION).toBe(5);
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'activeTasks',
      'calendarSources',
      'completionLog',
      'devTickets',
      'migrationLog',
      'resetLog',
      'rhythmTemplates',
      'schedulerPlanState',
      'settings',
      'softPlacements',
      'startBoostLog',
      'taskHistory',
      'taskPoolItems',
    ]);

    db.close();
  });
});

describe('import validation', () => {
  it('accepts a valid future app export', () => {
    expect(validateImportData(validExport).ok).toBe(true);
  });

  it('rejects malformed import JSON safely', () => {
    const result = parseImportJson('{not json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('not valid JSON');
    }
  });

  it('rejects structurally invalid import data', () => {
    const result = validateImportData({
      format: 'life-rhythm-app-export',
      activeTasks: [{ title: '' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe('legacy v146 inspection', () => {
  it('reads only the legacy key and reports candidate counts', () => {
    const getItem = vi.fn((key: string) =>
      key === LEGACY_V146_KEY
        ? JSON.stringify({
            version: '1.4.6',
            settings: { theme: 'exhale' },
            tasks: [
              { id: 'template-1', title: 'Enabled rhythm', library: true },
              { id: 'task-1', title: 'Active task', library: false },
            ],
            history: [{ id: 'history-1' }],
            completedToday: { 'task-1': { mode: 'Minimum' } },
            resetLog: [{ id: 'reset-1' }],
            startBoostLog: [{ id: 'boost-1' }],
            devTickets: [{ id: 'ticket-1' }],
          })
        : null,
    );
    const setItem = vi.fn();
    const removeItem = vi.fn();

    const { inspection, plan } = inspectAndPlanLegacyV146({
      getItem,
      setItem,
      removeItem,
    } as unknown as Storage);

    expect(getItem).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledWith(LEGACY_V146_KEY);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(inspection.found).toBe(true);
    expect(inspection.readOnly).toBe(true);
    expect(plan.willWrite).toBe(false);
    expect(plan.counts).toMatchObject({
      settings: 1,
      rhythmTemplates: 1,
      activeTasks: 1,
      taskHistory: 1,
      completionLogs: 2,
      resetLogs: 1,
      startBoostLogs: 1,
      devTickets: 1,
    });
  });

  it('reports invalid legacy JSON without throwing', () => {
    const inspection = inspectLegacyV146({
      getItem: () => '{broken',
    } as unknown as Storage);

    expect(inspection.found).toBe(true);
    expect(inspection.readOnly).toBe(true);
    if (inspection.found) {
      expect(inspection.parsed).toBe(false);
      expect(inspection.warnings[0]).toContain('not valid JSON');
    }
  });
});

const migrationNow = '2026-08-12T00:00:00.000Z';

function makeLegacySettings(
  workdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  overrides: Partial<LegacySettings> = {},
): LegacySettings {
  const lifeShape = {
    commuteMinutes: 35,
    fixedCommitments: [
      {
        bufferMinutes: 10,
        days: ['Tuesday'] as DayOfWeek[],
        end: '09:00',
        id: 'school-run',
        label: 'School run',
        start: '08:15',
        travelMinutes: 15,
      },
    ],
    lowCapacityPreference: 'minimum-first' as const,
    mealAnchors: {
      breakfast: '07:15',
      dinner: '18:45',
      lunch: '12:20',
    },
    sleepWakeAnchors: {
      sleep: '22:10',
      wake: '06:20',
    },
    timeBlocks: [
      {
        days: ['Wednesday'] as DayOfWeek[],
        end: '15:00',
        id: 'open-wednesday',
        label: 'Wednesday capacity',
        schedulerUse: 'available' as const,
        start: '14:00',
        type: 'openCapacity' as const,
      },
    ],
    transitionBufferMinutes: 20,
    travelMinutes: 25,
    usualWorkHours: {
      days: workdays,
      end: '17:30',
      start: '09:30',
    },
  };

  return legacySettingsSchema.parse({
    appVersion: '1.4.6',
    bedTime: lifeShape.sleepWakeAnchors.sleep,
    breakfastTime: lifeShape.mealAnchors.breakfast,
    createdAt: migrationNow,
    dinnerTime: lifeShape.mealAnchors.dinner,
    id: 'settings',
    lifeShape,
    lunchTime: lifeShape.mealAnchors.lunch,
    startBoostSafety: {
      avoidAccountabilityPrompts: true,
      avoidFoodRewards: false,
      avoidScrollingRewards: true,
      avoidShoppingRewards: true,
      avoidStreakPressure: true,
      avoidUrgencyCountdowns: true,
    },
    theme: 'clear',
    updatedAt: migrationNow,
    wakeTime: lifeShape.sleepWakeAnchors.wake,
    workDays: workdays,
    workEnd: lifeShape.usualWorkHours.end,
    workStart: lifeShape.usualWorkHours.start,
    ...overrides,
  });
}

describe('day-profile settings migration', () => {
  it('creates stable Workday and Non-workday profiles without activating usable-day derivation', () => {
    const result = migrateSettingsDayProfileFoundation(makeLegacySettings());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.status).toBe('migrated');
    expect(result.settings.dayProfiles).toEqual([
      {
        id: WORKDAY_PROFILE_ID,
        kind: 'workday',
        name: 'Workday',
        workPeriod: {
          end: '17:30',
          start: '09:30',
        },
        workPlanningUse: 'workRhythmsOnly',
      },
      {
        id: NON_WORKDAY_PROFILE_ID,
        kind: 'nonWorkday',
        name: 'Non-workday',
        workPlanningUse: 'unavailable',
      },
    ]);
    expect(result.settings.dayProfiles.every((profile) => profile.usableDay === undefined)).toBe(true);
    expect(result.settings.dayProfileMigrationState.reviewState).toBe('needsReview');
  });

  it('assigns all seven weekdays from a non-standard saved workday set', () => {
    const workdays: DayOfWeek[] = ['Tuesday', 'Thursday', 'Saturday'];
    const result = migrateSettingsDayProfileFoundation(makeLegacySettings(workdays));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.settings.weekdayProfileAssignments.map((assignment) => assignment.weekday)).toEqual(ALL_WEEKDAYS);
    expect(new Set(result.settings.weekdayProfileAssignments.map((assignment) => assignment.weekday)).size).toBe(7);
    expect(
      result.settings.weekdayProfileAssignments
        .filter((assignment) => assignment.profileId === WORKDAY_PROFILE_ID)
        .map((assignment) => assignment.weekday),
    ).toEqual(workdays);
    expect(
      result.settings.weekdayProfileAssignments
        .filter((assignment) => assignment.profileId === NON_WORKDAY_PROFILE_ID)
        .map((assignment) => assignment.weekday),
    ).toEqual(['Monday', 'Wednesday', 'Friday', 'Sunday']);
  });

  it('preserves the full legacy record and freezes unconverted compatibility context', () => {
    const legacy = makeLegacySettings();
    const result = migrateSettingsDayProfileFoundation(legacy);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const {
      dayProfileMigrationState,
      dayProfiles: _dayProfiles,
      weekdayProfileAssignments: _weekdayProfileAssignments,
      ...preservedLegacy
    } = result.settings;

    expect(preservedLegacy).toEqual(legacy);
    expect(dayProfileMigrationState).toEqual({
      legacyCommuteTransitionContext: {
        commuteMinutes: 35,
        transitionBufferMinutes: 20,
      },
      legacyLowCapacityPreference: 'minimum-first',
      legacyMealAnchors: {
        breakfast: '07:15',
        dinner: '18:45',
        lunch: '12:20',
      },
      legacySleepWakeAnchors: {
        sleep: '22:10',
        wake: '06:20',
      },
      legacyTravelContext: {
        travelMinutes: 25,
      },
      reviewState: 'needsReview',
      sourceSettingsVersion: '1.4.6',
    });
    expect(result.settings.lifeShape.fixedCommitments).toEqual(legacy.lifeShape.fixedCommitments);
    expect(result.settings.lifeShape.timeBlocks).toEqual(legacy.lifeShape.timeBlocks);
    expect(result.settings.dayProfiles.some((profile) => 'mealWindows' in profile)).toBe(false);
    expect(result.settings.dayProfiles.some((profile) => 'sleepWakeContext' in profile)).toBe(false);
  });

  it.each(['1.4.6', 'dev', 'preview build'])(
    'preserves the accepted stored app-version label %s exactly',
    (appVersion) => {
      const result = migrateSettingsDayProfileFoundation(makeLegacySettings(undefined, { appVersion }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.status).toBe('migrated');
      expect(result.settings.appVersion).toBe(appVersion);
      expect(result.settings.dayProfileMigrationState.sourceSettingsVersion).toBe(appVersion);
      expect(result.settings.theme).toBe('clear');
    },
  );

  it('rejects an app-version value that the stored-settings schema rejects', () => {
    const legacy = {
      ...makeLegacySettings(),
      appVersion: '',
    };
    const result = migrateSettingsDayProfileFoundation(legacy);

    expect(legacySettingsSchema.safeParse(legacy).success).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('appVersion');
    }
  });

  it('is deterministic, idempotent, and does not recreate stable identities', () => {
    const legacy = makeLegacySettings();
    const first = migrateSettingsDayProfileFoundation(legacy);
    const repeated = migrateSettingsDayProfileFoundation(legacy);

    expect(first).toEqual(repeated);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const alreadyMigrated = migrateSettingsDayProfileFoundation(first.settings);

    expect(alreadyMigrated.ok).toBe(true);
    if (!alreadyMigrated.ok) return;
    expect(alreadyMigrated.status).toBe('unchanged');
    expect(alreadyMigrated.settings).toEqual(first.settings);
  });

  it('preserves valid later user-owned profile changes on subsequent normalization', () => {
    const migrated = migrateSettingsDayProfileFoundation(makeLegacySettings());

    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    const changed = {
      ...migrated.settings,
      dayProfiles: migrated.settings.dayProfiles.map((profile) =>
        profile.kind === 'workday'
          ? {
              ...profile,
              name: 'Office day',
              usableDay: {
                end: '21:00',
                start: '07:00',
              },
              workPeriod: {
                end: '18:00',
                start: '10:00',
              },
              workPlanningUse: 'askFirst' as const,
            }
          : profile,
      ),
    };
    const result = migrateSettingsDayProfileFoundation(changed);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('unchanged');
    expect(result.settings).toEqual(changed);
  });

  it('surfaces duplicated legacy-field conflicts while preserving both sources', () => {
    const legacy = makeLegacySettings(undefined, {
      breakfastTime: '08:00',
      workDays: ['Monday', 'Friday'],
      workStart: '08:00',
    });
    const result = migrateSettingsDayProfileFoundation(legacy);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.conflicts.map((conflict) => conflict.field)).toEqual([
      'workDays',
      'workStart',
      'breakfastTime',
    ]);
    expect(result.settings.workStart).toBe('08:00');
    expect(result.settings.lifeShape.usualWorkHours.start).toBe('09:30');
    expect(result.settings.dayProfiles[0].workPeriod?.start).toBe('09:30');
    expect(result.settings.dayProfileMigrationState.legacyMealAnchors.breakfast).toBe('07:15');

    const repeated = migrateSettingsDayProfileFoundation(result.settings);

    expect(repeated.ok).toBe(true);
    if (repeated.ok) {
      expect(repeated.conflicts.map((conflict) => conflict.field)).toEqual([
        'workDays',
        'workStart',
        'breakfastTime',
      ]);
    }
  });

  it('fails partial or malformed profile-aware records without rebuilding them', () => {
    const migrated = migrateSettingsDayProfileFoundation(makeLegacySettings());

    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    const { weekdayProfileAssignments: _assignments, ...partial } = migrated.settings;
    const malformed = {
      ...migrated.settings,
      weekdayProfileAssignments: migrated.settings.weekdayProfileAssignments.map((assignment) =>
        assignment.weekday === 'Monday'
          ? { ...assignment, profileId: 'missing-profile' }
          : assignment,
      ),
    };
    const partialResult = migrateSettingsDayProfileFoundation(partial);
    const malformedResult = migrateSettingsDayProfileFoundation(malformed);

    expect(partialResult.ok).toBe(false);
    expect(malformedResult.ok).toBe(false);
    if (!partialResult.ok && !malformedResult.ok) {
      expect(partialResult.profileFoundationPresent).toBe(true);
      expect(partialResult.errors.join(' ')).toContain('incomplete');
      expect(malformedResult.profileFoundationPresent).toBe(true);
      expect(malformedResult.errors.join(' ')).toContain('existing day profile');
    }
  });
});