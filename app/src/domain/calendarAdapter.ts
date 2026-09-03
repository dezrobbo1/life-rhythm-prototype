export type CalendarLocalPoint = {
  date: string;
  time?: string;
};

export type CalendarReadEvent = {
  adapterId: 'ics';
  sourceEventId: string;
  title: string;
  allDay: boolean;
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

function partsInZone(epochMs: number, timezone: string) {
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

function zonedLocalToEpoch(
  components: { year: number; month: number; day: number; hour: number; minute: number; second: number },
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

  const components = {
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

  const sourceTimezone = property.params.TZID;
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

export class IcsCalendarAdapter implements CalendarAdapter {
  readonly id = 'ics';

  read(source: string, options: CalendarReadOptions): CalendarReadResult {
    const warnings: string[] = [];
    const events: CalendarReadEvent[] = [];

    if (options.windowStartDate > options.windowEndDate) {
      throw new Error('Calendar read window start must not be after the end date.');
    }

    // Validate the requested zone up front so bad configuration fails visibly.
    partsInZone(Date.now(), options.targetTimezone);

    for (const block of collectEventBlocks(unfoldLines(source))) {
      const properties = propertyMap(block);
      const status = firstProperty(properties, 'STATUS')?.value.toUpperCase();
      if (status === 'CANCELLED') continue;

      const uid = firstProperty(properties, 'UID')?.value.trim();
      const startProperty = firstProperty(properties, 'DTSTART');
      const endProperty = firstProperty(properties, 'DTEND');

      if (!uid || !startProperty || !endProperty) {
        warnings.push('A calendar event was skipped because UID, DTSTART or DTEND was missing.');
        continue;
      }

      if (firstProperty(properties, 'RRULE')) {
        warnings.push(`Recurring event ${uid} is imported as its DTSTART occurrence only in Gate 2.`);
      }

      const start = parseDateProperty(startProperty, options.targetTimezone, warnings);
      const end = parseDateProperty(endProperty, options.targetTimezone, warnings);
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
      const event: CalendarReadEvent = {
        adapterId: 'ics',
        sourceEventId,
        title,
        allDay: start.allDay,
        start: { date: start.date, time: start.time },
        end: { date: end.date, time: end.time },
        timezone: options.targetTimezone,
        sourceTimezone: start.sourceTimezone,
      };

      if (overlapsDateWindow(event, options.windowStartDate, options.windowEndDate)) {
        events.push(event);
      }
    }

    events.sort((left, right) => {
      const startOrder = compareLocalPoints(left.start, right.start);
      return startOrder !== 0 ? startOrder : left.sourceEventId.localeCompare(right.sourceEventId);
    });

    return { events, warnings };
  }
}

export const icsCalendarAdapter: CalendarAdapter = new IcsCalendarAdapter();
