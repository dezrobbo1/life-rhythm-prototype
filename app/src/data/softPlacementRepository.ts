import type { Table } from 'dexie';
import { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  successfulCollectionRead,
  type CollectionReadResult,
} from './collectionReadResult';
import {
  softPlacementDateSchema,
  softPlacementSchema,
  softPlacementStatusSchema,
  type SoftPlacement,
  type SoftPlacementStatus,
} from './schemas';
import {
  appendBehaviourEvent,
  behaviourEventForUserPlacement,
} from './behaviourEventRepository';

type SoftPlacementsTable = Pick<Table<SoftPlacement, string>, 'get' | 'put' | 'toArray' | 'where'>;

export type SoftPlacementStore = {
  softPlacements: SoftPlacementsTable;
};

export type SoftPlacementWriteResult =
  | {
      ok: true;
      placement: SoftPlacement;
    }
  | {
      errors: string[];
      ok: false;
    };

export type SoftPlacementStatusUpdateResult =
  | {
      ok: true;
      placement: SoftPlacement;
    }
  | {
      errors: string[];
      ok: false;
    };

function nowIso() {
  return new Date().toISOString();
}

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'softPlacement';

    return `${path}: ${issue.message}`;
  });
}

export function validateSoftPlacementWrite(input: unknown): SoftPlacementWriteResult {
  const parsed = softPlacementSchema.safeParse(input);

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
    };
  }

  return {
    ok: true,
    placement: parsed.data,
  };
}

export async function saveSoftPlacement(
  input: unknown,
  store: SoftPlacementStore = getCurrentLifeRhythmDatabase(),
): Promise<SoftPlacementWriteResult> {
  const validated = validateSoftPlacementWrite(input);

  if (!validated.ok) {
    return validated;
  }

  if (store instanceof LifeRhythmDatabase) {
    return store.transaction('rw', store.softPlacements, store.taskHistory, async () => {
      const existing = await store.softPlacements.get(validated.placement.id);
      if (existing) {
        return {
          errors: ['id: A soft placement with this ID already exists.'],
          ok: false as const,
        };
      }

      await store.softPlacements.put(validated.placement);
      await appendBehaviourEvent(
        behaviourEventForUserPlacement(
          validated.placement,
          'create',
          validated.placement.createdAt,
        ),
        store,
      );
      return validated;
    });
  }

  const existing = await store.softPlacements.get(validated.placement.id);

  if (existing) {
    return {
      errors: ['id: A soft placement with this ID already exists.'],
      ok: false,
    };
  }

  await store.softPlacements.put(validated.placement);

  return validated;
}

export async function loadAllSoftPlacements(
  store: SoftPlacementStore = getCurrentLifeRhythmDatabase(),
): Promise<SoftPlacement[]> {
  const result = await loadAllSoftPlacementsResult(store);

  return result.status === 'readFailed' ? [] : result.items;
}

export async function loadAllSoftPlacementsResult(
  store: SoftPlacementStore = getCurrentLifeRhythmDatabase(),
): Promise<CollectionReadResult<SoftPlacement>> {
  try {
    const stored = await store.softPlacements.toArray();
    let invalidRecordCount = 0;

    const items = stored.flatMap((placement) => {
      const parsed = softPlacementSchema.safeParse(placement);

      if (!parsed.success) {
        invalidRecordCount += 1;
        return [];
      }

      return [parsed.data];
    });

    return successfulCollectionRead(items, invalidRecordCount);
  } catch {
    return {
      errors: ['softPlacements: Saved manual placements could not be read.'],
      status: 'readFailed',
    };
  }
}

export async function loadSoftPlacementsForDate(
  date: string,
  store: SoftPlacementStore = getCurrentLifeRhythmDatabase(),
): Promise<SoftPlacement[]> {
  const result = await loadSoftPlacementsForDateResult(date, store);

  return result.status === 'readFailed' ? [] : result.items;
}

export async function loadSoftPlacementsForDateResult(
  date: string,
  store: SoftPlacementStore = getCurrentLifeRhythmDatabase(),
): Promise<CollectionReadResult<SoftPlacement>> {
  const parsedDate = softPlacementDateSchema.safeParse(date);

  if (!parsedDate.success) {
    return {
      errors: ['date: Manual placement date is invalid.'],
      status: 'readFailed',
    };
  }

  try {
    const stored = await store.softPlacements.toArray();
    let invalidRecordCount = 0;

    const items = stored.flatMap((placement) => {
      const parsed = softPlacementSchema.safeParse(placement);

      if (!parsed.success) {
        invalidRecordCount += 1;
        return [];
      }

      return parsed.data.date === parsedDate.data ? [parsed.data] : [];
    });

    return successfulCollectionRead(items, invalidRecordCount);
  } catch {
    return {
      errors: ['softPlacements: Saved manual placements could not be read.'],
      status: 'readFailed',
    };
  }
}

export async function updateSoftPlacementStatus(
  id: string,
  status: SoftPlacementStatus,
  store: SoftPlacementStore = getCurrentLifeRhythmDatabase(),
): Promise<SoftPlacementStatusUpdateResult> {
  const statusResult = softPlacementStatusSchema.safeParse(status);

  if (!statusResult.success) {
    return {
      errors: issuesToMessages(statusResult.error.issues),
      ok: false,
    };
  }

  if (store instanceof LifeRhythmDatabase) {
    return store.transaction('rw', store.softPlacements, store.taskHistory, async () => {
      const storedPlacement = await store.softPlacements.get(id);
      if (!storedPlacement) {
        return { errors: ['id: Soft placement was not found.'], ok: false as const };
      }
      const parsedPlacement = softPlacementSchema.safeParse(storedPlacement);
      if (!parsedPlacement.success) {
        return { errors: issuesToMessages(parsedPlacement.error.issues), ok: false as const };
      }
      if (parsedPlacement.data.status === statusResult.data) {
        return { ok: true as const, placement: parsedPlacement.data };
      }

      const timestamp = nowIso();
      const updatedPlacement = softPlacementSchema.parse({
        ...parsedPlacement.data,
        status: statusResult.data,
        updatedAt: timestamp,
      });
      await store.softPlacements.put(updatedPlacement);
      if (statusResult.data === 'removed') {
        await appendBehaviourEvent(
          behaviourEventForUserPlacement(updatedPlacement, 'remove', timestamp, parsedPlacement.data),
          store,
        );
      }
      return { ok: true as const, placement: updatedPlacement };
    });
  }

  const storedPlacement = await store.softPlacements.get(id);

  if (!storedPlacement) {
    return {
      errors: ['id: Soft placement was not found.'],
      ok: false,
    };
  }

  const parsedPlacement = softPlacementSchema.safeParse(storedPlacement);

  if (!parsedPlacement.success) {
    return {
      errors: issuesToMessages(parsedPlacement.error.issues),
      ok: false,
    };
  }

  const updatedPlacement = softPlacementSchema.parse({
    ...parsedPlacement.data,
    status: statusResult.data,
    updatedAt: nowIso(),
  });

  await store.softPlacements.put(updatedPlacement);

  return {
    ok: true,
    placement: updatedPlacement,
  };
}

export function markSoftPlacementRemoved(
  id: string,
  store: SoftPlacementStore = getCurrentLifeRhythmDatabase(),
) {
  return updateSoftPlacementStatus(id, 'removed', store);
}
