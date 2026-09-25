import type { Table } from 'dexie';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  behaviourEventSchema,
  type ActiveTask,
  type BehaviourEvent,
  type BehaviourEventFact,
  type SoftPlacement,
  type TaskHistory,
  type TaskPoolItem,
} from './schemas';
import {
  successfulCollectionRead,
  type CollectionReadResult,
} from './collectionReadResult';
import type {
  InternalPlacement,
  SchedulerPlan,
  SchedulerPlanChange,
} from '../domain/schedulingModel';

type TaskHistoryTable = Pick<Table<TaskHistory, string>, 'add' | 'get' | 'toArray' | 'where'>;

export type BehaviourEventStore = {
  taskHistory: TaskHistoryTable;
};

type CreateBehaviourEventInput = Omit<
  BehaviourEvent,
  'id' | 'localDate' | 'recordKind' | 'timezone' | 'version'
> & {
  id?: string;
  localDate?: string;
  timezone?: string;
};

function eventId(prefix = 'behaviour-event') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const localDateFormatters = new Map<string, Intl.DateTimeFormat>();

function localDateAt(occurredAt: string, timezone: string) {
  let formatter = localDateFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: timezone,
      year: 'numeric',
    });
    localDateFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(new Date(occurredAt));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function createBehaviourEvent(input: CreateBehaviourEventInput): BehaviourEvent {
  const timezone = input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  return behaviourEventSchema.parse({
    ...input,
    id: input.id ?? eventId(),
    localDate: input.localDate ?? localDateAt(input.occurredAt, timezone),
    recordKind: 'behaviourEvent',
    timezone,
    version: 1,
  });
}

export async function appendBehaviourEvent(
  event: BehaviourEvent,
  store: BehaviourEventStore = getCurrentLifeRhythmDatabase(),
) {
  const parsed = behaviourEventSchema.parse(event);
  const existing = await store.taskHistory.get(parsed.id);

  if (existing !== undefined) {
    const existingEvent = behaviourEventSchema.safeParse(existing);
    if (existingEvent.success && JSON.stringify(existingEvent.data) === JSON.stringify(parsed)) {
      return parsed;
    }
    throw new Error(`Behaviour event ID ${parsed.id} already belongs to a different behaviour event.`);
  }

  await store.taskHistory.add(parsed);
  return parsed;
}

function compareByOccurredAt(left: BehaviourEvent, right: BehaviourEvent) {
  return new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
}

export async function loadBehaviourEventsResult(
  store: BehaviourEventStore = getCurrentLifeRhythmDatabase(),
): Promise<CollectionReadResult<BehaviourEvent>> {
  try {
    const rows = await store.taskHistory.toArray();
    let invalidRecordCount = 0;
    const items = rows.flatMap((row) => {
      const parsed = behaviourEventSchema.safeParse(row);
      if (!parsed.success) {
        invalidRecordCount += 1;
        return [];
      }
      return [parsed.data];
    }).sort(compareByOccurredAt);

    return successfulCollectionRead(items, invalidRecordCount);
  } catch {
    return {
      errors: ['taskHistory: Saved behaviour facts could not be read.'],
      status: 'readFailed',
    };
  }
}

async function trustedEventsForTask(taskId: string, store: BehaviourEventStore) {
  const rows = await store.taskHistory.where('taskId').equals(taskId).toArray();
  return rows.flatMap((row) => {
    const parsed = behaviourEventSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  }).sort(compareByOccurredAt);
}

async function observedActiveMinutes(
  taskId: string,
  completedAt: string,
  store: BehaviourEventStore,
) {
  const events = await trustedEventsForTask(taskId, store);
  let activeSince: number | null = null;
  let totalMilliseconds = 0;

  for (const event of events) {
    const at = new Date(event.occurredAt).getTime();
    if (event.eventType === 'taskStarted' || event.eventType === 'taskResumed' || event.eventType === 'taskContinued') {
      if (activeSince === null) activeSince = at;
    } else if (
      activeSince !== null &&
      (
        event.eventType === 'taskPaused' ||
        event.eventType === 'taskMinimumAchieved' ||
        event.eventType === 'taskCompleted' ||
        event.eventType === 'taskParked' ||
        event.eventType === 'taskNotToday' ||
        event.eventType === 'taskNoLongerNeeded'
      )
    ) {
      totalMilliseconds += Math.max(0, at - activeSince);
      activeSince = null;
    }
  }

  if (activeSince !== null) {
    totalMilliseconds += Math.max(0, new Date(completedAt).getTime() - activeSince);
  }

  return totalMilliseconds > 0 ? Math.round(totalMilliseconds / 60_000) : undefined;
}

