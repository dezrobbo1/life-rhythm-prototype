import type { TaskPoolItem, TaskPoolItemStatus } from '../../data/schemas';

export type TaskPoolResurfacingGroup = {
  helper: string;
  id: 'safely-held' | 'parked' | 'ready-to-revisit' | 'bring-back-later' | 'not-today';
  items: TaskPoolItem[];
  title: string;
};

const visibleTaskPoolStatuses = new Set<TaskPoolItemStatus>([
  'captured',
  'suggested',
  'softPlaced',
  'parked',
  'notToday',
  'deferred',
]);

function parsedTimestamp(value: string | undefined): number | null {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isTaskPoolItemReadyToRevisit(
  item: TaskPoolItem,
  nowMs = Date.now(),
): boolean {
  if (item.status !== 'deferred') return false;

  const bringBackAfter = parsedTimestamp(item.bringBackAfter);
  return bringBackAfter === null || bringBackAfter <= nowMs;
}

export function nextTaskPoolResurfacingAt(
  items: TaskPoolItem[],
  nowMs = Date.now(),
): number | null {
  const futureTimestamps = items
    .filter((item) => item.status === 'deferred')
    .map((item) => parsedTimestamp(item.bringBackAfter))
    .filter((timestamp): timestamp is number => timestamp !== null && timestamp > nowMs)
    .sort((left, right) => left - right);

  return futureTimestamps[0] ?? null;
}

export function buildTaskPoolResurfacingGroups(
  items: TaskPoolItem[],
  nowMs = Date.now(),
): TaskPoolResurfacingGroup[] {
  const visibleItems = items.filter((item) => visibleTaskPoolStatuses.has(item.status));
  const definitions: Array<Omit<TaskPoolResurfacingGroup, 'items'> & {
    matches: (item: TaskPoolItem) => boolean;
  }> = [
    {
      helper: 'Ready when you choose.',
      id: 'safely-held',
      matches: (item) => ['captured', 'suggested', 'softPlaced'].includes(item.status),
      title: 'Safely held',
    },
    {
      helper: 'Safe to return to when it fits.',
      id: 'parked',
      matches: (item) => item.status === 'parked',
      title: 'Parked',
    },
    {
      helper: 'The time you chose has arrived. Nothing moved automatically.',
      id: 'ready-to-revisit',
      matches: (item) => isTaskPoolItemReadyToRevisit(item, nowMs),
      title: 'Ready to revisit',
    },
    {
      helper: 'Held until the time you chose.',
      id: 'bring-back-later',
      matches: (item) => item.status === 'deferred' && !isTaskPoolItemReadyToRevisit(item, nowMs),
      title: 'Bring back later',
    },
    {
      helper: 'Kept out of the current day.',
      id: 'not-today',
      matches: (item) => item.status === 'notToday',
      title: 'Not today',
    },
  ];

  return definitions
    .map(({ matches, ...definition }) => ({
      ...definition,
      items: visibleItems.filter(matches),
    }))
    .filter((group) => group.items.length > 0);
}
