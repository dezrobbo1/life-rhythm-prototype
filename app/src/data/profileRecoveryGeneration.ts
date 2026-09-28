import { z } from 'zod';
import type { Table } from 'dexie';
import type { LifeRhythmDatabase } from './db';
import { strictIsoDateTimeSchema } from './schemas';

export const PROFILE_RECOVERY_GENERATION_ID = 'profile:recovery-generation:v1';
export const STALE_PROFILE_RECOVERY_MESSAGE = 'The local profile changed during this action. Try again.';

export const profileRecoveryGenerationSchema = z.object({
  id: z.literal(PROFILE_RECOVERY_GENERATION_ID),
  recordType: z.literal('profileRecoveryGeneration'),
  formatVersion: z.literal(1),
  generation: z.number().int().nonnegative().safe(),
  updatedAt: strictIsoDateTimeSchema,
}).strict();

export class StaleProfileRecoveryError extends Error {
  constructor() { super(STALE_PROFILE_RECOVERY_MESSAGE); }
}

export function profileRecoveryErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StaleProfileRecoveryError ? STALE_PROFILE_RECOVERY_MESSAGE : fallback;
}

/** A missing record in pre-Gate-8A4 databases is generation zero; reads never materialize it. */
export async function readProfileRecoveryGeneration(db: LifeRhythmDatabase): Promise<number> {
  const stored: unknown = await db.settings.get(PROFILE_RECOVERY_GENERATION_ID);
  if (stored === undefined) return 0;
  return profileRecoveryGenerationSchema.parse(stored).generation;
}

/** Call before any read that can influence the later write, including UI/coordinator preflight. */
export const captureProfileRecoveryGeneration = readProfileRecoveryGeneration;

/** Scheduling snapshots already include settings sidecars; identify an epoch
 * conflict separately from an ordinary input change so it is never retried. */
export function recoveryGenerationFromCanonicalSnapshot(snapshot: string): number | null {
  try {
    const settings: unknown = (JSON.parse(snapshot) as { settings?: unknown }).settings;
    if (!Array.isArray(settings)) return null;
    const records = settings.filter((row): row is Record<string, unknown> => row && typeof row === 'object');
    const record = records.find((row) => row.id === PROFILE_RECOVERY_GENERATION_ID);
    return record ? profileRecoveryGenerationSchema.parse(record).generation : 0;
  } catch { return null; }
}

/** The caller's rw transaction MUST include settings. Compare before the first mutation. */
export async function assertProfileRecoveryGeneration(db: LifeRhythmDatabase, expected: number): Promise<void> {
  if (await readProfileRecoveryGeneration(db) !== expected) throw new StaleProfileRecoveryError();
}

export async function profileWriteTransaction<T>(db: LifeRhythmDatabase, tables: Table[],
  operation: () => Promise<T>, expectedGeneration?: number): Promise<T> {
  const expected = expectedGeneration ?? await captureProfileRecoveryGeneration(db);
  return db.transaction('rw', [db.settings, ...tables], async () => {
    await assertProfileRecoveryGeneration(db, expected);
    return operation();
  });
}

/** Must run within the same rw transaction as the complete replace restore. */
export async function advanceProfileRecoveryGeneration(db: LifeRhythmDatabase, current: number): Promise<void> {
  if (!Number.isSafeInteger(current + 1)) throw new Error('Recovery generation exhausted.');
  await db.settings.put({ id: PROFILE_RECOVERY_GENERATION_ID, recordType: 'profileRecoveryGeneration',
    formatVersion: 1, generation: current + 1, updatedAt: new Date().toISOString() } as never);
}
