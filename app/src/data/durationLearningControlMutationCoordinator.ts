import type { LifeRhythmDatabase } from './db';
import {
  createDurationLearningControlStore,
  deleteDurationLearningControl,
  loadDurationLearningControlsResult,
  upsertDurationLearningControl,
  type DurationLearningControlStore,
  type DurationLearningControlsLoadResult,
} from './durationLearningControlRepository';
import type {
  DurationLearningControl,
  DurationLearningControlWriteInput,
} from './durationLearningControlSchema';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';

const STALE_DURATION_CONTROL =
  'durationLearning: This template control changed after editing began. Reload duration learning and try again.';

export type DurationLearningControlExpectation = {
  templateId: string;
  control: DurationLearningControl | null;
};

export type DurationLearningControlMutationResult =
  | {
      ok: true;
      control?: DurationLearningControl;
      controls: DurationLearningControl[];
      removed?: boolean;
    }
  | {
      ok: false;
      errors: string[];
      conflict?: 'stale';
    };

function stableControl(control: DurationLearningControl | null) {
  return control === null ? null : JSON.stringify(control);
}

function currentControl(
  result: Extract<DurationLearningControlsLoadResult, { status: 'missing' | 'ok' }>,
  templateId: string,
) {
  return result.controls.find((control) => control.templateId === templateId) ?? null;
}

export function durationLearningControlExpectation(
  result: DurationLearningControlsLoadResult,
  templateId: string,
): DurationLearningControlExpectation | null {
  if (result.status === 'invalid' || result.status === 'readFailed') return null;
  return {
    templateId,
    control: currentControl(result, templateId),
  };
}

function expectationMatches(
  result: Extract<DurationLearningControlsLoadResult, { status: 'missing' | 'ok' }>,
  expectation: DurationLearningControlExpectation,
) {
  return stableControl(currentControl(result, expectation.templateId)) ===
    stableControl(expectation.control);
}

function monotonicMutationTimestamp(
  result: Extract<DurationLearningControlsLoadResult, { status: 'missing' | 'ok' }>,
  commandTimestamp: string,
) {
  if (result.status === 'missing') return commandTimestamp;
  return Date.parse(commandTimestamp) < Date.parse(result.record.updatedAt)
    ? result.record.updatedAt
    : commandTimestamp;
}

function transactionPassthroughStore(
  database: LifeRhythmDatabase,
): DurationLearningControlStore {
  const store = createDurationLearningControlStore(database);
  return {
    ...store,
    transaction: async (operation) => operation(),
  };
}

export async function commitDurationLearningControlUpsert(
  input: DurationLearningControlWriteInput,
  expectation: DurationLearningControlExpectation,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  timestamp = new Date().toISOString(),
): Promise<DurationLearningControlMutationResult> {
  if (input.templateId !== expectation.templateId) {
    return {
      ok: false,
      errors: ['durationLearning: Control expectation does not match the requested template.'],
    };
  }

  try {
    return await database.transaction('rw', database.settings, async () => {
      const store = transactionPassthroughStore(database);
      const loaded = await loadDurationLearningControlsResult(store);
      if (loaded.status === 'invalid' || loaded.status === 'readFailed') {
        return { ok: false as const, errors: loaded.errors };
      }
      if (!expectationMatches(loaded, expectation)) {
        return { ok: false as const, conflict: 'stale' as const, errors: [STALE_DURATION_CONTROL] };
      }

      return upsertDurationLearningControl(
        input,
        store,
        monotonicMutationTimestamp(loaded, timestamp),
      );
    });
  } catch {
    return {
      ok: false,
      errors: ['durationLearning: Duration control could not be saved on this device.'],
    };
  }
}

export async function commitDurationLearningControlDelete(
  templateId: string,
  expectation: DurationLearningControlExpectation,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  timestamp = new Date().toISOString(),
): Promise<DurationLearningControlMutationResult> {
  if (templateId !== expectation.templateId) {
    return {
      ok: false,
      errors: ['durationLearning: Control expectation does not match the requested template.'],
    };
  }

  try {
    return await database.transaction('rw', database.settings, async () => {
      const store = transactionPassthroughStore(database);
      const loaded = await loadDurationLearningControlsResult(store);
      if (loaded.status === 'invalid' || loaded.status === 'readFailed') {
        return { ok: false as const, errors: loaded.errors };
      }
      if (!expectationMatches(loaded, expectation)) {
        return { ok: false as const, conflict: 'stale' as const, errors: [STALE_DURATION_CONTROL] };
      }

      return deleteDurationLearningControl(
        templateId,
        store,
        monotonicMutationTimestamp(loaded, timestamp),
      );
    });
  } catch {
    return {
      ok: false,
      errors: ['durationLearning: Duration control could not be reset on this device.'],
    };
  }
}
