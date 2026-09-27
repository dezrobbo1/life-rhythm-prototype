import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importIcsCalendarSource,
  loadCalendarSource,
} from './calendarSourceRepository';
import {
  commitCalendarSourceImport,
  commitCalendarSourceRemoval,
} from './calendarSourceMutationCoordinator';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  loadSchedulerPlanState,
  markCalendarRepairPending,
  saveSchedulerPlanState,
} from './schedulerPlanStateRepository';

let namespaceIndex = 0;

const options = {
  targetTimezone: 'Australia/Perth',
  windowStartDate: '2026-09-07',
  windowEndDate: '2026-09-08',
};

const calendarA = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:calendar-a',
  'DTSTART:20260907T010000Z',
  'DTEND:20260907T020000Z',
  'SUMMARY:Calendar A',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendarB = calendarA
  .replace('calendar-a', 'calendar-b')
  .replace('Calendar A', 'Calendar B');

const overBudgetTimed = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:long-busy',
  'DTSTART:20260101T090000Z',
  'DURATION:P1000000D',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const futureAggregateCalendar = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:future-a', 'DTSTART:20261201T160000Z', 'DURATION:P6000D', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:future-b', 'DTSTART:20261202T160000Z', 'DURATION:P6000D', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const plan = {
  placements: [],
  rejectedExistingPlacements: [],
  unscheduledIntentionIds: ['task-a'],
  unscheduledRhythmIds: [],
};

async function seedPlan() {
  const saved = await saveSchedulerPlanState(
    plan,
    getCurrentLifeRhythmDatabase(),
    '2026-09-07T00:00:00.000Z',
  );
  expect(saved.ok).toBe(true);
  return getCurrentLifeRhythmDatabase().schedulerPlanState.get('current');
}

async function seedCalendarA() {
  const imported = await importIcsCalendarSource({
    label: 'Calendar A',
    source: calendarA,
    options,
    importedAt: '2026-09-07T00:01:00.000Z',
  });
  expect(imported.ok).toBe(true);
  return getCurrentLifeRhythmDatabase().calendarSources.get('primary');
}

function failPendingMarkerWrite() {
  return vi
    .spyOn(getCurrentLifeRhythmDatabase().schedulerPlanState, 'update')
    .mockRejectedValueOnce(new Error('synthetic marker persistence failure'));
}

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  namespaceIndex += 1;
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`calendar-source-atomic-${namespaceIndex}`),
  );
});

