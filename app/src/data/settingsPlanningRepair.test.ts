import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthLocalDataNamespace, getCurrentLifeRhythmDatabase, resetCurrentLocalDataNamespace, setCurrentLocalDataNamespace } from './localDataNamespace';
import { buildCurrentLiveSchedulingContext, ensureCurrentPrivatePlan, undoCurrentPrivatePlan } from './schedulerPlanCoordinator';
import { createDefaultSettings, loadSettings, resetSettingsToDefaults, saveSettings } from './settingsRepository';
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';
import { WORKDAY_PROFILE_ID, taskPoolItemSchema } from './schemas';

let index = 0;
const planOptions = { startDate: '2026-09-07', now: new Date('2026-09-06T23:00:00.000Z'), timezone: 'Australia/Perth', horizonDays: 1 };
beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate8a3-settings-${++index}`));
});

describe('reviewed planning day persistence and repair', () => {
  it('persists an absent core work period across reload and repairs the accepted plan without a legacy fallback', async () => {
    const defaults = createDefaultSettings();
    const workBoundaryMinutes = { beforeTravel: 10, afterTravel: 5, beforeTransition: 5, afterTransition: 5 };
    const reviewedProfiles = defaults.dayProfiles.map((profile) => profile.kind === 'workday'
      ? { ...profile, usableDay: { start: '06:30', end: '22:00' }, workBoundaryMinutes } : profile);
    const input = { lifeShape: defaults.lifeShape, theme: defaults.theme, startBoostSafety: defaults.startBoostSafety,
      dayProfiles: reviewedProfiles, activatePlanningDay: true };
    expect((await saveSettings(input)).ok).toBe(true);
    expect((await ensureCurrentPrivatePlan(planOptions)).ok).toBe(true);
    const nonWorkday = (await loadSettings()).dayProfiles[1];
    const cleared = await saveSettings({ ...input, dayProfiles: reviewedProfiles.map((profile) => profile.kind === 'workday'
      ? { ...profile, workPeriod: undefined } : profile) });
    expect(cleared.ok).toBe(true);
    const pending = await loadSchedulerPlanState();
    expect(pending.status === 'ok' && pending.settingsRepairPendingAt).toBeTruthy();
    expect((await loadSettings()).dayProfiles).toEqual(cleared.settings.dayProfiles);
    expect(cleared.settings.dayProfiles[0]).toMatchObject({ usableDay: { start: '06:30', end: '22:00' },
      workPeriod: undefined, workPlanningUse: reviewedProfiles[0].workPlanningUse, workBoundaryMinutes });
    expect(cleared.settings.dayProfiles[1]).toEqual(nonWorkday);
    expect(cleared.settings.weekdayProfileAssignments).toEqual(defaults.weekdayProfileAssignments);
    expect(cleared.settings.dayProfileMigrationState.reviewState).toBe('reviewedAndEnabled');
    expect(cleared.settings.lifeShape.usualWorkHours).toEqual(defaults.lifeShape.usualWorkHours);
    const repaired = await ensureCurrentPrivatePlan(planOptions);
    expect(repaired.ok).toBe(true);
    const saved = await loadSchedulerPlanState();
    expect(saved.status).toBe('ok');
    if (saved.status !== 'ok') return;
    expect(saved.settingsRepairPendingAt).toBeUndefined();
    expect(saved.plan.repair?.trigger).toBe('settingsChanged');
    const live = await buildCurrentLiveSchedulingContext({ ...planOptions, readOnly: true });
    expect(live.ok).toBe(true);
    if (!live.ok) return;
    expect(live.context.input.dayProfiles.find((profile) => profile.id === reviewedProfiles[0].id)?.workPeriod).toBeUndefined();
    expect(live.context.input.candidateIntervals?.some((interval) => interval.start <= '08:00' && interval.end >= '16:00')).toBe(true);
    expect((await undoCurrentPrivatePlan(planOptions)).ok).toBe(false);
    expect(await loadSchedulerPlanState()).toEqual(saved);
  });

  it('never restores an old evening placement after the reviewed day is narrowed', async () => {
    const database = getCurrentLifeRhythmDatabase();
    const defaults = createDefaultSettings();
    const profilesWithDay = (start: string, end: string) => defaults.dayProfiles.map((profile) =>
      profile.kind === 'workday' ? { ...profile, usableDay: { start, end } } : profile);
    const baseInput = { lifeShape: defaults.lifeShape, theme: defaults.theme, startBoostSafety: defaults.startBoostSafety };
    expect((await saveSettings({ ...baseInput, dayProfiles: profilesWithDay('18:00', '22:00'), activatePlanningDay: true })).ok).toBe(true);
    await database.taskPoolItems.put(taskPoolItemSchema.parse({
      id: 'evening-task', source: 'adhoc', title: 'Evening task', area: 'admin', status: 'captured',
      minimum: { label: 'Start', minutes: 20 }, normal: { label: 'Continue', minutes: 20 }, full: { label: 'Finish', minutes: 20 },
      createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
    }));
    const oldPlan = await ensureCurrentPrivatePlan(planOptions);
    expect(oldPlan.ok).toBe(true);
    if (!oldPlan.ok) return;
    expect(oldPlan.plan.placements).toEqual([expect.objectContaining({ start: '18:00' })]);

    const narrowed = await saveSettings({ ...baseInput, dayProfiles: profilesWithDay('06:30', '17:00'), activatePlanningDay: true });
    expect(narrowed.ok).toBe(true);
    expect((await loadSchedulerPlanState()).status).toBe('ok');
    const repaired = await ensureCurrentPrivatePlan(planOptions);
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.plan.repair?.trigger).toBe('settingsChanged');
    expect(repaired.plan.placements.every((placement) => placement.end <= '17:00')).toBe(true);
    expect(repaired.plan.placements).not.toEqual(oldPlan.plan.placements);
    const eventsBeforeUndo = await database.taskHistory.toArray();

    const undone = await undoCurrentPrivatePlan(planOptions);
    expect(undone.ok).toBe(false);
    expect((await loadSettings()).dayProfiles).toEqual(narrowed.settings.dayProfiles);
    const saved = await loadSchedulerPlanState();
    expect(saved.status).toBe('ok');
    if (saved.status !== 'ok') return;
    expect(saved.plan).toEqual(repaired.plan);
    expect(saved.settingsRepairPendingAt).toBeUndefined();
    expect(await database.taskHistory.toArray()).toEqual(eventsBeforeUndo);
    expect(eventsBeforeUndo.filter((event) => event.eventType === 'schedulerRepairUndone')).toHaveLength(0);
  });

  it('does not activate a migrated or merely entered envelope; explicitly reviewed workdays survive reload and a theme edit', async () => {
    const initial = createDefaultSettings();
    const profiles = initial.dayProfiles.map((profile) => ({ ...profile, usableDay: { start: '06:30', end: '22:00' } }));
    const assignments = initial.weekdayProfileAssignments.map((assignment) => ({ ...assignment,
      profileId: ['Tuesday', 'Thursday', 'Saturday'].includes(assignment.weekday) ? WORKDAY_PROFILE_ID : 'profile-non-workday' }));
    const input = { lifeShape: { ...initial.lifeShape, usualWorkHours: { ...initial.lifeShape.usualWorkHours, days: ['Tuesday', 'Thursday', 'Saturday'] } },
      dayProfiles: profiles, weekdayProfileAssignments: assignments, theme: 'clear', startBoostSafety: initial.startBoostSafety };
    const entered = await saveSettings(input);
    expect(entered.ok).toBe(true);
    expect((await loadSettings()).dayProfileMigrationState.reviewState).toBe('notStarted');
    const reviewed = await saveSettings({ ...input, activatePlanningDay: true });
    expect(reviewed.ok).toBe(true);
    const saved = await loadSettings();
    expect(saved.dayProfileMigrationState.reviewState).toBe('reviewedAndEnabled');
    expect(saved.weekdayProfileAssignments.filter((item) => item.profileId === WORKDAY_PROFILE_ID).map((item) => item.weekday)).toEqual(['Tuesday', 'Thursday', 'Saturday']);
    await saveSettings({ lifeShape: saved.lifeShape, theme: 'grounded', startBoostSafety: saved.startBoostSafety });
    expect((await loadSettings()).weekdayProfileAssignments).toEqual(assignments);
  });

  it('marks schedule-affecting saves and reset while cosmetic edits leave the accepted plan alone', async () => {
    const initial = createDefaultSettings();
    await saveSettings({ lifeShape: initial.lifeShape, theme: 'clear', startBoostSafety: initial.startBoostSafety });
    expect((await ensureCurrentPrivatePlan(planOptions)).ok).toBe(true);
    const before = await loadSchedulerPlanState();
    await saveSettings({ lifeShape: initial.lifeShape, theme: 'grounded', startBoostSafety: initial.startBoostSafety });
    expect(await loadSchedulerPlanState()).toEqual(before);
    const edited = await saveSettings({ lifeShape: { ...initial.lifeShape, timeBlocks: [{ id: 'capacity', label: 'Open', type: 'openCapacity', days: ['Monday'], start: '09:00', end: '10:00' }] },
      theme: 'grounded', startBoostSafety: initial.startBoostSafety });
    expect(edited.ok).toBe(true);
    const pending = await loadSchedulerPlanState();
    expect(pending.status === 'ok' && pending.settingsRepairPendingAt).toBeTruthy();
    expect((await ensureCurrentPrivatePlan(planOptions)).ok).toBe(true);
    const repaired = await loadSchedulerPlanState();
    expect(repaired.status === 'ok' && repaired.settingsRepairPendingAt).toBeUndefined();
    await resetSettingsToDefaults();
    const resetPending = await loadSchedulerPlanState();
    expect(resetPending.status === 'ok' && resetPending.settingsRepairPendingAt).toBeTruthy();
    expect(await getCurrentLifeRhythmDatabase().settings.get('settings')).toBeTruthy();
  });
});
