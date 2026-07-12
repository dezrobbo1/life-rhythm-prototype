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
  preferredTaskId?: string | null;
  selectedDate: string;
  selectedDay: DayName;
  timeBlocks: PoolSoftSuggestionTimeBlock[];
};

type SuggestionWindow = {
  blockEndMs: number;
  minimumEndMs: number;
  start: string;
  startMs: number;
};

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function localDateTimeMs(date: string, time: string): number | null {
  const parsed = new Date(`${date}T${time}:00`);
  const milliseconds = parsed.getTime();

  return Number.isNaN(milliseconds) ? null : milliseconds;
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function localTime(value: Date): string {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function timestamp(value: string | undefined): number | null {
  if (!value) return null;

  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? null : milliseconds;
}

function suggestionWindow(
  item: TaskPoolItem,
  block: PoolSoftSuggestionTimeBlock,
  selectedDate: string,
): SuggestionWindow | null {
  const blockStartMs = localDateTimeMs(selectedDate, block.start);
  const blockEndMs = localDateTimeMs(selectedDate, block.end);

  if (blockStartMs === null || blockEndMs === null) return null;

  let startMs = blockStartMs;
  let start = block.start;

  if (item.timeConstraint === 'fixedAt' && item.fixedAt) {
    const fixedAt = timestamp(item.fixedAt);
    if (fixedAt === null) return null;

    const fixedDate = new Date(fixedAt);
    if (localDate(fixedDate) !== selectedDate || fixedAt < blockStartMs || fixedAt >= blockEndMs) {
      return null;
    }

    startMs = fixedAt;
    start = localTime(fixedDate);
  }

  const minimumEndMs = startMs + item.minimum.minutes * 60_000;
  if (minimumEndMs > blockEndMs) return null;

  return {
    blockEndMs,
    minimumEndMs,
    start,
    startMs,
  };
}

function crossesOriginalUsefulEdge(item: TaskPoolItem, window: SuggestionWindow): boolean {
  const latestUsefulStartAt = timestamp(item.latestUsefulStartAt);
  if (latestUsefulStartAt !== null && window.startMs > latestUsefulStartAt) return true;

  const usefulEndEdges = [
    timestamp(item.dueAt),
    timestamp(item.expiresAfter),
    timestamp(item.notUsefulAfter),
  ].filter((value): value is number => value !== null);

  return usefulEndEdges.some((edge) => window.minimumEndMs > edge);
}

function usefulWindowAllows(item: TaskPoolItem, window: SuggestionWindow): boolean {
  const bringBackAfter = timestamp(item.bringBackAfter);
  if (bringBackAfter !== null && window.startMs < bringBackAfter) return false;

  if (crossesOriginalUsefulEdge(item, window) && !item.minimumStillUsefulAfterDeadline) {
    return false;
  }

  return true;
}

function suggestionReason(item: TaskPoolItem, window: SuggestionWindow): string {
  if (crossesOriginalUsefulEdge(item, window) && item.minimumStillUsefulAfterDeadline) {
    return 'The original useful edge is crossed, but you marked the minimum as still helpful.';
  }

  if (item.timeConstraint === 'fixedAt' && item.fixedAt) {
    return 'The fixed-time point fits inside this open-capacity block.';
  }

  if (item.latestUsefulStartAt || item.notUsefulAfter || item.dueAt || item.expiresAfter) {
    return 'The minimum fits inside the useful window. Choose this only if it still helps.';
  }

  return 'This is a user-marked open-capacity block, not blank time.';
}

function toSuggestion(
  item: TaskPoolItem,
  block: PoolSoftSuggestionTimeBlock,
  selectedDate: string,
  window: SuggestionWindow,
): PoolSoftSuggestion {
  return {
    blockEnd: block.end,
    blockId: block.id,
    blockLabel: block.label,
    blockStart: window.start,
    blockTimeRange: `${window.start}-${block.end}`,
    boundaryCopy: 'No schedule created',
    date: selectedDate,
    id: `${item.id}-${selectedDate}-${block.id}`,
    minimumLabel: item.minimum.label,
    minimumMinutes: item.minimum.minutes,
    reason: suggestionReason(item, window),
    taskId: item.id,
    taskTitle: item.title,
  };
}

export function buildPoolSoftSuggestions({
  existingPlacements,
  items,
  preferredTaskId,
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
    .sort((left, right) => {
      if (preferredTaskId) {
        if (left.id === preferredTaskId && right.id !== preferredTaskId) return -1;
        if (right.id === preferredTaskId && left.id !== preferredTaskId) return 1;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });
  const openCapacityBlocks = timeBlocks
    .filter((block) =>
      block.days.includes(selectedDay) &&
      block.type === 'openCapacity' &&
      block.schedulerUse === 'available',
    )
    .sort((left, right) => left.start.localeCompare(right.start));
  const suggestions: PoolSoftSuggestion[] = [];

  for (const item of eligibleItems) {
    let selectedBlock: PoolSoftSuggestionTimeBlock | null = null;
    let selectedWindow: SuggestionWindow | null = null;

    for (const block of openCapacityBlocks) {
      if (usedBlockIds.has(block.id)) continue;

      const window = suggestionWindow(item, block, selectedDate);
      if (!window || !usefulWindowAllows(item, window)) continue;

      selectedBlock = block;
      selectedWindow = window;
      break;
    }

    if (!selectedBlock || !selectedWindow) continue;

    usedBlockIds.add(selectedBlock.id);
    suggestions.push(toSuggestion(item, selectedBlock, selectedDate, selectedWindow));
  }

  return {
    eligibleTaskCount: eligibleItems.length,
    openCapacityBlockCount: openCapacityBlocks.length,
    suggestions,
  };
}
