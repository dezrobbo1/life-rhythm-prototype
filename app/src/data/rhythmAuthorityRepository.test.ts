import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase, type LifeRhythmDatabase } from './db';
import { rhythmTemplateSchema } from './schemas';
import {
  generateRhythmInstancesForHorizon,
  loadRhythmAuthorityResult,
  saveRhythmConfiguration,
  setRhythmPlanState,
} from './rhythmAuthorityRepository';
import { buildAndPersistSchedulerPlan, loadSchedulerPlanState } from './schedulerPlanStateRepository';

let index = 0;
const databases: LifeRhythmDatabase[] = [];
const now = '2026-09-25T02:00:00.000Z';

function database() {
  index += 1;
  const value = createLifeRhythmDatabase(`gate8a2-rhythm-authority-${index}`);
  databases.push(value);
  return value;
}

function template(id = 'rhythm-one') {
  return rhythmTemplateSchema.parse({
    id, source: 'custom', title: 'Truthful rhythm', area: 'house',
    minimum: { label: 'Do the smallest action', minutes: 6 },
    normal: { label: 'Do the normal action', minutes: 14 },
    full: { label: 'Do the full action', minutes: 29 },
    enabled: true, createdAt: now, updatedAt: now,
  });
}

async function configure(db: LifeRhythmDatabase, overrides: Partial<Parameters<typeof saveRhythmConfiguration>[0]> = {}) {
  return saveRhythmConfiguration({
    template: template(), state: 'enabled', frequency: 3, period: 'week', preferredDays: ['Monday'],
    preferredTime: 'morning', maxPerDay: 1, timezone: 'Australia/Perth',
    effectiveFromLocalDate: '2026-09-25', now, ...overrides,
  }, db);
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (databases.length) {
    const db = databases.pop()!;
    db.close();
    await db.delete();
  }
});

