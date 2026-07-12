import type { DayName } from '../../viewModels';

const dayIndexes: Record<DayName, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const dayNames: DayName[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

function localDateString(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

function stablePlacementPart(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'item';
}

export function localDateForNextSelectedDay(selectedDay: DayName, now = new Date()) {
  const targetDayIndex = dayIndexes[selectedDay];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilTarget = (targetDayIndex - start.getDay() + 7) % 7;

  start.setDate(start.getDate() + daysUntilTarget);

  return localDateString(start);
}

export function dayNameForLocalDate(date: string | null | undefined): DayName | null {
  if (!date) return null;

  const parsed = new Date(`${date}T12:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : dayNames[parsed.getDay()];
}

export function createSoftPlacementId({
  blockId,
  date,
  taskId,
}: {
  blockId: string;
  date: string;
  taskId: string;
}) {
  return `soft-placement-${stablePlacementPart(date)}-${stablePlacementPart(taskId)}-${stablePlacementPart(blockId)}`;
}
