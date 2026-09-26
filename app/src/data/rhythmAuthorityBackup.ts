import { z } from 'zod';
import { activeTaskSchema, behaviourEventSchema, rhythmTemplateSchema } from './schemas';
import {
  rhythmInstanceSchema,
  rhythmPlanSchema,
  rhythmRecurrenceRevisionSchema,
} from './rhythmAuthoritySchemas';
import {
  loadRhythmAuthorityResult,
  validateRhythmAuthorityRelationships,
} from './rhythmAuthorityRepository';
import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';

export const RHYTHM_AUTHORITY_BACKUP_FORMAT = 'life-rhythm-rhythm-authority-backup';
export const RHYTHM_AUTHORITY_BACKUP_VERSION = 1;

export const rhythmAuthorityBackupSchema = z.object({
  format: z.literal(RHYTHM_AUTHORITY_BACKUP_FORMAT),
  version: z.literal(RHYTHM_AUTHORITY_BACKUP_VERSION),
  exportedAt: z.string().datetime({ offset: true }),
  templates: z.array(rhythmTemplateSchema),
  plans: z.array(rhythmPlanSchema).optional(),
  revisions: z.array(rhythmRecurrenceRevisionSchema).optional(),
  instances: z.array(rhythmInstanceSchema).optional(),
  activeTasks: z.array(activeTaskSchema).optional(),
  behaviourEvents: z.array(behaviourEventSchema).optional(),
}).strict().superRefine((backup, context) => {
  const unique = (values: Array<{ id: string }>, path: string) => {
    const ids = new Set<string>();
    values.forEach((value, index) => {
      if (ids.has(value.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate ID.', path: [path, index, 'id'] });
      ids.add(value.id);
    });
  };
  unique(backup.templates, 'templates');
  unique(backup.plans ?? [], 'plans');
  unique(backup.revisions ?? [], 'revisions');
  unique(backup.instances ?? [], 'instances');
  unique(backup.activeTasks ?? [], 'activeTasks');
  unique(backup.behaviourEvents ?? [], 'behaviourEvents');
  const duplicateKey = <T,>(values: T[], keyFor: (value: T) => string, path: string) => {
    const keys = new Set<string>();
    values.forEach((value, index) => {
      const key = keyFor(value);
      if (keys.has(key)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate canonical identity.', path: [path, index] });
      keys.add(key);
    });
  };
  duplicateKey(backup.plans ?? [], (plan) => plan.rhythmTemplateId, 'plans');
  duplicateKey(backup.revisions ?? [], (revision) => `${revision.rhythmPlanId}:${revision.revisionNumber}`, 'revisions');
  duplicateKey(backup.instances ?? [], (instance) => instance.deduplicationKey, 'instances');
  const templateIds = new Set(backup.templates.map((item) => item.id));
  const plans = backup.plans;
  const revisions = backup.revisions;
  if (plans) plans.forEach((plan, index) => {
    if (!templateIds.has(plan.rhythmTemplateId)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Referenced template is missing.', path: ['plans', index, 'rhythmTemplateId'] });
    if (revisions && !revisions.some((revision) => revision.id === plan.latestRecurrenceRevisionId && revision.rhythmPlanId === plan.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Latest recurrence revision is missing.', path: ['plans', index, 'latestRecurrenceRevisionId'] });
    }
  });
  if (revisions && plans) revisions.forEach((revision, index) => {
    if (!plans.some((plan) => plan.id === revision.rhythmPlanId)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Referenced plan is missing.', path: ['revisions', index, 'rhythmPlanId'] });
  });
  if (backup.instances && plans && revisions) backup.instances.forEach((instance, index) => {
    if (!templateIds.has(instance.rhythmTemplateId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Referenced template is missing.', path: ['instances', index, 'rhythmTemplateId'] });
    }
    if (!plans.some((plan) => plan.id === instance.rhythmPlanId && plan.rhythmTemplateId === instance.rhythmTemplateId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Plan/template reference is inconsistent.', path: ['instances', index, 'rhythmPlanId'] });
    }
    if (!revisions.some((revision) => revision.id === instance.recurrenceRevisionId && revision.rhythmPlanId === instance.rhythmPlanId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Recurrence revision reference is inconsistent.', path: ['instances', index, 'recurrenceRevisionId'] });
    }
    if (backup.activeTasks && instance.activeTaskId && !backup.activeTasks.some((task) =>
      task.id === instance.activeTaskId && task.sourceRhythmInstanceId === instance.id,
    )) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Linked Today projection is missing.', path: ['instances', index, 'activeTaskId'] });
    }
  });
  if (backup.activeTasks && backup.instances) backup.activeTasks.forEach((task, index) => {
    if (task.sourceRhythmInstanceId && !backup.instances!.some((instance) =>
      instance.id === task.sourceRhythmInstanceId && instance.rhythmTemplateId === task.templateId,
    )) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Referenced rhythm occurrence is missing or inconsistent.', path: ['activeTasks', index, 'sourceRhythmInstanceId'] });
    }
  });
  if (backup.behaviourEvents && backup.instances) backup.behaviourEvents.forEach((event, index) => {
    if (event.rhythmInstanceId && !backup.instances!.some((instance) =>
      instance.id === event.rhythmInstanceId &&
        (event.templateId === undefined || instance.rhythmTemplateId === event.templateId),
    )) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Referenced rhythm occurrence is missing.', path: ['behaviourEvents', index, 'rhythmInstanceId'] });
    }
  });
  if (plans && revisions && backup.instances) {
    validateRhythmAuthorityRelationships(backup.templates, plans, revisions, backup.instances)
      .forEach((message) => context.addIssue({ code: z.ZodIssueCode.custom, message, path: ['references'] }));
  }
});

export type RhythmAuthorityBackupPreview = {
  exportedAt: string;
  templateCount: number;
  planCount: number;
  revisionCount: number;
  instanceCount: number;
  activeTaskCount: number;
  behaviourEventCount: number;
  dependencyState: 'complete' | 'unverified';
};

export function parseRhythmAuthorityBackupJson(json: string):
  | { ok: true; preview: RhythmAuthorityBackupPreview }
  | { ok: false; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, errors: ['Backup JSON is malformed.'] }; }
  const parsed = rhythmAuthorityBackupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'backup'}: ${issue.message}`) };
  }
  return {
    ok: true,
    preview: {
      exportedAt: parsed.data.exportedAt,
      templateCount: parsed.data.templates.length,
      planCount: parsed.data.plans?.length ?? 0,
      revisionCount: parsed.data.revisions?.length ?? 0,
      instanceCount: parsed.data.instances?.length ?? 0,
      activeTaskCount: parsed.data.activeTasks?.length ?? 0,
      behaviourEventCount: parsed.data.behaviourEvents?.length ?? 0,
      dependencyState: parsed.data.plans && parsed.data.revisions && parsed.data.instances &&
        parsed.data.activeTasks && parsed.data.behaviourEvents &&
        !parsed.data.instances.some((instance) => instance.placementId)
        ? 'complete'
        : 'unverified',
    },
  };
}

export async function exportRhythmAuthorityBackup(
  database?: LifeRhythmDatabase,
  exportedAt = new Date().toISOString(),
) {
  const store = database ?? getCurrentLifeRhythmDatabase();
  const result = await loadRhythmAuthorityResult(store);
  if (result.status !== 'ok') throw new Error(result.errors.join(' '));
  const activeTaskRows = await store.activeTasks.toArray();
  const historyRows = await store.taskHistory.toArray();
  const activeTasks = activeTaskRows.flatMap((row) => {
    const parsed = activeTaskSchema.safeParse(row);
    return parsed.success && parsed.data.sourceRhythmInstanceId ? [parsed.data] : [];
  });
  const behaviourEvents = historyRows.flatMap((row) => {
    const parsed = behaviourEventSchema.safeParse(row);
    return parsed.success && parsed.data.rhythmInstanceId ? [parsed.data] : [];
  });
  const payload = rhythmAuthorityBackupSchema.parse({
    format: RHYTHM_AUTHORITY_BACKUP_FORMAT,
    version: RHYTHM_AUTHORITY_BACKUP_VERSION,
    exportedAt,
    templates: result.templates,
    plans: result.plans,
    revisions: result.revisions,
    instances: result.instances,
    activeTasks,
    behaviourEvents,
  });
  const checked = parseRhythmAuthorityBackupJson(JSON.stringify(payload));
  if (!checked.ok) throw new Error(checked.errors.join(' '));
  return {
    fileName: `life-rhythm-rhythm-authority-${exportedAt.slice(0, 10)}.json`,
    json: `${JSON.stringify(payload, null, 2)}\n`,
    preview: {
      exportedAt,
      templateCount: payload.templates.length,
      planCount: payload.plans?.length ?? 0,
      revisionCount: payload.revisions?.length ?? 0,
      instanceCount: payload.instances?.length ?? 0,
      activeTaskCount: payload.activeTasks?.length ?? 0,
      behaviourEventCount: payload.behaviourEvents?.length ?? 0,
      dependencyState: checked.preview.dependencyState,
    },
  };
}