function taskFact(task: ActiveTask): BehaviourEventFact {
  return {
    minimumAchieved: Boolean(task.minimumAchievedAt),
    taskStatus: task.status,
  };
}

export async function behaviourEventForTaskTransition(
  before: ActiveTask,
  after: ActiveTask,
  occurredAt: string,
  store: BehaviourEventStore,
): Promise<BehaviourEvent | null> {
  if (before.status === after.status) return null;

  const common = {
    after: taskFact(after),
    before: taskFact(before),
    occurredAt,
    provenance: { origin: 'userAction' as const, mechanism: 'taskLifecycle' },
    source: 'user' as const,
    taskId: after.id,
    ...(after.templateId ? { templateId: after.templateId } : {}),
    ...(after.sourceRhythmInstanceId ? { rhythmInstanceId: after.sourceRhythmInstanceId } : {}),
  };

  if (after.status === 'inProgress') {
    if (before.status === 'paused') {
      return createBehaviourEvent({ ...common, action: 'resume', eventType: 'taskResumed' });
    }
    if (before.status === 'minimumDone') {
      return createBehaviourEvent({ ...common, action: 'continue', eventType: 'taskContinued' });
    }
    return createBehaviourEvent({ ...common, action: 'start', eventType: 'taskStarted' });
  }
  if (after.status === 'paused') {
    return createBehaviourEvent({ ...common, action: 'pause', eventType: 'taskPaused' });
  }
  if (after.status === 'minimumDone') {
    return createBehaviourEvent({ ...common, action: 'minimumDone', eventType: 'taskMinimumAchieved' });
  }
  if (after.status === 'done') {
    const actualMinutes = await observedActiveMinutes(after.id, occurredAt, store);
    return createBehaviourEvent({
      ...common,
      action: 'complete',
      eventType: 'taskCompleted',
      ...(actualMinutes === undefined ? {} : { actualMinutes }),
    });
  }
  if (after.status === 'parked') {
    return createBehaviourEvent({ ...common, action: 'park', eventType: 'taskParked' });
  }
  if (after.status === 'notToday' || after.status === 'skipped') {
    return createBehaviourEvent({ ...common, action: 'notToday', eventType: 'taskNotToday' });
  }

  return null;
}

export function behaviourEventForAddedToToday(
  item: TaskPoolItem,
  occurredAt: string,
) {
  return createBehaviourEvent({
    action: 'addToToday',
    after: { poolStatus: 'today', taskStatus: 'active' },
    before: { poolStatus: item.status },
    eventType: 'taskAddedToToday',
    occurredAt,
    provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
    source: 'user',
    taskId: item.id,
    ...(item.templateId ? { templateId: item.templateId } : {}),
  });
}

function placementFact(placement: SoftPlacement): BehaviourEventFact {
  return {
    date: placement.date,
    end: placement.end,
    placementStatus: placement.status,
    start: placement.start,
  };
}

export function behaviourEventForUserPlacement(
  placement: SoftPlacement,
  action: 'create' | 'remove',
  occurredAt: string,
  previousPlacement?: SoftPlacement,
) {
  return createBehaviourEvent({
    action: action === 'create' ? 'createPlacement' : 'removePlacement',
    ...(action === 'create'
      ? { after: placementFact(placement) }
      : { before: placementFact(previousPlacement ?? placement), after: placementFact(placement) }),
    eventType: action === 'create' ? 'userPlacementCreated' : 'userPlacementRemoved',
    occurredAt,
    placementId: placement.id,
    provenance: { origin: 'userAction', mechanism: 'softPlacement' },
    source: 'user',
    taskId: placement.taskId,
  });
}

export function behaviourEventForDeferredTask(
  before: TaskPoolItem,
  after: TaskPoolItem,
  occurredAt: string,
) {
  return createBehaviourEvent({
    action: 'defer',
    after: { bringBackAfter: after.bringBackAfter, poolStatus: after.status },
    before: {
      ...(before.bringBackAfter ? { bringBackAfter: before.bringBackAfter } : {}),
      poolStatus: before.status,
    },
    eventType: 'taskDeferred',
    occurredAt,
    provenance: { origin: 'userAction', mechanism: 'taskPoolDeferral' },
    source: 'user',
    taskId: after.id,
    ...(after.templateId ? { templateId: after.templateId } : {}),
  });
}

