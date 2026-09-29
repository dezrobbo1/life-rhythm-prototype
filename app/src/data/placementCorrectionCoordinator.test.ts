import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { createDefaultSettings, saveSettings } from './settingsRepository';
import { rhythmTemplateSchema, taskPoolItemSchema } from './schemas';
import { saveRhythmConfiguration } from './rhythmAuthorityRepository';
import {
  checkPortableProfileForRestore,
  exportPortableProfile,
  REPLACE_LOCAL_PROFILE_CONFIRMATION,
  restorePortableProfile,
} from './portableProfileBackup';
import {
  ensureCurrentPrivatePlan,
  repairCurrentPrivatePlan,
} from './schedulerPlanCoordinator';
import {
  movePrivatePlacement,
  protectPrivatePlacement,
  unprotectPrivatePlacement,
} from './placementCorrectionCoordinator';
import {
  advanceProfileRecoveryGeneration,
  readProfileRecoveryGeneration,
  STALE_PROFILE_RECOVERY_MESSAGE,
} from './profileRecoveryGeneration';
import { loadSchedulerPlanState, markSettingsRepairPending } from './schedulerPlanStateRepository';

const timestamp = '2026-09-07T00:00:00.000Z';
const monday = '2026-09-07';
const timezone = 'Australia/Perth';
const now = new Date('2026-09-06T23:30:00.000Z');
let namespaceIndex = 0;

