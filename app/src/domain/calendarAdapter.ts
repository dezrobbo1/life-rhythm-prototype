export type CalendarLocalPoint = {
  date: string;
  time?: string;
};

export type CalendarReadEvent = {
  adapterId: string;
  sourceEventId: string;
  title: string;
  allDay: boolean;
  busy: boolean;
  start: CalendarLocalPoint;
  end: CalendarLocalPoint;
  timezone: string;
  sourceTimezone?: string;
};

export type CalendarReadOptions = {
  targetTimezone: string;
  windowStartDate: string;
  windowEndDate: string;
};

export type CalendarReadResult = {
  events: CalendarReadEvent[];
  warnings: string[];
};

export interface CalendarAdapter {
  readonly id: string;
  read(source: string, options: CalendarReadOptions): CalendarReadResult;
}

type ParsedProperty = {
  name: string;
  params: Record<string, string>;
  value: string;
};

type LocalDateTimeComponents = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type ParsedDateValue = {
  allDay: boolean;
  date: string;
  time?: string;
  epochMs?: number;
  sourceTimezone?: string;
};

function unfoldLines(source: string): string[] {
  return source
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function parseProperty(line: string): ParsedProperty | null {
  const colon = line.indexOf(':');
  if (colon < 1) return null;

  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [rawName, ...rawParams] = left.split(';');
  const params: Record<string, string> = {};

  for (const rawParam of rawParams) {
    const equals = rawParam.indexOf('=');
    if (equals < 1) continue;
    params[rawParam.slice(0, equals).toUpperCase()] = rawParam.slice(equals + 1);
  }

  return {
    name: rawName.toUpperCase(),
    params,
    value,
  };
}

function decodeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function formatDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function partsInZone(epochMs: number, timezone: string): LocalDateTimeComponents {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(epochMs));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function localComponentsMatch(left: LocalDateTimeComponents, right: LocalDateTimeComponents): boolean {
  return left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second;
}

function zonedLocalToEpoch(
  components: LocalDateTimeComponents,
  timezone: string,
): number {
  let guess = Date.UTC(
    components.year,
    components.month - 1,
    components.day,
    components.hour,
    components.minute,
    components.second,
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const represented = partsInZone(guess, timezone);
    const representedAsUtc = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
      represented.second,
    );
    const intendedAsUtc = Date.UTC(
      components.year,
      components.month - 1,
      components.day,
      components.hour,
      components.minute,
      components.second,
    );
    const delta = representedAsUtc - intendedAsUtc;
    if (delta === 0) break;
    guess -= delta;
  }

  const represented = partsInZone(guess, timezone);
  if (!localComponentsMatch(represented, components)) {
    throw new RangeError(`Local calendar time cannot be represented in timezone ${timezone}.`);
  }

  return guess;
}

function pointFromEpoch(epochMs: number, targetTimezone: string): ParsedDateValue {
  const parts = partsInZone(epochMs, targetTimezone);
  return {
    allDay: false,
    date: formatDate(parts.year, parts.month, parts.day),
    time: formatTime(parts.hour, parts.minute),
    epochMs,
  };
}

function parseDateProperty(
  property: ParsedProperty,
  targetTimezone: string,
  warnings: string[],
): ParsedDateValue | null {
  if (property.params.VALUE?.toUpperCase() === 'DATE' || /^\d{8}$/.test(property.value)) {
    const match = property.value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return null;

    return {
      allDay: true,
      date: formatDate(Number(match[1]), Number(match[2]), Number(match[3])),
    };
  }

  const match = property.value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;

  const components: LocalDateTimeComponents = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? '0'),
  };

  if (match[7] === 'Z') {
    return pointFromEpoch(
      Date.UTC(
        components.year,
        components.month - 1,
        components.day,
        components.hour,
        components.minute,
        components.second,
      ),
      targetTimezone,
    );
  }

  const sourceTimezone = property.params.TZID?.replace(/^"|"$/g, '');
  if (!sourceTimezone) {
    warnings.push(`Floating calendar time ${property.value} was interpreted in ${targetTimezone}.`);
    return {
      allDay: false,
      date: formatDate(components.year, components.month, components.day),
      time: formatTime(components.hour, components.minute),
      epochMs: zonedLocalToEpoch(components, targetTimezone),
      sourceTimezone: targetTimezone,
    };
  }

  const epochMs = zonedLocalToEpoch(components, sourceTimezone);
  return {
    ...pointFromEpoch(epochMs, targetTimezone),
    sourceTimezone,
  };
}

