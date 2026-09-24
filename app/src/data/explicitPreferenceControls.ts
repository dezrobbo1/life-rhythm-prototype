import type { LifeRhythmDatabase } from './db';
import {
  createExplicitPreferenceStore,
  DELETE_EXPLICIT_PREFERENCES_CONFIRMATION,
  loadExplicitPreferencesResult,
  resetExplicitPreferences,
  type ExplicitPreferenceLoadResult,
  type ExplicitPreferenceStore,
} from './explicitPreferenceRepository';
import type { ExplicitPreference } from './explicitPreferenceSchema';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  CURRENT_SCHEDULER_PLAN_STATE_ID,
  markPreferenceRepairPending,
} from './schedulerPlanStateRepository';
import type {
  PreferenceRepairTarget,
  SchedulerPlanStateRecord,
} from './schedulerPlanStateSchema';
import {
  activeTaskSchema,
  areaSchema,
  rhythmTemplateSchema,
  taskPoolItemSchema,
  taskTypeSchema,
} from './schemas';

export { DELETE_EXPLICIT_PREFERENCES_CONFIRMATION };

export type PreferenceTargetOption = {
  kind: 'intention' | 'rhythm' | 'area' | 'taskType';
  value: string;
  label: string;
};

export type PreferenceCatalogueResult =
  | { status: 'ok'; options: PreferenceTargetOption[] }
  | { status: 'readFailed'; errors: string[] };

export type ExplicitPreferenceResetCommitResult =
  | {
      ok: true;
      removed: boolean;
      preferences: ExplicitPreference[];
      repairAttentionPersisted: boolean;
    }
  | { ok: false; errors: string[] };

const titleCase = (value: string) =>
  value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());

function transactionPassthroughStore(database: LifeRhythmDatabase): ExplicitPreferenceStore {
  const store = createExplicitPreferenceStore(database);
  return {
    ...store,
    transaction: async (operation) => operation(),
  };
}

function targetForPreference(
  preference: Pick<ExplicitPreference, 'targetKind' | 'targetValue'>,
): PreferenceRepairTarget {
  return {
    targetKind: preference.targetKind,
    targetValue: preference.targetValue,
  };
}

function dedupeTargets(targets: readonly PreferenceRepairTarget[]) {
  const byKey = new Map<string, PreferenceRepairTarget>();
  for (const target of targets) {
    byKey.set(`${target.targetKind}:${target.targetValue}`, { ...target });
  }
  return [...byKey.values()].sort((left, right) =>
    left.targetKind.localeCompare(right.targetKind) ||
    left.targetValue.localeCompare(right.targetValue),
  );
}

function exactPlanTargets(plan: SchedulerPlanStateRecord | undefined) {
  if (!plan) return [];
  return dedupeTargets(plan.plan.placements
    .filter((placement) => placement.origin === 'scheduler')
    .map((placement): PreferenceRepairTarget => placement.targetKind === 'rhythm'
      ? {
          targetKind: 'rhythm',
          targetValue: placement.rhythmId ?? placement.intentionId,
        }
      : {
          targetKind: 'intention',
          targetValue: placement.intentionId,
        }));
}

export async function loadPreferenceTargetCatalogue(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<PreferenceCatalogueResult> {
  try {
    const [activeRows, poolRows, rhythmRows] = await database.transaction(
      'r',
      database.activeTasks,
      database.taskPoolItems,
      database.rhythmTemplates,
      () => Promise.all([
        database.activeTasks.toArray(),
        database.taskPoolItems.toArray(),
        database.rhythmTemplates.toArray(),
      ]),
    );

    const active = activeTaskSchema.array().safeParse(activeRows);
    const pool = taskPoolItemSchema.array().safeParse(poolRows);
    const rhythms = rhythmTemplateSchema.array().safeParse(rhythmRows);
    if (!active.success || !pool.success || !rhythms.success) {
      return {
        status: 'readFailed',
        errors: ['explicitPreferences: Saved task or rhythm targets could not be read safely.'],
      };
    }

    const intentions = new Map<string, string>();
    for (const item of pool.data) {
      if (item.status !== 'noLongerNeeded') intentions.set(item.id, item.title);
    }
    for (const task of active.data) {
      if (task.status !== 'done') intentions.set(task.id, task.title);
    }

    const options: PreferenceTargetOption[] = [
      ...[...intentions.entries()]
        .sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]))
        .map(([value, label]) => ({ kind: 'intention' as const, value, label })),
      ...rhythms.data
        .filter((rhythm) => rhythm.enabled && !rhythm.archivedAt)
        .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
        .map((rhythm) => ({
          kind: 'rhythm' as const,
          value: `rhythm:${rhythm.id}`,
          label: rhythm.title,
        })),
      ...areaSchema.options.map((value) => ({
        kind: 'area' as const,
        value,
        label: titleCase(value),
      })),
      ...taskTypeSchema.options.map((value) => ({
        kind: 'taskType' as const,
        value,
        label: titleCase(value),
      })),
    ];

    return { status: 'ok', options };
  } catch {
    return {
      status: 'readFailed',
      errors: ['explicitPreferences: Preference targets could not be read on this device.'],
    };
  }
}

export async function commitExplicitPreferenceReset(
  confirmation: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  timestamp = new Date().toISOString(),
): Promise<ExplicitPreferenceResetCommitResult> {
  let failure: { ok: false; errors: string[] } | null = null;

  try {
    return await database.transaction(
      'rw',
      database.settings,
      database.schedulerPlanState,
      async () => {
        const store = transactionPassthroughStore(database);
        const loaded: ExplicitPreferenceLoadResult = await loadExplicitPreferencesResult(store);
        const plan = await database.schedulerPlanState.get(CURRENT_SCHEDULER_PLAN_STATE_ID);
        const targets = loaded.status === 'ok'
          ? dedupeTargets(loaded.preferences.map(targetForPreference))
          : exactPlanTargets(plan);

        const reset = await resetExplicitPreferences(confirmation, store, timestamp);
        if (!reset.ok) return reset;

        let repairAttentionPersisted = false;
        if (reset.removed && plan && targets.length > 0) {
          const marked = await markPreferenceRepairPending(database, timestamp, targets);
          if (!marked.ok || !marked.persisted) {
            failure = {
              ok: false,
              errors: ['explicitPreferences: Preferences were not cleared because plan-repair attention could not be stored safely.'],
            };
            throw new Error('Preference reset repair attention failed.');
          }
          repairAttentionPersisted = true;
        }

        return {
          ...reset,
          repairAttentionPersisted,
        };
      },
    );
  } catch {
    return failure ?? {
      ok: false,
      errors: ['explicitPreferences: Preferences could not be cleared on this device.'],
    };
  }
}
