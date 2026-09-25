import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createLifeRhythmDatabase, type LifeRhythmDatabase } from './db';
import { rhythmTemplateSchema } from './schemas';
import { generateRhythmInstancesForHorizon, saveRhythmConfiguration } from './rhythmAuthorityRepository';
import {
  activeTaskIdForRhythmInstance,
  addRhythmToTodayOnce,
  syncScheduledRhythmOccurrencesToToday,
} from './rhythmTodayRepository';
import { updateTaskLifecycleStatus } from './taskLifecycleRepository';
import { deriveDurationLearningEvidence } from './durationLearning';

let index = 0;
const databases: LifeRhythmDatabase[] = [];
const now = '2026-09-25T01:00:00.000Z';

function database() {
  const db = createLifeRhythmDatabase(`gate8a2-rhythm-today-${++index}`);
  databases.push(db);
  return db;
}

async function configure(db: LifeRhythmDatabase, state: 'enabled' | 'disabled' = 'enabled') {
  const template = rhythmTemplateSchema.parse({
    id: 'rhythm-today', source: 'custom', title: 'Today rhythm', area: 'house',
    minimum: { label: 'Minimum action', minutes: 6 }, normal: { label: 'Normal action', minutes: 17 },
    full: { label: 'Full action', minutes: 31 }, enabled: false, createdAt: now, updatedAt: now,
  });
  const result = await saveRhythmConfiguration({
    template, state, frequency: 1, period: 'week', preferredDays: [], preferredTime: 'anytime',
    maxPerDay: 1, timezone: 'Australia/Perth', effectiveFromLocalDate: '2026-09-25', now,
  }, db);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result;
}

async function generated(db: LifeRhythmDatabase) {
  await configure(db);
  const result = await generateRhythmInstancesForHorizon('2026-09-25', '2026-09-27', db, now);
  if (!result.ok || !result.created[0]) throw new Error('Expected generated instance.');
  return result.created[0];
}

function planFor(instanceId: string) {
  return {
    placements: [{
      id: 'placement-a', intentionId: instanceId, targetKind: 'rhythm' as const, rhythmId: instanceId,
      rhythmTemplateId: 'rhythm-today', rhythmPlanId: 'rhythm-plan:rhythm-today',
      rhythmRecurrenceRevisionId: 'rhythm-revision:rhythm-plan%3Arhythm-today:1', rhythmInstanceId: instanceId,
      date: '2026-09-25', start: '09:00', end: '09:17', timezone: 'Australia/Perth',
      origin: 'scheduler' as const, variantKind: 'normal' as const, provenance: ['Test placement.'],
    }],
    unscheduledIntentionIds: [], unscheduledRhythmIds: [], rejectedExistingPlacements: [],
  };
}

afterEach(async () => {
  while (databases.length) {
    const db = databases.pop()!;
    db.close();
    await db.delete();
  }
});