function task() {
  return taskPoolItemSchema.parse({
    id: 'move-task',
    source: 'adhoc',
    title: 'Move this task',
    area: 'admin',
    status: 'captured',
    minimum: { label: 'Open', minutes: 30 },
    normal: { label: 'Do it', minutes: 30 },
    full: { label: 'Finish', minutes: 30 },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function settings(fixedCommitments: unknown[] = []) {
  const defaults = createDefaultSettings(timestamp);
  const result = await saveSettings({
    theme: defaults.theme,
    startBoostSafety: defaults.startBoostSafety,
    lifeShape: {
      ...defaults.lifeShape,
      fixedCommitments,
      timeBlocks: [{
        id: 'monday-capacity',
        label: 'Monday capacity',
        type: 'openCapacity',
        schedulerUse: 'available',
        days: ['Monday'],
        start: '09:00',
        end: '12:00',
      }],
    },
  });
  expect(result.ok).toBe(true);
}

const options = {
  horizonDays: 1,
  now,
  startDate: monday,
  timezone,
};

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate8a5-corrections-${namespaceIndex}`));
});

afterEach(async () => {
  const db = getCurrentLifeRhythmDatabase();
  await db.delete();
  resetCurrentLocalDataNamespace();
});

describe('Gate 8A5 placement corrections', () => {
  it('moves an automatic intention into durable user authority and preserves it across repair', async () => {
    await settings();
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const automatic = built.plan.placements.find((placement) => placement.intentionId === 'move-task');
    expect(automatic).toMatchObject({ origin: 'scheduler', start: '09:00', end: '09:30' });
    if (!automatic) return;

    const generation = await readProfileRecoveryGeneration(db);
    const moved = await movePrivatePlacement(
      automatic,
      { date: monday, start: '10:00' },
      generation,
      options,
    );
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.repairPending).toBe(false);
    expect(moved.placement).toMatchObject({
      correctionKind: 'move',
      placementSource: 'userConfirmed',
      status: 'moved',
      start: '10:00',
      end: '10:30',
      targetKind: 'intention',
    });
    expect(await db.taskPoolItems.get('move-task')).toMatchObject({ status: 'softPlaced' });

    const accepted = (await loadSchedulerPlanState(db));
    expect(accepted.status).toBe('ok');
    if (accepted.status !== 'ok') return;
    expect(accepted.plan.placements).toEqual([
      expect.objectContaining({
        id: moved.placement?.id,
        origin: 'existingUserConfirmed',
        start: '10:00',
        end: '10:30',
      }),
    ]);

    const later = await repairCurrentPrivatePlan({
      ...options,
      reason: 'Unrelated manual refresh.',
      trigger: 'manualReplan',
    });
    expect(later.ok).toBe(true);
    if (later.ok) {
      expect(later.plan.placements).toContainEqual(expect.objectContaining({
        id: moved.placement?.id,
        origin: 'existingUserConfirmed',
        start: '10:00',
      }));
    }
    const events = await db.taskHistory.toArray();
    expect(events).toContainEqual(expect.objectContaining({
      eventType: 'userPlacementMoved',
      action: 'movePlacement',
      placementId: moved.placement?.id,
      taskId: 'move-task',
    }));
  });

  it('rejects an explicit move into a hard fixed commitment without writing a correction', async () => {
    await settings([{
      id: 'appointment',
      label: 'Appointment',
      days: ['Monday'],
      start: '10:00',
      end: '11:00',
      travelMinutes: 0,
      bufferMinutes: 0,
    }]);
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const automatic = built.plan.placements[0];
    expect(automatic.start).toBe('09:00');

    const moved = await movePrivatePlacement(
      automatic,
      { date: monday, start: '10:00' },
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.errors.join(' ')).toMatch(/commitment|outside|time/i);
    expect(await db.softPlacements.count()).toBe(0);
  });

  it('protects a placement, preserves it across ordinary repair, and returns it to automatic authority on Unprotect', async () => {
    await settings();
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const automatic = built.plan.placements[0];

    const protectedResult = await protectPrivatePlacement(
      automatic,
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok || !protectedResult.placement) return;
    expect(protectedResult.placement.correctionKind).toBe('protect');
    expect(protectedResult.plan.placements).toContainEqual(expect.objectContaining({
      id: protectedResult.placement.id,
      origin: 'existingUserConfirmed',
      start: automatic.start,
    }));

    const refreshed = await repairCurrentPrivatePlan({
      ...options,
      reason: 'Ordinary refresh.',
      trigger: 'manualReplan',
    });
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    const kept = refreshed.plan.placements.find((placement) => placement.id === protectedResult.placement?.id);
    expect(kept).toMatchObject({ origin: 'existingUserConfirmed', start: automatic.start });
    if (!kept) return;

    const unprotected = await unprotectPrivatePlacement(
      kept,
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(unprotected.ok).toBe(true);
    if (!unprotected.ok) return;
    expect(unprotected.placement).toBeNull();
    expect(unprotected.plan.placements).toContainEqual(expect.objectContaining({
      id: kept.id,
      origin: 'scheduler',
      start: kept.start,
    }));
    expect(await db.softPlacements.get(protectedResult.placement.id)).toMatchObject({ status: 'removed' });

    const automaticAgain = unprotected.plan.placements.find((placement) => placement.id === kept.id);
    expect(automaticAgain).toBeTruthy();
    if (!automaticAgain) return;
    const movedAfterUnprotect = await movePrivatePlacement(
      automaticAgain,
      { date: monday, start: '10:00' },
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(movedAfterUnprotect.ok).toBe(true);
    if (movedAfterUnprotect.ok) {
      expect(movedAfterUnprotect.placement).toMatchObject({ correctionKind: 'move' });
    }
  });

  it('rejects Unprotect when newer scheduling authority is still pending repair', async () => {
    await settings();
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const protectedResult = await protectPrivatePlacement(
      built.plan.placements[0],
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok || !protectedResult.placement) return;
    const accepted = protectedResult.plan.placements.find((placement) =>
      placement.id === protectedResult.placement?.id,
    );
    expect(accepted).toBeTruthy();
    if (!accepted) return;

    const correctionBefore = await db.softPlacements.get(protectedResult.placement.id);
    const planBefore = await db.schedulerPlanState.get('current');
    expect((await markSettingsRepairPending(db, '2026-09-07T00:20:00.000Z')).ok).toBe(true);

    const result = await unprotectPrivatePlacement(
      accepted,
      await readProfileRecoveryGeneration(db),
      options,
    );

    expect(result).toMatchObject({ ok: false, conflict: 'stale' });
    expect(await db.softPlacements.get(protectedResult.placement.id)).toEqual(correctionBefore);
    expect((await db.schedulerPlanState.get('current'))?.plan).toEqual(planBefore?.plan);
    expect(await db.schedulerPlanState.get('current')).toMatchObject({
      settingsRepairPendingAt: '2026-09-07T00:20:00.000Z',
    });
  });

  it('rejects Unprotect when repair attention appears after its plan read but before commit', async () => {
    await settings();
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const protectedResult = await protectPrivatePlacement(
      built.plan.placements[0],
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok || !protectedResult.placement) return;
    const accepted = protectedResult.plan.placements.find((placement) =>
      placement.id === protectedResult.placement?.id,
    );
    expect(accepted).toBeTruthy();
    if (!accepted) return;

    const correctionBefore = await db.softPlacements.get(protectedResult.placement.id);
    const originalGet = db.softPlacements.get.bind(db.softPlacements);
    let injected = false;
    const getSpy = vi.spyOn(db.softPlacements, 'get').mockImplementation((async (key: string) => {
      const row = await originalGet(key);
      if (!injected) {
        injected = true;
        getSpy.mockRestore();
        expect((await markSettingsRepairPending(db, '2026-09-07T00:21:00.000Z')).ok).toBe(true);
      }
      return row;
    }) as never);

    const result = await unprotectPrivatePlacement(
      accepted,
      await readProfileRecoveryGeneration(db),
      options,
    );

    expect(result).toMatchObject({ ok: false, conflict: 'stale' });
    expect(await db.softPlacements.get(protectedResult.placement.id)).toEqual(correctionBefore);
    expect(await db.schedulerPlanState.get('current')).toMatchObject({
      settingsRepairPendingAt: '2026-09-07T00:21:00.000Z',
    });
  });

  it('keeps a protected hard-conflicted target visible as rejected rather than silently moving it', async () => {
    await settings();
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const protectedResult = await protectPrivatePlacement(
      built.plan.placements[0],
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok || !protectedResult.placement) return;

    await settings([{
      id: 'new-commitment',
      label: 'New commitment',
      days: ['Monday'],
      start: protectedResult.placement.start,
      end: protectedResult.placement.end,
      travelMinutes: 0,
      bufferMinutes: 0,
    }]);
    const repaired = await ensureCurrentPrivatePlan(options);
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.plan.placements.some((placement) => placement.intentionId === 'move-task')).toBe(false);
    expect(repaired.plan.rejectedExistingPlacements).toContainEqual(expect.objectContaining({
      placement: expect.objectContaining({ id: protectedResult.placement.id }),
    }));
    expect(repaired.plan.unscheduledIntentionIds).toContain('move-task');
    expect(await db.softPlacements.get(protectedResult.placement.id)).toMatchObject({ correctionKind: 'protect' });
  });

  it('can remove protection from a hard-conflicted ordinary placement and repair from current reality', async () => {
    await settings();
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const protectedResult = await protectPrivatePlacement(
      built.plan.placements[0],
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok || !protectedResult.placement) return;

    await settings([{
      id: 'new-commitment',
      label: 'New commitment',
      days: ['Monday'],
      start: protectedResult.placement.start,
      end: protectedResult.placement.end,
      travelMinutes: 0,
      bufferMinutes: 0,
    }]);
    const conflicted = await ensureCurrentPrivatePlan(options);
    expect(conflicted.ok).toBe(true);
    if (!conflicted.ok) return;
    const rejected = conflicted.plan.rejectedExistingPlacements.find((item) =>
      item.placement.id === protectedResult.placement?.id,
    )?.placement;
    expect(rejected).toBeTruthy();
    if (!rejected) return;

    const unprotected = await unprotectPrivatePlacement(
      rejected,
      await readProfileRecoveryGeneration(db),
      options,
    );
    expect(unprotected.ok).toBe(true);
    if (!unprotected.ok) return;
    expect(unprotected.placement).toBeNull();
    expect(await db.softPlacements.get(protectedResult.placement.id)).toMatchObject({ status: 'removed' });
    expect(unprotected.plan.placements).toContainEqual(expect.objectContaining({
      intentionId: 'move-task',
      origin: 'scheduler',
    }));
    expect(unprotected.plan.placements.some((placement) =>
      placement.intentionId === 'move-task' &&
      placement.start === protectedResult.placement?.start,
    )).toBe(false);
  });

  it('moves and protects one concrete rhythm occurrence and preserves that authority through portable recovery', async () => {
    await settings();
    const sourceDb = getCurrentLifeRhythmDatabase();
    const template = rhythmTemplateSchema.parse({
      id: 'rhythm-correction',
      source: 'custom',
      title: 'Correct this rhythm',
      area: 'admin',
      minimum: { label: 'Minimum rhythm', minutes: 10 },
      normal: { label: 'Normal rhythm', minutes: 20 },
      full: { label: 'Full rhythm', minutes: 30 },
      enabled: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const configured = await saveRhythmConfiguration({
      template,
      state: 'enabled',
      frequency: 1,
      period: 'day',
      preferredDays: [],
      preferredTime: 'anytime',
      maxPerDay: 1,
      timezone,
      effectiveFromLocalDate: monday,
      now: timestamp,
    }, sourceDb);
    expect(configured.ok).toBe(true);

    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const automatic = built.plan.placements.find((placement) =>
      placement.targetKind === 'rhythm' && placement.rhythmTemplateId === template.id,
    );
    expect(automatic).toMatchObject({
      origin: 'scheduler',
      targetKind: 'rhythm',
      rhythmTemplateId: template.id,
      start: '09:00',
      end: '09:20',
    });
    if (!automatic?.rhythmInstanceId) return;

    const moved = await movePrivatePlacement(
      automatic,
      { date: monday, start: '10:00' },
      await readProfileRecoveryGeneration(sourceDb),
      options,
    );
    expect(moved.ok).toBe(true);
    if (!moved.ok || !moved.placement) return;
    const movedAccepted = moved.plan.placements.find((placement) => placement.id === moved.placement?.id);
    expect(movedAccepted).toMatchObject({
      origin: 'existingUserConfirmed',
      targetKind: 'rhythm',
      rhythmInstanceId: automatic.rhythmInstanceId,
      start: '10:00',
      end: '10:20',
    });
    if (!movedAccepted) return;

    const protectedResult = await protectPrivatePlacement(
      movedAccepted,
      await readProfileRecoveryGeneration(sourceDb),
      options,
    );
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok || !protectedResult.placement) return;
    expect(protectedResult.placement).toMatchObject({
      correctionKind: 'moveProtected',
      targetKind: 'rhythm',
      rhythmTemplateId: automatic.rhythmTemplateId,
      rhythmPlanId: automatic.rhythmPlanId,
      rhythmRecurrenceRevisionId: automatic.rhythmRecurrenceRevisionId,
      rhythmInstanceId: automatic.rhythmInstanceId,
      start: '10:00',
    });
    const correctedInstance = await sourceDb.rhythmInstances.get(automatic.rhythmInstanceId);
    expect(correctedInstance?.lifecycleState).toBe('eligible');
    expect(correctedInstance?.activeTaskId).toBeUndefined();
    expect(correctedInstance?.placementId).toBeUndefined();

    const exported = await exportPortableProfile(sourceDb, '2026-09-07T00:30:00.000Z');
    expect(exported.payload.data.routedRhythmPlacements).toEqual([]);
    expect(exported.payload.data.softPlacements).toContainEqual(expect.objectContaining({
      id: protectedResult.placement.id,
      correctionKind: 'moveProtected',
      rhythmInstanceId: automatic.rhythmInstanceId,
    }));

    sourceDb.close();
    await sourceDb.delete();

    setCurrentLocalDataNamespace(
      createAuthLocalDataNamespace(`gate8a5-corrections-restored-${namespaceIndex}`),
    );
    const checked = await checkPortableProfileForRestore(exported.json);
    expect(checked.ok).toBe(true);
    if (!checked.ok || !('expectation' in checked)) return;
    expect(await restorePortableProfile(
      exported.json,
      checked.expectation,
      REPLACE_LOCAL_PROFILE_CONFIRMATION,
    )).toEqual({ ok: true });

    const restoredDb = getCurrentLifeRhythmDatabase();
    expect(await restoredDb.softPlacements.get(protectedResult.placement.id)).toMatchObject({
      correctionKind: 'moveProtected',
      rhythmInstanceId: automatic.rhythmInstanceId,
      start: '10:00',
    });
    const rebuilt = await ensureCurrentPrivatePlan(options);
    expect(rebuilt.ok).toBe(true);
    if (!rebuilt.ok) return;
    expect(rebuilt.plan.placements.filter((placement) =>
      placement.rhythmInstanceId === automatic.rhythmInstanceId,
    )).toEqual([
      expect.objectContaining({
        id: protectedResult.placement.id,
        origin: 'existingUserConfirmed',
        start: '10:00',
        end: '10:20',
      }),
    ]);
  });

  it('rejects a rendered Move when repair attention appears before its correction commit', async () => {
    await settings();
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const automatic = built.plan.placements[0];

    const originalGet = db.softPlacements.get.bind(db.softPlacements);
    let injected = false;
    const getSpy = vi.spyOn(db.softPlacements, 'get').mockImplementation((async (key: string) => {
      const row = await originalGet(key);
      if (!injected) {
        injected = true;
        getSpy.mockRestore();
        expect((await markSettingsRepairPending(db, '2026-09-07T00:22:00.000Z')).ok).toBe(true);
      }
      return row;
    }) as never);

    const result = await movePrivatePlacement(
      automatic,
      { date: monday, start: '10:00' },
      await readProfileRecoveryGeneration(db),
      options,
    );

    expect(result).toMatchObject({ ok: false, conflict: 'stale' });
    expect(await db.softPlacements.count()).toBe(0);
    expect(await db.schedulerPlanState.get('current')).toMatchObject({
      settingsRepairPendingAt: '2026-09-07T00:22:00.000Z',
    });
  });

  it('rejects a stale correction after the recovery generation changes', async () => {
    await settings();
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(task());
    const built = await ensureCurrentPrivatePlan(options);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const generation = await readProfileRecoveryGeneration(db);
    await db.transaction('rw', db.settings, () => advanceProfileRecoveryGeneration(db, generation));

    const moved = await movePrivatePlacement(
      built.plan.placements[0],
      { date: monday, start: '10:00' },
      generation,
      options,
    );
    expect(moved).toMatchObject({ ok: false, errors: [STALE_PROFILE_RECOVERY_MESSAGE] });
    expect(await db.softPlacements.count()).toBe(0);
  });
});