function compareLocalPoints(left: CalendarLocalPoint, right: CalendarLocalPoint): number {
  return `${left.date}T${left.time ?? '00:00'}`.localeCompare(`${right.date}T${right.time ?? '00:00'}`);
}

function overlapsDateWindow(event: CalendarReadEvent, startDate: string, endDate: string): boolean {
  if (event.allDay) {
    return event.start.date <= endDate && event.end.date > startDate;
  }

  if (event.end.date < startDate || event.start.date > endDate) return false;
  if (event.end.date === startDate && event.end.time === '00:00') return false;
  return true;
}

function collectEventBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      current = [];
      continue;
    }
    if (line.toUpperCase() === 'END:VEVENT') {
      if (current) blocks.push(current);
      current = null;
      continue;
    }
    current?.push(line);
  }

  return blocks;
}

function propertyMap(lines: string[]): Map<string, ParsedProperty[]> {
  const map = new Map<string, ParsedProperty[]>();

  for (const line of lines) {
    const property = parseProperty(line);
    if (!property) continue;
    const existing = map.get(property.name) ?? [];
    existing.push(property);
    map.set(property.name, existing);
  }

  return map;
}

function firstProperty(map: Map<string, ParsedProperty[]>, name: string): ParsedProperty | undefined {
  return map.get(name)?.[0];
}

