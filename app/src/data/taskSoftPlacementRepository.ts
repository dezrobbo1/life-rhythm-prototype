import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  activeTaskSchema,
  softPlacementSchema,
  taskPoolItemSchema,
  type SoftPlacement,
  type TaskPoolItem,
} from './schemas';
import type { LifeRhythmDatabase } from './db';

export type ConfirmTaskSoftPlacementInput = {
  blockEnd: string;
  blockId: string;
  blockLabel: string;
  blockStart: string;
  date: string;
  id: string;
  taskId: string;
};

export type TaskSoftPlacementResult =
  | {
      item: TaskPoolItem | null;
      ok: true;
      placement: SoftPlacement;
    }
  | {
      errors: string[];
      ok: false;
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

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'taskSoftPlacement';
    return `${path}: ${issue.message}`;
  });
}

function fallbackPoolStatus(
  activeTask: unknown,
  item: TaskPoolItem,
): Extract<TaskPoolItem['status'], 'captured' | 'parked' | 'notToday' | 'deferred'> {
  const parsed = activeTaskSchema.safeParse(activeTask);

  if (parsed.success && parsed.data.status === 'parked') return 'parked';
  if (parsed.success && parsed.data.status === 'notToday') return 'notToday';
  if (item.bringBackAfter) return 'deferred';
  return 'captured';
}

export async function confirmTaskPoolSoftPlacement(
  input: ConfirmTaskSoftPlacementInput,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<TaskSoftPlacementResult> {
  return database.transaction('rw', database.taskPoolItems, database.softPlacements, async () => {
    const storedItem = await database.taskPoolItems.get(input.taskId);
    const parsedItem = taskPoolItemSchema.safeParse(storedItem);

    if (!parsedItem.success) {
      return {
        errors: storedItem
          ? issuesToMessages(parsedItem.error.issues)
          : ['taskId: Task Pool item was not found.'],
        ok: false,
      };
    }

    if (!eligiblePoolStatuses.has(parsedItem.data.status)) {
      return {
        errors: ['status: This task is not available for a new soft placement.'],
        ok: false,
      };
    }

    const existingById = await database.softPlacements.get(input.id);
    const parsedExistingById = existingById
      ? softPlacementSchema.safeParse(existingById)
      : null;
    if (parsedExistingById && (!parsedExistingById.success || parsedExistingById.data.status !== 'removed')) {
      return {
        errors: ['id: This soft placement already exists.'],
        ok: false,
      };
    }

    const placementsForDate = await database.softPlacements.where('date').equals(input.date).toArray();
    const visiblePlacements = placementsForDate.flatMap((placement) => {
      const parsed = softPlacementSchema.safeParse(placement);
      return parsed.success && visiblePlacementStatuses.has(parsed.data.status) ? [parsed.data] : [];
    });

    if (visiblePlacements.some((placement) => placement.taskId === parsedItem.data.id)) {
      return {
        errors: ['taskId: This task already has a soft placement for the selected day.'],
        ok: false,
      };
    }

    if (visiblePlacements.some((placement) => placement.blockId === input.blockId)) {
      return {
        errors: ['blockId: This open-capacity block already has a soft placement.'],
        ok: false,
      };
    }

    const timestamp = new Date().toISOString();
    const parsedPlacement = softPlacementSchema.safeParse({
      blockId: input.blockId,
      blockLabelSnapshot: input.blockLabel,
      createdAt: timestamp,
      date: input.date,
      end: input.blockEnd,
      id: input.id,
      placementSource: 'userConfirmed',
      start: input.blockStart,
      status: 'planned',
      taskId: parsedItem.data.id,
      taskTitleSnapshot: parsedItem.data.title,
      updatedAt: timestamp,
    });

    if (!parsedPlacement.success) {
      return {
        errors: issuesToMessages(parsedPlacement.error.issues),
        ok: false,
      };
    }

    const updatedItem = taskPoolItemSchema.parse({
      ...parsedItem.data,
      status: 'softPlaced',
      updatedAt: timestamp,
    });

    await database.softPlacements.put(parsedPlacement.data);
    await database.taskPoolItems.put(updatedItem);

    return {
      item: updatedItem,
      ok: true,
      placement: parsedPlacement.data,
    };
  });
}

export async function removeTaskPoolSoftPlacement(
  placementId: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<TaskSoftPlacementResult> {
  return database.transaction(
    'rw',
    database.softPlacements,
    database.taskPoolItems,
    database.activeTasks,
    async () => {
      const storedPlacement = await database.softPlacements.get(placementId);
      const parsedPlacement = softPlacementSchema.safeParse(storedPlacement);

      if (!parsedPlacement.success) {
        return {
          errors: storedPlacement
            ? issuesToMessages(parsedPlacement.error.issues)
            : ['id: Soft placement was not found.'],
          ok: false,
        };
      }

      const timestamp = new Date().toISOString();
      const removedPlacement = softPlacementSchema.parse({
        ...parsedPlacement.data,
        status: 'removed',
        updatedAt: timestamp,
      });
      const storedItem = await database.taskPoolItems.get(parsedPlacement.data.taskId);
      const parsedItem = taskPoolItemSchema.safeParse(storedItem);
      let updatedItem: TaskPoolItem | null = null;

      if (parsedItem.success && parsedItem.data.status === 'softPlaced') {
        const activeTask = await database.activeTasks.get(parsedItem.data.id);
        updatedItem = taskPoolItemSchema.parse({
          ...parsedItem.data,
          status: fallbackPoolStatus(activeTask, parsedItem.data),
          updatedAt: timestamp,
        });
      }

      await database.softPlacements.put(removedPlacement);
      if (updatedItem) {
        await database.taskPoolItems.put(updatedItem);
      }

      return {
        item: updatedItem,
        ok: true,
        placement: removedPlacement,
      };
    },
  );
}
