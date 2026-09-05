import Dexie, { type Table } from 'dexie';
import type {
  ActiveTask,
  CompletionLog,
  DevTicket,
  MigrationLog,
  ResetLog,
  RhythmTemplate,
  Settings,
  SoftPlacement,
  StartBoostLog,
  TaskPoolItem,
  TaskHistory,
} from './schemas';
import type { SchedulerPlanStateRecord } from './schedulerPlanStateSchema';

export const DATABASE_NAME = 'life-rhythm-app';
export const DATABASE_VERSION = 4;

const VERSION_3_STORES = {
  settings: 'id, appVersion, updatedAt',
  rhythmTemplates: 'id, source, enabled, area, kind, updatedAt',
  activeTasks: 'id, templateId, source, status, showToday, area, updatedAt',
  taskHistory: 'id, taskId, eventType, occurredAt',
  completionLog: 'id, taskId, templateId, localDate, completedAt',
  resetLog: 'id, localDate, action, occurredAt',
  startBoostLog: 'id, taskId, templateId, barrier, supportId, usedAt',
  devTickets: 'id, status, priority, area, createdAt, updatedAt',
  migrationLog: 'id, sourceKey, status, inspectedAt',
  softPlacements: 'id, taskId, date, blockId, status, placementSource, updatedAt',
  taskPoolItems: 'id, status, source, createdAt, updatedAt, dueAt, notUsefulAfter, bringBackAfter, templateId',
} as const;

export class LifeRhythmDatabase extends Dexie {
  settings!: Table<Settings, string>;
  rhythmTemplates!: Table<RhythmTemplate, string>;
  activeTasks!: Table<ActiveTask, string>;
  taskHistory!: Table<TaskHistory, string>;
  completionLog!: Table<CompletionLog, string>;
  resetLog!: Table<ResetLog, string>;
  startBoostLog!: Table<StartBoostLog, string>;
  devTickets!: Table<DevTicket, string>;
  migrationLog!: Table<MigrationLog, string>;
  softPlacements!: Table<SoftPlacement, string>;
  taskPoolItems!: Table<TaskPoolItem, string>;
  schedulerPlanState!: Table<SchedulerPlanStateRecord, string>;

  constructor(databaseName = DATABASE_NAME) {
    super(databaseName);

    this.version(3).stores(VERSION_3_STORES);
    this.version(DATABASE_VERSION).stores({
      ...VERSION_3_STORES,
      schedulerPlanState: 'id, updatedAt',
    });
  }
}

export function createLifeRhythmDatabase(databaseName?: string) {
  return new LifeRhythmDatabase(databaseName);
}