function recurringEvents(source: string, options: CalendarReadOptions, warnings: string[]): CalendarReadEvent[] {
  // ICAL.js normalizes unknown RRULE clauses away. Validate the original VEVENT
  // text before parsing, but only when the component can contribute busy time.
  // VTIMEZONE observance rules and explicitly cancelled/transparent VEVENTs do
  // not authorize planning blockers and must not make an otherwise usable
  // calendar fail closed.
  const supportedRuleClauses = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTH', 'BYMONTHDAY', 'WKST']);
  for (const block of collectEventBlocks(unfoldLines(source))) {
    const properties = propertyMap(block);
    const status = firstProperty(properties, 'STATUS')?.value.toUpperCase();
    const transparency = firstProperty(properties, 'TRANSP')?.value.toUpperCase();
    if (status === 'CANCELLED' || transparency === 'TRANSPARENT') continue;
    for (const rule of properties.get('RRULE') ?? []) {
      if (Object.keys(rule.params).length > 0) throw new Error('Unsupported busy recurrence parameters.');
      const clauses = rule.value.toUpperCase().split(';').map((clause) => clause.split('='));
      if (!clauses.some(([key, value]) => key === 'FREQ' && /^(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(value ?? '')) ||
        clauses.some(([key, value]) => !supportedRuleClauses.has(key) || !value) ||
        new Set(clauses.map(([key]) => key)).size !== clauses.length) {
        throw new Error('Unsupported busy recurrence rule.');
      }
    }
  }
  const calendar = new ICAL.Component(ICAL.parse(source));
  if (calendar.name !== 'vcalendar') throw new Error('Invalid calendar document.');
  const components = calendar.getAllSubcomponents('vevent');
  const grouped = new Map<string, ICAL.Component[]>();
  for (const component of components) {
    if (!['rrule', 'rdate', 'exdate', 'recurrence-id'].some((name) => component.hasProperty(name))) continue;
    const uid = component.getFirstPropertyValue('uid');
    if (typeof uid !== 'string' || !uid.trim()) throw new Error('Calendar UID is required.');
    grouped.set(uid, [...(grouped.get(uid) ?? []), component]);
  }
  const events: CalendarReadEvent[] = [];
  const MAX_RECURRING_SERIES = 250;
  const MAX_TOTAL_RECURRENCE_ITERATIONS = 50_000;
  const MAX_TOTAL_RECURRENCE_EVENTS = 10_000;
  if (grouped.size > MAX_RECURRING_SERIES) {
    throw new Error('Calendar contains too many recurring series for a safe browser read.');
  }
  let totalRecurrenceIterations = 0;
  for (const [uid, parts] of grouped) {
    const masters = parts.filter((part) => !part.hasProperty('recurrence-id'));
    if (masters.length !== 1) throw new Error(`Calendar event ${uid} has no unique recurrence master.`);
    const master = new ICAL.Event(masters[0]);
    const allParts = [masters[0], ...parts.filter((part) => part !== masters[0])];
    const recurrence = allParts.some((part) => ['rrule', 'rdate', 'exdate', 'recurrence-id'].some((name) => part.hasProperty(name)));
    if (!recurrence) continue;
    for (const part of allParts) {
      const partStatus = part.getFirstPropertyValue('status')?.toString().toUpperCase();
      const effectiveTransparency = (part.getFirstPropertyValue('transp') ?? masters[0].getFirstPropertyValue('transp'))
        ?.toString().toUpperCase();
      const relevantBusyPart = partStatus !== 'CANCELLED' && effectiveTransparency !== 'TRANSPARENT';
      if (relevantBusyPart && part.hasProperty('rrule')) {
        for (const rule of part.getAllProperties('rrule')) {
          const raw = rule.getFirstValue()?.toString() ?? '';
          const clauses = raw.toUpperCase().split(';').map((clause) => clause.split('='));
          const supported = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTH', 'BYMONTHDAY', 'WKST']);
          if (!/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;|$)/i.test(raw) ||
            clauses.some(([key, value]) => !supported.has(key) || !value) ||
            new Set(clauses.map(([key]) => key)).size !== clauses.length) {
            throw new Error(`Unsupported busy recurrence for ${uid}.`);
          }
        }
      }
      if (relevantBusyPart && part.hasProperty('recurrence-id') && part.getFirstProperty('recurrence-id')?.getParameter('range')) {
        throw new Error(`Unsupported recurrence range for ${uid}.`);
      }
    }
    for (const exception of parts.filter((part) => part !== masters[0])) master.relateException(exception);
    const startZone = masters[0].getFirstProperty('dtstart')?.getParameter('tzid') as string | undefined;
    const endZone = masters[0].getFirstProperty('dtend')?.getParameter('tzid') as string | undefined;
    const sourceTimezone = startZone?.replace(/^"|"$/g, '');
    const sourceEndTimezone = endZone?.replace(/^"|"$/g, '') ?? sourceTimezone;
    if (sourceTimezone) partsInZone(Date.now(), sourceTimezone);
    if (sourceEndTimezone && sourceEndTimezone !== sourceTimezone) partsInZone(Date.now(), sourceEndTimezone);
    const asEpoch = (
      time: ICAL.Time,
      component: ICAL.Component,
      propertyName: 'dtstart' | 'dtend',
      fallbackTimezone?: string,
    ): number => {
      const timeZone = component.getFirstProperty(propertyName)?.getParameter('tzid') as string | undefined;
      const tz = timeZone?.replace(/^"|"$/g, '') ?? fallbackTimezone;
      if (time.zone === ICAL.Timezone.utcTimezone) return time.toJSDate().getTime();
      if (!tz && !time.isDate) warnings.push(`Floating calendar time for ${uid} was interpreted in ${options.targetTimezone}.`);
      return zonedLocalToEpoch(
        { year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second },
        tz ?? options.targetTimezone,
      );
    };
    const emittedOccurrenceIds = new Set<string>();
    const addOccurrence = (identity: ICAL.Time, item: ICAL.Event, startTime: ICAL.Time, endTime: ICAL.Time) => {
      if (item.component.getFirstPropertyValue('status')?.toString().toUpperCase() === 'CANCELLED') return;
      const sourceEventId = `${uid}::${identity.toString()}`;
      if (emittedOccurrenceIds.has(sourceEventId)) return;
      const allDay = startTime.isDate;
      const start: CalendarLocalPoint = allDay
        ? { date: formatDate(startTime.year, startTime.month, startTime.day) }
        : pointFromEpoch(asEpoch(startTime, item.component, 'dtstart', sourceTimezone), options.targetTimezone);
      const end: CalendarLocalPoint = allDay
        ? { date: formatDate(endTime.year, endTime.month, endTime.day) }
        : pointFromEpoch(asEpoch(endTime, item.component, 'dtend', sourceEndTimezone), options.targetTimezone);
      if (start.date >= end.date && (allDay || start.date !== end.date || (start.time ?? '') >= (end.time ?? ''))) throw new Error(`Invalid calendar occurrence ${uid}.`);
      const event: CalendarReadEvent = {
        adapterId: 'ics', sourceEventId, title: item.summary || master.summary || 'Calendar commitment',
        allDay, busy: (item.component.getFirstPropertyValue('transp') ?? master.component.getFirstPropertyValue('transp'))
          ?.toString().toUpperCase() !== 'TRANSPARENT',
        start: { date: start.date, time: start.time }, end: { date: end.date, time: end.time },
        timezone: options.targetTimezone, ...((item.component.getFirstProperty('dtstart')?.getParameter('tzid') ?? sourceTimezone)
          ? { sourceTimezone: (item.component.getFirstProperty('dtstart')?.getParameter('tzid') as string | undefined) ?? sourceTimezone }
          : {}),
      };
      if (overlapsDateWindow(event, options.windowStartDate, options.windowEndDate)) {
        if (events.length >= MAX_TOTAL_RECURRENCE_EVENTS) {
          throw new Error('Calendar recurrence exceeds the safe emitted-event limit.');
        }
        events.push(event);
        emittedOccurrenceIds.add(sourceEventId);
      }
    };
    const iterator = master.iterator();
    let next: ICAL.Time | null;
    while ((next = iterator.next())) {
      if (++totalRecurrenceIterations > MAX_TOTAL_RECURRENCE_ITERATIONS) {
        throw new Error('Calendar recurrence exceeds the safe read limit.');
      }
      const details = master.getOccurrenceDetails(next);
      addOccurrence(details.recurrenceId, details.item, details.startDate, details.endDate);
      // Earlier logical dates can move into the horizon, so read them until the horizon ends.
      if (formatDate(next.year, next.month, next.day) > options.windowEndDate) break;
    }
    // A later logical date can also be moved into the requested horizon.
    for (const exception of parts.filter((part) => part.hasProperty('recurrence-id'))) {
      const id = exception.getFirstPropertyValue('recurrence-id') as ICAL.Time;
      if (formatDate(id.year, id.month, id.day) <= options.windowEndDate) continue;
      const item = new ICAL.Event(exception);
      addOccurrence(id, item, item.startDate, item.endDate);
    }
  }
  return events;
}

