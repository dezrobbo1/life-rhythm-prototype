import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  commitExplicitPreferenceReset,
  DELETE_EXPLICIT_PREFERENCES_CONFIRMATION,
} from './explicitPreferenceControls';
import {
  EXPLICIT_PREFERENCES_RECORD_ID,
} from './explicitPreferenceSchema';
import {
  loadExplicitPreferencesResult,
  upsertExplicitPreference,
} from './explicitPreferenceRepository';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  loadSchedulerPlanState,
  saveSchedulerPlanState,
} from './schedulerPlanStateRepository';

let namespaceIndex = 0;
const first = '2026-09-24T09:00:00.000Z';
const later = '2026-09-24T10:00:00.000Z';

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`gate7d2-controls-${++namespaceIndex}`),
  );
});

async function seedPlan() {
  const saved = await saveSchedulerPlanState({
    placements: [{
      id: 'scheduler:intention:task-a',
      intentionId: 'task-a',
      targetKind: 'intention',
      date: '2026-09-25',
      start: '09:00',
      end: '09:20',
      timezone: 'Australia/Perth',
      origin: 'scheduler',
      variantKind: 'normal',
      provenance: ['Synthetic automatic placement.'],
    }],
    rejectedExistingPlacements: [],
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
  }, undefined, first);
  expect(saved.ok).toBe(true);
}

describe('Gate 7D2 explicit preference controls', () => {
  it('clears valid preferences and marks the accepted plan with their declared targets', async () => {
    await seedPlan();
    expect((await upsertExplicitPreference({
      id: 'prefer-admin',
      targetKind: 'area',
      targetValue: 'admin',
      relation: 'prefer',
      days: ['Monday'],
      start: '11:00',
      end: '12:00',
    }, undefined, first)).ok).toBe(true);

    const reset = await commitExplicitPreferenceReset(
      DELETE_EXPLICIT_PREFERENCES_CONFIRMATION,
      undefined,
      later,
    );

    expect(reset).toMatchObject({
      ok: true,
      removed: true,
      preferences: [],
      repairAttentionPersisted: true,
    });
    const preferences = await loadExplicitPreferencesResult();
    expect(preferences.status).toBe('ok');
    if (preferences.status !== 'ok') return;
    expect(preferences.preferences).toEqual([]);

    const plan = await loadSchedulerPlanState();
    expect(plan).toEqual(expect.objectContaining({
      status: 'ok',
      preferenceRepairPendingAt: later,
      preferenceRepairTargets: [{ targetKind: 'area', targetValue: 'admin' }],
    }));
  });

  it('uses current automatic placement targets when recovering a malformed preference record', async () => {
    await seedPlan();
    await getCurrentLifeRhythmDatabase().settings.put({
      id: EXPLICIT_PREFERENCES_RECORD_ID,
      recordType: 'explicitPreferenceStore',
      formatVersion: 99,
      secretMalformedField: 'discard me',
    } as never);

    const reset = await commitExplicitPreferenceReset(
      DELETE_EXPLICIT_PREFERENCES_CONFIRMATION,
      undefined,
      later,
    );

    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.removed).toBe(true);

    const plan = await loadSchedulerPlanState();
    expect(plan).toEqual(expect.objectContaining({
      status: 'ok',
      preferenceRepairTargets: [{ targetKind: 'intention', targetValue: 'task-a' }],
    }));

    const preferences = await loadExplicitPreferencesResult();
    expect(preferences.status).toBe('ok');
    if (preferences.status !== 'ok') return;
    expect(preferences.preferences).toEqual([]);
    expect(JSON.stringify(preferences.record)).not.toContain('secretMalformedField');
  });

  it('does not clear anything without the exact confirmation phrase', async () => {
    await upsertExplicitPreference({
      id: 'prefer-admin',
      targetKind: 'area',
      targetValue: 'admin',
      relation: 'prefer',
      days: [],
    }, undefined, first);
    const before = await getCurrentLifeRhythmDatabase().settings.get(EXPLICIT_PREFERENCES_RECORD_ID);

    const reset = await commitExplicitPreferenceReset('DELETE');

    expect(reset.ok).toBe(false);
    expect(await getCurrentLifeRhythmDatabase().settings.get(EXPLICIT_PREFERENCES_RECORD_ID)).toEqual(before);
  });
});
