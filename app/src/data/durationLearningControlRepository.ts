import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import { SETTINGS_APP_VERSION } from './settingsRepository';
import { strictIsoDateTimeSchema } from './schemas';
import {
  DURATION_LEARNING_CONTROLS_RECORD_ID,
  durationLearningControlSchema,
  durationLearningControlStoreRecordSchema,
  durationLearningControlWriteInputSchema,
  type DurationLearningControl,
  type DurationLearningControlStoreRecord,
  type DurationLearningControlWriteInput,
} from './durationLearningControlSchema';

export type DurationLearningControlStore = {
  read(): Promise<unknown>;
  write(record: DurationLearningControlStoreRecord): Promise<unknown>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
};

export type DurationLearningControlsLoadResult =
  | { status: 'missing'; controls: [] }
  | { status: 'ok'; record: DurationLearningControlStoreRecord; controls: DurationLearningControl[] }
  | { status: 'invalid'; errors: string[] }
  | { status: 'readFailed'; errors: string[] };

export type DurationLearningControlWriteResult =
  | { ok: true; control: DurationLearningControl; controls: DurationLearningControl[] }
  | { ok: false; errors: string[] };

export type DurationLearningControlDeleteResult =
  | { ok: true; removed: boolean; controls: DurationLearningControl[] }
  | { ok: false; errors: string[] };

function failure(message: string) {
  return { ok: false as const, errors: [`durationLearning: ${message}`] };
}

function ordered(controls: readonly DurationLearningControl[]) {
  return [...controls].sort((left, right) => left.templateId.localeCompare(right.templateId));
}

export function createDurationLearningControlStore(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): DurationLearningControlStore {
  const table = database.table<DurationLearningControlStoreRecord, string>('settings');
  return {
    read: () => table.get(DURATION_LEARNING_CONTROLS_RECORD_ID),
    write: (record) => table.put(durationLearningControlStoreRecordSchema.parse(record)),
    transaction: (operation) => database.transaction('rw', database.settings, operation),
  };
}

function recordForWrite(
  controls: DurationLearningControl[],
  timestamp: string,
  previous?: DurationLearningControlStoreRecord,
) {
  return durationLearningControlStoreRecordSchema.safeParse({
    id: DURATION_LEARNING_CONTROLS_RECORD_ID,
    recordType: 'durationLearningControls',
    formatVersion: 1,
    appVersion: SETTINGS_APP_VERSION,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    controls: ordered(controls),
  });
}

export async function loadDurationLearningControlsResult(
  store: DurationLearningControlStore = createDurationLearningControlStore(),
): Promise<DurationLearningControlsLoadResult> {
  let stored: unknown;
  try {
    stored = await store.read();
  } catch {
    return { status: 'readFailed', errors: ['durationLearning: Saved duration controls could not be read.'] };
  }

  if (stored === undefined) return { status: 'missing', controls: [] };
  const parsed = durationLearningControlStoreRecordSchema.safeParse(stored);
  if (!parsed.success) {
    return {
      status: 'invalid',
      errors: ['durationLearning: Saved duration controls are invalid and were left untouched.'],
    };
  }

  const record = { ...parsed.data, controls: ordered(parsed.data.controls) };
  return { status: 'ok', record, controls: record.controls };
}

export async function upsertDurationLearningControl(
  input: DurationLearningControlWriteInput,
  store: DurationLearningControlStore = createDurationLearningControlStore(),
  timestamp = new Date().toISOString(),
): Promise<DurationLearningControlWriteResult> {
  const parsedInput = durationLearningControlWriteInputSchema.safeParse(input);
  if (!parsedInput.success) return failure('Duration control is invalid.');
  if (!strictIsoDateTimeSchema.safeParse(timestamp).success) return failure('Invalid write timestamp.');

  try {
    return await store.transaction(async () => {
      const loaded = await loadDurationLearningControlsResult(store);
      if (loaded.status === 'invalid' || loaded.status === 'readFailed') {
        return { ok: false as const, errors: loaded.errors };
      }
      const previous = loaded.status === 'ok' ? loaded.record : undefined;
      if (previous && Date.parse(timestamp) < Date.parse(previous.updatedAt)) {
        return failure('Write timestamp is older than the saved controls; nothing was changed.');
      }
      const existing = loaded.controls.find((control) => control.templateId === parsedInput.data.templateId);
      const parsedControl = durationLearningControlSchema.safeParse({
        ...parsedInput.data,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
      if (!parsedControl.success) return failure('Duration control timestamps are inconsistent.');

      const controls = ordered([
        ...loaded.controls.filter((control) => control.templateId !== parsedControl.data.templateId),
        parsedControl.data,
      ]);
      const record = recordForWrite(controls, timestamp, previous);
      if (!record.success) return failure('Duration control store validation failed; nothing was changed.');
      await store.write(record.data);
      return { ok: true as const, control: parsedControl.data, controls };
    });
  } catch {
    return failure('Duration control could not be saved on this device.');
  }
}

export async function deleteDurationLearningControl(
  templateId: string,
  store: DurationLearningControlStore = createDurationLearningControlStore(),
  timestamp = new Date().toISOString(),
): Promise<DurationLearningControlDeleteResult> {
  if (!strictIsoDateTimeSchema.safeParse(timestamp).success || !templateId.trim()) {
    return failure('Invalid reset template or timestamp.');
  }

  try {
    return await store.transaction(async () => {
      const loaded = await loadDurationLearningControlsResult(store);
      if (loaded.status === 'invalid' || loaded.status === 'readFailed') {
        return { ok: false as const, errors: loaded.errors };
      }
      if (loaded.status === 'missing') return { ok: true as const, removed: false, controls: [] };
      if (Date.parse(timestamp) < Date.parse(loaded.record.updatedAt)) {
        return failure('Reset timestamp is older than the saved controls; nothing was changed.');
      }
      const controls = loaded.controls.filter((control) => control.templateId !== templateId);
      if (controls.length === loaded.controls.length) {
        return { ok: true as const, removed: false, controls };
      }
      const record = recordForWrite(controls, timestamp, loaded.record);
      if (!record.success) return failure('Duration control store validation failed; nothing was changed.');
      await store.write(record.data);
      return { ok: true as const, removed: true, controls };
    });
  } catch {
    return failure('Duration control could not be reset on this device.');
  }
}
