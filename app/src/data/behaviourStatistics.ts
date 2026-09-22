import {
  loadBehaviourEventsResult,
  type BehaviourEventStore,
} from './behaviourEventRepository';
import type { CollectionReadResult } from './collectionReadResult';
import type { BehaviourEvent } from './schemas';

export type DurationSummary = {
  maximumObservedMinutes: number | null;
  medianActualMinutes: number | null;
  minimumObservedMinutes: number | null;
  sampleCount: number;
};

export type GroupedDurationSummary = DurationSummary & {
  id: string;
};

const countedEventTypes = [
  'taskStarted',
  'taskCompleted',
  'taskMinimumAchieved',
  'taskParked',
  'taskNotToday',
  'taskDeferred',
  'userPlacementCreated',
  'userPlacementMoved',
  'userPlacementRemoved',
  'schedulerPlacementAdded',
  'schedulerPlacementMoved',
  'schedulerPlacementRemoved',
  'schedulerPlacementVariantChanged',
  'schedulerRepairUndone',
] as const satisfies readonly BehaviourEvent['eventType'][];

type CountedEventType = (typeof countedEventTypes)[number];
type BehaviourEventCounts = Record<CountedEventType, number>;

export const timeOfDayBucketDefinitions = {
  morning: '05:00–11:59',
  midday: '12:00–13:59',
  afternoon: '14:00–17:59',
  evening: '18:00–22:59',
  night: '23:00–04:59',
} as const;

type TimeOfDayBucket = keyof typeof timeOfDayBucketDefinitions;
type TimeOfDayObservation = Record<TimeOfDayBucket, number> & {
  sampleCount: number;
};

export type BehaviourStatistics = {
  duration: {
    byTaskId: GroupedDurationSummary[];
    byTemplateId: GroupedDurationSummary[];
    completionEventCount: number;
    completionEventsWithoutActualMinutes: number;
    overall: DurationSummary;
  };
  eventCounts: BehaviourEventCounts;
  provenance: {
    byOrigin: Record<BehaviourEvent['provenance']['origin'], number>;
    bySource: Record<BehaviourEvent['source'], number>;
  };
  timeOfDay: {
    taskCompleted: TimeOfDayObservation;
    taskStarted: TimeOfDayObservation;
  };
};

export type BehaviourStatisticsReadResult =
  | {
      invalidRecordCount: number;
      statistics: BehaviourStatistics;
      status: 'ok' | 'partial';
      validEventCount: number;
    }
  | {
      errors: string[];
      status: 'readFailed';
    };

function emptyEventCounts(): BehaviourEventCounts {
  return {
    schedulerPlacementAdded: 0,
    schedulerPlacementMoved: 0,
    schedulerPlacementRemoved: 0,
    schedulerPlacementVariantChanged: 0,
    schedulerRepairUndone: 0,
    taskCompleted: 0,
    taskDeferred: 0,
    taskMinimumAchieved: 0,
    taskNotToday: 0,
    taskParked: 0,
    taskStarted: 0,
    userPlacementCreated: 0,
    userPlacementMoved: 0,
    userPlacementRemoved: 0,
  };
}

function emptyTimeOfDayObservation(): TimeOfDayObservation {
  return {
    afternoon: 0,
    evening: 0,
    midday: 0,
    morning: 0,
    night: 0,
    sampleCount: 0,
  };
}

function summariseDurations(minutes: readonly number[]): DurationSummary {
  if (minutes.length === 0) {
    return {
      maximumObservedMinutes: null,
      medianActualMinutes: null,
      minimumObservedMinutes: null,
      sampleCount: 0,
    };
  }

  const ordered = [...minutes].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const median = ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];

  return {
    maximumObservedMinutes: ordered[ordered.length - 1],
    medianActualMinutes: median,
    minimumObservedMinutes: ordered[0],
    sampleCount: ordered.length,
  };
}

function groupedDurationSummaries(groups: Map<string, number[]>): GroupedDurationSummary[] {
  return [...groups.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([id, minutes]) => ({ id, ...summariseDurations(minutes) }));
}

const localHourFormatters = new Map<string, Intl.DateTimeFormat>();

function localHour(event: BehaviourEvent): number {
  let formatter = localHourFormatters.get(event.timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: event.timezone,
    });
    localHourFormatters.set(event.timezone, formatter);
  }

  const hour = formatter.formatToParts(new Date(event.occurredAt))
    .find((part) => part.type === 'hour')?.value;
  return Number(hour);
}

function timeOfDayBucket(event: BehaviourEvent): TimeOfDayBucket {
  const hour = localHour(event);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

function addToGroup(groups: Map<string, number[]>, id: string, minutes: number) {
  const existing = groups.get(id);
  if (existing) existing.push(minutes);
  else groups.set(id, [minutes]);
}

export function deriveBehaviourStatistics(events: readonly BehaviourEvent[]): BehaviourStatistics {
  const eventCounts = emptyEventCounts();
  const countedTypeSet = new Set<BehaviourEvent['eventType']>(countedEventTypes);
  const byTask = new Map<string, number[]>();
  const byTemplate = new Map<string, number[]>();
  const observedCompletionMinutes: number[] = [];
  const timeOfDay = {
    taskCompleted: emptyTimeOfDayObservation(),
    taskStarted: emptyTimeOfDayObservation(),
  };
  const provenance: BehaviourStatistics['provenance'] = {
    byOrigin: { automaticRepair: 0, initialPlanBuild: 0, undo: 0, userAction: 0 },
    bySource: { scheduler: 0, user: 0 },
  };
  let completionEventCount = 0;
  let completionEventsWithoutActualMinutes = 0;

  for (const event of events) {
    if (countedTypeSet.has(event.eventType)) {
      eventCounts[event.eventType as CountedEventType] += 1;
    }
    provenance.bySource[event.source] += 1;
    provenance.byOrigin[event.provenance.origin] += 1;

    if (event.eventType === 'taskStarted' || event.eventType === 'taskCompleted') {
      const observation = timeOfDay[event.eventType];
      observation[timeOfDayBucket(event)] += 1;
      observation.sampleCount += 1;
    }

    if (event.eventType !== 'taskCompleted') continue;
    completionEventCount += 1;
    if (event.actualMinutes === undefined) {
      completionEventsWithoutActualMinutes += 1;
      continue;
    }

    observedCompletionMinutes.push(event.actualMinutes);
    if (event.taskId) addToGroup(byTask, event.taskId, event.actualMinutes);
    if (event.templateId) addToGroup(byTemplate, event.templateId, event.actualMinutes);
  }

  return {
    duration: {
      byTaskId: groupedDurationSummaries(byTask),
      byTemplateId: groupedDurationSummaries(byTemplate),
      completionEventCount,
      completionEventsWithoutActualMinutes,
      overall: summariseDurations(observedCompletionMinutes),
    },
    eventCounts,
    provenance,
    timeOfDay,
  };
}

export function deriveBehaviourStatisticsResult(
  readResult: CollectionReadResult<BehaviourEvent>,
): BehaviourStatisticsReadResult {
  if (readResult.status === 'readFailed') return readResult;

  return {
    invalidRecordCount: readResult.invalidRecordCount,
    statistics: deriveBehaviourStatistics(readResult.items),
    status: readResult.status,
    validEventCount: readResult.items.length,
  };
}

export async function loadBehaviourStatisticsResult(
  store?: BehaviourEventStore,
): Promise<BehaviourStatisticsReadResult> {
  return deriveBehaviourStatisticsResult(await loadBehaviourEventsResult(store));
}
