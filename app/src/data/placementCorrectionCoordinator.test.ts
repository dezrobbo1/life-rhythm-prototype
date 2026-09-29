import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import { createDefaultSettings, saveSettings } from './settingsRepository';
import { taskPoolItemSchema } from './schemas';
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
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';

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
    );
    expect(moved).toMatchObject({ ok: false, errors: [STALE_PROFILE_RECOVERY_MESSAGE] });
    expect(await db.softPlacements.count()).toBe(0);
  });
});
