import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { parseImportJson, validateImportData } from './exportImport';
import { inspectAndPlanLegacyV146, inspectLegacyV146, LEGACY_V146_KEY } from './migrations';
import {
  activeTaskSchema,
  appExportSchema,
  lifeShapeSettingsSchema,
  rhythmTemplateSchema,
  settingsSchema,
  startBoostSafetySettingsSchema,
  themeNameSchema,
  type AppExport,
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
    expect(rhythmTemplate.enabled).toBe(true);
    expect(activeTask.source).toBe('library');
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

  it('defines Dexie tables for each schema group', () => {
    const db = createLifeRhythmDatabase('life-rhythm-test-schema-only');

    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'activeTasks',
      'completionLog',
      'devTickets',
      'migrationLog',
      'resetLog',
      'rhythmTemplates',
      'settings',
      'startBoostLog',
      'taskHistory',
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
