import type { Table } from 'dexie';
import {
  icsCalendarAdapter,
  type CalendarReadEvent,
  type CalendarReadOptions,
} from '../domain/calendarAdapter';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  CURRENT_CALENDAR_SOURCE_ID,
  calendarSourceRecordSchema,
  type CalendarSourceRecord,
} from './calendarSourceSchema';

type CalendarSourceTable = Pick<Table<CalendarSourceRecord, string>, 'delete' | 'get' | 'put'>;

export type CalendarSourceStore = {
  calendarSources: CalendarSourceTable;
};

export type CalendarSourceLoadResult =
  | { status: 'missing' }
  | { status: 'ok'; record: CalendarSourceRecord }
  | { status: 'invalid'; errors: string[] }
  | { status: 'error'; errors: string[] };

export type CalendarSourceReadResult =
  | {
      status: 'missing';
      events: CalendarReadEvent[];
      warnings: string[];
    }
  | {
      status: 'ok';
      record: CalendarSourceRecord;
      events: CalendarReadEvent[];
      warnings: string[];
    }
  | { status: 'invalid' | 'error'; errors: string[]; warnings: string[] };

export type CalendarSourceImportResult =
  | {
      ok: true;
      record: CalendarSourceRecord;
      eventCount: number;
      busyEventCount: number;
      warnings: string[];
    }
  | { ok: false; errors: string[]; warnings: string[] };

export type CalendarSourceRemoveResult =
  | { ok: true; removed: boolean }
  | { ok: false; errors: string[] };

function issueMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'calendarSource';
    return `${path}: ${issue.message}`;
  });
}

function looksLikeIcsCalendar(source: string) {
  const normalized = source.toUpperCase();
  return normalized.includes('BEGIN:VCALENDAR') && normalized.includes('END:VCALENDAR');
}

export async function loadCalendarSource(
  store: CalendarSourceStore = getCurrentLifeRhythmDatabase(),
): Promise<CalendarSourceLoadResult> {
  let stored: unknown;

  try {
    stored = await store.calendarSources.get(CURRENT_CALENDAR_SOURCE_ID);
  } catch {
    return {
      status: 'error',
      errors: ['calendarSource: Saved read-only calendar source could not be read.'],
    };
  }

  if (!stored) {
    return { status: 'missing' };
  }

  const parsed = calendarSourceRecordSchema.safeParse(stored);
  if (!parsed.success) {
    return {
      status: 'invalid',
      errors: issueMessages(parsed.error.issues),
    };
  }

  return { status: 'ok', record: parsed.data };
}

export async function readPersistedCalendarEvents(
  options: CalendarReadOptions,
  store: CalendarSourceStore = getCurrentLifeRhythmDatabase(),
): Promise<CalendarSourceReadResult> {
  const loaded = await loadCalendarSource(store);

  if (loaded.status === 'missing') {
    return { status: 'missing', events: [], warnings: [] };
  }

  if (loaded.status === 'invalid' || loaded.status === 'error') {
    return { ...loaded, warnings: [] };
  }

  try {
    const result = icsCalendarAdapter.read(loaded.record.source, options);
    return {
      status: 'ok',
      record: loaded.record,
      events: result.events,
      warnings: result.warnings,
    };
  } catch {
    return {
      status: 'error',
      errors: ['calendarSource: Saved calendar data could not be interpreted safely.'],
      warnings: [],
    };
  }
}

export async function importIcsCalendarSource(
  input: {
    label: string;
    source: string;
    options: CalendarReadOptions;
    importedAt?: string;
  },
  store: CalendarSourceStore = getCurrentLifeRhythmDatabase(),
): Promise<CalendarSourceImportResult> {
  const label = input.label.trim() || 'Imported calendar';
  const source = input.source.trim();

  if (!looksLikeIcsCalendar(source)) {
    return {
      ok: false,
      errors: ['calendarSource: This file does not contain an iCalendar VCALENDAR document.'],
      warnings: [],
    };
  }

  let preview;
  try {
    preview = icsCalendarAdapter.read(source, input.options);
  } catch {
    return {
      ok: false,
      errors: ['calendarSource: This calendar could not be interpreted safely.'],
      warnings: [],
    };
  }

  const timestamp = input.importedAt ?? new Date().toISOString();
  const parsed = calendarSourceRecordSchema.safeParse({
    id: CURRENT_CALENDAR_SOURCE_ID,
    version: 1,
    adapterId: 'ics',
    label,
    source,
    importedAt: timestamp,
    updatedAt: timestamp,
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: issueMessages(parsed.error.issues),
      warnings: preview.warnings,
    };
  }

  try {
    await store.calendarSources.put(parsed.data);
  } catch {
    return {
      ok: false,
      errors: ['calendarSource: Calendar source could not be saved on this device.'],
      warnings: preview.warnings,
    };
  }

  return {
    ok: true,
    record: parsed.data,
    eventCount: preview.events.length,
    busyEventCount: preview.events.filter((event) => event.busy).length,
    warnings: preview.warnings,
  };
}

export async function removeCalendarSource(
  store: CalendarSourceStore = getCurrentLifeRhythmDatabase(),
): Promise<CalendarSourceRemoveResult> {
  let existing: unknown;
  try {
    existing = await store.calendarSources.get(CURRENT_CALENDAR_SOURCE_ID);
    if (existing) {
      await store.calendarSources.delete(CURRENT_CALENDAR_SOURCE_ID);
    }
  } catch {
    return {
      ok: false,
      errors: ['calendarSource: Saved read-only calendar source could not be removed.'],
    };
  }

  return { ok: true, removed: Boolean(existing) };
}
