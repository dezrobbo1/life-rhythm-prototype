import type { LifeRhythmDatabase } from './db';
import {
  createExplicitPreferenceStore,
  deleteExplicitPreference,
  loadExplicitPreferencesResult,
  resetExplicitPreferences,
  upsertExplicitPreference,
  type ExplicitPreferenceLoadResult,
  type ExplicitPreferenceStore,
} from './explicitPreferenceRepository';
import type {
  ExplicitPreference,
  ExplicitPreferenceWriteInput,
} from './explicitPreferenceSchema';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import { areaSchema } from './schemas';
import {
  CURRENT_SCHEDULER_PLAN_STATE_ID,
  markPreferenceRepairPending,
} from './schedulerPlanStateRepository';
import type { PreferenceRepairTarget } from './schedulerPlanStateSchema';

const STALE_PREFERENCE_COMMAND =
  'explicitPreferences: This preference changed after the edit began. Reload the saved preference and try again.';
const REPAIR_ATTENTION_ERROR =
  'explicitPreferences: Preference change was not saved because plan-repair attention could not be stored safely.';

export type ExplicitPreferenceTargetExpectation = {
  preferenceId: string;
  preference: ExplicitPreference | null;
};

type PreferenceMutationFailure = {
  ok: false;
  errors: string[];
  conflict?: 'stale';
};

export type PreferenceMutationCommitResult =
  | {
      ok: true;
      repairAttentionPersisted: boolean;
      preference?: ExplicitPreference;
      preferences: ExplicitPreference[];
      removed?: boolean;
    }
  | PreferenceMutationFailure;

function stablePreference(preference: ExplicitPreference | null) {
  return preference === null ? null : JSON.stringify(preference);
}

function currentPreference(
  result: Extract<ExplicitPreferenceLoadResult, { status: 'missing' | 'ok' }>,
  preferenceId: string,
) {
  return result.preferences.find((preference) => preference.id === preferenceId) ?? null;
}

export function explicitPreferenceTargetExpectation(
  result: ExplicitPreferenceLoadResult,
  preferenceId: string,
): ExplicitPreferenceTargetExpectation | null {
  if (result.status === 'invalid' || result.status === 'readFailed') return null;
  return {
    preferenceId,
    preference: currentPreference(result, preferenceId),
  };
}

function expectationMatches(
  result: Extract<ExplicitPreferenceLoadResult, { status: 'missing' | 'ok' }>,
  expectation: ExplicitPreferenceTargetExpectation,
) {
  return stablePreference(currentPreference(result, expectation.preferenceId)) ===
    stablePreference(expectation.preference);
}

function monotonicMutationTimestamp(
  result: Extract<ExplicitPreferenceLoadResult, { status: 'missing' | 'ok' }>,
  commandTimestamp: string,
) {
  if (result.status === 'missing') return commandTimestamp;
  return Date.parse(commandTimestamp) < Date.parse(result.record.updatedAt)
    ? result.record.updatedAt
    : commandTimestamp;
}

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

function affectedTargetsForUpsert(
  input: ExplicitPreferenceWriteInput,
  expectation: ExplicitPreferenceTargetExpectation,
): PreferenceRepairTarget[] {
  return [
    ...(expectation.preference ? [targetForPreference(expectation.preference)] : []),
    { targetKind: input.targetKind, targetValue: input.targetValue },
  ];
}

function orderedTargets(targets: readonly PreferenceRepairTarget[]) {
  const byKey = new Map<string, PreferenceRepairTarget>();
  for (const target of targets) {
    byKey.set(`${target.targetKind}:${target.targetValue}`, { ...target });
  }
  return [...byKey.values()].sort((left, right) =>
    left.targetKind.localeCompare(right.targetKind) ||
    left.targetValue.localeCompare(right.targetValue),
  );
}

function conservativeRecoveryTargets(): PreferenceRepairTarget[] {
  return areaSchema.options.map((targetValue) => ({
    targetKind: 'area' as const,
    targetValue,
  }));
}

async function markPlanAttentionIfNeeded(
  database: LifeRhythmDatabase,
  timestamp: string,
  targets: readonly PreferenceRepairTarget[],
) {
  const existingPlan = await database.schedulerPlanState.get(CURRENT_SCHEDULER_PLAN_STATE_ID);
  const marked = await markPreferenceRepairPending(database, timestamp, targets);

  if (!marked.ok || (existingPlan && !marked.persisted)) {
    throw new Error(REPAIR_ATTENTION_ERROR);
  }

  return marked.persisted;
}