export class IcsCalendarAdapter implements CalendarAdapter {
  readonly id = 'ics';

  read(source: string, options: CalendarReadOptions): CalendarReadResult {
    const warnings: string[] = [];
    const events: CalendarReadEvent[] = [];

    if (options.windowStartDate > options.windowEndDate) {
      throw new Error('Calendar read window start must not be after the end date.');
    }

    // Validate the requested zone up front so bad application configuration fails visibly.
    partsInZone(Date.now(), options.targetTimezone);

    for (const block of collectEventBlocks(unfoldLines(source))) {
      const properties = propertyMap(block);
      if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].some((name) => properties.has(name))) continue;
      const status = firstProperty(properties, 'STATUS')?.value.toUpperCase();
      if (status === 'CANCELLED') continue;

      const uid = firstProperty(properties, 'UID')?.value.trim();
      const startProperty = firstProperty(properties, 'DTSTART');
      const endProperty = firstProperty(properties, 'DTEND');

      if (!uid || !startProperty || !endProperty) {
        warnings.push('A calendar event was skipped because UID, DTSTART or DTEND was missing.');
        continue;
      }


      let start: ParsedDateValue | null;
      let end: ParsedDateValue | null;
      try {
        start = parseDateProperty(startProperty, options.targetTimezone, warnings);
        end = parseDateProperty(endProperty, options.targetTimezone, warnings);
      } catch {
        warnings.push(`Calendar event ${uid} was skipped because its timezone or local time could not be resolved.`);
        continue;
      }

      if (!start || !end || start.allDay !== end.allDay) {
        warnings.push(`Calendar event ${uid} was skipped because its date/time form is unsupported.`);
        continue;
      }

      if (start.allDay) {
        if (start.date >= end.date) {
          warnings.push(`Calendar event ${uid} was skipped because its end is not after its start.`);
          continue;
        }
      } else {
        if (start.epochMs === undefined || end.epochMs === undefined || start.epochMs >= end.epochMs) {
          warnings.push(`Calendar event ${uid} was skipped because its end is not after its start.`);
          continue;
        }
      }

      const recurrenceId = firstProperty(properties, 'RECURRENCE-ID')?.value;
      const sourceEventId = recurrenceId ? `${uid}::${recurrenceId}` : uid;
      const title = decodeText(firstProperty(properties, 'SUMMARY')?.value ?? 'Calendar commitment');
      const busy = firstProperty(properties, 'TRANSP')?.value.toUpperCase() !== 'TRANSPARENT';
      const event: CalendarReadEvent = {
        adapterId: this.id,
        sourceEventId,
        title,
        allDay: start.allDay,
        busy,
        start: { date: start.date, time: start.time },
        end: { date: end.date, time: end.time },
        timezone: options.targetTimezone,
        sourceTimezone: start.sourceTimezone,
      };

      if (overlapsDateWindow(event, options.windowStartDate, options.windowEndDate)) {
        events.push(event);
      }
    }

    events.push(...recurringEvents(source, options, warnings));

    events.sort((left, right) => {
      const startOrder = compareLocalPoints(left.start, right.start);
      return startOrder !== 0 ? startOrder : left.sourceEventId.localeCompare(right.sourceEventId);
    });

    return { events, warnings };
  }
}

export const icsCalendarAdapter: CalendarAdapter = new IcsCalendarAdapter();
import ICAL from 'ical.js';