describe('atomic calendar source mutation and repair attention', () => {
  it('rejects two individually safe future BUSY events before first import while preserving a plan', async () => {
    const database = getCurrentLifeRhythmDatabase();
    const beforePlan = await seedPlan();
    const result = await commitCalendarSourceImport({
      label: 'Future aggregate', source: futureAggregateCalendar, options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await database.calendarSources.get('primary')).toBeUndefined();
    expect(await database.schedulerPlanState.get('current')).toEqual(beforePlan);
  });

  it.each([false, true])('rejects future 6,000 + 6,000 fragments without changing source, spacing or plan (pending=%s)', async (pending) => {
    const database = getCurrentLifeRhythmDatabase();
    await seedCalendarA();
    await database.calendarSources.update('primary', { beforeBusyMinutes: 35, afterBusyMinutes: 25 });
    await seedPlan();
    if (pending) {
      expect(await markCalendarRepairPending(database, '2026-09-07T00:01:30.000Z'))
        .toEqual({ ok: true, persisted: true });
    }
    const beforeSource = await database.calendarSources.get('primary');
    const beforePlan = await database.schedulerPlanState.get('current');
    const result = await commitCalendarSourceImport({
      label: 'Future aggregate', source: futureAggregateCalendar, options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await database.calendarSources.get('primary')).toEqual(beforeSource);
    expect(await database.schedulerPlanState.get('current')).toEqual(beforePlan);
  });

  it('rejects a first over-budget import without changing an accepted plan or repair attention', async () => {
    const database = getCurrentLifeRhythmDatabase();
    const beforePlan = await seedPlan();
    const result = await commitCalendarSourceImport({
      label: 'Long busy calendar', source: overBudgetTimed, options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await database.calendarSources.get('primary')).toBeUndefined();
    expect(await database.schedulerPlanState.get('current')).toEqual(beforePlan);
  });

  it.each([false, true])('rejects an over-budget replacement without changing prior source, buffers or plan (pending=%s)', async (pending) => {
    const database = getCurrentLifeRhythmDatabase();
    await seedCalendarA();
    await database.calendarSources.update('primary', { beforeBusyMinutes: 35, afterBusyMinutes: 25 });
    await seedPlan();
    if (pending) {
      expect(await markCalendarRepairPending(database, '2026-09-07T00:01:30.000Z'))
        .toEqual({ ok: true, persisted: true });
    }
    const beforeSource = await database.calendarSources.get('primary');
    const beforePlan = await database.schedulerPlanState.get('current');

    const result = await commitCalendarSourceImport({
      label: 'Long busy replacement', source: overBudgetTimed, options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining('safe daily expansion bounds')] });
    expect(await database.calendarSources.get('primary')).toEqual(beforeSource);
    expect(await database.schedulerPlanState.get('current')).toEqual(beforePlan);
  });

  it('keeps authored spacing on a valid replacement and marks accepted plans for repair', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await seedCalendarA();
    await database.calendarSources.update('primary', { beforeBusyMinutes: 35, afterBusyMinutes: 25 });
    await seedPlan();
    const result = await commitCalendarSourceImport({
      label: 'Calendar B', source: calendarB, options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });
    expect(result).toMatchObject({
      ok: true, repairAttentionPersisted: true,
      record: { beforeBusyMinutes: 35, afterBusyMinutes: 25 },
    });
    expect(await loadSchedulerPlanState()).toMatchObject({
      status: 'ok', calendarRepairPendingAt: expect.any(String),
    });
  });

  it('does not retain a first import when an existing plan cannot be marked pending', async () => {
    const beforePlan = await seedPlan();
    failPendingMarkerWrite();

    const result = await commitCalendarSourceImport({
      label: 'Calendar B',
      source: calendarB,
      options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result.ok).toBe(false);
    expect((await loadCalendarSource()).status).toBe('missing');
    expect(await getCurrentLifeRhythmDatabase().schedulerPlanState.get('current')).toEqual(beforePlan);
  });

  it('restores the exact prior calendar when replacement cannot mark an existing plan pending', async () => {
    const beforeCalendar = await seedCalendarA();
    const beforePlan = await seedPlan();
    failPendingMarkerWrite();

    const result = await commitCalendarSourceImport({
      label: 'Calendar B',
      source: calendarB,
      options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result.ok).toBe(false);
    expect(await getCurrentLifeRhythmDatabase().calendarSources.get('primary')).toEqual(beforeCalendar);
    expect(await getCurrentLifeRhythmDatabase().schedulerPlanState.get('current')).toEqual(beforePlan);
  });

  it('restores the exact source when removal cannot mark an existing plan pending', async () => {
    const beforeCalendar = await seedCalendarA();
    const beforePlan = await seedPlan();
    failPendingMarkerWrite();

    const result = await commitCalendarSourceRemoval();

    expect(result.ok).toBe(false);
    expect(await getCurrentLifeRhythmDatabase().calendarSources.get('primary')).toEqual(beforeCalendar);
    expect(await getCurrentLifeRhythmDatabase().schedulerPlanState.get('current')).toEqual(beforePlan);
  });

  it('commits an import when no old scheduler plan exists', async () => {
    const result = await commitCalendarSourceImport({
      label: 'Calendar B',
      source: calendarB,
      options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repairAttentionPersisted).toBe(false);
    expect((await loadCalendarSource()).status).toBe('ok');
    expect((await loadSchedulerPlanState()).status).toBe('missing');
  });

  it('commits a source together with durable pending attention when an old plan exists', async () => {
    await seedPlan();

    const result = await commitCalendarSourceImport({
      label: 'Calendar B',
      source: calendarB,
      options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repairAttentionPersisted).toBe(true);
    const reloadedCalendar = await loadCalendarSource();
    const reloadedPlan = await loadSchedulerPlanState();
    expect(reloadedCalendar.status).toBe('ok');
    expect(reloadedPlan).toEqual(expect.objectContaining({
      status: 'ok',
      calendarRepairPendingAt: expect.any(String),
    }));
  });

  it('replaces an invalid saved source atomically with repair attention', async () => {
    const database = getCurrentLifeRhythmDatabase();
    await database.calendarSources.put({
      id: 'primary',
      version: 99,
      adapterId: 'ics',
      label: 'Corrupt source',
      source: calendarA,
      importedAt: 'not-a-time',
      updatedAt: 'not-a-time',
    } as never);
    await seedPlan();

    const result = await commitCalendarSourceImport({
      label: 'Calendar B',
      source: calendarB,
      options,
      importedAt: '2026-09-07T00:02:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repairAttentionPersisted).toBe(true);
    const calendarState = await loadCalendarSource();
    const planState = await loadSchedulerPlanState();
    expect(calendarState.status).toBe('ok');
    expect(planState).toEqual(expect.objectContaining({
      status: 'ok',
      calendarRepairPendingAt: expect.any(String),
    }));
  });
});
