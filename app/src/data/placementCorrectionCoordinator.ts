import { scheduler } from '../domain/primaryScheduler';
import type { InternalPlacement, SchedulerPlan } from '../domain/schedulingModel';
import { calendarSourceRecordSchema, CURRENT_CALENDAR_SOURCE_ID } from './calendarSourceSchema';
import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  canonicalSchedulingInputSnapshot,
  readCanonicalSchedulingInputRows,
} from './schedulerCanonicalInputSnapshot';
import {
  buildCurrentLiveSchedulingContext,
  repairCurrentPrivatePlan,
  type PrivatePlanCoordinatorOptions,
} from './schedulerPlanCoordinator';
import {
  type CalendarSourceSnapshot,
  loadSchedulerPlanState,
  markRhythmInputRepairPending,
  markTaskInputRepairPending,
  saveSchedulerPlanState,
} from './schedulerPlanStateRepository';
import {
  activeTaskSchema,
  softPlacementSchema,
  taskPoolItemSchema,
  type SoftPlacement,
  type TaskPoolItem,
} from './schemas';
import { rhythmInstanceSchema } from './rhythmAuthoritySchemas';
import {
  assertProfileRecoveryGeneration,
  profileRecoveryErrorMessage,
  profileWriteTransaction,
  STALE_PROFILE_RECOVERY_MESSAGE,
} from './profileRecoveryGeneration';
import {
  appendBehaviourEvent,
  behaviourEventForUserPlacement,
} from './behaviourEventRepository';

export type PlacementMoveInput = {
  date: string;
  start: string;
};

export type PlacementCorrectionResult =
  | {
      ok: true;
      placement: SoftPlacement | null;
      repairPending: boolean;
      plan: SchedulerPlan;
    }
  | {
      ok: false;
      errors: string[];
      conflict?: 'stale';
    };

function targetKind(placement: InternalPlacement): 'intention' | 'rhythm' {
  return placement.targetKind ?? 'intention';
}

function targetId(placement: InternalPlacement): string {
  return targetKind(placement) === 'rhythm'
    ? placement.rhythmInstanceId ?? placement.rhythmId ?? placement.intentionId
    : placement.intentionId;
}

function correctionId(placement: InternalPlacement) {
  return placement.sourcePlacementId ??
    `correction:${targetKind(placement)}:${encodeURIComponent(targetId(placement))}`;
}

function minutes(value: string) {
  const [hours, minute] = value.split(':').map(Number);
  return hours * 60 + minute;
}

function timeFromMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minute = value % 60;
  return `${hours.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function placementDuration(placement: InternalPlacement) {
  return minutes(placement.end) - minutes(placement.start);
}

function sameRenderedPlacement(left: InternalPlacement, right: InternalPlacement) {
  return left.id === right.id &&
    targetKind(left) === targetKind(right) &&
    targetId(left) === targetId(right) &&
    left.date === right.date &&
    left.start === right.start &&
    left.end === right.end &&
    left.variantKind === right.variantKind &&
    left.rhythmInstanceId === right.rhythmInstanceId;
}

function correctionProvenance(kind: NonNullable<SoftPlacement['correctionKind']>) {
  return [
    ...(kind === 'move' || kind === 'moveProtected'
      ? ['User explicitly moved this private placement.']
      : []),
    ...(kind === 'protect' || kind === 'moveProtected'
      ? ['User explicitly protected this private placement.']
      : []),
  ];
}

function internalPlacementFromCorrection(placement: SoftPlacement): InternalPlacement {
  const kind = placement.targetKind ?? 'intention';
  return {
    id: placement.id,
    intentionId: placement.taskId,
    targetKind: kind,
    ...(kind === 'rhythm'
      ? {
          rhythmId: placement.rhythmInstanceId ?? placement.taskId,
          rhythmTemplateId: placement.rhythmTemplateId,
          rhythmPlanId: placement.rhythmPlanId,
          rhythmRecurrenceRevisionId: placement.rhythmRecurrenceRevisionId,
          rhythmInstanceId: placement.rhythmInstanceId,
        }
      : {}),
    date: placement.date,
    start: placement.start,
    end: placement.end,
    ...(placement.timezone ? { timezone: placement.timezone } : {}),
    origin: 'existingUserConfirmed',
    sourcePlacementId: placement.id,
    ...(placement.variantKind ? { variantKind: placement.variantKind } : {}),
    provenance: correctionProvenance(placement.correctionKind ?? 'move'),
  };
}

function candidateForDateAndRange(
  input: Awaited<ReturnType<typeof buildCurrentLiveSchedulingContext>>,
  date: string,
  start: string,
  end: string,
) {
  if (!input.ok) return undefined;
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);
  return input.context.input.candidateIntervals?.find((candidate) =>
    candidate.date === date &&
    minutes(candidate.start) <= startMinutes &&
    endMinutes <= minutes(candidate.end),
  );
}

function currentPlanPlacement(
  plan: SchedulerPlan,
  expected: InternalPlacement,
) {
  const found = plan.placements.find((placement) => placement.id === expected.id);
  return found && sameRenderedPlacement(found, expected) ? found : null;
}

function staleResult(): PlacementCorrectionResult {
  return { ok: false, conflict: 'stale', errors: [STALE_PROFILE_RECOVERY_MESSAGE] };
}

async function calendarStillMatches(
  database: LifeRhythmDatabase,
  snapshot: CalendarSourceSnapshot,
) {
  const stored = await database.calendarSources.get(CURRENT_CALENDAR_SOURCE_ID);
  if (snapshot === null) return stored === undefined;
  const parsed = calendarSourceRecordSchema.safeParse(stored);
  return parsed.success &&
    parsed.data.source === snapshot.source &&
    parsed.data.updatedAt === snapshot.updatedAt &&
    parsed.data.beforeBusyMinutes === (snapshot.beforeBusyMinutes ?? 0) &&
    parsed.data.afterBusyMinutes === (snapshot.afterBusyMinutes ?? 0);
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

function schedulerFields(current: Extract<Awaited<ReturnType<typeof loadSchedulerPlanState>>, { status: 'ok' }>) {
  return {
    ...(current.calendarRepairPendingAt ? { calendarRepairPendingAt: current.calendarRepairPendingAt } : {}),
    ...(current.settingsRepairPendingAt ? { settingsRepairPendingAt: current.settingsRepairPendingAt } : {}),
    ...(current.preferenceRepairPendingAt ? { preferenceRepairPendingAt: current.preferenceRepairPendingAt } : {}),
    ...(current.preferenceRepairTargets ? { preferenceRepairTargets: current.preferenceRepairTargets } : {}),
    ...(current.durationLearningRepairPendingAt
      ? { durationLearningRepairPendingAt: current.durationLearningRepairPendingAt }
      : {}),
    ...(current.durationLearningApplied ? { durationLearningApplied: current.durationLearningApplied } : {}),
    ...(current.taskInputRepairPendingAt
      ? {
          taskInputRepairPendingAt: current.taskInputRepairPendingAt,
          taskInputRepairTargetIds: current.taskInputRepairTargetIds,
        }
      : {}),
    ...(current.rhythmInputRepairPendingAt
      ? {
          rhythmInputRepairPendingAt: current.rhythmInputRepairPendingAt,
          rhythmInputRepairTargetIds: current.rhythmInputRepairTargetIds,
        }
      : {}),
    ...(current.dayModeContext ? { dayModeContext: current.dayModeContext } : {}),
    ...(current.undoDayModeContext !== undefined
      ? { undoDayModeContext: current.undoDayModeContext }
      : {}),
  };
}

async function prepareCorrection(
  expected: InternalPlacement,
  action: 'move' | 'protect',
  move: PlacementMoveInput | null,
  options: PrivatePlanCoordinatorOptions = {},
) {
  const live = await buildCurrentLiveSchedulingContext({ ...options, readOnly: true });
  if (!live.ok) return { ok: false as const, errors: live.errors };

  const saved = live.context.schedulerStateSnapshot ?? await loadSchedulerPlanState();
  if (saved.status !== 'ok') {
    return {
      ok: false as const,
      errors: saved.status === 'missing'
        ? ['Private plan is not available. Refresh Plan and try again.']
        : saved.errors,
    };
  }
  const current = currentPlanPlacement(saved.plan, expected);
  if (!current) return { ok: false as const, conflict: 'stale' as const, errors: [STALE_PROFILE_RECOVERY_MESSAGE] };

  const duration = placementDuration(current);
  if (!Number.isInteger(duration) || duration <= 0) {
    return { ok: false as const, errors: ['The current placement duration could not be read safely.'] };
  }

  const date = move?.date ?? current.date;
  const start = move?.start ?? current.start;
  const startMinutes = minutes(start);
  if (!Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes >= 24 * 60) {
    return { ok: false as const, errors: ['Choose a valid local start time.'] };
  }
  const endMinutes = startMinutes + duration;
  if (endMinutes > 24 * 60) {
    return { ok: false as const, errors: ['This move would cross the local-day boundary. Choose an earlier time.'] };
  }
  const end = timeFromMinutes(endMinutes);
  if (date < live.now.date || (date === live.now.date && start < live.now.time)) {
    return { ok: false as const, errors: ['Choose a time that has not already passed.'] };
  }
  const candidate = candidateForDateAndRange(live, date, start, end);
  if (!candidate) {
    return { ok: false as const, errors: ['That time is outside the capacity Life Rhythm can currently use.'] };
  }

  const database = getCurrentLifeRhythmDatabase();
  const id = correctionId(current);
  const existingRaw = await database.softPlacements.get(id);
  const existingParsed = existingRaw ? softPlacementSchema.safeParse(existingRaw) : null;
  if (existingParsed && !existingParsed.success) {
    return { ok: false as const, errors: ['Saved placement correction could not be read safely.'] };
  }
  const existing = existingParsed?.success ? existingParsed.data : null;

  const currentKind = existing?.correctionKind;
  const nextKind: NonNullable<SoftPlacement['correctionKind']> = action === 'move'
    ? currentKind === 'protect' || currentKind === 'moveProtected'
      ? 'moveProtected'
      : 'move'
    : currentKind === 'move' || currentKind === 'moveProtected'
      ? 'moveProtected'
      : 'protect';

  const kind = targetKind(current);
  const title = live.context.titleByTargetId[targetId(current)] ??
    (kind === 'rhythm' ? 'Private rhythm' : 'Private task');

  if (kind === 'rhythm') {
    if (!current.rhythmInstanceId || !current.rhythmTemplateId || !current.rhythmPlanId ||
        !current.rhythmRecurrenceRevisionId) {
      return { ok: false as const, errors: ['This rhythm placement does not retain complete occurrence identity.'] };
    }
    const rhythm = live.context.input.rhythms.find((item) => item.rhythmInstanceId === current.rhythmInstanceId);
    if (!rhythm || (rhythm.eligibilityStartDate && date < rhythm.eligibilityStartDate) ||
        (rhythm.eligibilityEndDate && date > rhythm.eligibilityEndDate)) {
      return { ok: false as const, errors: ['That date is outside this rhythm occurrence window.'] };
    }
  }

  const timestamp = new Date().toISOString();
  const parsed = softPlacementSchema.safeParse({
    id,
    taskId: targetId(current),
    taskTitleSnapshot: title,
    date,
    blockId: `correction-slot:${encodeURIComponent(id)}`,
    blockLabelSnapshot: 'User-corrected private time',
    start,
    end,
    placementSource: 'userConfirmed',
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    status: action === 'move' || nextKind === 'moveProtected' || currentKind === 'move'
      ? 'moved'
      : 'planned',
    correctionKind: nextKind,
    targetKind: kind,
    timezone: candidate.timezone,
    ...(current.variantKind ? { variantKind: current.variantKind } : {}),
    ...(kind === 'rhythm'
      ? {
          rhythmTemplateId: current.rhythmTemplateId,
          rhythmPlanId: current.rhythmPlanId,
          rhythmRecurrenceRevisionId: current.rhythmRecurrenceRevisionId,
          rhythmInstanceId: current.rhythmInstanceId,
        }
      : {}),
  });
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const corrected = internalPlacementFromCorrection(parsed.data);
  const candidatePlan: SchedulerPlan = {
    ...saved.plan,
    placements: saved.plan.placements.map((placement) =>
      placement.id === current.id ? corrected : placement),
  };
  const violations = scheduler.validatePlan(candidatePlan, live.context.input)
    .filter((violation) =>
      violation.placementId === corrected.id || violation.conflictingId === corrected.id,
    );
  if (violations.length > 0) {
    return { ok: false as const, errors: [...new Set(violations.map((violation) => violation.message))] };
  }

  return { ok: true as const, live, saved, current, correction: parsed.data, existing };
}

async function persistCorrection(
  prepared: Extract<Awaited<ReturnType<typeof prepareCorrection>>, { ok: true }>,
  expectedRecoveryGeneration: number,
) {
  const database = getCurrentLifeRhythmDatabase();
  const expectedSnapshot = prepared.live.context.canonicalInputSnapshot;
  const expectedCalendar = prepared.live.context.calendarSourceSnapshot ?? null;

  return profileWriteTransaction(database, [
    database.activeTasks,
    database.taskPoolItems,
    database.softPlacements,
    database.rhythmTemplates,
    database.rhythmPlans,
    database.rhythmRecurrenceRevisions,
    database.rhythmInstances,
    database.schedulerPlanState,
    database.calendarSources,
    database.taskHistory,
  ], async () => {
    const latest = await loadSchedulerPlanState(database);
    if (latest.status !== 'ok' || latest.updatedAt !== prepared.saved.updatedAt ||
        !currentPlanPlacement(latest.plan, prepared.current)) {
      return staleResult();
    }
    if (canonicalSchedulingInputSnapshot(await readCanonicalSchedulingInputRows(database)) !== expectedSnapshot) {
      return staleResult();
    }
    if (!await calendarStillMatches(database, expectedCalendar)) return staleResult();

    const before = await database.softPlacements.get(prepared.correction.id);
    const parsedBefore = before ? softPlacementSchema.safeParse(before) : null;
    if (parsedBefore && !parsedBefore.success) {
      return { ok: false as const, errors: ['Saved placement correction could not be read safely.'] };
    }

    await database.softPlacements.put(prepared.correction);

    if (prepared.correction.targetKind === 'rhythm') {
      const instance = rhythmInstanceSchema.safeParse(
        await database.rhythmInstances.get(prepared.correction.rhythmInstanceId!),
      );
      if (!instance.success || instance.data.lifecycleState === 'closed' ||
          instance.data.rhythmTemplateId !== prepared.correction.rhythmTemplateId ||
          instance.data.rhythmPlanId !== prepared.correction.rhythmPlanId ||
          instance.data.recurrenceRevisionId !== prepared.correction.rhythmRecurrenceRevisionId) {
        throw new Error('Rhythm occurrence changed before the correction could be saved.');
      }
      await database.rhythmInstances.put(rhythmInstanceSchema.parse({
        ...instance.data,
        placementId: prepared.correction.id,
        updatedAt: prepared.correction.updatedAt,
      }));
      const pending = await markRhythmInputRepairPending(
        database,
        `instance:${instance.data.id}`,
        prepared.correction.updatedAt,
      );
      if (!pending.ok) throw new Error(pending.errors.join(' '));
    } else {
      const poolRow = await database.taskPoolItems.get(prepared.correction.taskId);
      const pool = poolRow ? taskPoolItemSchema.safeParse(poolRow) : null;
      const taskRow = await database.activeTasks.get(prepared.correction.taskId);
      const task = taskRow ? activeTaskSchema.safeParse(taskRow) : null;
      if (pool?.success && (!task?.success || !task.data.showToday)) {
        await database.taskPoolItems.put(taskPoolItemSchema.parse({
          ...pool.data,
          status: 'softPlaced',
          updatedAt: prepared.correction.updatedAt,
        }));
      }
      const pending = await markTaskInputRepairPending(
        database,
        prepared.correction.taskId,
        prepared.correction.updatedAt,
      );
      if (!pending.ok) throw new Error(pending.errors.join(' '));
    }

    const beforePlacement = parsedBefore?.success ? parsedBefore.data : null;
    const previous = beforePlacement ?? softPlacementSchema.parse({
      ...prepared.correction,
      date: prepared.current.date,
      start: prepared.current.start,
      end: prepared.current.end,
      status: 'planned',
      correctionKind: undefined,
      updatedAt: prepared.correction.updatedAt,
    });
    const positionChanged =
      previous.date !== prepared.correction.date ||
      previous.start !== prepared.correction.start ||
      previous.end !== prepared.correction.end;
    if (
      positionChanged &&
      (prepared.correction.correctionKind === 'move' ||
        prepared.correction.correctionKind === 'moveProtected')
    ) {
      await appendBehaviourEvent(
        behaviourEventForUserPlacement(
          prepared.correction,
          'move',
          prepared.correction.updatedAt,
          previous,
        ),
        database,
      );
    }

    return { ok: true as const };
  }, expectedRecoveryGeneration);
}

export async function movePrivatePlacement(
  expected: InternalPlacement,
  move: PlacementMoveInput,
  expectedRecoveryGeneration: number,
  options: PrivatePlanCoordinatorOptions = {},
): Promise<PlacementCorrectionResult> {
  try {
    await assertProfileRecoveryGeneration(getCurrentLifeRhythmDatabase(), expectedRecoveryGeneration);
  } catch (error) {
    return { ok: false, conflict: 'stale', errors: [profileRecoveryErrorMessage(error, STALE_PROFILE_RECOVERY_MESSAGE)] };
  }
  const prepared = await prepareCorrection(expected, 'move', move, options);
  if (!prepared.ok) return prepared;
  try {
    const persisted = await persistCorrection(prepared, expectedRecoveryGeneration);
    if (!persisted.ok) return persisted;
  } catch (error) {
    return {
      ok: false,
      errors: [profileRecoveryErrorMessage(error, 'The placement move was not saved. Nothing else changed.')],
    };
  }

  const repaired = await repairCurrentPrivatePlan({
    ...options,
    trigger: 'userCorrection',
    reason: 'You moved one private placement.',
    ...(expected.origin === 'scheduler' ? { releasePlacementIds: [expected.id] } : {}),
  });
  if (!repaired.ok) {
    return {
      ok: true,
      placement: prepared.correction,
      repairPending: true,
      plan: prepared.saved.plan,
    };
  }
  return { ok: true, placement: prepared.correction, repairPending: false, plan: repaired.plan };
}

export async function protectPrivatePlacement(
  expected: InternalPlacement,
  expectedRecoveryGeneration: number,
  options: PrivatePlanCoordinatorOptions = {},
): Promise<PlacementCorrectionResult> {
  try {
    await assertProfileRecoveryGeneration(getCurrentLifeRhythmDatabase(), expectedRecoveryGeneration);
  } catch (error) {
    return { ok: false, conflict: 'stale', errors: [profileRecoveryErrorMessage(error, STALE_PROFILE_RECOVERY_MESSAGE)] };
  }
  const prepared = await prepareCorrection(expected, 'protect', null, options);
  if (!prepared.ok) return prepared;
  try {
    const persisted = await persistCorrection(prepared, expectedRecoveryGeneration);
    if (!persisted.ok) return persisted;
  } catch (error) {
    return {
      ok: false,
      errors: [profileRecoveryErrorMessage(error, 'The placement protection was not saved. Nothing else changed.')],
    };
  }

  const repaired = await repairCurrentPrivatePlan({
    ...options,
    trigger: 'userCorrection',
    reason: 'You protected one private placement.',
    ...(expected.origin === 'scheduler' ? { releasePlacementIds: [expected.id] } : {}),
  });
  if (!repaired.ok) {
    return {
      ok: true,
      placement: prepared.correction,
      repairPending: true,
      plan: prepared.saved.plan,
    };
  }
  return { ok: true, placement: prepared.correction, repairPending: false, plan: repaired.plan };
}

export async function unprotectPrivatePlacement(
  expected: InternalPlacement,
  expectedRecoveryGeneration: number,
  options: PrivatePlanCoordinatorOptions = {},
): Promise<PlacementCorrectionResult> {
  const database = getCurrentLifeRhythmDatabase();
  try {
    await assertProfileRecoveryGeneration(database, expectedRecoveryGeneration);
  } catch (error) {
    return { ok: false, conflict: 'stale', errors: [profileRecoveryErrorMessage(error, STALE_PROFILE_RECOVERY_MESSAGE)] };
  }
  const live = await buildCurrentLiveSchedulingContext({ ...options, readOnly: true });
  if (!live.ok) return { ok: false, errors: live.errors };
  const saved = live.context.schedulerStateSnapshot ?? await loadSchedulerPlanState(database);
  if (saved.status !== 'ok') {
    return { ok: false, errors: ['Private plan is not available. Refresh Plan and try again.'] };
  }
  const current = currentPlanPlacement(saved.plan, expected);
  if (!current) return staleResult();
  const id = correctionId(current);
  const raw = await database.softPlacements.get(id);
  const parsed = softPlacementSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.correctionKind ||
      !['protect', 'moveProtected'].includes(parsed.data.correctionKind)) {
    return { ok: false, errors: ['This placement is not currently protected.'] };
  }

  const timestamp = new Date().toISOString();

  if (parsed.data.correctionKind === 'moveProtected') {
    const moved = softPlacementSchema.parse({
      ...parsed.data,
      correctionKind: 'move',
      updatedAt: timestamp,
    });
    try {
      const savedMutation = await profileWriteTransaction(database,
        [
          database.softPlacements,
          database.schedulerPlanState,
          database.activeTasks,
          database.taskPoolItems,
          database.rhythmInstances,
          database.taskHistory,
        ],
        async () => {
          const latest = await loadSchedulerPlanState(database);
          if (latest.status !== 'ok' || latest.updatedAt !== saved.updatedAt ||
              !currentPlanPlacement(latest.plan, current)) return staleResult();
          await database.softPlacements.put(moved);
          if (moved.targetKind === 'rhythm') {
            const pending = await markRhythmInputRepairPending(database, `instance:${moved.rhythmInstanceId}`, timestamp);
            if (!pending.ok) throw new Error(pending.errors.join(' '));
          } else {
            const pending = await markTaskInputRepairPending(database, moved.taskId, timestamp);
            if (!pending.ok) throw new Error(pending.errors.join(' '));
          }
          return { ok: true as const };
        },
        expectedRecoveryGeneration,
      );
      if (!savedMutation.ok) return savedMutation;
    } catch (error) {
      return { ok: false, errors: [profileRecoveryErrorMessage(error, 'Protection was not removed.')] };
    }
    const repaired = await repairCurrentPrivatePlan({
      ...options,
      trigger: 'userCorrection',
      reason: 'You removed protection from one moved private placement.',
    });
    return repaired.ok
      ? { ok: true, placement: moved, repairPending: false, plan: repaired.plan }
      : { ok: true, placement: moved, repairPending: true, plan: saved.plan };
  }

  try {
    const result = await profileWriteTransaction(database,
      [
        database.softPlacements,
        database.schedulerPlanState,
        database.taskPoolItems,
        database.activeTasks,
        database.taskHistory,
      ],
      async () => {
        const latest = await loadSchedulerPlanState(database);
        if (latest.status !== 'ok' || latest.updatedAt !== saved.updatedAt ||
            !currentPlanPlacement(latest.plan, current)) return staleResult();

        const removed = softPlacementSchema.parse({
          ...parsed.data,
          status: 'removed',
          updatedAt: timestamp,
        });
        await database.softPlacements.put(removed);

        if (removed.targetKind !== 'rhythm') {
          const poolRow = await database.taskPoolItems.get(removed.taskId);
          const pool = poolRow ? taskPoolItemSchema.safeParse(poolRow) : null;
          if (pool?.success && pool.data.status === 'softPlaced') {
            await database.taskPoolItems.put(taskPoolItemSchema.parse({
              ...pool.data,
              status: fallbackPoolStatus(await database.activeTasks.get(pool.data.id), pool.data),
              updatedAt: timestamp,
            }));
          }
        }

        const automaticPlacement: InternalPlacement = {
          ...current,
          origin: 'scheduler',
          provenance: ['Returned to automatic scheduling after explicit protection was removed.'],
        };
        delete automaticPlacement.sourcePlacementId;
        const plan: SchedulerPlan = {
          placements: latest.plan.placements.map((placement) =>
            placement.id === current.id ? automaticPlacement : placement),
          unscheduledIntentionIds: [...latest.plan.unscheduledIntentionIds],
          unscheduledRhythmIds: [...latest.plan.unscheduledRhythmIds],
          rejectedExistingPlacements: latest.plan.rejectedExistingPlacements.map((item) => ({
            placement: { ...item.placement },
            violations: item.violations.map((violation) => ({ ...violation })),
          })),
        };
        const persisted = await saveSchedulerPlanState(
          plan,
          database,
          timestamp,
          schedulerFields(latest),
        );
        if (!persisted.ok) throw new Error(persisted.errors.join(' '));

        await appendBehaviourEvent(
          behaviourEventForUserPlacement(removed, 'remove', timestamp, parsed.data),
          database,
        );
        return { ok: true as const, plan: persisted.plan };
      },
      expectedRecoveryGeneration,
    );
    if (!result.ok) return result;
    return { ok: true, placement: null, repairPending: false, plan: result.plan };
  } catch (error) {
    return { ok: false, errors: [profileRecoveryErrorMessage(error, 'Protection was not removed.')] };
  }
}
