import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMissingRhythmInstances } from '../domain/rhythmRecurrence';
import { createAuthLocalDataNamespace, getCurrentLifeRhythmDatabase,
  getLegacyLocalDataNamespace, resetCurrentLocalDataNamespace, setCurrentLocalDataNamespace } from './localDataNamespace';
import { createDefaultSettings, loadSettingsResult, saveSettings } from './settingsRepository';
import { activeTaskSchema, behaviourEventSchema, rhythmTemplateSchema, softPlacementSchema,
  taskPoolItemSchema } from './schemas';
import { rhythmPlanSchema, rhythmRecurrenceRevisionSchema } from './rhythmAuthoritySchemas';
import { createExplicitPreferenceStore, loadExplicitPreferencesResult, upsertExplicitPreference } from './explicitPreferenceRepository';
import { createDurationLearningControlStore, loadDurationLearningControlsResult,
  upsertDurationLearningControl } from './durationLearningControlRepository';
import { loadRhythmAuthorityResult } from './rhythmAuthorityRepository';
import { loadActiveTodayTasksResult } from './activeTaskRepository';
import { loadTaskPoolItemsResult } from './taskPoolRepository';
import { loadBehaviourEventsResult } from './behaviourEventRepository';
import { loadCalendarSource, readPersistedCalendarEvents } from './calendarSourceRepository';
import { confirmTaskPoolSoftPlacement } from './taskSoftPlacementRepository';
import { buildCurrentLiveSchedulingContext, ensureCurrentPrivatePlan } from './schedulerPlanCoordinator';
import { CURRENT_CALENDAR_SOURCE_ID } from './calendarSourceSchema';
import {
  checkPortableProfileForRestore, checkPortableProfileJson, exportPortableProfile,
  REPLACE_LOCAL_PROFILE_CONFIRMATION, restorePortableProfile,
} from './portableProfileBackup';

const timestamp = '2026-09-25T00:00:00.000Z';
const namespaceA = createAuthLocalDataNamespace('portable-a');
const namespaceB = createAuthLocalDataNamespace('portable-b');
const namespaceC = createAuthLocalDataNamespace('portable-c');
const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:busy',
  'DTSTART:20260928T010000Z', 'DTEND:20260928T020000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const template = rhythmTemplateSchema.parse({ id: 'rhythm', source: 'custom', title: 'Paperwork', area: 'house',
  minimum: { label: 'Quick', minutes: 5 }, normal: { label: 'Normal', minutes: 20 },
  full: { label: 'Full', minutes: 35 }, enabled: true, createdAt: timestamp, updatedAt: timestamp });
const plan = rhythmPlanSchema.parse({ id: 'plan', rhythmTemplateId: template.id, state: 'enabled',
  latestRecurrenceRevisionId: 'revision', initialEffectiveFromLocalDate: '2026-09-25', preferredTime: 'anytime',
  timezone: 'Australia/Perth', missedOccurrencePolicy: 'skip', planningMode: 'automaticPrivate',
  createdAt: timestamp, updatedAt: timestamp });
const revision = rhythmRecurrenceRevisionSchema.parse({ id: 'revision', rhythmPlanId: plan.id, revisionNumber: 1,
  effectiveFromLocalDate: '2026-09-25', timezone: 'Australia/Perth',
  rule: { frequency: 1, period: 'week', preferredDays: [], maxPerDay: 1 }, createdAt: timestamp });

