// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase } from '../../data/db';
import { createAuthLocalDataNamespace, getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace, setCurrentLocalDataNamespace } from '../../data/localDataNamespace';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';
import { checkPortableProfileForRestore, exportPortableProfile,
  REPLACE_LOCAL_PROFILE_CONFIRMATION, restorePortableProfile } from '../../data/portableProfileBackup';
import { CURRENT_CALENDAR_SOURCE_ID } from '../../data/calendarSourceSchema';
import { createExplicitPreferenceStore, upsertExplicitPreference } from '../../data/explicitPreferenceRepository';
import { createDurationLearningControlStore, upsertDurationLearningControl } from '../../data/durationLearningControlRepository';
import { activeTaskSchema, behaviourEventSchema, rhythmTemplateSchema } from '../../data/schemas';
import { rhythmPlanSchema, rhythmRecurrenceRevisionSchema } from '../../data/rhythmAuthoritySchemas';
import { CalendarSourceControl } from './CalendarSourceControl';
import { commitCalendarSourceBuffers, commitCalendarSourceImport } from '../../data/calendarSourceMutationCoordinator';
import { commitExplicitPreferenceUpsert, explicitPreferenceTargetExpectation } from '../../data/explicitPreferenceMutationCoordinator';
import { loadExplicitPreferencesResult } from '../../data/explicitPreferenceRepository';
import { commitDurationLearningControlUpsert, durationLearningControlExpectation } from '../../data/durationLearningControlMutationCoordinator';
import { loadDurationLearningControlsResult } from '../../data/durationLearningControlRepository';
import { readProfileRecoveryGeneration, STALE_PROFILE_RECOVERY_MESSAGE } from '../../data/profileRecoveryGeneration';
import { LibraryScreen } from '../../screens/LibraryScreen';
import { SchedulingPreferencesPanel } from '../setup/SchedulingPreferencesPanel';
import { DurationLearningPanel } from '../setup/DurationLearningPanel';
import { ResetScreen } from '../../screens/ResetScreen';
import { BEHAVIOUR_HISTORY_DELETE_CONFIRMATION, deleteBehaviourHistory } from '../../data/behaviourHistoryControl';

const now = '2026-09-28T10:00:00.000Z';
let counter = 0;
beforeEach(async () => {
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`additional-rendered-${++counter}`));
  const defaults = createDefaultSettings(now);
  expect((await saveSettings({ theme: 'clear', lifeShape: defaults.lifeShape,
    startBoostSafety: defaults.startBoostSafety })).ok).toBe(true);
});
afterEach(() => { cleanup(); resetCurrentLocalDataNamespace(); });

async function restoreInAnotherHandle(replacement?: string) {
  const db = getCurrentLifeRhythmDatabase();
  const backup = replacement ?? (await exportPortableProfile(db)).json;
  const other = createLifeRhythmDatabase(db.name);
  try {
    const checked = await checkPortableProfileForRestore(backup, other);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Check failed');
    expect(await restorePortableProfile(backup, checked.expectation, REPLACE_LOCAL_PROFILE_CONFIRMATION, other))
      .toEqual({ ok: true });
  } finally { other.close(); }
}

