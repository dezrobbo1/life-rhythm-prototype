// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveActiveTodayTask } from '../../data/activeTaskRepository';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { activeTaskSchema, taskPoolItemSchema } from '../../data/schemas';
import { createBehaviourEvent } from '../../data/behaviourEventRepository';
import { createDefaultSettings, saveSettings } from '../../data/settingsRepository';
import { saveSchedulerPlanState, loadSchedulerPlanState } from '../../data/schedulerPlanStateRepository';
import { createDurationLearningControlStore, upsertDurationLearningControl } from '../../data/durationLearningControlRepository';
import { TodayScreen } from '../../screens/TodayScreen';

describe('Minimum achievement persistence', () => {
  afterEach(async () => {
    cleanup();
    await getCurrentLifeRhythmDatabase().delete();
    resetCurrentLocalDataNamespace();
    vi.useRealTimers();
  });

  it.each([null, 25])('repairs a legacy learned plan on ordinary Today load with override=%s', async (override) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 7, 8, 30));
    setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`today-legacy-learning-${override ?? 'saved'}`));
    const db = getCurrentLifeRhythmDatabase();
    const timestamp = new Date().toISOString();
    const date = '2026-09-07';
    const defaults = createDefaultSettings(timestamp);
    expect((await saveSettings({
      ...defaults, lifeShape: { ...defaults.lifeShape, timeBlocks: [{ id: 'monday-open',
        label: 'Monday open', type: 'openCapacity', schedulerUse: 'available', days: ['Monday'],
        start: '09:00', end: '11:00' }] },
    }, db)).ok).toBe(true);
    await db.taskPoolItems.put(taskPoolItemSchema.parse({
      id: 'upgrade-task', source: 'adhoc', title: 'Upgrade task', area: 'admin', status: 'captured',
      templateId: 'paperwork', minimum: { label: 'Start', minutes: 5 },
      normal: { label: 'Do it', minutes: 30 }, full: { label: 'Finish', minutes: 60 },
      createdAt: timestamp, updatedAt: timestamp,
    }));
    for (const [index, minutes] of [35, 40, 45].entries()) {
      await db.taskHistory.put(createBehaviourEvent({
        id: `old-completion-${index}`, action: 'complete', eventType: 'taskCompleted',
        taskId: `old-task-${index}`, templateId: 'paperwork', actualMinutes: minutes,
        occurredAt: `2026-09-0${index + 1}T00:00:00.000Z`, source: 'user',
        provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
        before: { taskStatus: 'inProgress', minimumAchieved: false },
        after: { taskStatus: 'done', minimumAchieved: false },
      }));
    }
    if (override !== null) {
      expect((await upsertDurationLearningControl({ templateId: 'paperwork', mode: 'override',
        overrideMinutes: override }, createDurationLearningControlStore(db), timestamp)).ok).toBe(true);
    }
    const historyBefore = await db.taskHistory.toArray();
    const accepted = await saveSchedulerPlanState({
      placements: [{ id: 'legacy-placement', intentionId: 'upgrade-task', targetKind: 'intention',
        date, start: '09:00', end: '09:45', origin: 'scheduler', variantKind: 'normal',
        provenance: ['Used learned normal duration from 3 trusted completions: median 40 minutes; conservative duration 45 minutes; saved normal duration is 30 minutes.'] }],
      unscheduledIntentionIds: [], unscheduledRhythmIds: [], rejectedExistingPlacements: [],
    }, db, timestamp, { durationLearningApplied: [{ templateId: 'paperwork', source: 'learned',
      schedulerMinutes: 45, sampleCount: 3, confidence: 'low', medianActualMinutes: 40,
      upperQuartileActualMinutes: 45 }] });
    expect(accepted.ok).toBe(true);

    render(<TodayScreen />);
    const expectedMinutes = override ?? 30;
    const expectedEnd = `09:${String(expectedMinutes).padStart(2, '0')}`;
    await waitFor(async () => {
      const current = await loadSchedulerPlanState(db);
      expect(current.status).toBe('ok');
      if (current.status !== 'ok') return;
      expect(current.durationLearningApplied).toMatchObject(override === null ? [] : [{
        templateId: 'paperwork', source: 'userOverride', schedulerMinutes: override,
      }]);
      expect(current.plan.placements[0]).toMatchObject({ intentionId: 'upgrade-task',
        start: '09:00', end: expectedEnd });
    });
    const historyAfter = await db.taskHistory.toArray();
    expect(historyAfter.filter((row) => row.id.startsWith('old-completion-'))).toEqual(historyBefore);
    expect(historyAfter.filter((row) => row.eventType === 'schedulerPlacementMoved')).toHaveLength(1);
    expect((await db.taskPoolItems.get('upgrade-task'))?.normal.minutes).toBe(30);
    expect(within(screen.getByRole('region', { name: 'Later' })).queryByText(/09:00–09:45/)).toBeNull();
  });

  it('reconstructs Minimum achievement after Keep going and a Today reload', async () => {
    const namespace = createAuthLocalDataNamespace('minimum-achievement-integration');
    setCurrentLocalDataNamespace(namespace);
    const database = getCurrentLifeRhythmDatabase();
    const task = activeTaskSchema.parse({
      area: 'money',
      createdAt: '2026-09-08T00:00:00.000Z',
      full: { label: 'Pay the bill and file the receipt.', minutes: 20 },
      id: 'active-pay-water-bill',
      minimum: { label: 'Open the bill.', minutes: 5 },
      normal: { label: 'Check the amount and due date.', minutes: 10 },
      purpose: 'Keep the payment visible.',
      showToday: true,
      source: 'adhoc',
      status: 'active',
      title: 'Pay water bill',
      updatedAt: '2026-09-08T00:00:00.000Z',
    });

    await saveActiveTodayTask(task, database);
    const user = userEvent.setup();
    const firstRender = render(<TodayScreen />);

    await user.click(await screen.findByRole('button', { name: 'Start task' }));
    await user.click(await screen.findByRole('button', { name: 'Mark minimum done' }));
    await screen.findAllByText('Minimum done. That counts.');
    await user.click(await screen.findByRole('button', { name: 'Keep going' }));

    await waitFor(async () => {
      expect(await database.activeTasks.get(task.id)).toMatchObject({ status: 'inProgress' });
    });

    firstRender.unmount();
    const continuedRender = render(<TodayScreen />);

    expect(await screen.findByText('Minimum already counts.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark minimum done' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(async () => {
      expect(await database.activeTasks.get(task.id)).toMatchObject({
        minimumAchievedAt: expect.any(String),
        status: 'paused',
      });
    });

    continuedRender.unmount();
    const pausedRender = render(<TodayScreen />);
    expect(await screen.findByText('Paused. Minimum already counts.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark minimum done' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(async () => {
      expect(await database.activeTasks.get(task.id)).toMatchObject({
        minimumAchievedAt: expect.any(String),
        status: 'inProgress',
      });
    });

    pausedRender.unmount();
    render(<TodayScreen />);
    expect(await screen.findByText('Minimum already counts.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(screen.getByRole('button', { name: 'Mark normal done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark full done' })).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Stop here' })[0]);

    await waitFor(async () => {
      expect(await database.activeTasks.get(task.id)).toMatchObject({
        minimumAchievedAt: expect.any(String),
        showToday: false,
        status: 'done',
      });
    });
  });
});