let exported: string;
beforeEach(async () => {
  resetCurrentLocalDataNamespace();
  for (const namespace of [namespaceA, namespaceB, namespaceC, getLegacyLocalDataNamespace()]) {
    setCurrentLocalDataNamespace(namespace);
    const db = getCurrentLifeRhythmDatabase();
    await db.delete();
    await db.open();
  }
  setCurrentLocalDataNamespace(namespaceA);
  const db = getCurrentLifeRhythmDatabase();
  const settings = createDefaultSettings(timestamp);
  expect((await saveSettings({ theme: 'clear', lifeShape: settings.lifeShape,
    startBoostSafety: settings.startBoostSafety,
    dayProfiles: settings.dayProfiles.map((profile) => ({ ...profile, usableDay: { start: '06:30', end: '22:00' } })),
    activatePlanningDay: true }, db)).ok).toBe(true);
  await db.rhythmTemplates.put(template);
  await db.rhythmPlans.put(plan);
  await db.rhythmRecurrenceRevisions.put(revision);
  const instance = buildMissingRhythmInstances({ template, plan, revisions: [revision], existing: [],
    horizonStartDate: '2026-09-25', horizonEndDate: '2026-09-25', createdAt: timestamp })[0];
  await db.rhythmInstances.put(instance);
  await db.activeTasks.put(activeTaskSchema.parse({ id: 'today', source: 'adhoc', title: 'Call home', area: 'house',
    minimum: { label: 'Call', minutes: 5 }, normal: { label: 'Call', minutes: 15 },
    full: { label: 'Call', minutes: 30 }, showToday: true, createdAt: timestamp, updatedAt: timestamp }));
  await db.taskPoolItems.put(taskPoolItemSchema.parse({ id: 'pool', source: 'adhoc', title: 'Plan shopping', area: 'house',
    minimum: { label: 'List', minutes: 5 }, normal: { label: 'Shop', minutes: 20 },
    full: { label: 'Shop', minutes: 30 }, createdAt: timestamp, updatedAt: timestamp }));
  await db.softPlacements.put(softPlacementSchema.parse({ id: 'placement', taskId: 'today',
    taskTitleSnapshot: 'Call home', date: '2026-09-28', blockId: 'block', blockLabelSnapshot: 'Home',
    start: '10:00', end: '10:15', placementSource: 'userConfirmed', status: 'planned',
    createdAt: timestamp, updatedAt: timestamp }));
  await upsertExplicitPreference({ id: 'prefer', targetKind: 'rhythm', targetValue: 'rhythm:rhythm',
    relation: 'prefer', days: [], start: '09:00', end: '11:00' }, createExplicitPreferenceStore(db), timestamp);
  await upsertDurationLearningControl({ templateId: 'rhythm', mode: 'override', overrideMinutes: 27 },
    createDurationLearningControlStore(db), timestamp);
  await db.taskHistory.put(behaviourEventSchema.parse({ recordKind: 'behaviourEvent', version: 1,
    id: 'fact', eventType: 'taskStarted', occurredAt: timestamp, localDate: '2026-09-25',
    timezone: 'Australia/Perth', taskId: 'today', source: 'user', action: 'start',
    provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
    before: { taskStatus: 'active', minimumAchieved: false },
    after: { taskStatus: 'inProgress', minimumAchieved: false } }));
  await db.calendarSources.put({ id: CURRENT_CALENDAR_SOURCE_ID, adapterId: 'ics', version: 2,
    label: 'Personal calendar', source: calendar, importedAt: timestamp, updatedAt: timestamp,
    beforeBusyMinutes: 10, afterBusyMinutes: 15 });
  exported = (await exportPortableProfile()).json;
});
afterEach(() => { vi.restoreAllMocks(); resetCurrentLocalDataNamespace(); });

