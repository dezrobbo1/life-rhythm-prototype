import { describe, expect, it } from 'vitest';
import {
  EXPLICIT_PREFERENCES_RECORD_ID, explicitPreferenceSchema,
  explicitPreferenceStoreRecordSchema, explicitPreferenceWriteInputSchema,
} from './explicitPreferenceSchema';

const input = {
  id: 'admin-window', targetKind: 'area', targetValue: 'admin', relation: 'prefer',
  days: ['Saturday'], start: '08:00', end: '12:00',
};
const preference = {
  ...input, source: 'explicitPersistent', provenance: { actor: 'user', mechanism: 'explicitPreference' },
  createdAt: '2026-09-23T09:00:00Z', updatedAt: '2026-09-23T09:00:00Z',
};
const record = {
  id: EXPLICIT_PREFERENCES_RECORD_ID, recordType: 'explicitPreferenceStore', formatVersion: 1,
  appVersion: '1.4.6', createdAt: preference.createdAt, updatedAt: preference.updatedAt, preferences: [preference],
};

describe('Gate 7C strict preference schema', () => {
  it.each([['00:00', '00:01'], ['08:00', '12:00'], ['23:58', '23:59']])(
    'accepts real HH:MM values %s to %s', (start, end) => {
      expect(explicitPreferenceWriteInputSchema.safeParse({ ...input, start, end }).success).toBe(true);
    },
  );
  it.each([
    { id: ' ' }, { targetValue: ' ' }, { targetKind: 'area', targetValue: 'unknown' },
    { targetKind: 'taskType', targetValue: 'unknown' }, { start: '8:00' }, { end: '24:00' },
    { start: '08:60' }, { start: '08:00', end: '08:00' }, { start: '23:00', end: '01:00' },
    { end: undefined }, { start: undefined }, { days: ['Saturday', 'Saturday'] }, { days: ['Funday'] },
    { expiresAt: '2026-02-30T10:00:00Z' }, { expiresAt: '2026-09-23T10:00:00' },
    { confidence: 1 }, { source: 'strongRepeatedAssociation' },
  ])('rejects invalid or undeclared input %j', (change) => {
    expect(explicitPreferenceWriteInputSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it('allows an all-day scope with no window and exact intention/rhythm IDs', () => {
    for (const targetKind of ['intention', 'rhythm']) {
      expect(explicitPreferenceWriteInputSchema.safeParse({
        id: 'p', targetKind, targetValue: 'exact-id', relation: 'avoid',
      }).success).toBe(true);
    }
  });
  it('rejects source/provenance spoofing, extra stored fields, and inconsistent timestamps', () => {
    expect(explicitPreferenceSchema.safeParse(preference).success).toBe(true);
    for (const change of [
      { source: 'currentInstruction' }, { source: 'strongRepeatedAssociation' },
      { provenance: { actor: 'scheduler', mechanism: 'explicitPreference' } },
      { provenance: { ...preference.provenance, reason: 'inferred' } },
      { updatedAt: '2026-09-23T08:00:00Z' }, { expiresAt: preference.createdAt }, { score: 100 },
    ]) expect(explicitPreferenceSchema.safeParse({ ...preference, ...change }).success).toBe(false);
  });
  it('rejects duplicate IDs, unsupported versions, cross-data fields, and inconsistent store lifetimes', () => {
    expect(explicitPreferenceStoreRecordSchema.safeParse(record).success).toBe(true);
    for (const change of [
      { preferences: [preference, preference] }, { formatVersion: 2 }, { id: 'settings' },
      { tasks: [] }, { createdAt: '2026-09-23T10:00:00Z' },
      { preferences: [{ ...preference, updatedAt: '2026-09-23T10:00:00Z' }] },
    ]) expect(explicitPreferenceStoreRecordSchema.safeParse({ ...record, ...change }).success).toBe(false);
  });
});
