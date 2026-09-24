import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  loadExplicitPreferencesResult,
  upsertExplicitPreference,
} from './explicitPreferenceRepository';
import {
  commitExplicitPreferenceDelete,
  commitExplicitPreferenceUpsert,
  explicitPreferenceTargetExpectation,
} from './explicitPreferenceMutationCoordinator';
import { loadSchedulerPlanState, saveSchedulerPlanState } from './schedulerPlanStateRepository';

let namespaceIndex = 0;
const firstTime = '2026-09-24T09:00:00.000Z';
const tiedTime = '2026-09-24T10:00:00.000Z';
const input = {
  id: 'a',
  targetKind: 'area' as const,
  targetValue: 'admin',
  relation: 'prefer' as const,
  days: ['Monday' as const],
  start: '09:00',
  end: '11:00',
};

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`gate7d-pref-mutation-${++namespaceIndex}`),
  );
});

async function seedPlan() {
  const saved = await saveSchedulerPlanState({
    placements: [],
    rejectedExistingPlacements: [],
    unscheduledIntentionIds: [],
    unscheduledRhythmIds: [],
  }, undefined, firstTime);
  expect(saved.ok).toBe(true);
}

async function expectationFor(id: string) {
  const loaded = await loadExplicitPreferencesResult();
  const expectation = explicitPreferenceTargetExpectation(loaded, id);
  if (!expectation) throw new Error('Expected healthy preference state');
  return expectation;
}

describe('Gate 7D1 explicit preference mutation coordination', () => {
  it('rejects a same-timestamp stale save after deleting one preference while another remains', async () => {
    await upsertExplicitPreference(input, undefined, firstTime);
    await upsertExplicitPreference({ ...input, id: 'b', targetValue: 'work' }, undefined, firstTime);
    const staleSaveExpectation = await expectationFor('a');
    const deleteExpectation = await expectationFor('a');

    const deleted = await commitExplicitPreferenceDelete('a', deleteExpectation, undefined, tiedTime);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.removed).toBe(true);

    const stale = await commitExplicitPreferenceUpsert(
      { ...input, relation: 'avoid' },
      staleSaveExpectation,
      undefined,
      tiedTime,
    );
    expect(stale).toMatchObject({ ok: false, conflict: 'stale' });

    const loaded = await loadExplicitPreferencesResult();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.preferences.map((preference) => preference.id)).toEqual(['b']);
  });

  it('preserves independent edits that began from the same collection snapshot', async () => {
    await upsertExplicitPreference(input, undefined, firstTime);
    await upsertExplicitPreference({ ...input, id: 'b', targetValue: 'work' }, undefined, firstTime);
    const expectationA = await expectationFor('a');
    const expectationB = await expectationFor('b');

    const a = await commitExplicitPreferenceUpsert(
      { ...input, relation: 'avoid' },
      expectationA,
      undefined,
      '2026-09-24T10:00:00.001Z',
    );
    const b = await commitExplicitPreferenceUpsert(
      { ...input, id: 'b', targetValue: 'work', relation: 'avoid' },
      expectationB,
      undefined,
      '2026-09-24T10:00:00.002Z',
    );

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const loaded = await loadExplicitPreferencesResult();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.preferences.map((preference) => [preference.id, preference.relation])).toEqual([
      ['a', 'avoid'],
      ['b', 'avoid'],
    ]);
  });

  it('marks an existing private plan for repair in the same committed mutation', async () => {
    await seedPlan();
    const expectation = await expectationFor('a');

    const saved = await commitExplicitPreferenceUpsert(input, expectation, undefined, tiedTime);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.repairAttentionPersisted).toBe(true);

    const plan = await loadSchedulerPlanState();
    expect(plan).toEqual(expect.objectContaining({
      status: 'ok',
      preferenceRepairPendingAt: tiedTime,
    }));
  });

  it('does not require repair attention when no private plan exists', async () => {
    const expectation = await expectationFor('a');
    const saved = await commitExplicitPreferenceUpsert(input, expectation, undefined, tiedTime);

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.repairAttentionPersisted).toBe(false);
    expect((await loadSchedulerPlanState()).status).toBe('missing');
  });

  it('rolls back the preference mutation if repair attention cannot be stored', async () => {
    await seedPlan();
    const expectation = await expectationFor('a');
    vi.spyOn(getCurrentLifeRhythmDatabase().schedulerPlanState, 'update')
      .mockRejectedValueOnce(new Error('synthetic failure'));

    const saved = await commitExplicitPreferenceUpsert(input, expectation, undefined, tiedTime);
    expect(saved.ok).toBe(false);
    expect((await loadExplicitPreferencesResult()).status).toBe('missing');

    const plan = await loadSchedulerPlanState();
    expect(plan.status).toBe('ok');
    if (plan.status !== 'ok') return;
    expect(plan.preferenceRepairPendingAt).toBeUndefined();
  });

  it('does not mark the plan when a missing-target delete is a no-op', async () => {
    await seedPlan();
    const expectation = await expectationFor('a');
    const deleted = await commitExplicitPreferenceDelete('a', expectation, undefined, tiedTime);

    expect(deleted).toEqual({
      ok: true,
      removed: false,
      preferences: [],
      repairAttentionPersisted: false,
    });
    const plan = await loadSchedulerPlanState();
    expect(plan.status).toBe('ok');
    if (plan.status !== 'ok') return;
    expect(plan.preferenceRepairPendingAt).toBeUndefined();
  });
});
