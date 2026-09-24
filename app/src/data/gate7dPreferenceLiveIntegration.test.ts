import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  commitExplicitPreferenceUpsert,
  explicitPreferenceTargetExpectation,
} from './explicitPreferenceMutationCoordinator';
import {
  EXPLICIT_PREFERENCES_RECORD_ID,
  type ExplicitPreferenceWriteInput,
} from './explicitPreferenceSchema';
import {
  loadExplicitPreferencesResult,
  upsertExplicitPreference,
} from './explicitPreferenceRepository';
import {
  buildCurrentLiveSchedulingContext,
  ensureCurrentPrivatePlan,
  repairCurrentPrivatePlan,
  undoCurrentPrivatePlan,
} from './schedulerPlanCoordinator';
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { taskPoolItemSchema } from './schemas';
import { createDefaultSettings, saveSettings } from './settingsRepository';

let namespaceIndex = 0;
const timestamp = '2026-09-07T00:00:00.000Z';
const options = {
  horizonDays: 1,
  now: new Date(timestamp),
  startDate: '2026-09-07',
  timezone: 'Australia/Perth',
};

const preferenceInput: ExplicitPreferenceWriteInput = {
  id: 'admin-late-morning',
  targetKind: 'area',
  targetValue: 'admin',
  relation: 'prefer',
  days: ['Monday'],
  start: '11:00',
  end: '12:00',
};

function task() {
  return taskPoolItemSchema.parse({
    id: 'admin-task',
    title: 'Admin task',
    area: 'admin',
    source: 'adhoc',
    status: 'captured',
    createdAt: timestamp,
    updatedAt: timestamp,
    minimum: { label: 'Open it', minutes: 5 },
    normal: { label: 'Do it', minutes: 20 },
    full: { label: 'Finish it', minutes: 40 },
  });
}

async function seedPlanningData() {
  const defaults = createDefaultSettings(timestamp);
  const saved = await saveSettings({
    lifeShape: {
      ...defaults.lifeShape,
      timeBlocks: [{
        id: 'monday-open',
        label: 'Monday open',
        type: 'openCapacity',
        schedulerUse: 'available',
        days: ['Monday'],
        start: '09:00',
        end: '12:00',
      }],
    },
    startBoostSafety: defaults.startBoostSafety,
    theme: defaults.theme,
  });
  expect(saved.ok).toBe(true);
  await getCurrentLifeRhythmDatabase().taskPoolItems.put(task());
}

beforeEach(async () => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`gate7d-live-${++namespaceIndex}`),
  );
  await seedPlanningData();
});

