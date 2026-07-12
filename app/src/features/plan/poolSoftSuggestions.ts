import type { SoftPlacement, TaskPoolItem } from '../../data/schemas';
import type { DayName } from '../../viewModels';

export type PoolSoftSuggestionTimeBlock = {
  days: string[];
  end: string;
  id: string;
  label: string;
  notes?: string;
  schedulerUse: 'unavailable' | 'askFirst' | 'available';
  start: string;
  type: 'protectedTime' | 'recoveryTime' | 'looseTime' | 'householdFlow' | 'familyTime' | 'openCapacity';
};

const eligiblePoolStatuses = new Set<TaskPoolItem['status']>([
  'captured',
  'suggested',
  'parked',
  'notToday',
  'deferred',
]);

const visiblePlacementStatuses = new Set<SoftPlacement['status']>([
  'planned',
  'moved',
  'completedFromToday',
]);

export type PoolSoftSuggestion = {
  blockEnd: string;
  blockId: string;
  blockLabel: string;
  blockStart: string;
  blockTimeRange: string;
  boundaryCopy: 'No schedule created';
  date: string;
  id: string;
  minimumLabel: string;
  minimumMinutes: number;
  reason: string;
  taskId: string;
  taskTitle: string;
};

export type PoolSoftSuggestionsResult = {
  eligibleTaskCount: number;
  openCapacityBlockCount: number;
  suggestions: PoolSoftSuggestion[];
};

type BuildPoolSoftSuggestionsInput = {
  existingPlacements: SoftPlacement[];
  items: TaskPoolItem[];
  selectedDate: string;
  selectedDay: DayName;
  timeBlocks: PoolSoftSuggestionTimeBlock[];
};

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function localDateTimeMs(date: string, time: string): number | null {
  const parsed = new Date(`${date}T${time}:00`);
  const milliseconds = parsed.getTime();

  return Number.isNaN(milliseconds) ? null : milliseconds;
}

function timestamp(value: string | undefined): number | null {
  if (!value) return null;

  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? null : milliseconds;
}

function minimumFits(item: TaskPoolItem, block: PoolSoftSuggestionTimeBlock): boolean {
  return item.minimum.minutes <= minutesFromTime(block.end) - minutesFromTime(block.start);
}

function originalUsefulEdgeHasPassed(item: TaskPoolItem, blockStartMs: number): boolean {
  const usefulEdges = [
    timestamp(item.latestUsefulStartAt),
    timestamp(item.notUsefulAfter),
    timestamp(item.dueAt),
    timestamp(item.expiresAfter),
  ].filter((value): value is number => value !== null);

  return usefulEdges.some((edge) => blockStartMs > edge);
}

function usefulWindowAllows(
  item: TaskPoolItem,
  block: PoolSoftSuggestionTimeBlock,
  selectedDate: string,
): boolean {
  const blockStartMs = localDateTimeMs(selectedDate, block.start);
  const blockEndMs = localDateTimeMs(selectedDate, block.end);

  if (blockStartMs === null || blockEndMs === null) return false;

  const bringBackAfter = timestamp(item.bringBackAfter);
  if (bringBackAfter !== null && blockStartMs < bringBackAfter) return false;

  if (item.timeConstraint === 'fixedAt' && item.fixedAt) {
    const fixedAt = timestamp(item.fixedAt);
    if (fixedAt === null || fixedAt < blockStartMs || fixedAt > blockEndMs) return false;
  }

  if (originalUsefulEdgeHasPassed(item, blockStartMs) && !item.minimumStillUsefulAfterDeadline) {
    return false;
  }

  return true;
}

function suggestionReason(item: TaskPoolItem, blockStartMs: number): string {
  if (originalUsefulEdgeHasPassed(item, blockStartMs) && item.minimumStillUsefulAfterDeadline) {
    return 'The original useful edge has passed, but you marked the minimum as still helpful.';
  }

  if (item.latestUsefulStartAt || item.notUsefulAfter || item.dueAt || item.expiresAfter || item.fixedAt) {
    return 'The useful window is still visible. Choose this only if it still helps.';
  }

  return 'This is a user-marked open-capacity block, not blank time.';
}

function toSuggestion(
  item: TaskPoolItem,
  block: PoolSoftSuggestionTimeBlock,
  selectedDate: string,
): PoolSoftSuggestion {
  const blockStartMs = localDateTimeMs(selectedDate, block.start) ?? Date.now();

  return {
    blockEnd: block.end,
    blockId: block.id,
    blockLabel: block.label,
    blockStart: block.start,
    blockTimeRange: `${block.start}-${block.end}`,
    boundaryCopy: 'No schedule created',
    date: selectedDate,
    id: `${item.id}-${selectedDate}-${block.id}`,
    minimumLabel: item.minimum.label,
    minimumMinutes: item.minimum.minutes,
    reason: suggestionReason(item, blockStartMs),
    taskId: item.id,
    taskTitle: item.title,
  };
}

export function buildPoolSoftSuggestions({
  existingPlacements,
  items,
  selectedDate,
  selectedDay,
  timeBlocks,
}: BuildPoolSoftSuggestionsInput): PoolSoftSuggestionsResult {
  const visiblePlacements = existingPlacements.filter((placement) =>
    placement.date === selectedDate && visiblePlacementStatuses.has(placement.status),
  );
  const placedTaskIds = new Set(visiblePlacements.map((placement) => placement.taskId));
  const usedBlockIds = new Set(visiblePlacements.map((placement) => placement.blockId));
  const eligibleItems = items
    .filter((item) => eligiblePoolStatuses.has(item.status))
    .filter((item) => !placedTaskIds.has(item.id))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const openCapacityBlocks = timeBlocks
    .filter((block) =>
      block.days.includes(selectedDay) &&
      block.type === 'openCapacity' &&
      block.schedulerUse === 'available',
    )
    .sort((left, right) => left.start.localeCompare(right.start));
  const suggestions: PoolSoftSuggestion[] = [];

  for (const item of eligibleItems) {
    const block = openCapacityBlocks.find((candidate) =>
      !usedBlockIds.has(candidate.id) &&
      minimumFits(item, candidate) &&
      usefulWindowAllows(item, candidate, selectedDate),
    );

    if (!block) continue;

    usedBlockIds.add(block.id);
    suggestions.push(toSuggestion(item, block, selectedDate));
  }

  return {
    eligibleTaskCount: eligibleItems.length,
    openCapacityBlockCount: openCapacityBlocks.length,
    suggestions,
  };
}