describe('rhythm Today occurrence projection and lifecycle', () => {
  it('requires user-confirmed configuration instead of using an unconfigured legacy template', async () => {
    const db = database();
    await db.rhythmTemplates.put(rhythmTemplateSchema.parse({
      id: 'rhythm-today', source: 'custom', title: 'Legacy rhythm', area: 'house',
      minimum: { label: 'Old minimum', minutes: 5 }, normal: { label: 'Old normal', minutes: 10 },
      full: { label: 'Old full', minutes: 20 }, enabled: false, createdAt: now, updatedAt: now,
    }));
    const result = await addRhythmToTodayOnce('rhythm-today', '2026-09-25', db, now);
    expect(result).toEqual({ ok: false, errors: ['Configure the rhythm durations before adding it to Today.'] });
    expect(await db.activeTasks.count()).toBe(0);
  });

  it('atomically projects an accepted placement into an executable Today task', async () => {
    const db = database();
    const instance = await generated(db);
    const result = await syncScheduledRhythmOccurrencesToToday(planFor(instance.id), '2026-09-25', db, now);
    expect(result.ok).toBe(true);
    const task = await db.activeTasks.get(activeTaskIdForRhythmInstance(instance.id));
    expect(task).toMatchObject({
      sourceRhythmInstanceId: instance.id, templateId: 'rhythm-today', showToday: true,
      minimum: { minutes: 6 }, normal: { minutes: 17 }, full: { minutes: 31 }, plannedVariantKind: 'normal',
    });
    expect(await db.taskPoolItems.count()).toBe(0);
    expect(await db.rhythmInstances.get(instance.id)).toMatchObject({ lifecycleState: 'today', activeTaskId: task?.id });
  });

  it('rolls back every Today projection when one placement has invalid identity', async () => {
    const db = database();
    const instance = await generated(db);
    const validPlan = planFor(instance.id);
    const result = await syncScheduledRhythmOccurrencesToToday({
      ...validPlan,
      placements: [
        ...validPlan.placements,
        { ...validPlan.placements[0], id: 'placement-bad', intentionId: 'missing', rhythmId: 'missing', rhythmInstanceId: 'missing' },
      ],
    }, '2026-09-25', db, now);
    expect(result.ok).toBe(false);
    expect(await db.activeTasks.count()).toBe(0);
    const stored = await db.rhythmInstances.get(instance.id);
    expect(stored?.lifecycleState).toBe('eligible');
    expect(stored?.activeTaskId).toBeUndefined();
  });

  it('routes start, pause, and resume to the linked canonical occurrence', async () => {
    const db = database();
    const instance = await generated(db);
    await syncScheduledRhythmOccurrencesToToday(planFor(instance.id), '2026-09-25', db, now);
    const taskId = activeTaskIdForRhythmInstance(instance.id);
    expect((await updateTaskLifecycleStatus(taskId, 'inProgress', db)).ok).toBe(true);
    expect((await db.rhythmInstances.get(instance.id))?.lifecycleState).toBe('inProgress');
    expect((await updateTaskLifecycleStatus(taskId, 'paused', db)).ok).toBe(true);
    expect((await db.rhythmInstances.get(instance.id))?.lifecycleState).toBe('paused');
    expect((await updateTaskLifecycleStatus(taskId, 'inProgress', db)).ok).toBe(true);
    expect((await db.rhythmInstances.get(instance.id))?.lifecycleState).toBe('inProgress');
  });

  it('records Minimum on the occurrence without completing the template or plan', async () => {
    const db = database();
    const instance = await generated(db);
    await syncScheduledRhythmOccurrencesToToday(planFor(instance.id), '2026-09-25', db, now);
    await updateTaskLifecycleStatus(activeTaskIdForRhythmInstance(instance.id), 'minimumDone', db);
    expect(await db.rhythmInstances.get(instance.id)).toMatchObject({
      lifecycleState: 'inProgress', completionState: 'minimumDone',
    });
    expect((await db.rhythmPlans.toArray())[0].state).toBe('enabled');
    expect((await db.rhythmTemplates.get('rhythm-today'))?.enabled).toBe(false);
  });

  it('completion closes only the occurrence and writes exact factual identity', async () => {
    const db = database();
    const instance = await generated(db);
    await syncScheduledRhythmOccurrencesToToday(planFor(instance.id), '2026-09-25', db, now);
    const taskId = activeTaskIdForRhythmInstance(instance.id);
    await updateTaskLifecycleStatus(taskId, 'inProgress', db);
    await updateTaskLifecycleStatus(taskId, 'done', db);
    expect(await db.rhythmInstances.get(instance.id)).toMatchObject({ lifecycleState: 'closed', completionState: 'done' });
    expect((await db.rhythmPlans.toArray())[0].state).toBe('enabled');
    const events = await db.taskHistory.toArray();
    expect(events.filter((event) => event.eventType === 'taskCompleted')[0]).toMatchObject({
      taskId, templateId: 'rhythm-today', rhythmInstanceId: instance.id,
    });
    expect(deriveDurationLearningEvidence(events as never)).toEqual([]);
  });

  it('skip closes the occurrence and repeated generation creates no catch-up replacement', async () => {
    const db = database();
    const instance = await generated(db);
    await syncScheduledRhythmOccurrencesToToday(planFor(instance.id), '2026-09-25', db, now);
    await updateTaskLifecycleStatus(activeTaskIdForRhythmInstance(instance.id), 'skipped', db);
    const repeated = await generateRhythmInstancesForHorizon('2026-09-25', '2026-09-27', db, now);
    expect(repeated).toEqual({ ok: true, created: [] });
    expect(await db.rhythmInstances.count()).toBe(1);
  });

  it('Add to Today once reuses a matching generated occurrence and remains idempotent', async () => {
    const db = database();
    const instance = await generated(db);
    const first = await addRhythmToTodayOnce('rhythm-today', '2026-09-25', db, now);
    const second = await addRhythmToTodayOnce('rhythm-today', '2026-09-25', db, now);
    expect(first.ok && first.reusedGeneratedOccurrence).toBe(true);
    expect(second.ok && second.alreadyExists).toBe(true);
    expect(await db.activeTasks.count()).toBe(1);
    expect((await db.activeTasks.toArray())[0].sourceRhythmInstanceId).toBe(instance.id);
  });

  it('manual Add to Today uses exact configured variants without enabling or consuming recurrence', async () => {
    const db = database();
    await configure(db, 'disabled');
    const first = await addRhythmToTodayOnce('rhythm-today', '2026-09-25', db, now);
    const second = await addRhythmToTodayOnce('rhythm-today', '2026-09-25', db, now);
    expect(first.ok && first.reusedGeneratedOccurrence).toBe(false);
    expect(second.ok && second.alreadyExists).toBe(true);
    const task = (await db.activeTasks.toArray())[0];
    expect(task).toMatchObject({ minimum: { minutes: 6 }, normal: { minutes: 17 }, full: { minutes: 31 } });
    expect(await db.rhythmInstances.count()).toBe(0);
    expect((await db.rhythmPlans.toArray())[0].state).toBe('disabled');
  });
});
