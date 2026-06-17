import { describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_TASK_BACKUP_FORMAT,
  activeTaskBackupSchema,
  buildActiveTaskBackupPayload,
  parseActiveTaskBackupJson,
  serializeActiveTaskBackup,
  validateActiveTaskBackup,
  type ActiveTaskBackup,
} from './activeTaskBackup';
import { activeTaskSchema, type ActiveTask } from './schemas';

const exportedAt = '2026-06-17T00:00:00.000Z';

function validActiveTask(overrides: Partial<ActiveTask> = {}): ActiveTask {
  return activeTaskSchema.parse({
    area: 'house',
    createdAt: '2026-06-17T00:00:00.000Z',
    full: {
      label: 'Clear the counter and reset one hidden edge.',
      minutes: 20,
    },
    id: 'active-kitchen-landing',
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
    taskType: 'house',
    title: 'Kitchen landing',
    updatedAt: '2026-06-17T01:00:00.000Z',
    ...overrides,
  });
}

function validPayload(): ActiveTaskBackup {
  return buildActiveTaskBackupPayload([validActiveTask()], exportedAt);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('active task backup scaffolding', () => {
  it('builds a valid active task backup payload from explicit active task data', () => {
    const payload = validPayload();

    expect(payload.format).toBe(ACTIVE_TASK_BACKUP_FORMAT);
    expect(payload.appVersion).toBe('1.4.6');
    expect(payload.exportedAt).toBe(exportedAt);
    expect(payload.activeTasks).toHaveLength(1);
    expect(payload.activeTasks[0]).toMatchObject({
      id: 'active-kitchen-landing',
      source: 'adhoc',
      status: 'active',
      title: 'Kitchen landing',
    });
    expect(payload.activeTasks[0].schedule.bestTime).toBe('anytime');
  });

  it('includes only approved active task backup fields', () => {
    const payload = validPayload();
    const task = payload.activeTasks[0];

    expect(Object.keys(payload).sort()).toEqual(['activeTasks', 'appVersion', 'exportedAt', 'format']);
    expect(Object.keys(task).sort()).toEqual([
      'area',
      'createdAt',
      'full',
      'id',
      'minimum',
      'normal',
      'purpose',
      'schedule',
      'showToday',
      'source',
      'status',
      'taskType',
      'title',
      'updatedAt',
    ]);
    expect(task).not.toHaveProperty('kind');
    expect(task).not.toHaveProperty('completionStyle');
    expect(task).not.toHaveProperty('priority');
    expect(task).not.toHaveProperty('energy');
    expect(task).not.toHaveProperty('startBarrier');
  });

  it('preserves optional template, fallback, schedule, and re-entry status fields when present', () => {
    const payload = buildActiveTaskBackupPayload([
      validActiveTask({
        fallback: 'If blocked, park the next exact step.',
        id: 'active-breakfast-reset',
        schedule: {
          bestTime: 'morning',
          bufferMode: 'light',
          catchupAllowed: false,
          cleanupMinutes: 2,
          droppable: true,
          fixedTime: '08:00',
          frequency: 3,
          lateHandling: 'ask',
          maxPerDay: 1,
          movable: true,
          period: 'week',
          preferredDays: ['Monday', 'Wednesday'],
          prepMinutes: 5,
          targetDate: '2026-06-18',
          transitionMinutes: 5,
          travelMinutes: 0,
        },
        showToday: false,
        source: 'library',
        status: 'parked',
        templateId: 'food-breakfast-reset',
        title: 'Breakfast reset',
      }),
    ], exportedAt);
    const task = payload.activeTasks[0];

    expect(task).toMatchObject({
      fallback: 'If blocked, park the next exact step.',
      showToday: false,
      source: 'library',
      status: 'parked',
      templateId: 'food-breakfast-reset',
    });
    expect(task.schedule.fixedTime).toBe('08:00');
    expect(task.schedule.preferredDays).toEqual(['Monday', 'Wednesday']);
  });

  it('serializes a payload that parses through active task backup validation', () => {
    const payload = validPayload();
    const serialized = serializeActiveTaskBackup(payload);
    const parsed = parseActiveTaskBackupJson(serialized);

    expect(activeTaskBackupSchema.parse(JSON.parse(serialized))).toEqual(payload);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload).toEqual(payload);
    }
  });

  it('validates an active task backup and returns a preview', () => {
    const result = validateActiveTaskBackup(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.activeTaskCount).toBe(1);
      expect(result.preview.taskTitles).toEqual(['Kitchen landing']);
      expect(result.preview.exportedAt).toBe(exportedAt);
    }
  });

  it('rejects malformed JSON and non-object values safely', () => {
    const malformed = parseActiveTaskBackupJson('{ not json');
    const nonObject = validateActiveTaskBackup([]);

    expect(malformed.ok).toBe(false);
    expect(nonObject.ok).toBe(false);
    if (!malformed.ok && !nonObject.ok) {
      expect(malformed.errors[0]).toContain('malformed');
      expect(nonObject.errors[0]).toContain('Expected an active task backup object');
    }
  });

  it('rejects unknown top-level and active task fields', () => {
    const payload = clone(validPayload());
    const unknownTopLevel = validateActiveTaskBackup({
      ...payload,
      notes: 'extra',
    });
    const unknownTaskField = validateActiveTaskBackup({
      ...payload,
      activeTasks: [
        {
          ...payload.activeTasks[0],
          startBarrier: 'unclear',
        },
      ],
    });

    expect(unknownTopLevel.ok).toBe(false);
    expect(unknownTaskField.ok).toBe(false);
    if (!unknownTopLevel.ok && !unknownTaskField.ok) {
      expect(unknownTopLevel.errors.join(' ')).toContain('Unrecognized key');
      expect(unknownTaskField.errors.join(' ')).toContain('activeTasks.0');
      expect(unknownTaskField.errors.join(' ')).toContain('startBarrier');
    }
  });

  it('rejects invalid backup metadata', () => {
    const payload = clone(validPayload());
    const invalidFormat = validateActiveTaskBackup({
      ...payload,
      format: 'life-rhythm-settings-backup',
    });
    const invalidVersion = validateActiveTaskBackup({
      ...payload,
      appVersion: 'preview',
    });
    const invalidExportedAt = validateActiveTaskBackup({
      ...payload,
      exportedAt: '2026-02-31T00:00:00.000Z',
    });

    expect(invalidFormat.ok).toBe(false);
    expect(invalidVersion.ok).toBe(false);
    expect(invalidExportedAt.ok).toBe(false);
    if (!invalidFormat.ok && !invalidVersion.ok && !invalidExportedAt.ok) {
      const errors = [...invalidFormat.errors, ...invalidVersion.errors, ...invalidExportedAt.errors].join(' ');

      expect(errors).toContain('format');
      expect(errors).toContain('appVersion');
      expect(errors).toContain('exportedAt');
    }
  });

  it('rejects invalid task IDs and duplicate task IDs', () => {
    const payload = clone(validPayload());
    const invalidId = validateActiveTaskBackup({
      ...payload,
      activeTasks: [
        {
          ...payload.activeTasks[0],
          id: '',
        },
      ],
    });
    const duplicateId = validateActiveTaskBackup({
      ...payload,
      activeTasks: [
        payload.activeTasks[0],
        {
          ...payload.activeTasks[0],
          title: 'Kitchen landing copy',
        },
      ],
    });

    expect(invalidId.ok).toBe(false);
    expect(duplicateId.ok).toBe(false);
    if (!invalidId.ok && !duplicateId.ok) {
      expect(invalidId.errors.join(' ')).toContain('activeTasks.0.id');
      expect(duplicateId.errors.join(' ')).toContain('Duplicate active task IDs');
    }
  });

  it.each([
    ['active'],
    ['inProgress'],
    ['paused'],
    ['minimumDone'],
    ['done'],
    ['parked'],
    ['skipped'],
    ['notToday'],
  ] as const)('accepts allowed active task status %s', (status) => {
    const payload = buildActiveTaskBackupPayload([
      validActiveTask({
        showToday: status === 'active' || status === 'inProgress' || status === 'paused' || status === 'minimumDone',
        status,
      }),
    ], exportedAt);

    expect(validateActiveTaskBackup(payload).ok).toBe(true);
  });

  it('rejects invalid status, source, task versions, and schedule hints', () => {
    const payload = clone(validPayload());
    const invalidTask = validateActiveTaskBackup({
      ...payload,
      activeTasks: [
        {
          ...payload.activeTasks[0],
          full: {
            label: '',
            minutes: 0,
          },
          schedule: {
            ...payload.activeTasks[0].schedule,
            fixedTime: '25:00',
            maxPerDay: 0,
          },
          source: 'built-in',
          status: 'missed',
        },
      ],
    });

    expect(invalidTask.ok).toBe(false);
    if (!invalidTask.ok) {
      const errors = invalidTask.errors.join(' ');

      expect(errors).toContain('activeTasks.0.status');
      expect(errors).toContain('activeTasks.0.source');
      expect(errors).toContain('activeTasks.0.full.label');
      expect(errors).toContain('activeTasks.0.full.minutes');
      expect(errors).toContain('activeTasks.0.schedule.fixedTime');
      expect(errors).toContain('activeTasks.0.schedule.maxPerDay');
    }
  });

  it('rejects library active tasks without template references', () => {
    const payload = clone(validPayload());
    const result = validateActiveTaskBackup({
      ...payload,
      activeTasks: [
        {
          ...payload.activeTasks[0],
          source: 'library',
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('activeTasks.0.templateId');
    }
  });

  it('rejects missing required active task fields without adding defaults', () => {
    const payload = clone(validPayload());
    const result = validateActiveTaskBackup({
      ...payload,
      activeTasks: [
        {
          ...payload.activeTasks[0],
          schedule: undefined,
          taskType: undefined,
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const errors = result.errors.join(' ');

      expect(errors).toContain('activeTasks.0.taskType');
      expect(errors).toContain('activeTasks.0.schedule');
    }
  });

  it('rejects settings, Library rhythm, scheduler, history, logs, calendar, migration, reset, module, and legacy data', () => {
    const payload = clone(validPayload());
    const blockedPayloads = [
      { key: 'settings', value: { ...payload, settings: {} } },
      { key: 'rhythmTemplates', value: { ...payload, rhythmTemplates: [] } },
      { key: 'libraryEnablement', value: { ...payload, libraryEnablement: {} } },
      { key: 'schedulerOutput', value: { ...payload, schedulerOutput: {} } },
      { key: 'taskHistory', value: { ...payload, taskHistory: [] } },
      { key: 'completionLog', value: { ...payload, completionLog: [] } },
      { key: 'startBoostLogs', value: { ...payload, startBoostLogs: [] } },
      { key: 'imports', value: { ...payload, imports: [] } },
      { key: 'restores', value: { ...payload, restores: [] } },
      { key: 'migrationLog', value: { ...payload, migrationLog: [] } },
      { key: 'resetLogs', value: { ...payload, resetLogs: [] } },
      { key: 'devTickets', value: { ...payload, devTickets: [] } },
      { key: 'futureModules', value: { ...payload, futureModules: [] } },
      { key: 'calendarData', value: { ...payload, calendarData: {} } },
      { key: 'rootData', value: { ...payload, rootData: {} } },
      { key: 'lifeRhythm_v146', value: { ...payload, lifeRhythm_v146: { tasks: [] } } },
      {
        key: 'tasks',
        value: {
          ...payload,
          activeTasks: [
            {
              ...payload.activeTasks[0],
              tasks: [],
            },
          ],
        },
      },
    ];

    blockedPayloads.forEach(({ key, value }) => {
      const result = validateActiveTaskBackup(value);

      expect(result.ok, key).toBe(false);
      if (!result.ok) {
        expect(result.errors.join(' ')).toContain(key);
        expect(result.errors.join(' ')).toContain('Active task backup cannot include');
      }
    });
  });

  it('does not read or write localStorage', () => {
    const localStorage = {
      getItem: vi.fn(() => {
        throw new Error('localStorage must not be read');
      }),
      setItem: vi.fn(() => {
        throw new Error('localStorage must not be written');
      }),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    try {
      const result = validateActiveTaskBackup(validPayload());

      expect(result.ok).toBe(true);
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('does not open, write, or delete IndexedDB while building or validating', () => {
    const indexedDB = {
      deleteDatabase: vi.fn(),
      open: vi.fn(),
    };
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: indexedDB,
    });

    try {
      const payload = buildActiveTaskBackupPayload([validActiveTask()], exportedAt);
      const result = parseActiveTaskBackupJson(JSON.stringify(payload));

      expect(result.ok).toBe(true);
      expect(indexedDB.open).not.toHaveBeenCalled();
      expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
