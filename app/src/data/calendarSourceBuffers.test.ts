import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthLocalDataNamespace, getCurrentLifeRhythmDatabase, resetCurrentLocalDataNamespace, setCurrentLocalDataNamespace } from './localDataNamespace';
import { commitCalendarSourceBuffers, commitCalendarSourceImport } from './calendarSourceMutationCoordinator';
import { loadCalendarSource, readPersistedCalendarEvents } from './calendarSourceRepository';
import { externalCommitmentsFromCalendarEvents } from '../domain/calendarAvailability';

let index = 0;
const options = { targetTimezone: 'Australia/Perth', windowStartDate: '2026-09-07', windowEndDate: '2026-09-07' };
const source = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:weekly', 'SUMMARY:Meeting',
  'DTSTART;TZID=Australia/Perth:20260907T090000', 'DTEND;TZID=Australia/Perth:20260907T093000',
  'RRULE:FREQ=WEEKLY;COUNT=5', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`calendar-buffer-${++index}`));
});

describe('calendar source spacing', () => {
  it('reads a version-1 source with zero buffers without rewriting its file and updates spacing atomically', async () => {
    const db = getCurrentLifeRhythmDatabase();
    const old = { id: 'primary', version: 1, adapterId: 'ics', source, label: 'Old calendar',
      importedAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
    await db.table('calendarSources').put(old);
    const loaded = await loadCalendarSource();
    expect(loaded.status === 'ok' && loaded.record.beforeBusyMinutes).toBe(0);
    expect(await db.table('calendarSources').get('primary')).toEqual(old);
    const changed = await commitCalendarSourceBuffers(15, 10);
    expect(changed.ok).toBe(true);
    const read = await readPersistedCalendarEvents(options);
    expect(read.status).toBe('ok');
    if (read.status !== 'ok') return;
    expect(externalCommitmentsFromCalendarEvents(read.events, read.record.beforeBusyMinutes, read.record.afterBusyMinutes)[0]).toMatchObject({
      travelBeforeMinutes: 15, transitionAfterMinutes: 10,
    });
    const after = await db.table('calendarSources').get('primary');
    expect(after).toMatchObject({ source, importedAt: old.importedAt, version: 2 });
    expect((await commitCalendarSourceBuffers(181, 0)).ok).toBe(false);
    expect(await db.table('calendarSources').get('primary')).toEqual(after);
    const reimported = await commitCalendarSourceImport({ label: 'Old calendar', source, options });
    expect(reimported.ok && reimported.record.beforeBusyMinutes).toBe(15);
  });
});
