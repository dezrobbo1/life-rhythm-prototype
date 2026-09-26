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
import type { CalendarSourceRecord } from './calendarSourceSchema';
import type {
  RhythmInstance,
  RhythmPlan,
  RhythmRecurrenceRevision,
} from './rhythmAuthoritySchemas';

export const DATABASE_NAME = 'life-rhythm-app';
export const DATABASE_VERSION = 6;

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

const VERSION_4_STORES = {
  ...VERSION_3_STORES,
  schedulerPlanState: 'id, updatedAt',
} as const;

const VERSION_5_STORES = {
  ...VERSION_4_STORES,
  calendarSources: 'id, adapterId, updatedAt',
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
  calendarSources!: Table<CalendarSourceRecord, string>;
  rhythmPlans!: Table<RhythmPlan, string>;
  rhythmRecurrenceRevisions!: Table<RhythmRecurrenceRevision, string>;
  rhythmInstances!: Table<RhythmInstance, string>;

  constructor(databaseName = DATABASE_NAME) {
    super(databaseName);

    this.version(3).stores(VERSION_3_STORES);
    this.version(4).stores(VERSION_4_STORES);
    this.version(5).stores(VERSION_5_STORES);
    this.version(DATABASE_VERSION).stores({
      ...VERSION_5_STORES,
      rhythmPlans: 'id, &rhythmTemplateId, state, updatedAt',
      rhythmRecurrenceRevisions: 'id, rhythmPlanId, &[rhythmPlanId+revisionNumber], effectiveFromLocalDate, createdAt',
      rhythmInstances: 'id, &deduplicationKey, rhythmTemplateId, rhythmPlanId, recurrenceRevisionId, lifecycleState, completionState, eligibilityStartDate, eligibilityEndDate, activeTaskId, updatedAt',
    }).upgrade(async (transaction) => {
      // v5 could persist template-level rhythm placements whose catalogue
      // enabled flag was never user authority. Preserve the derived plan bytes,
      // but make them ineligible for silent reuse until canonical v6 rhythm
      // authority repairs them. Session/catalogue flags are never promoted.
      await transaction.table('schedulerPlanState').toCollection().modify((record: unknown) => {
        if (typeof record !== 'object' || record === null) return;
        const state = record as Record<string, unknown>;
        const plan = state.plan;
        if (typeof plan !== 'object' || plan === null || !Array.isArray((plan as { placements?: unknown }).placements)) return;
        const legacyTargets = (plan as { placements: Array<Record<string, unknown>> }).placements.flatMap((placement) =>
          placement.targetKind === 'rhythm' && !placement.rhythmInstanceId
            ? [`legacy:${String(placement.rhythmId ?? placement.intentionId)}`]
            : [],
        );
        if (legacyTargets.length === 0 || typeof state.updatedAt !== 'string') return;
        state.rhythmInputRepairPendingAt = state.updatedAt;
        state.rhythmInputRepairTargetIds = [...new Set(legacyTargets)].sort();
      });
    });
  }
}

export function createLifeRhythmDatabase(databaseName?: string) {
  return new LifeRhythmDatabase(databaseName);
}