describe('Gate 7D1 live explicit preference integration', () => {
  it('loads validated preference rules in the same live scheduling context and changes placement', async () => {
    const before = await buildCurrentLiveSchedulingContext(options);
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    expect((await upsertExplicitPreference(
      preferenceInput,
      undefined,
      '2026-09-06T23:30:00.000Z',
    )).ok).toBe(true);

    const after = await buildCurrentLiveSchedulingContext(options);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.context.canonicalInputSnapshot).not.toBe(before.context.canonicalInputSnapshot);
    expect(after.context.input.preferences).toEqual([
      expect.objectContaining({
        id: preferenceInput.id,
        precedenceSource: 'explicitPersistent',
        activeFrom: '2026-09-06T23:30:00.000Z',
      }),
    ]);

    const plan = await ensureCurrentPrivatePlan(options);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.plan.placements[0]).toMatchObject({
      intentionId: 'admin-task',
      start: '11:00',
      end: '11:20',
    });
  });

  it('fails closed on a malformed preference sidecar instead of scheduling as if no preference exists', async () => {
    await getCurrentLifeRhythmDatabase().table('settings').put({
      id: EXPLICIT_PREFERENCES_RECORD_ID,
      recordType: 'explicitPreferenceStore',
      formatVersion: 99,
    });

    const live = await buildCurrentLiveSchedulingContext(options);
    expect(live.ok).toBe(false);
    if (live.ok) return;
    expect(live.errors.join(' ')).toContain('Saved preferences are invalid');
    expect((await loadSchedulerPlanState()).status).toBe('missing');
  });

  it('restores consumed preference repair authority when an unrelated repair is undone', async () => {
    const initial = await ensureCurrentPrivatePlan(options);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.plan.placements[0]).toMatchObject({ start: '09:00', end: '09:20' });

    const loaded = await loadExplicitPreferencesResult();
    const expectation = explicitPreferenceTargetExpectation(loaded, preferenceInput.id);
    if (!expectation) throw new Error('Expected healthy preference store');

    const mutation = await commitExplicitPreferenceUpsert(
      preferenceInput,
      expectation,
      undefined,
      '2026-09-07T00:00:00.001Z',
    );
    expect(mutation.ok).toBe(true);

    const repaired = await repairCurrentPrivatePlan({
      ...options,
      now: new Date('2026-09-07T00:00:00.002Z'),
      reason: 'Synthetic unrelated repair after a preference mutation.',
      trigger: 'manualReplan',
    });
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.plan.placements[0]).toMatchObject({ start: '11:00', end: '11:20' });
    expect(repaired.plan.repair?.trigger).toBe('manualReplan');
    expect(repaired.plan.repair?.appliedPreferenceRepairTargets).toEqual([
      { targetKind: 'area', targetValue: 'admin' },
    ]);

    const saved = await loadSchedulerPlanState();
    expect(saved.status).toBe('ok');
    if (saved.status !== 'ok') return;
    expect(saved.preferenceRepairPendingAt).toBeUndefined();
    expect(saved.preferenceRepairTargets).toBeUndefined();

    // A later independent preference can become pending before the user undoes
    // this repair. Undo must restore the consumed admin target without dropping
    // this newer work target.
    const afterRepairPreferences = await loadExplicitPreferencesResult();
    const laterExpectation = explicitPreferenceTargetExpectation(
      afterRepairPreferences,
      'work-later',
    );
    if (!laterExpectation) throw new Error('Expected healthy preference store');
    const laterMutation = await commitExplicitPreferenceUpsert(
      {
        id: 'work-later',
        targetKind: 'area',
        targetValue: 'work',
        relation: 'prefer',
        days: ['Monday'],
        start: '15:00',
        end: '16:00',
      },
      laterExpectation,
      undefined,
      '2026-09-07T00:00:00.002Z',
    );
    expect(laterMutation.ok).toBe(true);

    const undone = await undoCurrentPrivatePlan({
      ...options,
      now: new Date('2026-09-07T00:00:00.003Z'),
    });
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.plan.placements[0]).toMatchObject({ start: '09:00', end: '09:20' });

    const afterUndo = await loadSchedulerPlanState();
    expect(afterUndo).toEqual(expect.objectContaining({
      status: 'ok',
      preferenceRepairPendingAt: expect.any(String),
      preferenceRepairTargets: [
        { targetKind: 'area', targetValue: 'admin' },
        { targetKind: 'area', targetValue: 'work' },
      ],
    }));

    const reconciled = await ensureCurrentPrivatePlan({
      ...options,
      now: new Date('2026-09-07T00:00:00.004Z'),
    });
    expect(reconciled.ok).toBe(true);
    if (!reconciled.ok) return;
    expect(reconciled.plan.placements[0]).toMatchObject({ start: '11:00', end: '11:20' });

    const finalState = await loadSchedulerPlanState();
    expect(finalState.status).toBe('ok');
    if (finalState.status !== 'ok') return;
    expect(finalState.preferenceRepairPendingAt).toBeUndefined();
    expect(finalState.preferenceRepairTargets).toBeUndefined();
  });

  it('repairs an accepted plan after a committed preference change and reopens attention after Undo', async () => {
    const initial = await ensureCurrentPrivatePlan(options);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.plan.placements[0]).toMatchObject({ start: '09:00', end: '09:20' });

    const loaded = await loadExplicitPreferencesResult();
    const expectation = explicitPreferenceTargetExpectation(loaded, preferenceInput.id);
    if (!expectation) throw new Error('Expected healthy preference store');

    const mutation = await commitExplicitPreferenceUpsert(
      preferenceInput,
      expectation,
      undefined,
      '2026-09-07T00:00:00.001Z',
    );
    expect(mutation.ok).toBe(true);
    if (!mutation.ok) return;
    expect(mutation.repairAttentionPersisted).toBe(true);

    const pending = await loadSchedulerPlanState();
    expect(pending).toEqual(expect.objectContaining({
      status: 'ok',
      preferenceRepairPendingAt: '2026-09-07T00:00:00.001Z',
    }));

    const repaired = await ensureCurrentPrivatePlan({
      ...options,
      now: new Date('2026-09-07T00:00:00.002Z'),
    });
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.mode).toBe('repaired');
    expect(repaired.plan.placements[0]).toMatchObject({ start: '11:00', end: '11:20' });
    expect(repaired.plan.repair?.trigger).toBe('preferenceChanged');

    const healthy = await loadSchedulerPlanState();
    expect(healthy.status).toBe('ok');
    if (healthy.status !== 'ok') return;
    expect(healthy.preferenceRepairPendingAt).toBeUndefined();

    const undone = await undoCurrentPrivatePlan({
      ...options,
      now: new Date('2026-09-07T00:00:00.003Z'),
    });
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.plan.placements[0]).toMatchObject({ start: '09:00', end: '09:20' });

    const afterUndo = await loadSchedulerPlanState();
    expect(afterUndo).toEqual(expect.objectContaining({
      status: 'ok',
      preferenceRepairPendingAt: expect.any(String),
    }));
  });
});