describe('read generation accompanies additional rendered actions', () => {
  it('rejects a stale Reset history deletion and keeps the newly restored facts', async () => {
    const db = getCurrentLifeRhythmDatabase();
    const source = createLifeRhythmDatabase(`additional-history-source-${counter}`);
    const event = behaviourEventSchema.parse({ recordKind: 'behaviourEvent', version: 1,
      id: 'restored-fact', eventType: 'taskStarted', occurredAt: now, localDate: '2026-09-28',
      timezone: 'UTC', taskId: 'restored-task', source: 'user', action: 'start',
      provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
      before: { taskStatus: 'active', minimumAchieved: false },
      after: { taskStatus: 'inProgress', minimumAchieved: false } });
    await source.taskHistory.put(event);
    const replacement = (await exportPortableProfile(source)).json;
    await source.delete();
    const onBehaviourHistoryDeleted = vi.fn(async () => true);
    const user = userEvent.setup();
    render(<ResetScreen onBehaviourHistoryDeleted={onBehaviourHistoryDeleted} />);
    await user.click(screen.getByText("Behaviour history controls"));
    const input = screen.getByLabelText(`Type ${BEHAVIOUR_HISTORY_DELETE_CONFIRMATION} to delete behaviour history`) as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    await user.type(input, BEHAVIOUR_HISTORY_DELETE_CONFIRMATION);
    await restoreInAnotherHandle(replacement);
    const before = await db.taskHistory.toArray();
    await user.click(screen.getByRole('button', { name: 'Delete behaviour history' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.taskHistory.toArray()).toEqual(before);
    expect(onBehaviourHistoryDeleted).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    await waitFor(() => expect(input.disabled).toBe(false));
    await user.type(input, BEHAVIOUR_HISTORY_DELETE_CONFIRMATION);
    await user.click(screen.getByRole('button', { name: 'Delete behaviour history' }));
    await waitFor(() => expect(onBehaviourHistoryDeleted).toHaveBeenCalledTimes(1));
    expect(await db.taskHistory.toArray()).toEqual([]);
  });
  it('rejects a stale expected generation passed directly to history deletion', async () => {
    const db = getCurrentLifeRhythmDatabase();
    await db.taskHistory.put(behaviourEventSchema.parse({ recordKind: 'behaviourEvent', version: 1,
      id: 'kept-fact', eventType: 'taskStarted', occurredAt: now, localDate: '2026-09-28',
      timezone: 'UTC', taskId: 'kept-task', source: 'user', action: 'start',
      provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
      before: { taskStatus: 'active', minimumAchieved: false },
      after: { taskStatus: 'inProgress', minimumAchieved: false } }));
    const expected = await readProfileRecoveryGeneration(db);
    await restoreInAnotherHandle();
    const before = await db.taskHistory.toArray();
    expect(await deleteBehaviourHistory(BEHAVIOUR_HISTORY_DELETE_CONFIRMATION, db, expected))
      .toMatchObject({ ok: false, errors: [STALE_PROFILE_RECOVERY_MESSAGE] });
    expect(await db.taskHistory.toArray()).toEqual(before);
  });
  it('rejects stale Reset actions on Today tasks from the prior profile', async () => {
    const db = getCurrentLifeRhythmDatabase();
    for (const id of ['first', 'second']) await db.activeTasks.put(activeTaskSchema.parse({
      id, source: 'adhoc', title: `Task ${id}`, area: 'house',
      minimum: { label: 'Start', minutes: 5 }, normal: { label: 'Continue', minutes: 15 },
      full: { label: 'Finish', minutes: 25 }, showToday: true, createdAt: now, updatedAt: now,
    }));
    const user = userEvent.setup();
    render(<ResetScreen />);
    await screen.findByText('2 visible Today tasks are available for reset.');
    await restoreInAnotherHandle();
    const before = await db.activeTasks.toArray();
    const history = await db.taskHistory.toArray();
    await user.click(within(screen.getByRole('article', { name: 'Park extras safely' }))
      .getByRole('button', { name: 'Park extras safely' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.activeTasks.toArray()).toEqual(before);
    expect(await db.taskHistory.toArray()).toEqual(history);
  });
  it('rejects explicit old-view tokens for calendar buffers/import and preference/duration upserts', async () => {
    const db = getCurrentLifeRhythmDatabase();
    const calendar = { id: CURRENT_CALENDAR_SOURCE_ID as typeof CURRENT_CALENDAR_SOURCE_ID,
      adapterId: 'ics' as const, version: 2 as const,
      label: 'A', source: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',
      importedAt: now, updatedAt: now, beforeBusyMinutes: 5, afterBusyMinutes: 5 };
    await db.calendarSources.put(calendar);
    const preferenceStore = createExplicitPreferenceStore(db);
    const pref = { id: 'prefer', targetKind: 'area' as const, targetValue: 'admin', relation: 'prefer' as const,
      days: [] as [] };
    expect((await upsertExplicitPreference(pref, preferenceStore, now)).ok).toBe(true);
    const durationStore = createDurationLearningControlStore(db);
    expect((await upsertDurationLearningControl({ templateId: 'paperwork', mode: 'override', overrideMinutes: 20 },
      durationStore, now)).ok).toBe(true);
    const expected = await readProfileRecoveryGeneration(db);
    const preference = explicitPreferenceTargetExpectation(await loadExplicitPreferencesResult(preferenceStore), 'prefer')!;
    const duration = durationLearningControlExpectation(await loadDurationLearningControlsResult(durationStore), 'paperwork')!;
    await restoreInAnotherHandle();
    const before = { calendar: await db.calendarSources.toArray(), settings: await db.settings.toArray(),
      plan: await db.schedulerPlanState.toArray(), history: await db.taskHistory.toArray() };
    expect(await commitCalendarSourceBuffers(10, 15, db, expected)).toMatchObject({ ok: false,
      errors: [STALE_PROFILE_RECOVERY_MESSAGE] });
    expect(await commitCalendarSourceImport({ label: 'Replacement', source: calendar.source,
      options: { targetTimezone: 'UTC', windowStartDate: '2026-09-28', windowEndDate: '2026-09-29' } },
    db, expected)).toMatchObject({ ok: false, errors: [STALE_PROFILE_RECOVERY_MESSAGE] });
    expect(await commitExplicitPreferenceUpsert({ ...pref, relation: 'avoid' }, preference, db, now, expected))
      .toMatchObject({ ok: false, errors: [STALE_PROFILE_RECOVERY_MESSAGE] });
    expect(await commitDurationLearningControlUpsert({ templateId: 'paperwork', mode: 'disabled' },
      duration, db, now, expected)).toMatchObject({ ok: false, errors: [STALE_PROFILE_RECOVERY_MESSAGE] });
    expect(await db.calendarSources.toArray()).toEqual(before.calendar);
    expect(await db.settings.toArray()).toEqual(before.settings);
    expect(await db.schedulerPlanState.toArray()).toEqual(before.plan);
    expect(await db.taskHistory.toArray()).toEqual(before.history);
    expect((await commitCalendarSourceBuffers(10, 15, db)).ok).toBe(true);
  });
  it('rejects stale calendar removal and keeps the restored calendar and repair state', async () => {
    const db = getCurrentLifeRhythmDatabase();
    await db.calendarSources.put({ id: CURRENT_CALENDAR_SOURCE_ID, adapterId: 'ics', version: 2,
      label: 'Source A', source: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',
      importedAt: now, updatedAt: now, beforeBusyMinutes: 5, afterBusyMinutes: 5 });
    const user = userEvent.setup();
    render(<CalendarSourceControl />);
    await screen.findByText('Source A');
    await restoreInAnotherHandle();
    const source = await db.calendarSources.toArray();
    const plan = await db.schedulerPlanState.toArray();
    await user.click(screen.getByRole('button', { name: 'Remove calendar' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.calendarSources.toArray()).toEqual(source);
    expect(await db.schedulerPlanState.toArray()).toEqual(plan);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove calendar' }).hasAttribute('disabled')).toBe(false));
  });

  it('rejects stale rhythm state commands from Library and accepts a fresh read', async () => {
    const db = getCurrentLifeRhythmDatabase();
    const template = rhythmTemplateSchema.parse({ id: 'my-rhythm', source: 'custom', title: 'My routine', area: 'house',
      minimum: { label: 'Start', minutes: 5 }, normal: { label: 'Continue', minutes: 20 },
      full: { label: 'Finish', minutes: 30 }, enabled: true, createdAt: now, updatedAt: now });
    const plan = rhythmPlanSchema.parse({ id: 'my-plan', rhythmTemplateId: template.id, state: 'enabled',
      latestRecurrenceRevisionId: 'my-revision', initialEffectiveFromLocalDate: '2026-09-28',
      preferredTime: 'anytime', timezone: 'UTC', missedOccurrencePolicy: 'skip',
      planningMode: 'automaticPrivate', createdAt: now, updatedAt: now });
    const revision = rhythmRecurrenceRevisionSchema.parse({ id: 'my-revision', rhythmPlanId: plan.id,
      revisionNumber: 1, effectiveFromLocalDate: '2026-09-28', timezone: 'UTC',
      rule: { frequency: 1, period: 'week', preferredDays: [], maxPerDay: 1 }, createdAt: now });
    await db.rhythmTemplates.put(template); await db.rhythmPlans.put(plan); await db.rhythmRecurrenceRevisions.put(revision);
    const user = userEvent.setup();
    render(<LibraryScreen />);
    const card = (await screen.findByRole('heading', { name: 'My routine' })).closest('article')!;
    await restoreInAnotherHandle();
    await user.click(within(card).getByRole('button', { name: 'Pause rhythm' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect((await db.rhythmPlans.get('my-plan'))?.state).toBe('enabled');
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Pause rhythm' }).hasAttribute('disabled')).toBe(false));
    await user.click(within(card).getByRole('button', { name: 'Pause rhythm' }));
    await waitFor(async () => expect((await db.rhythmPlans.get('my-plan'))?.state).toBe('paused'));
  });

  it('rejects stale preference removal from a rendered row', async () => {
    const db = getCurrentLifeRhythmDatabase();
    expect((await upsertExplicitPreference({ id: 'prefer', targetKind: 'area', targetValue: 'admin',
      relation: 'prefer', days: [] }, createExplicitPreferenceStore(db), now)).ok).toBe(true);
    const user = userEvent.setup();
    render(<SchedulingPreferencesPanel />);
    const row = (await screen.findByText(/Prefer area/)).closest('li')!;
    await restoreInAnotherHandle();
    const original = await db.settings.get('preferences:explicit:v1');
    await user.click(within(row).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.settings.get('preferences:explicit:v1')).toEqual(original);
  });

  it('rejects stale duration control actions from rendered evidence', async () => {
    const db = getCurrentLifeRhythmDatabase();
    expect((await upsertDurationLearningControl({ templateId: 'paperwork', mode: 'override', overrideMinutes: 20 },
      createDurationLearningControlStore(db), now)).ok).toBe(true);
    const user = userEvent.setup();
    render(<DurationLearningPanel />);
    await screen.findByRole('button', { name: 'Use learning again' });
    await restoreInAnotherHandle();
    const original = await db.settings.get('learning:duration-controls:v1');
    await user.click(screen.getByRole('button', { name: 'Use learning again' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.settings.get('learning:duration-controls:v1')).toEqual(original);
  });
});