describe('durable rhythm authority repository', () => {
  it('persists exact authored variants and deprecates template enabled as authority', async () => {
    const db = database();
    const result = await configure(db);
    expect(result.ok).toBe(true);
    expect(await db.rhythmTemplates.get('rhythm-one')).toMatchObject({
      enabled: false,
      minimum: { label: 'Do the smallest action', minutes: 6 },
      normal: { label: 'Do the normal action', minutes: 14 },
      full: { label: 'Do the full action', minutes: 29 },
    });
  });

  it('marks accepted scheduler authority for repair in the same configuration transaction', async () => {
    const db = database();
    const built = await buildAndPersistSchedulerPlan({
      intentions: [], rhythms: [], externalCommitments: [], capacityWindows: [], placements: [], dayProfiles: [],
    }, db, now);
    expect(built.ok).toBe(true);
    expect((await configure(db)).ok).toBe(true);
    const saved = await loadSchedulerPlanState(db);
    expect(saved.status).toBe('ok');
    if (saved.status === 'ok') {
      expect(saved.rhythmInputRepairPendingAt).toBe(now);
      expect(saved.rhythmInputRepairTargetIds).toContain('template:rhythm-one');
    }
  });

  it('creates and reuses exactly one plan per template', async () => {
    const db = database();
    expect((await configure(db)).ok).toBe(true);
    expect((await configure(db, { frequency: 4, effectiveFromLocalDate: '2026-09-26' })).ok).toBe(true);
    expect(await db.rhythmPlans.count()).toBe(1);
    expect(await db.rhythmRecurrenceRevisions.count()).toBe(2);
  });

  it('keeps template-only edits separate from recurrence revision history', async () => {
    const db = database();
    expect((await configure(db)).ok).toBe(true);
    expect((await configure(db, {
      template: rhythmTemplateSchema.parse({
        ...template(),
        minimum: { label: 'Edited minimum', minutes: 8 },
        normal: { label: 'Edited normal', minutes: 16 },
        full: { label: 'Edited full', minutes: 30 },
      }),
      effectiveFromLocalDate: '2026-09-26',
    })).ok).toBe(true);
    expect(await db.rhythmPlans.count()).toBe(1);
    expect(await db.rhythmRecurrenceRevisions.count()).toBe(1);
    expect(await db.rhythmTemplates.get('rhythm-one')).toMatchObject({
      minimum: { label: 'Edited minimum', minutes: 8 },
      normal: { label: 'Edited normal', minutes: 16 },
      full: { label: 'Edited full', minutes: 30 },
    });
  });

  it('persists pause, disable, and re-enable on the same plan identity', async () => {
    const db = database();
    const saved = await configure(db);
    if (!saved.ok) throw new Error(saved.errors.join(' '));
    const id = saved.plan.id;
    expect((await setRhythmPlanState('rhythm-one', 'paused', db, '2026-09-25T03:00:00.000Z')).ok).toBe(true);
    db.close();
    await db.open();
    expect((await db.rhythmPlans.get(id))?.pausedAt).toBeTruthy();
    expect((await setRhythmPlanState('rhythm-one', 'disabled', db, '2026-09-25T04:00:00.000Z')).ok).toBe(true);
    db.close();
    await db.open();
    expect((await db.rhythmPlans.get(id))?.state).toBe('disabled');
    expect((await setRhythmPlanState('rhythm-one', 'enabled', db, '2026-09-25T05:00:00.000Z')).ok).toBe(true);
    expect(await db.rhythmPlans.count()).toBe(1);
    expect((await db.rhythmPlans.get(id))?.state).toBe('enabled');
  });

  it('generates deterministic instances idempotently across repeated calls', async () => {
    const db = database();
    await configure(db);
    const first = await generateRhythmInstancesForHorizon('2026-09-25', '2026-10-01', db, now);
    db.close();
    await db.open();
    const second = await generateRhythmInstancesForHorizon('2026-09-25', '2026-10-01', db, now);
    expect(first.ok && first.created.length).toBe(6);
    expect(second).toEqual({ ok: true, created: [] });
    expect(await db.rhythmInstances.count()).toBe(6);
  });

  it('paused and disabled plans create no new occurrences', async () => {
    const db = database();
    await configure(db);
    await setRhythmPlanState('rhythm-one', 'paused', db, '2026-09-25T03:00:00.000Z');
    expect(await generateRhythmInstancesForHorizon('2026-09-25', '2026-10-01', db, now)).toEqual({ ok: true, created: [] });
    await setRhythmPlanState('rhythm-one', 'disabled', db, '2026-09-25T04:00:00.000Z');
    expect(await generateRhythmInstancesForHorizon('2026-09-25', '2026-10-01', db, now)).toEqual({ ok: true, created: [] });
  });

  it('rejects a quota that cannot fit inside its period', async () => {
    const db = database();
    const result = await configure(db, { frequency: 8, period: 'week', maxPerDay: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('cannot fit inside every selected period');
    expect(await db.rhythmPlans.count()).toBe(0);
  });

  it('fails closed on malformed plan data', async () => {
    const db = database();
    await db.rhythmTemplates.put(template());
    await db.rhythmPlans.put({ id: 'bad-plan' } as never);
    const read = await loadRhythmAuthorityResult(db);
    expect(read.status).toBe('invalid');
    const write = await configure(db);
    expect(write.ok).toBe(false);
    expect(await db.rhythmRecurrenceRevisions.count()).toBe(0);
  });

  it('allows canonical correction when derived scheduler state is malformed', async () => {
    const db = database();
    await db.schedulerPlanState.put({ id: 'current', broken: true } as never);
    expect((await configure(db)).ok).toBe(true);
    expect(await db.schedulerPlanState.get('current')).toEqual({ id: 'current', broken: true });
  });

  it('rolls back template and revision when a cross-class write fails', async () => {
    const db = database();
    vi.spyOn(db.rhythmPlans, 'put').mockRejectedValueOnce(new Error('disk full'));
    expect((await configure(db)).ok).toBe(false);
    expect(await db.rhythmTemplates.count()).toBe(0);
    expect(await db.rhythmRecurrenceRevisions.count()).toBe(0);
  });

  it('upgrades a v5 database without promoting old enabled flags or existing Today tasks', async () => {
    index += 1;
    const name = `gate8a2-v5-upgrade-${index}`;
    const v5 = new Dexie(name);
    v5.version(5).stores({
      settings: 'id, appVersion, updatedAt', rhythmTemplates: 'id, source, enabled, area, kind, updatedAt',
      activeTasks: 'id, templateId, source, status, showToday, area, updatedAt', taskHistory: 'id, taskId, eventType, occurredAt',
      completionLog: 'id, taskId, templateId, localDate, completedAt', resetLog: 'id, localDate, action, occurredAt',
      startBoostLog: 'id, taskId, templateId, barrier, supportId, usedAt', devTickets: 'id, status, priority, area, createdAt, updatedAt',
      migrationLog: 'id, sourceKey, status, inspectedAt', softPlacements: 'id, taskId, date, blockId, status, placementSource, updatedAt',
      taskPoolItems: 'id, status, source, createdAt, updatedAt, dueAt, notUsefulAfter, bringBackAfter, templateId',
      schedulerPlanState: 'id, updatedAt', calendarSources: 'id, adapterId, updatedAt',
    });
    await v5.table('rhythmTemplates').put(template('legacy-enabled'));
    await v5.table('activeTasks').put({ id: 'legacy-today', templateId: 'legacy-enabled', source: 'library', status: 'active', showToday: true });
    v5.close();
    const upgraded = createLifeRhythmDatabase(name);
    databases.push(upgraded);
    await upgraded.open();
    expect(await upgraded.rhythmTemplates.get('legacy-enabled')).toMatchObject({ enabled: true });
    expect(await upgraded.activeTasks.get('legacy-today')).toMatchObject({ id: 'legacy-today' });
    expect(await upgraded.rhythmPlans.count()).toBe(0);
    expect(await upgraded.rhythmInstances.count()).toBe(0);
  });
});
