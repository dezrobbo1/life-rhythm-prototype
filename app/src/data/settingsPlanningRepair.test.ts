import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthLocalDataNamespace, getCurrentLifeRhythmDatabase, resetCurrentLocalDataNamespace, setCurrentLocalDataNamespace } from './localDataNamespace';
import { ensureCurrentPrivatePlan } from './schedulerPlanCoordinator';
import { createDefaultSettings, loadSettings, resetSettingsToDefaults, saveSettings } from './settingsRepository';
import { loadSchedulerPlanState } from './schedulerPlanStateRepository';
import { WORKDAY_PROFILE_ID } from './schemas';

let index = 0;
const planOptions = { startDate: '2026-09-07', now: new Date('2026-09-06T23:00:00.000Z'), timezone: 'Australia/Perth', horizonDays: 1 };
beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate8a3-settings-${++index}`));
});

describe('reviewed planning day persistence and repair', () => {
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
