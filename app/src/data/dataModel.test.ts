import { describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from './db';
import { parseImportJson, validateImportData } from './exportImport';
import { inspectAndPlanLegacyV146, inspectLegacyV146, LEGACY_V146_KEY } from './migrations';
import {
  activeTaskSchema,
  appExportSchema,
  rhythmTemplateSchema,
  settingsSchema,
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
    expect(rhythmTemplate.enabled).toBe(true);
    expect(activeTask.source).toBe('library');
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