function schedulerPlacementFact(
  point: SchedulerPlanChange['from'] | SchedulerPlanChange['to'],
): BehaviourEventFact | undefined {
  if (!point) return undefined;
  return {
    date: point.date,
    end: point.end,
    placementStatus: 'automatic',
    start: point.start,
    ...(point.variantKind ? { variantKind: point.variantKind } : {}),
  };
}

function initialSchedulerPlacementFact(placement: InternalPlacement): BehaviourEventFact {
  return {
    date: placement.date,
    end: placement.end,
    placementStatus: 'automatic',
    start: placement.start,
    ...(placement.variantKind ? { variantKind: placement.variantKind } : {}),
  };
}

export function behaviourEventsForInitialSchedulerPlan(
  plan: SchedulerPlan,
  occurredAt: string,
): BehaviourEvent[] {
  return plan.placements
    .filter((placement) => placement.origin === 'scheduler')
    .map((placement) => {
      const rhythmTarget = placement.targetKind === 'rhythm' || Boolean(placement.rhythmId);
      const targetId = rhythmTarget ? placement.rhythmId ?? placement.intentionId : placement.intentionId;

      return createBehaviourEvent({
        action: 'addAutomaticPlacement',
        after: initialSchedulerPlacementFact(placement),
        eventType: 'schedulerPlacementAdded',
        id: `behaviour-event-initial-plan-${occurredAt}-${placement.id}`,
        occurredAt,
        placementId: placement.id,
        ...(placement.timezone ? { timezone: placement.timezone } : {}),
        provenance: {
          origin: 'initialPlanBuild',
          mechanism: 'schedulerInitialBuild',
        },
        source: 'scheduler',
        ...(rhythmTarget
          ? {
              rhythmId: targetId,
              ...(placement.rhythmTemplateId ? { templateId: placement.rhythmTemplateId } : {}),
              ...(placement.rhythmInstanceId ? { rhythmInstanceId: placement.rhythmInstanceId } : {}),
            }
          : { taskId: targetId }),
      });
    });
}

export function behaviourEventsForSchedulerRepair(
  plan: SchedulerPlan,
  occurredAt: string,
): BehaviourEvent[] {
  if (!plan.repair) return [];

  return plan.repair.changes.map((change, index) => {
    const eventByKind = {
      added: ['schedulerPlacementAdded', 'addAutomaticPlacement'],
      moved: ['schedulerPlacementMoved', 'moveAutomaticPlacement'],
      removed: ['schedulerPlacementRemoved', 'removeAutomaticPlacement'],
      variantChanged: ['schedulerPlacementVariantChanged', 'changeAutomaticPlacementVariant'],
    } as const;
    const [eventType, action] = eventByKind[change.kind];

    return createBehaviourEvent({
      action,
      ...(change.to ? { after: schedulerPlacementFact(change.to) } : {}),
      ...(change.from ? { before: schedulerPlacementFact(change.from) } : {}),
      eventType,
      id: `behaviour-event-scheduler-${occurredAt}-${index}-${change.targetKind}-${change.targetId}`,
      occurredAt,
      ...(plan.repair?.now?.timezone ? { timezone: plan.repair.now.timezone } : {}),
      provenance: {
        origin: 'automaticRepair',
        mechanism: 'schedulerRepair',
        ...(plan.repair?.trigger ? { trigger: plan.repair.trigger } : {}),
      },
      source: 'scheduler',
      ...(change.targetKind === 'intention'
        ? { taskId: change.targetId }
        : {
            rhythmId: change.targetId,
            ...(change.rhythmTemplateId ? { templateId: change.rhythmTemplateId } : {}),
            ...(change.rhythmInstanceId ? { rhythmInstanceId: change.rhythmInstanceId } : {}),
          }),
    });
  });
}

export function behaviourEventForSchedulerUndo(
  repairedPlan: SchedulerPlan,
  occurredAt: string,
) {
  return createBehaviourEvent({
    action: 'undoRepair',
    eventType: 'schedulerRepairUndone',
    id: `behaviour-event-undo-${occurredAt}`,
    occurredAt,
    ...(repairedPlan.repair?.now?.timezone ? { timezone: repairedPlan.repair.now.timezone } : {}),
    provenance: {
      origin: 'undo',
      mechanism: 'schedulerRepairUndo',
      ...(repairedPlan.repair?.trigger ? { trigger: repairedPlan.repair.trigger } : {}),
    },
    source: 'user',
  });
}
