import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CURRENT_CALENDAR_SOURCE_ID, calendarSourceRecordSchema } from './calendarSourceSchema';
import { appendBehaviourEvent, createBehaviourEvent } from './behaviourEventRepository';
import {
  BEHAVIOUR_HISTORY_DELETE_CONFIRMATION,
  deleteBehaviourHistory,
  exportBehaviourHistory,
} from './behaviourHistoryControl';
import { createLifeRhythmDatabase } from './db';
import { saveSchedulerPlanState } from './schedulerPlanStateRepository';
import { taskPoolItemSchema } from './schemas';

let testDatabaseIndex = 0;

function createTestDatabase() {
  testDatabaseIndex += 1;
  return createLifeRhythmDatabase(`life-rhythm-behaviour-history-control-test-${testDatabaseIndex}`);
}

describe('behaviour history controls', () => {
  it('exports only Gate 7A ledger records as local JSON', async () => {
    const database = createTestDatabase();

    try {
      await database.taskHistory.put({
        id: 'legacy-history',
        taskId: 'task-one',
        eventType: 'created',
        occurredAt: '2026-09-22T08:00:00.000Z',
        summary: 'Legacy row',
        metadata: {},
      });
      await appendBehaviourEvent(createBehaviourEvent({
        action: 'start',
        after: { minimumAchieved: false, taskStatus: 'inProgress' },
        before: { minimumAchieved: false, taskStatus: 'active' },
        eventType: 'taskStarted',
        occurredAt: '2026-09-22T09:00:00.000Z',
        provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
        source: 'user',
        taskId: 'task-one',
        timezone: 'UTC',
      }), database);
      await database.taskHistory.put({
        id: 'unreadable-behaviour-row',
        recordKind: 'behaviourEvent',
      } as never);

      const exported = await exportBehaviourHistory(database, '2026-09-22T10:00:00.000Z');
      const payload = JSON.parse(exported.json);

      expect(exported).toMatchObject({ eventCount: 2 });
      expect(exported.fileName).toMatch(/^life-rhythm-behaviour-history-/);
      expect(payload).toMatchObject({
        exportedAt: '2026-09-22T10:00:00.000Z',
        recordKind: 'lifeRhythmBehaviourHistoryExport',
        version: 1,
      });
      expect(payload.events).toHaveLength(2);
      expect(payload.events[0]).toMatchObject({ id: expect.any(String), recordKind: 'behaviourEvent' });
      expect(payload.events).toContainEqual({ id: 'unreadable-behaviour-row', recordKind: 'behaviourEvent' });
      expect(exported.json).not.toContain('legacy-history');
    } finally {
      await database.delete();
    }
  });

  it('requires exact confirmation and deletes only Gate 7A ledger rows', async () => {
    const database = createTestDatabase();
    const calendar = calendarSourceRecordSchema.parse({
      adapterId: 'ics',
      id: CURRENT_CALENDAR_SOURCE_ID,
      importedAt: '2026-09-22T08:00:00.000Z',
      label: 'Private calendar',
      source: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',
      updatedAt: '2026-09-22T08:00:00.000Z',
      version: 1,
    });
    const task = taskPoolItemSchema.parse({
      area: 'admin',
      createdAt: '2026-09-22T08:00:00.000Z',
      full: { label: 'Finish it', minutes: 30 },
      id: 'task-one',
      minimum: { label: 'Open it', minutes: 5 },
      normal: { label: 'Do it', minutes: 15 },
      source: 'adhoc',
      status: 'captured',
      title: 'Task one',
      updatedAt: '2026-09-22T08:00:00.000Z',
    });
    const plan = {
      placements: [],
      rejectedExistingPlacements: [],
      unscheduledIntentionIds: [],
      unscheduledRhythmIds: [],
    };

    try {
      await database.calendarSources.put(calendar);
      await database.taskPoolItems.put(task);
      await saveSchedulerPlanState(plan, database, '2026-09-22T08:00:00.000Z');
      await database.taskHistory.put({
        id: 'legacy-history',
        taskId: 'task-one',
        eventType: 'created',
        occurredAt: '2026-09-22T08:00:00.000Z',
        summary: 'Legacy row',
        metadata: {},
      });
      await appendBehaviourEvent(createBehaviourEvent({
        action: 'capture',
        after: { poolStatus: 'captured' },
        eventType: 'taskCaptured',
        occurredAt: '2026-09-22T08:00:00.000Z',
        provenance: { origin: 'userAction', mechanism: 'taskPoolCapture' },
        source: 'user',
        taskId: 'task-one',
        timezone: 'UTC',
      }), database);
      await database.taskHistory.put({
        id: 'unreadable-behaviour-row',
        recordKind: 'behaviourEvent',
      } as never);
      const schedulerBefore = await database.schedulerPlanState.get('current');

      const rejected = await deleteBehaviourHistory('DELETE', database);
      expect(rejected.ok).toBe(false);
      expect(await database.taskHistory.count()).toBe(3);

      const deleted = await deleteBehaviourHistory(BEHAVIOUR_HISTORY_DELETE_CONFIRMATION, database);
      expect(deleted).toEqual({ deletedCount: 2, ok: true });
      expect(await database.taskHistory.toArray()).toEqual([
        expect.objectContaining({ id: 'legacy-history' }),
      ]);
      expect(await database.taskPoolItems.get('task-one')).toEqual(task);
      expect(await database.calendarSources.get(CURRENT_CALENDAR_SOURCE_ID)).toEqual(calendar);
      expect(await database.schedulerPlanState.get('current')).toEqual(schedulerBefore);
    } finally {
      await database.delete();
    }
  });
});