describe('Gate 8A4 portable canonical profile', () => {
  it('exports A read-only and restores A into B through normal repositories, preserving duration control and preferences', async () => {
    const aBefore = await exportPortableProfile(undefined, timestamp);
    setCurrentLocalDataNamespace(namespaceB);
    const checked = await checkPortableProfileForRestore(exported);
    expect(checked).toMatchObject({ ok: true, hasData: false, preview: { today: 1, pool: 1,
      rhythms: 1, instances: 1, preferences: 1, durationControls: 1, behaviourEvents: 1,
      calendarPresent: true } });
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    expect(await restorePortableProfile(exported, checked.expectation, '')).toEqual({ ok: true });
    const db = getCurrentLifeRhythmDatabase();
    expect((await loadSettingsResult(db, { persistMigration: false })).settings.theme).toBe('clear');
    expect((await loadSettingsResult(db, { persistMigration: false })).settings.dayProfileMigrationState.reviewState).toBe('reviewedAndEnabled');
    expect((await loadActiveTodayTasksResult(db)).status).toBe('ok');
    expect((await loadTaskPoolItemsResult(db)).status).toBe('ok');
    expect((await loadRhythmAuthorityResult(db)).status).toBe('ok');
    expect((await loadBehaviourEventsResult(db)).status).toBe('ok');
    expect((await loadExplicitPreferencesResult(createExplicitPreferenceStore(db)))).toMatchObject({ status: 'ok', preferences: [{ id: 'prefer' }] });
    expect((await loadDurationLearningControlsResult(createDurationLearningControlStore(db)))).toMatchObject({ status: 'ok', controls: [{ templateId: 'rhythm', overrideMinutes: 27 }] });
    expect((await loadCalendarSource(db))).toMatchObject({ status: 'ok', record: { beforeBusyMinutes: 10, afterBusyMinutes: 15 } });
    expect((await readPersistedCalendarEvents({ targetTimezone: 'Australia/Perth',
      windowStartDate: '2026-09-28', windowEndDate: '2026-09-28' }, db)).status).toBe('ok');
    expect(await db.schedulerPlanState.count()).toBe(0);
    const live = await buildCurrentLiveSchedulingContext({ readOnly: true,
      now: new Date('2026-09-28T08:00:00.000Z'), timezone: 'Australia/Perth', horizonDays: 1 });
    expect(live.ok, JSON.stringify(live)).toBe(true);
    if (live.ok) {
      expect(live.context.input.externalCommitments.some((item) => item.sourceId === 'busy')).toBe(true);
      expect(live.context.input.preferences?.length).toBeGreaterThan(0);
      expect(live.context.durationLearningApplied).toEqual(expect.arrayContaining([
        expect.objectContaining({ templateId: 'rhythm', source: 'userOverride', schedulerMinutes: 27 }),
      ]));
      expect(live.context.input.candidateIntervals?.length).toBeGreaterThan(0);
    }
    const bBackup = await exportPortableProfile(undefined, timestamp);
    expect(bBackup.payload.data).toEqual(aBefore.payload.data);
    const rebuilt = await ensureCurrentPrivatePlan({ now: new Date('2026-09-28T08:00:00.000Z'), timezone: 'Australia/Perth' });
    expect(rebuilt.ok, JSON.stringify(rebuilt)).toBe(true);
    setCurrentLocalDataNamespace(namespaceA);
    expect((await exportPortableProfile(undefined, timestamp)).payload.data).toEqual(aBefore.payload.data);
  });

  it('requires confirmation, replaces all canonical classes and clears the old derived plan', async () => {
    setCurrentLocalDataNamespace(namespaceB);
    const db = getCurrentLifeRhythmDatabase();
    await db.activeTasks.put(activeTaskSchema.parse({ id: 'old', source: 'adhoc', title: 'Old', area: 'house',
      minimum: { label: 'Old', minutes: 5 }, normal: { label: 'Old', minutes: 5 }, full: { label: 'Old', minutes: 5 },
      createdAt: timestamp, updatedAt: timestamp }));
    await db.schedulerPlanState.put({ id: 'current', updatedAt: timestamp } as never);
    const checked = await checkPortableProfileForRestore(exported);
    expect(checked).toMatchObject({ ok: true, hasData: true });
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    expect((await restorePortableProfile(exported, checked.expectation, '')).ok).toBe(false);
    expect(await db.activeTasks.get('old')).toBeTruthy();
    expect(await restorePortableProfile(exported, checked.expectation, REPLACE_LOCAL_PROFILE_CONFIRMATION)).toEqual({ ok: true });
    expect(await db.activeTasks.get('old')).toBeUndefined();
    expect(await db.schedulerPlanState.count()).toBe(0);
  });

  it('rejects a stale preview without changing any canonical or derived row', async () => {
    setCurrentLocalDataNamespace(namespaceB);
    const checked = await checkPortableProfileForRestore(exported);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(taskPoolItemSchema.parse({ id: 'later', source: 'adhoc', title: 'Later', area: 'house',
      minimum: { label: 'Later', minutes: 5 }, normal: { label: 'Later', minutes: 5 }, full: { label: 'Later', minutes: 5 },
      createdAt: timestamp, updatedAt: timestamp }));
    expect((await restorePortableProfile(exported, checked.expectation, REPLACE_LOCAL_PROFILE_CONFIRMATION)).ok).toBe(false);
    expect(await db.taskPoolItems.get('later')).toBeTruthy();
    expect(await db.settings.count()).toBe(0);
  });

  it('rejects an empty destination preview carried into a different empty namespace', async () => {
    setCurrentLocalDataNamespace(namespaceB);
    const checked = await checkPortableProfileForRestore(exported);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    expect(checked.hasData).toBe(false);
    setCurrentLocalDataNamespace(namespaceC);
    expect((await restorePortableProfile(exported, checked.expectation, '')).ok).toBe(false);
    expect(await getCurrentLifeRhythmDatabase().settings.count()).toBe(0);
  });

  it('rolls back a mid-transaction write failure', async () => {
    setCurrentLocalDataNamespace(namespaceB);
    const db = getCurrentLifeRhythmDatabase();
    await db.settings.put(createDefaultSettings(timestamp));
    const checked = await checkPortableProfileForRestore(exported);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    const before = await db.settings.toArray();
    vi.spyOn(db.rhythmPlans, 'bulkPut').mockRejectedValueOnce(new Error('injected failure'));
    expect((await restorePortableProfile(exported, checked.expectation, REPLACE_LOCAL_PROFILE_CONFIRMATION)).ok).toBe(false);
    expect(await db.settings.toArray()).toEqual(before);
    expect(await db.activeTasks.count()).toBe(0);
  });

  it('rejects malformed, unknown, duplicate, broken-reference and over-budget calendar artifacts', async () => {
    expect(checkPortableProfileJson('{').ok).toBe(false);
    const payload = JSON.parse(exported);
    const wrongSettingsId = JSON.stringify({ ...payload, data: { ...payload.data,
      settings: { ...payload.data.settings, id: 'not-settings' } } });
    expect(checkPortableProfileJson(wrongSettingsId).ok).toBe(false);
    const validPreview = await checkPortableProfileForRestore(exported);
    if (!validPreview.ok || !('expectation' in validPreview)) throw new Error('Check failed');
    const priorSettings = await getCurrentLifeRhythmDatabase().settings.toArray();
    expect((await restorePortableProfile(wrongSettingsId, validPreview.expectation,
      REPLACE_LOCAL_PROFILE_CONFIRMATION)).ok).toBe(false);
    expect(await getCurrentLifeRhythmDatabase().settings.toArray()).toEqual(priorSettings);
    expect(checkPortableProfileJson(JSON.stringify({ ...payload, appVersion: 'future-app-with-v1-format' })).ok).toBe(true);
    expect(checkPortableProfileJson(JSON.stringify({ ...payload, formatVersion: 2 })).ok).toBe(false);
    expect(checkPortableProfileJson(JSON.stringify({ ...payload, schedulerPlanState: [] })).ok).toBe(false);
    expect(checkPortableProfileJson(JSON.stringify({ ...payload, data: { ...payload.data,
      activeTasks: [payload.data.activeTasks[0], payload.data.activeTasks[0]] } })).ok).toBe(false);
    expect(checkPortableProfileJson(JSON.stringify({ ...payload, data: { ...payload.data,
      rhythmPlans: [{ ...payload.data.rhythmPlans[0], latestRecurrenceRevisionId: 'missing' }] } })).ok).toBe(false);
    expect(checkPortableProfileJson(JSON.stringify({ ...payload, data: { ...payload.data,
      calendarSource: { ...payload.data.calendarSource,
        source: calendar.replace('DTEND:20260928T020000Z', 'DURATION:P1000000D') } } })).ok).toBe(false);
  });

  it('does not omit an unreadable behaviour row or invalid destination sidecar', async () => {
    const db = getCurrentLifeRhythmDatabase();
    await db.taskHistory.put({ id: 'broken', recordKind: 'behaviourEvent' } as never);
    await expect(exportPortableProfile()).rejects.toThrow('Unreadable behaviour');
    await db.taskHistory.put({ id: 'kind-missing', eventType: 'taskStarted' } as never);
    await expect(exportPortableProfile()).rejects.toThrow('Unreadable behaviour');
    setCurrentLocalDataNamespace(namespaceB);
    await getCurrentLifeRhythmDatabase().settings.put({ id: 'learning:duration-controls:v1', controls: 'wrong' } as never);
    expect((await checkPortableProfileForRestore(exported)).ok).toBe(false);
  });

  it('preserves historical references and a duration control whose original template is no longer present', async () => {
    const db = getCurrentLifeRhythmDatabase();
    await upsertDurationLearningControl({ templateId: 'archived-template', mode: 'disabled' },
      createDurationLearningControlStore(db), timestamp);
    const existing = await db.taskHistory.get('fact');
    await db.taskHistory.put(behaviourEventSchema.parse({ ...existing,
      rhythmInstanceId: 'historical-instance', templateId: 'archived-template' }));
    const today = await db.activeTasks.get('today');
    await db.activeTasks.put(activeTaskSchema.parse({ ...today, id: 'library-archived',
      source: 'library', templateId: 'archived-template' }));
    const backup = (await exportPortableProfile()).json;
    setCurrentLocalDataNamespace(namespaceB);
    const checked = await checkPortableProfileForRestore(backup);
    expect(checked.ok).toBe(true);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    expect(await restorePortableProfile(backup, checked.expectation, '')).toEqual({ ok: true });
    const restored = getCurrentLifeRhythmDatabase();
    const controls = await loadDurationLearningControlsResult(createDurationLearningControlStore(restored));
    const facts = await loadBehaviourEventsResult(restored);
    if (controls.status !== 'ok' || facts.status !== 'ok') throw new Error('Normal repositories did not read restored facts');
    expect(controls.controls)
      .toEqual(expect.arrayContaining([expect.objectContaining({ templateId: 'archived-template', mode: 'disabled' })]));
    expect(facts.items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ rhythmInstanceId: 'historical-instance' })]));
  });

  it('backs up and restores a real confirmed Held-item placement without a Today task', async () => {
    const db = getCurrentLifeRhythmDatabase();
    const original = await db.taskPoolItems.get('pool');
    await db.taskPoolItems.put(taskPoolItemSchema.parse({ ...original, id: 'held-placement' }));
    expect(await confirmTaskPoolSoftPlacement({ id: 'held-placement-record', taskId: 'held-placement',
      blockId: 'held-block', blockLabel: 'Open', date: '2026-09-29',
      blockStart: '09:00', blockEnd: '09:20' }, db)).toMatchObject({ ok: true });
    expect(await db.activeTasks.get('held-placement')).toBeUndefined();
    const backup = (await exportPortableProfile()).json;
    setCurrentLocalDataNamespace(namespaceB);
    const checked = await checkPortableProfileForRestore(backup);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    expect(await restorePortableProfile(backup, checked.expectation, '')).toEqual({ ok: true });
    expect((await getCurrentLifeRhythmDatabase().softPlacements.get('held-placement-record'))?.taskId).toBe('held-placement');
    expect((await loadTaskPoolItemsResult(getCurrentLifeRhythmDatabase())).status).toBe('ok');
  });

  it('rejects unreadable active-task sources and colliding visible placements before restore', async () => {
    const payload = JSON.parse(exported);
    const placement = payload.data.softPlacements[0];
    const changed = (data: Record<string, unknown>) => JSON.stringify({ ...payload, data: { ...payload.data, ...data } });
    expect(checkPortableProfileJson(changed({ activeTasks: [{ ...payload.data.activeTasks[0], source: 'custom' }] })).ok).toBe(false);
    expect(checkPortableProfileJson(changed({ softPlacements: [placement,
      { ...placement, id: 'second', blockId: 'other-block' }] })).ok).toBe(false);
    expect(checkPortableProfileJson(changed({ softPlacements: [placement,
      { ...placement, id: 'third', taskId: 'pool' }] })).ok).toBe(false);
  });

  it('rejects a closed rhythm instance linked to a visible generated Today task', async () => {
    const db = getCurrentLifeRhythmDatabase();
    const instance = await db.rhythmInstances.toCollection().first();
    const today = await db.activeTasks.get('today');
    if (!instance || !today) throw new Error('Fixture is missing');
    await db.activeTasks.put(activeTaskSchema.parse({ ...today, id: 'generated', source: 'library',
      templateId: 'rhythm', sourceRhythmInstanceId: instance.id }));
    await db.rhythmInstances.put({ ...instance, activeTaskId: 'generated', lifecycleState: 'today',
      planningState: 'today', completionState: 'notStarted' });
    const valid = (await exportPortableProfile()).payload;
    const tampered = { ...valid, data: { ...valid.data, rhythmInstances: valid.data.rhythmInstances.map((item) =>
      item.id === instance.id ? { ...item, lifecycleState: 'closed', planningState: 'closed', completionState: 'done' } : item) } };
    expect(checkPortableProfileJson(JSON.stringify(tampered)).ok).toBe(false);
  });

  it('does not down-convert unknown day-profile foundation fields or parse oversized artifacts', async () => {
    const db = getCurrentLifeRhythmDatabase();
    const foundation = await db.settings.get('dayProfileFoundation');
    await db.settings.put({ ...foundation, newAuthorityFromLaterBuild: true } as never);
    await expect(exportPortableProfile()).rejects.toThrow('foundation');
    const oversized = checkPortableProfileJson(' '.repeat(16 * 1024 * 1024 + 1));
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.errors.join(' ')).toContain('size');
    const parsed = JSON.parse(exported);
    parsed.data.behaviourEvents = Array(10_001).fill(parsed.data.behaviourEvents[0]);
    const crowded = checkPortableProfileJson(JSON.stringify(parsed));
    expect(crowded.ok).toBe(false);
    if (!crowded.ok) expect(crowded.errors.join(' ')).toContain('record bounds');
  });

  it('restoring an empty source removes stale destination preferences, controls, calendar and tasks', async () => {
    setCurrentLocalDataNamespace(namespaceB);
    const empty = (await exportPortableProfile()).json;
    setCurrentLocalDataNamespace(namespaceA);
    const checked = await checkPortableProfileForRestore(empty);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    expect(await restorePortableProfile(empty, checked.expectation, REPLACE_LOCAL_PROFILE_CONFIRMATION)).toEqual({ ok: true });
    const db = getCurrentLifeRhythmDatabase();
    expect(await db.settings.count()).toBe(0);
    expect(await db.calendarSources.count()).toBe(0);
    expect(await db.activeTasks.count()).toBe(0);
    expect(await db.rhythmPlans.count()).toBe(0);
  });

  it('keeps active namespace export and restore isolated from other signed-in and legacy namespaces', async () => {
    setCurrentLocalDataNamespace(namespaceB);
    const b = getCurrentLifeRhythmDatabase();
    await b.taskPoolItems.put(taskPoolItemSchema.parse({ id: 'b-only', source: 'adhoc', title: 'B task', area: 'house',
      minimum: { label: 'B', minutes: 5 }, normal: { label: 'B', minutes: 5 }, full: { label: 'B', minutes: 5 },
      createdAt: timestamp, updatedAt: timestamp }));
    expect((await exportPortableProfile()).payload.data.taskPoolItems.map((row) => row.id)).toEqual(['b-only']);
    setCurrentLocalDataNamespace(namespaceC);
    const c = getCurrentLifeRhythmDatabase();
    await c.settings.put(createDefaultSettings(timestamp));
    setCurrentLocalDataNamespace(getLegacyLocalDataNamespace());
    const legacy = getCurrentLifeRhythmDatabase();
    await legacy.settings.put(createDefaultSettings(timestamp));
    setCurrentLocalDataNamespace(namespaceB);
    const checked = await checkPortableProfileForRestore(exported);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    expect(await restorePortableProfile(exported, checked.expectation, REPLACE_LOCAL_PROFILE_CONFIRMATION)).toEqual({ ok: true });
    expect(await b.taskPoolItems.get('b-only')).toBeUndefined();
    expect(await c.settings.count()).toBe(1);
    expect(await legacy.settings.count()).toBe(1);
    setCurrentLocalDataNamespace(namespaceA);
    expect((await exportPortableProfile(undefined, timestamp)).payload.data.taskPoolItems.map((row) => row.id)).toEqual(['pool']);
  });
});
