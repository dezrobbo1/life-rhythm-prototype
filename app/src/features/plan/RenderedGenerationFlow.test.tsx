// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { createAuthLocalDataNamespace, getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace, setCurrentLocalDataNamespace } from '../../data/localDataNamespace';
import { createLifeRhythmDatabase } from '../../data/db';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';
import { activeTaskSchema, taskPoolItemSchema } from '../../data/schemas';
import { checkPortableProfileForRestore, exportPortableProfile,
  REPLACE_LOCAL_PROFILE_CONFIRMATION, restorePortableProfile } from '../../data/portableProfileBackup';
import { readProfileRecoveryGeneration } from '../../data/profileRecoveryGeneration';

let index = 0;
const timestamp = '2026-09-26T00:00:00.000Z';
const pool = taskPoolItemSchema.parse({ id: 'task-x', source: 'adhoc', title: 'Old task', area: 'admin',
  minimum: { label: 'Start', minutes: 5 }, normal: { label: 'Continue', minutes: 15 },
  full: { label: 'Finish', minutes: 25 }, createdAt: timestamp, updatedAt: timestamp });
const active = activeTaskSchema.parse({ ...pool, status: 'active', showToday: true });

beforeEach(async () => {
  index++;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`rendered-epoch-${index}`));
  const defaults = createDefaultSettings(timestamp);
  expect((await saveSettings({ theme: 'clear', lifeShape: defaults.lifeShape,
    startBoostSafety: defaults.startBoostSafety })).ok).toBe(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); resetCurrentLocalDataNamespace(); });

async function restoreOther(modify: (payload: any) => void) {
  const db = getCurrentLifeRhythmDatabase();
  const payload = structuredClone((await exportPortableProfile(db)).payload);
  modify(payload);
  const other = createLifeRhythmDatabase(db.name);
  try {
    const json = JSON.stringify(payload);
    const checked = await checkPortableProfileForRestore(json, other);
    if (!checked.ok || !('expectation' in checked)) throw new Error('Backup check failed');
    expect(await restorePortableProfile(json, checked.expectation, REPLACE_LOCAL_PROFILE_CONFIRMATION, other))
      .toEqual({ ok: true });
  } finally { other.close(); }
  expect(await readProfileRecoveryGeneration(db)).toBe(1);
}

async function waitForPlan() {
  await waitFor(() => expect(screen.queryByText('Preparing the private plan.')).toBeNull());
}

describe('rendered canonical data retains recovery generation', () => {
  it('rejects stale Today Park of a different restored task sharing its ID', async () => {
    const db = getCurrentLifeRhythmDatabase();
    await db.activeTasks.put(active);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Old task' });
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await screen.findByRole('button', { name: 'Park' });
    await waitForPlan();
    await restoreOther((payload) => { payload.data.activeTasks[0].title = 'Restored task'; });
    const before = { task: await db.activeTasks.get('task-x'), events: await db.taskHistory.toArray(),
      pool: await db.taskPoolItems.toArray(), placements: await db.softPlacements.toArray(),
      rhythms: await db.rhythmInstances.toArray(), plan: await db.schedulerPlanState.toArray() };
    await user.click(screen.getByRole('button', { name: 'Park' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.activeTasks.get('task-x')).toEqual(before.task);
    expect(await db.taskHistory.toArray()).toEqual(before.events);
    expect(await db.taskPoolItems.toArray()).toEqual(before.pool);
    expect(await db.softPlacements.toArray()).toEqual(before.placements);
    expect(await db.rhythmInstances.toArray()).toEqual(before.rhythms);
    await screen.findByRole('heading', { name: 'Restored task' });
    await user.click(await screen.findByRole('button', { name: 'Park' }));
    expect(await db.activeTasks.get('task-x')).toMatchObject({ title: 'Restored task', status: 'parked' });
  });

  it('rejects stale Held Defer and then accepts a freshly read Defer', async () => {
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(pool);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Held' }));
    await screen.findByText('Old task');
    await waitForPlan();
    await restoreOther((payload) => { payload.data.taskPoolItems[0].title = 'Restored task'; });
    const events = await db.taskHistory.toArray();
    const item = await db.taskPoolItems.get('task-x');
    await user.click(screen.getByRole('button', { name: 'Bring back later' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hold until then' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.taskPoolItems.get('task-x')).toEqual(item);
    expect(await db.taskHistory.toArray()).toEqual(events);
    await screen.findByText('Restored task');
    await user.click(screen.getByRole('button', { name: 'Bring back later' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hold until then' }));
    expect((await screen.findAllByText(/Held until/)).length).toBeGreaterThan(0);
  });

  it('rejects stale Held Add to Today and No longer needed', async () => {
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(pool);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Held' }));
    await screen.findByText('Old task');
    await waitForPlan();
    await restoreOther((payload) => { payload.data.taskPoolItems[0].title = 'Restored task'; });
    await user.click(screen.getByRole('button', { name: 'Add to Today' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.activeTasks.count()).toBe(0);
    expect(await db.taskPoolItems.get('task-x')).toMatchObject({ status: 'captured', title: 'Restored task' });
    await screen.findByText('Restored task');
    await user.click(screen.getByRole('button', { name: 'Add to Today' }));
    expect(await screen.findByText('Added to Today.')).toBeTruthy();
    expect(await db.activeTasks.get('task-x')).toMatchObject({ title: 'Restored task', status: 'active' });
  });

  it('rejects stale Held No longer needed and accepts it after a fresh read', async () => {
    const db = getCurrentLifeRhythmDatabase();
    await db.taskPoolItems.put(pool);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Held' }));
    await screen.findByText('Old task');
    await waitForPlan();
    await restoreOther((payload) => { payload.data.taskPoolItems[0].title = 'Restored task'; });
    const events = await db.taskHistory.toArray();
    await user.click(screen.getByRole('button', { name: 'No longer needed' }));
    await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
    expect(await db.taskPoolItems.get('task-x')).toMatchObject({ status: 'captured', title: 'Restored task' });
    expect(await db.taskHistory.toArray()).toEqual(events);
    await screen.findByText('Restored task');
    await user.click(screen.getByRole('button', { name: 'No longer needed' }));
    expect(await screen.findByText('Marked no longer needed. Nothing else changed.')).toBeTruthy();
    expect(await db.taskPoolItems.get('task-x')).toMatchObject({ status: 'noLongerNeeded' });
  });

  for (const action of ['Save settings', 'Reset settings to defaults'] as const) {
    it(`rejects stale Setup ${action} and preserves restored settings`, async () => {
      const db = getCurrentLifeRhythmDatabase();
      const user = userEvent.setup();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: 'More' }));
      await user.click(await screen.findByRole('button', { name: 'Settings' }));
      await screen.findByRole('radio', { name: /Clear/ });
      await waitForPlan();
      await restoreOther((payload) => { payload.data.settings.theme = 'exhale'; });
      const before = await db.settings.toArray();
      await user.click(screen.getByRole('button', { name: action }));
      await waitFor(() => expect(screen.getByText(/local profile changed/i)).toBeTruthy());
      expect(await db.settings.toArray()).toEqual(before);
      await waitFor(() => expect(screen.getByRole('radio', { name: /Exhale/ }).getAttribute('aria-checked'))
        .toBe('true'));
      await user.click(screen.getByRole('button', { name: action }));
      expect(await screen.findByText(action === 'Save settings' ? 'Settings saved on this device.'
        : 'Settings reset to defaults on this device.')).toBeTruthy();
    });
  }
});