export async function commitExplicitPreferenceUpsert(
  input: ExplicitPreferenceWriteInput,
  expectation: ExplicitPreferenceTargetExpectation,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  timestamp = new Date().toISOString(),
): Promise<PreferenceMutationCommitResult> {
  if (input.id !== expectation.preferenceId) {
    return {
      ok: false,
      errors: ['explicitPreferences: Preference expectation does not match the requested preference ID.'],
    };
  }

  let failure: PreferenceMutationFailure | null = null;

  try {
    return await database.transaction(
      'rw',
      database.settings,
      database.schedulerPlanState,
      async () => {
        const store = transactionPassthroughStore(database);
        const loaded = await loadExplicitPreferencesResult(store);
        if (loaded.status === 'invalid' || loaded.status === 'readFailed') {
          return { ok: false, errors: loaded.errors };
        }
        if (!expectationMatches(loaded, expectation)) {
          return { ok: false, conflict: 'stale', errors: [STALE_PREFERENCE_COMMAND] };
        }

        const writeTimestamp = monotonicMutationTimestamp(loaded, timestamp);
        const saved = await upsertExplicitPreference(input, store, writeTimestamp);
        if (!saved.ok) return saved;

        try {
          const repairAttentionPersisted = await markPlanAttentionIfNeeded(
            database,
            writeTimestamp,
            affectedTargetsForUpsert(input, expectation),
          );
          return {
            ...saved,
            repairAttentionPersisted,
          };
        } catch {
          failure = { ok: false, errors: [REPAIR_ATTENTION_ERROR] };
          throw new Error(REPAIR_ATTENTION_ERROR);
        }
      },
    );
  } catch {
    return failure ?? {
      ok: false,
      errors: ['explicitPreferences: Preference could not be saved on this device.'],
    };
  }
}

export async function commitExplicitPreferenceDelete(
  preferenceId: string,
  expectation: ExplicitPreferenceTargetExpectation,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  timestamp = new Date().toISOString(),
): Promise<PreferenceMutationCommitResult> {
  if (preferenceId !== expectation.preferenceId) {
    return {
      ok: false,
      errors: ['explicitPreferences: Preference expectation does not match the requested preference ID.'],
    };
  }

  let failure: PreferenceMutationFailure | null = null;

  try {
    return await database.transaction(
      'rw',
      database.settings,
      database.schedulerPlanState,
      async () => {
        const store = transactionPassthroughStore(database);
        const loaded = await loadExplicitPreferencesResult(store);
        if (loaded.status === 'invalid' || loaded.status === 'readFailed') {
          return { ok: false, errors: loaded.errors };
        }
        if (!expectationMatches(loaded, expectation)) {
          return { ok: false, conflict: 'stale', errors: [STALE_PREFERENCE_COMMAND] };
        }

        const writeTimestamp = monotonicMutationTimestamp(loaded, timestamp);
        const deleted = await deleteExplicitPreference(preferenceId, store, writeTimestamp);
        if (!deleted.ok || !deleted.removed) {
          return {
            ...deleted,
            repairAttentionPersisted: false,
          } as PreferenceMutationCommitResult;
        }

        try {
          const repairAttentionPersisted = await markPlanAttentionIfNeeded(
            database,
            writeTimestamp,
            expectation.preference ? [targetForPreference(expectation.preference)] : [],
          );
          return {
            ...deleted,
            repairAttentionPersisted,
          };
        } catch {
          failure = { ok: false, errors: [REPAIR_ATTENTION_ERROR] };
          throw new Error(REPAIR_ATTENTION_ERROR);
        }
      },
    );
  } catch {
    return failure ?? {
      ok: false,
      errors: ['explicitPreferences: Preference could not be removed on this device.'],
    };
  }
}


export async function commitExplicitPreferenceReset(
  confirmation: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  timestamp = new Date().toISOString(),
): Promise<PreferenceMutationCommitResult> {
  let failure: PreferenceMutationFailure | null = null;

  try {
    return await database.transaction(
      'rw',
      database.settings,
      database.schedulerPlanState,
      async () => {
        const store = transactionPassthroughStore(database);
        const loaded = await loadExplicitPreferencesResult(store);

        if (loaded.status === 'readFailed') {
          return { ok: false, errors: loaded.errors };
        }

        const targets = loaded.status === 'invalid'
          ? conservativeRecoveryTargets()
          : loaded.status === 'ok'
            ? orderedTargets(loaded.preferences.map(targetForPreference))
            : [];

        const deleted = await resetExplicitPreferences(confirmation, store, timestamp);
        if (!deleted.ok) return deleted;

        if (!deleted.removed || targets.length === 0) {
          return {
            ...deleted,
            repairAttentionPersisted: false,
          };
        }

        try {
          const repairAttentionPersisted = await markPlanAttentionIfNeeded(
            database,
            timestamp,
            targets,
          );
          return {
            ...deleted,
            repairAttentionPersisted,
          };
        } catch {
          failure = { ok: false, errors: [REPAIR_ATTENTION_ERROR] };
          throw new Error(REPAIR_ATTENTION_ERROR);
        }
      },
    );
  } catch {
    return failure ?? {
      ok: false,
      errors: ['explicitPreferences: Preferences could not be cleared on this device.'],
    };
  }
}
