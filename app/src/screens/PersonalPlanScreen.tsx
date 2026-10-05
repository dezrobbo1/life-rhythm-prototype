import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Modal, ScreenHero } from '../components';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import {
  ensureCurrentPrivatePlan,
  repairCurrentPrivatePlan,
  undoCurrentPrivatePlan,
  type PrivatePlanActionResult,
} from '../data/schedulerPlanCoordinator';
import { loadSoftPlacementsForDateResult } from '../data/softPlacementRepository';
import { loadTaskPoolItemsResult } from '../data/taskPoolRepository';
import { getCurrentLifeRhythmDatabase } from '../data/localDataNamespace';
import { assertProfileRecoveryGeneration, captureProfileRecoveryGeneration,
  StaleProfileRecoveryError, STALE_PROFILE_RECOVERY_MESSAGE } from '../data/profileRecoveryGeneration';
import type { CollectionReadResult } from '../data/collectionReadResult';
import {
  confirmTaskPoolSoftPlacement,
  removeTaskPoolSoftPlacement,
} from '../data/taskSoftPlacementRepository';
import {
  movePrivatePlacement,
  protectPrivatePlacement,
  unprotectPrivatePlacement,
} from '../data/placementCorrectionCoordinator';
import type { SoftPlacement, TaskPoolItem } from '../data/schemas';
import type {
  InternalPlacement,
  SchedulerPlan,
  SchedulerPlanChange,
  SchedulerViolation,
} from '../domain/schedulingModel';
import {
  buildPoolSoftSuggestions,
  type PoolSoftSuggestion,
} from '../features/plan/poolSoftSuggestions';
import { placementReasonLines } from '../features/plan/placementExplanation';
import {
  createSoftPlacementId,
  dayNameForLocalDate,
  localDateForNextSelectedDay,
} from '../features/plan/softPlacementDate';
import {
  buildDayShapePreviewViewModel,
  dayShapePreviewDays,
  type DayName,
} from '../viewModels';

const visibleSoftPlacementStatuses: Array<SoftPlacement['status']> = [
  'planned',
  'moved',
  'completedFromToday',
];

const softPlacementStatusLabels: Record<SoftPlacement['status'], string> = {
  completedFromToday: 'Completed from Today',
  moved: 'Moved',
  planned: 'Planned',
  removed: 'Removed',
};

type PlacementFeedback = {
  kind: 'error' | 'success';
  lines: string[];
};

type PrivatePlanViewState =
  | { status: 'loading' }
  | {
      status: 'error';
      errors: string[];
    }
  | {
      status: 'ready';
      plan: SchedulerPlan;
      titleByTargetId: Record<string, string>;
      warnings: string[];
      generation: number;
    };

type SurfaceCollectionState<T> =
  | { status: 'loading' }
  | CollectionReadResult<T>;

type ManualPlanState = {
  generation: number | null;
  placementsResult: SurfaceCollectionState<SoftPlacement>;
  itemsResult: SurfaceCollectionState<TaskPoolItem>;
};

function loadingManualPlanState(): ManualPlanState {
  return { generation: null, placementsResult: { status: 'loading' }, itemsResult: { status: 'loading' } };
}

function failedManualPlanState(): ManualPlanState {
  return { generation: null,
    placementsResult: { errors: ['softPlacements: Saved manual placements could not be read.'], status: 'readFailed' },
    itemsResult: { errors: ['taskPoolItems: Saved Pool tasks could not be read.'], status: 'readFailed' } };
}

type PersonalPlanScreenProps = {
  detailsFooter?: ReactNode;
  dayLinePlacementIds?: string[];
  renderDayLine?: (renderCorrection: (placementId: string) => ReactNode) => ReactNode;
  embeddedInDayLine?: boolean;
  onPlanRecovered?: () => void;
  planRevision?: number;
  preferredPlacementDate?: string | null;
  preferredTaskId?: string | null;
};

function placementTitle(
  titleByTargetId: Record<string, string>,
  targetId: string,
) {
  return titleByTargetId[targetId] ?? 'Private task';
}

function localTimeMinutes(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function moveTimingSummary(placement: InternalPlacement | null, start: string) {
  if (!placement) return null;
  const originalStart = localTimeMinutes(placement.start);
  const originalEnd = localTimeMinutes(placement.end);
  const requestedStart = localTimeMinutes(start);
  if (originalStart === null || originalEnd === null || requestedStart === null) return null;
  const duration = originalEnd - originalStart;
  if (duration <= 0) return null;
  const requestedEnd = requestedStart + duration;
  if (requestedEnd >= 24 * 60) {
    return { duration, end: null as string | null };
  }
  const hours = Math.floor(requestedEnd / 60).toString().padStart(2, '0');
  const minutes = (requestedEnd % 60).toString().padStart(2, '0');
  return { duration, end: `${hours}:${minutes}` };
}

function correctionConflictReason(violations: readonly SchedulerViolation[]) {
  const codes = new Set(violations.map((violation) => violation.code));
  if (codes.has('external-commitment-overlap')) {
    return 'A fixed or read-only calendar commitment now overlaps this saved private time.';
  }
  if (codes.has('protected-window-overlap')) {
    return 'A protected or unavailable boundary now overlaps this saved private time.';
  }
  if (codes.has('placement-overlap')) {
    return 'Another private placement now overlaps this saved private time.';
  }
  if (codes.has('outside-candidate-interval')) {
    return 'This saved time is no longer inside capacity Life Rhythm can use.';
  }
  if (codes.has('timing-constraint-violation')) {
    return 'This saved time no longer fits the item’s current timing boundary.';
  }
  if (codes.has('unknown-intention') || codes.has('unknown-rhythm')) {
    return 'This saved correction no longer has a current schedulable item.';
  }
  return 'Current scheduling reality no longer supports this saved correction.';
}

function formatChangedLine(
  change: SchedulerPlanChange,
  titleByTargetId: Record<string, string>,
) {
  const title = placementTitle(titleByTargetId, change.targetId);
  const from = change.from
    ? `${change.from.date} ${change.from.start}-${change.from.end}`
    : null;
  const to = change.to
    ? `${change.to.date} ${change.to.start}-${change.to.end}`
    : null;

  switch (change.kind) {
    case 'added':
      return `${title} was added${to ? ` at ${to}` : ''}.`;
    case 'removed':
      return `${title} was removed${from ? ` from ${from}` : ''}.`;
    case 'variantChanged':
      return `${title} changed form${to ? ` at ${to}` : ''}.`;
    case 'moved':
    default:
      return `${title} moved${from ? ` from ${from}` : ''}${to ? ` to ${to}` : ''}.`;
  }
}

export function PersonalPlanScreen({
  detailsFooter = null,
  renderDayLine,
  embeddedInDayLine = false,
  dayLinePlacementIds = [],
  onPlanRecovered,
  planRevision = 0,
  preferredPlacementDate = null,
  preferredTaskId = null,
}: PersonalPlanScreenProps = {}) {
  const { snapshot } = useAppSnapshot();
  const [selectedDay, setSelectedDay] = useState<DayName>(
    () => dayNameForLocalDate(preferredPlacementDate) ?? 'Monday',
  );
  const [selectedPlacementDateOverride, setSelectedPlacementDateOverride] = useState<string | null>(
    preferredPlacementDate,
  );
  const [manualPlanState, setManualPlanState] = useState<ManualPlanState>(loadingManualPlanState);
  const [placingSuggestionId, setPlacingSuggestionId] = useState<string | null>(null);
  const [removingPlacementId, setRemovingPlacementId] = useState<string | null>(null);
  const [placementFeedback, setPlacementFeedback] = useState<PlacementFeedback | null>(null);
  const [privatePlanState, setPrivatePlanState] = useState<PrivatePlanViewState>({ status: 'loading' });
  const [privatePlanBusy, setPrivatePlanBusy] = useState<'refresh' | 'undo' | null>(null);
  const [privatePlanFeedback, setPrivatePlanFeedback] = useState<string | null>(null);
  const [correctionBusyId, setCorrectionBusyId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<InternalPlacement | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [moveStart, setMoveStart] = useState('');
  const [planDetailsOpen, setPlanDetailsOpen] = useState(!embeddedInDayLine);
  const manualPlanReadRequestRef = useRef(0);
  const correctionFocusTarget = useRef<string | null>(null);
  const planDetailsSummaryRef = useRef<HTMLElement | null>(null);
  const moveSucceededRef = useRef(false);
  const moveReturnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const clearCorrectionFocus = () => { correctionFocusTarget.current = null; };
    document.addEventListener('pointerdown', clearCorrectionFocus);
    document.addEventListener('keydown', clearCorrectionFocus);
    return () => {
      document.removeEventListener('pointerdown', clearCorrectionFocus);
      document.removeEventListener('keydown', clearCorrectionFocus);
    };
  }, []);
  const { generation: manualPlanGeneration, placementsResult: placementReadState,
    itemsResult: poolReadState } = manualPlanState;
  const savedSoftPlacements = placementReadState.status === 'loading' || placementReadState.status === 'readFailed'
    ? [] : placementReadState.items;
  const taskPoolItems = poolReadState.status === 'loading' || poolReadState.status === 'readFailed'
    ? [] : poolReadState.items;

  const dayShapePreview = useMemo(
    () => buildDayShapePreviewViewModel(snapshot, selectedDay),
    [selectedDay, snapshot],
  );
  const selectedPlacementDate = useMemo(
    () => selectedPlacementDateOverride ?? localDateForNextSelectedDay(dayShapePreview.selectedDay),
    [dayShapePreview.selectedDay, selectedPlacementDateOverride],
  );
  const hasDayShapeBlocks = dayShapePreview.groups.some((group) => group.blocks.length > 0);
  const askFirstBlocks = dayShapePreview.groups.find((group) => group.id === 'askFirst')?.blocks ?? [];
  const visibleSoftPlacements = useMemo(
    () => savedSoftPlacements.filter((placement) => visibleSoftPlacementStatuses.includes(placement.status)),
    [savedSoftPlacements],
  );
  const preferredTask = useMemo(
    () => taskPoolItems.find((item) => item.id === preferredTaskId) ?? null,
    [preferredTaskId, taskPoolItems],
  );
  const poolSoftSuggestions = useMemo(
    () => buildPoolSoftSuggestions({
      existingPlacements: savedSoftPlacements,
      items: taskPoolItems,
      preferredTaskId,
      selectedDate: selectedPlacementDate,
      selectedDay: dayShapePreview.selectedDay,
      timeBlocks: snapshot.settings?.lifeShape?.timeBlocks ?? [],
    }),
    [
      dayShapePreview.selectedDay,
      preferredTaskId,
      savedSoftPlacements,
      selectedPlacementDate,
      snapshot.settings,
      taskPoolItems,
    ],
  );
  const automaticPlacements = useMemo(() => {
    if (privatePlanState.status !== 'ready') return [];
    return privatePlanState.plan.placements.filter(
      (placement) =>
        placement.origin === 'scheduler' &&
        placement.date === selectedPlacementDate,
    );
  }, [privatePlanState, selectedPlacementDate]);
  const changedItems = privatePlanState.status === 'ready'
    ? privatePlanState.plan.repair?.changes ?? []
    : [];
  const correctionConflicts = useMemo(() => {
    if (privatePlanState.status !== 'ready') return [];
    return privatePlanState.plan.rejectedExistingPlacements.filter(({ placement }) =>
      placement.origin === 'existingUserConfirmed' &&
      placement.date === selectedPlacementDate &&
      placement.provenance.some((item) =>
        item === 'User explicitly moved this private placement.' ||
        item === 'User explicitly protected this private placement.',
      ),
    );
  }, [privatePlanState, selectedPlacementDate]);

  const applyPrivatePlanResult = useCallback((result: PrivatePlanActionResult, generation: number | null) => {
    if (!result.ok || generation === null) {
      setPrivatePlanState({
        status: 'error',
        errors: result.ok ? ['Private plan could not retain a current profile view. Reload Plan and try again.'] : result.errors,
      });
      return false;
    }

    setPrivatePlanState({
      status: 'ready',
      plan: result.plan,
      titleByTargetId: result.titleByTargetId,
      warnings: result.warnings,
      generation,
    });
    return true;
  }, []);

  const readPrivatePlan = useCallback(async () => {
    const database = getCurrentLifeRhythmDatabase();
    const readOnce = async () => {
      const generation = await captureProfileRecoveryGeneration(database);
      const result = await ensureCurrentPrivatePlan();
      await assertProfileRecoveryGeneration(database, generation);
      return { generation, result };
    };
    try {
      return await readOnce();
    } catch (error) {
      if (error instanceof StaleProfileRecoveryError) return readOnce();
      throw error;
    }
  }, []);

  const reloadPrivatePlan = useCallback(async () => {
    setPrivatePlanState({ status: 'loading' });
    try {
      const { result, generation } = await readPrivatePlan();
      return applyPrivatePlanResult(result, generation);
    } catch {
      setPrivatePlanState({
        status: 'error',
        errors: ['Private plan needs updating. Use Refresh flexible plan to try again.'],
      });
      return false;
    }
  }, [applyPrivatePlanResult, readPrivatePlan]);

  const readManualPlanData = useCallback(async () => {
    const db = getCurrentLifeRhythmDatabase();
    const readOnce = async () => {
      const generation = await captureProfileRecoveryGeneration(db);
      const [placementsResult, itemsResult] = await Promise.all([
        loadSoftPlacementsForDateResult(selectedPlacementDate, db),
        loadTaskPoolItemsResult(db),
      ]);
      await assertProfileRecoveryGeneration(db, generation);
      return { generation, placementsResult, itemsResult };
    };
    try {
      return await readOnce();
    } catch (error) {
      // A restore between source reads makes the result ambiguous. Refresh once,
      // never expose that mixed read as an actionable Plan view.
      if (error instanceof StaleProfileRecoveryError) return readOnce();
      throw error;
    }
  }, [selectedPlacementDate]);

  const applyManualPlanData = useCallback((result: Awaited<ReturnType<typeof readManualPlanData>>) => {
    setManualPlanState({ ...result, generation: result.placementsResult.status === 'readFailed' ||
      result.itemsResult.status === 'readFailed' ? null : result.generation });
  }, []);

  const refreshPlanData = useCallback(async () => {
    const requestId = manualPlanReadRequestRef.current + 1;
    manualPlanReadRequestRef.current = requestId;
    const result = await readManualPlanData();

    if (manualPlanReadRequestRef.current === requestId) {
      applyManualPlanData(result);
    }
  }, [applyManualPlanData, readManualPlanData]);

  const retryManualPlanData = useCallback(async () => {
    const requestId = manualPlanReadRequestRef.current + 1;
    manualPlanReadRequestRef.current = requestId;

    try {
      const result = await readManualPlanData();

      if (manualPlanReadRequestRef.current === requestId) {
        applyManualPlanData(result);
      }
    } catch {
      if (manualPlanReadRequestRef.current !== requestId) return;

      setManualPlanState(failedManualPlanState());
    }
  }, [applyManualPlanData, readManualPlanData]);

  const repairAfterUserPlacementChange = useCallback(async (expectedGeneration: number) => {
    const database = getCurrentLifeRhythmDatabase();
    try {
      const result = await repairCurrentPrivatePlan({
        reason: 'A user-confirmed private placement changed.',
        trigger: 'userCorrection',
        expectedRecoveryGeneration: expectedGeneration,
      });
      await assertProfileRecoveryGeneration(database, expectedGeneration);
      if (!result.ok && result.errors.includes(STALE_PROFILE_RECOVERY_MESSAGE)) {
        await reloadPrivatePlan();
        return 'stale' as const;
      }
      return applyPrivatePlanResult(result, expectedGeneration) ? 'repaired' as const : 'pending' as const;
    } catch (error) {
      if (error instanceof StaleProfileRecoveryError) {
        await reloadPrivatePlan();
        return 'stale' as const;
      }
      throw error;
    }
  }, [applyPrivatePlanResult, reloadPrivatePlan]);

  useEffect(() => {
    let active = true;

    setPrivatePlanState({ status: 'loading' });
    setPrivatePlanFeedback(null);

    readPrivatePlan()
      .then(({ result, generation }) => {
        if (active) applyPrivatePlanResult(result, generation);
      })
      .catch(() => {
        if (active) {
          setPrivatePlanState({
            status: 'error',
            errors: ['Private plan could not be loaded. Saved scheduler state was left unchanged.'],
          });
        }
      });

    return () => {
      active = false;
    };
  }, [applyPrivatePlanResult, planRevision, readPrivatePlan]);

  useEffect(() => {
    let active = true;
    const requestId = manualPlanReadRequestRef.current + 1;
    manualPlanReadRequestRef.current = requestId;

    setPlacementFeedback(null);
    setManualPlanState(loadingManualPlanState());

    readManualPlanData()
      .then((result) => {
        if (active && manualPlanReadRequestRef.current === requestId) applyManualPlanData(result);
      })
      .catch(() => {
        if (active && manualPlanReadRequestRef.current === requestId) {
          setManualPlanState(failedManualPlanState());
        }
      });

    return () => {
      active = false;
    };
  }, [applyManualPlanData, readManualPlanData]);

  useEffect(() => {
    setSelectedDay(dayNameForLocalDate(preferredPlacementDate) ?? 'Monday');
    setSelectedPlacementDateOverride(preferredPlacementDate);
    correctionFocusTarget.current = null;
  }, [preferredPlacementDate]);

  const refreshPrivatePlan = useCallback(async () => {
    setPrivatePlanBusy('refresh');
    setPrivatePlanFeedback(null);

    const database = getCurrentLifeRhythmDatabase();
    const generation = privatePlanState.status === 'ready'
      ? privatePlanState.generation
      : await captureProfileRecoveryGeneration(database);

    try {
      const result = await repairCurrentPrivatePlan({
        reason: 'You asked Life Rhythm to refresh flexible private work.',
        trigger: 'manualReplan',
        expectedRecoveryGeneration: generation,
      });
      await assertProfileRecoveryGeneration(database, generation);
      if (!result.ok && result.errors.includes(STALE_PROFILE_RECOVERY_MESSAGE)) {
        await Promise.all([reloadPrivatePlan(), retryManualPlanData()]);
        setPrivatePlanFeedback(STALE_PROFILE_RECOVERY_MESSAGE);
        return;
      }
      const applied = applyPrivatePlanResult(result, generation);
      if (applied) {
        onPlanRecovered?.();
      }
      setPrivatePlanFeedback(
        applied
          ? 'Flexible private work was refreshed. External calendar events were not changed.'
          : 'Private plan was not changed.',
      );
    } catch (error) {
      if (error instanceof StaleProfileRecoveryError) {
        await Promise.all([reloadPrivatePlan(), retryManualPlanData()]);
        setPrivatePlanFeedback(STALE_PROFILE_RECOVERY_MESSAGE);
      } else {
        setPrivatePlanFeedback('Private plan was not changed.');
      }
    } finally {
      setPrivatePlanBusy(null);
    }
  }, [
    applyPrivatePlanResult,
    onPlanRecovered,
    privatePlanState,
    reloadPrivatePlan,
    retryManualPlanData,
  ]);

  const undoPrivatePlan = useCallback(async () => {
    if (privatePlanState.status !== 'ready') {
      setPrivatePlanFeedback('Reload Plan before undoing this change.');
      return;
    }
    setPrivatePlanBusy('undo');
    setPrivatePlanFeedback(null);

    const database = getCurrentLifeRhythmDatabase();
    const generation = privatePlanState.generation;

    try {
      const result = await undoCurrentPrivatePlan({}, generation);
      await assertProfileRecoveryGeneration(database, generation);
      if (!result.ok && result.errors.includes(STALE_PROFILE_RECOVERY_MESSAGE)) {
        await Promise.all([reloadPrivatePlan(), retryManualPlanData()]);
        setPrivatePlanFeedback(STALE_PROFILE_RECOVERY_MESSAGE);
        return;
      }
      const applied = applyPrivatePlanResult(result, generation);
      setPrivatePlanFeedback(
        applied
          ? 'The previous private plan was restored.'
          : 'The previous private plan could not be restored.',
      );
    } catch (error) {
      if (error instanceof StaleProfileRecoveryError) {
        await Promise.all([reloadPrivatePlan(), retryManualPlanData()]);
        setPrivatePlanFeedback(STALE_PROFILE_RECOVERY_MESSAGE);
      } else {
        setPrivatePlanFeedback('The previous private plan could not be restored.');
      }
    } finally {
      setPrivatePlanBusy(null);
    }
  }, [applyPrivatePlanResult, privatePlanState, reloadPrivatePlan, retryManualPlanData]);

  const addSoftPlacement = useCallback(async (suggestion: PoolSoftSuggestion) => {
    const expectedGeneration = manualPlanGeneration;
    if (expectedGeneration === null) return;
    setPlacingSuggestionId(suggestion.id);
    setPlacementFeedback(null);

    try {
      const result = await confirmTaskPoolSoftPlacement({
        blockEnd: suggestion.blockEnd,
        blockId: suggestion.blockId,
        blockLabel: suggestion.blockLabel,
        blockStart: suggestion.blockStart,
        date: suggestion.date,
        id: createSoftPlacementId({
          blockId: suggestion.blockId,
          date: suggestion.date,
          taskId: suggestion.taskId,
        }),
        taskId: suggestion.taskId,
      }, getCurrentLifeRhythmDatabase(), expectedGeneration);

      if (!result.ok) {
        setPlacementFeedback({
          kind: 'error',
          lines: ['User-confirmed placement was not added.', 'Nothing else changed.'],
        });
        return;
      }

      await refreshPlanData();
      const repairState = await repairAfterUserPlacementChange(expectedGeneration);
      if (repairState === 'stale') {
        await retryManualPlanData();
        setPlacementFeedback({ kind: 'error', lines: ['The local profile changed. Refresh Plan and try again.'] });
        return;
      }
      setPlacementFeedback({
        kind: 'success',
        lines: [
          'User-confirmed placement added.',
          'No calendar event created.',
          repairState === 'repaired'
            ? 'Flexible automatic placements were checked around it.'
            : 'The automatic private plan could not update; the placement is still saved.',
        ],
      });
    } catch (error) {
      if (error instanceof StaleProfileRecoveryError) {
        await retryManualPlanData();
        setPlacementFeedback({ kind: 'error', lines: ['The local profile changed. Refresh Plan and try again.'] });
        return;
      }
      setPlacementFeedback({
        kind: 'error',
        lines: ['User-confirmed placement was not added.', 'Nothing else changed.'],
      });
    } finally {
      setPlacingSuggestionId(null);
    }
  }, [manualPlanGeneration, refreshPlanData, repairAfterUserPlacementChange, retryManualPlanData]);

  const removeSoftPlacement = useCallback(async (placement: SoftPlacement) => {
    const expectedGeneration = manualPlanGeneration;
    if (expectedGeneration === null) return;
    setRemovingPlacementId(placement.id);
    setPlacementFeedback(null);

    try {
      const result = await removeTaskPoolSoftPlacement(placement.id, getCurrentLifeRhythmDatabase(), expectedGeneration);

      if (!result.ok) {
        setPlacementFeedback({
          kind: 'error',
          lines: ['User-confirmed placement was not removed.', 'Nothing else changed.'],
        });
        return;
      }

      await refreshPlanData();
      const repairState = await repairAfterUserPlacementChange(expectedGeneration);
      if (repairState === 'stale') {
        await retryManualPlanData();
        setPlacementFeedback({ kind: 'error', lines: ['The local profile changed. Refresh Plan and try again.'] });
        return;
      }
      setPlacementFeedback({
        kind: 'success',
        lines: [
          'User-confirmed placement removed.',
          'Task was not deleted. No calendar event changed.',
          repairState === 'repaired'
            ? 'Flexible automatic placements were checked again.'
            : 'The automatic private plan could not update; the removal is still saved.',
        ],
      });
    } catch (error) {
      if (error instanceof StaleProfileRecoveryError) {
        await retryManualPlanData();
        setPlacementFeedback({ kind: 'error', lines: ['The local profile changed. Refresh Plan and try again.'] });
        return;
      }
      setPlacementFeedback({
        kind: 'error',
        lines: ['User-confirmed placement was not removed.', 'Nothing else changed.'],
      });
    } finally {
      setRemovingPlacementId(null);
    }
  }, [manualPlanGeneration, refreshPlanData, repairAfterUserPlacementChange, retryManualPlanData]);

  const prepareCorrectionFocus = useCallback((placement: InternalPlacement, plan: SchedulerPlan, repairPending: boolean) => {
    const targetId = placement.targetKind === 'rhythm'
      ? placement.rhythmId ?? placement.intentionId : placement.intentionId;
    const replacement = plan.placements.find((item) =>
      (item.targetKind === 'rhythm' ? item.rhythmId ?? item.intentionId : item.intentionId) === targetId &&
      item.date === selectedPlacementDate,
    );
    // Wait for the exact replacement row, never an earlier row for this target.
    correctionFocusTarget.current = embeddedInDayLine && !repairPending &&
      dayLinePlacementIds.includes(placement.id) ? replacement?.id ?? null : null;
  }, [dayLinePlacementIds, embeddedInDayLine, selectedPlacementDate]);

  const openMove = useCallback((placement: InternalPlacement) => {
    moveSucceededRef.current = false;
    moveReturnFocusRef.current = null;
    correctionFocusTarget.current = null;
    setMoveTarget(placement);
    setMoveDate(placement.date);
    setMoveStart(placement.start);
    setPlacementFeedback(null);
  }, []);

  const saveMove = useCallback(async () => {
    if (!moveTarget || privatePlanState.status !== 'ready') return;
    setCorrectionBusyId(moveTarget.id);
    setPlacementFeedback(null);
    try {
      const result = await movePrivatePlacement(
        moveTarget,
        { date: moveDate, start: moveStart },
        privatePlanState.generation,
      );
      if (!result.ok) {
        if (result.errors.includes(STALE_PROFILE_RECOVERY_MESSAGE)) {
          await Promise.all([retryManualPlanData(), reloadPrivatePlan()]);
        }
        setPlacementFeedback({ kind: 'error', lines: result.errors });
        return;
      }
      await refreshPlanData();
      if (result.repairPending) {
        setPrivatePlanState({
          status: 'error',
          errors: ['Your move is saved, but the automatic private plan still needs updating.'],
        });
      } else {
        setPrivatePlanState({
          status: 'ready',
          plan: result.plan,
          titleByTargetId: privatePlanState.titleByTargetId,
          warnings: privatePlanState.warnings,
          generation: privatePlanState.generation,
        });
      }
      prepareCorrectionFocus(moveTarget, result.plan, result.repairPending);
      moveSucceededRef.current = true;
      moveReturnFocusRef.current = planDetailsSummaryRef.current;
      setMoveTarget(null);
      setPlacementFeedback({
        kind: 'success',
        lines: [
          'Placement moved.',
          'No external calendar event was changed.',
          result.repairPending ? 'The private plan still needs updating.' : 'Other flexible work was checked around your correction.',
        ],
      });
    } catch {
      setPlacementFeedback({ kind: 'error', lines: ['The placement move was not saved. Nothing else changed.'] });
    } finally {
      setCorrectionBusyId(null);
    }
  }, [
    moveDate,
    moveStart,
    moveTarget,
    privatePlanState,
    prepareCorrectionFocus,
    refreshPlanData,
    reloadPrivatePlan,
    retryManualPlanData,
  ]);

  const protectPlacement = useCallback(async (placement: InternalPlacement) => {
    if (privatePlanState.status !== 'ready') return;
    setCorrectionBusyId(placement.id);
    setPlacementFeedback(null);
    try {
      const result = await protectPrivatePlacement(placement, privatePlanState.generation);
      if (!result.ok) {
        if (result.errors.includes(STALE_PROFILE_RECOVERY_MESSAGE)) {
          await Promise.all([retryManualPlanData(), reloadPrivatePlan()]);
        }
        setPlacementFeedback({ kind: 'error', lines: result.errors });
        return;
      }
      prepareCorrectionFocus(placement, result.plan, result.repairPending);
      await refreshPlanData();
      if (result.repairPending) {
        setPrivatePlanState({
          status: 'error',
          errors: ['Protection is saved, but the automatic private plan still needs updating.'],
        });
      } else {
        setPrivatePlanState({
          status: 'ready',
          plan: result.plan,
          titleByTargetId: privatePlanState.titleByTargetId,
          warnings: privatePlanState.warnings,
          generation: privatePlanState.generation,
        });
      }
      setPlacementFeedback({
        kind: 'success',
        lines: [
          'This private time is protected.',
          'Hard calendar commitments and unavailable boundaries still take priority.',
        ],
      });
      if (!correctionFocusTarget.current) {
        window.setTimeout(() => planDetailsSummaryRef.current?.focus(), 0);
      }
    } catch {
      setPlacementFeedback({ kind: 'error', lines: ['Protection was not saved. Nothing else changed.'] });
    } finally {
      setCorrectionBusyId(null);
    }
  }, [
    privatePlanState,
    prepareCorrectionFocus,
    refreshPlanData,
    reloadPrivatePlan,
    retryManualPlanData,
  ]);

  const unprotectPlacement = useCallback(async (placement: InternalPlacement) => {
    if (privatePlanState.status !== 'ready') return;
    setCorrectionBusyId(placement.id);
    setPlacementFeedback(null);
    try {
      const result = await unprotectPrivatePlacement(placement, privatePlanState.generation);
      if (!result.ok) {
        if (result.errors.includes(STALE_PROFILE_RECOVERY_MESSAGE)) {
          await Promise.all([retryManualPlanData(), reloadPrivatePlan()]);
        }
        setPlacementFeedback({ kind: 'error', lines: result.errors });
        return;
      }
      prepareCorrectionFocus(placement, result.plan, result.repairPending);
      await refreshPlanData();
      if (result.repairPending) {
        setPrivatePlanState({
          status: 'error',
          errors: ['Protection was removed, but the automatic private plan still needs updating.'],
        });
      } else {
        setPrivatePlanState({
          status: 'ready',
          plan: result.plan,
          titleByTargetId: privatePlanState.titleByTargetId,
          warnings: privatePlanState.warnings,
          generation: privatePlanState.generation,
        });
      }
      setPlacementFeedback({
        kind: 'success',
        lines: [
          'Protection removed.',
          result.repairPending
            ? 'The automatic private plan still needs updating.'
            : 'Future automatic repair may move this flexible placement.',
        ],
      });
      if (!correctionFocusTarget.current) {
        window.setTimeout(() => planDetailsSummaryRef.current?.focus(), 0);
      }
    } catch {
      setPlacementFeedback({ kind: 'error', lines: ['Protection was not removed. Nothing else changed.'] });
    } finally {
      setCorrectionBusyId(null);
    }
  }, [
    privatePlanState,
    prepareCorrectionFocus,
    refreshPlanData,
    reloadPrivatePlan,
    retryManualPlanData,
  ]);

  const planPlacementForCorrection = useCallback((placement: SoftPlacement) => {
    if (privatePlanState.status !== 'ready') return null;
    return privatePlanState.plan.placements.find((candidate) =>
      candidate.id === placement.id || candidate.sourcePlacementId === placement.id,
    ) ?? privatePlanState.plan.rejectedExistingPlacements.find((item) =>
      item.placement.id === placement.id || item.placement.sourcePlacementId === placement.id,
    )?.placement ?? null;
  }, [privatePlanState]);

  const suggestionEmptyTitle = poolSoftSuggestions.openCapacityBlockCount === 0
    ? `No open capacity blocks for ${dayShapePreview.selectedDay}.`
    : poolSoftSuggestions.eligibleTaskCount === 0
      ? 'No safely held tasks need a manual window.'
      : 'No held task fits the available block.';
  const suggestionEmptyMessage = poolSoftSuggestions.openCapacityBlockCount === 0
    ? 'Blank time stays blank. Add an open-capacity block in Settings only when it is genuinely available.'
    : poolSoftSuggestions.eligibleTaskCount === 0
      ? 'Capture or return a task to Held when you want a manual placement option.'
      : 'The minimum version or useful window does not fit. Nothing was manually placed.';
  const manualDataLoading = poolReadState.status === 'loading' || placementReadState.status === 'loading';
  const manualDataFailed = poolReadState.status === 'readFailed' || placementReadState.status === 'readFailed';
  const manualDataPartial = poolReadState.status === 'partial' || placementReadState.status === 'partial';
  const moveTiming = moveTimingSummary(moveTarget, moveStart);

  function renderCorrection(placementId: string) {
    if (privatePlanState.status !== 'ready') return null;
    const placement = privatePlanState.plan.placements.find((item) => item.id === placementId);
    if (!placement) return null;
    const targetId = placement.targetKind === 'rhythm' ? placement.rhythmId ?? placement.intentionId : placement.intentionId;
    const title = placementTitle(privatePlanState.titleByTargetId, targetId);
    const protectedTime = placement.provenance.includes('User explicitly protected this private placement.');
    const reasons = placementReasonLines(placement.provenance);
    return (
      <details className="plan-context-correction">
        <summary tabIndex={0} ref={(element) => {
          // Corrections may replace a keyed row. Focus only its exact successor
          // and let modal cleanup use the same destination when it is ready.
          if (element && !moveTarget && correctionFocusTarget.current === placement.id) {
            moveReturnFocusRef.current = element;
            window.setTimeout(() => {
              if (element.isConnected && correctionFocusTarget.current === placement.id) {
                const current = document.activeElement;
                if (current === document.body || current === planDetailsSummaryRef.current ||
                    element.closest('details')?.contains(current)) {
                  element.focus();
                }
              }
            }, 0);
          }
        }}>Correct {title}</summary>
        <div className="plan-context-correction__content">
          <div className="button-row" aria-label={`Correction actions for ${title}`}>
            <Button disabled={correctionBusyId !== null} onClick={() => openMove(placement)}>Move</Button>
            <Button disabled={correctionBusyId !== null}
              onClick={() => void (protectedTime ? unprotectPlacement(placement) : protectPlacement(placement))}>
              {correctionBusyId === placement.id ? 'Saving' : protectedTime ? 'Unprotect' : 'Protect this time'}
            </Button>
          </div>
          {reasons.length > 0 ? <details className="plan-section__details">
            <summary>Why this time?</summary>
            <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </details> : null}
        </div>
      </details>
    );
  }

  return (
    <div className="screen-stack plan-screen personal-plan-screen">
      {renderDayLine?.(renderCorrection)}
      {!embeddedInDayLine ? (
        <ScreenHero
          className="plan-hero"
          tagline="Life Rhythm maintains flexible private work around the boundaries you set."
          title="Plan"
          titleId="plan-title"
        />
      ) : null}

      {embeddedInDayLine && privatePlanState.status === 'loading' ? (
        <p role="status">Preparing the private plan.</p>
      ) : null}

      {embeddedInDayLine && privatePlanState.status === 'error' ? (
        <section className="surface-status surface-status--error plan-default-attention" role="alert">
          <h2>Flexible plan needs updating.</h2>
          {privatePlanState.errors.map((error) => <p key={error}>{error}</p>)}
          <p>Your saved plan was left unchanged. Open Plan details to recheck flexible work.</p>
        </section>
      ) : null}

      {privatePlanState.status === 'ready' && changedItems.length > 0 ? (
        <section
          className="private-plan-changed plan-section plan-section--changed plan-default-changed"
          aria-labelledby="personal-private-plan-changed-title"
        >
          <div className="soft-placements__header">
            <p className="section-label">Recent plan change</p>
            <h2 id="personal-private-plan-changed-title">Changed</h2>
            <div className="plan-section__guidance">
              <p>Only the latest change to your flexible plan is shown here.</p>
            </div>
          </div>

          <ul className="soft-placements__list">
            {changedItems.map((change, index) => (
              <li key={`${change.targetKind}:${change.targetId}:${change.kind}:${index}`}>
                <div className="soft-placements__item-copy">
                  <strong>{formatChangedLine(change, privatePlanState.titleByTargetId)}</strong>
                  <p>{change.reason}</p>
                </div>
              </li>
            ))}
          </ul>

          {privatePlanState.plan.repair?.undo &&
            privatePlanState.plan.repair.trigger !== 'settingsChanged' &&
            !privatePlanState.plan.repair.settingsDefinitionRepairApplied &&
            privatePlanState.plan.repair.trigger !== 'taskDefinitionChanged' &&
            !privatePlanState.plan.repair.taskDefinitionRepairApplied &&
            privatePlanState.plan.repair.trigger !== 'rhythmDefinitionChanged' &&
            !privatePlanState.plan.repair.rhythmDefinitionRepairApplied ? (
            <Button
              disabled={privatePlanBusy !== null}
              onClick={() => void undoPrivatePlan()}
            >
              {privatePlanBusy === 'undo' ? 'Restoring plan' : 'Undo last change'}
            </Button>
          ) : null}
        </section>
      ) : null}

      {privatePlanFeedback ? <p className="plan-default-feedback" role="status">{privatePlanFeedback}</p> : null}

      {manualDataFailed ? (
        <section
          aria-label="Manual Plan data unavailable"
          className="surface-read-state surface-read-state--error plan-default-attention"
          role="alert"
        >
          <h2>Some saved manual Plan data could not be loaded.</h2>
          {placementReadState.status === 'readFailed' ? <p>Saved manual placements could not be loaded.</p> : null}
          {poolReadState.status === 'readFailed' ? <p>Saved Held tasks could not be loaded for manual suggestions.</p> : null}
          <p>The automatic private plan and other available Plan information remain unchanged.</p>
          <p>Nothing stored on this device was changed.</p>
          <Button onClick={() => void retryManualPlanData()}>Retry manual Plan data</Button>
        </section>
      ) : manualDataPartial ? (
        <section
          aria-label="Saved manual Plan data warning"
          className="surface-read-state surface-read-state--warning plan-default-attention"
          role="status"
        >
          <h2>Some saved manual Plan data could not be read.</h2>
          <p>Readable Held tasks and placements remain available. Nothing stored on this device was changed.</p>
          <Button onClick={() => void retryManualPlanData()}>Retry manual Plan data</Button>
        </section>
      ) : null}

        {privatePlanState.status === 'ready' && correctionConflicts.length > 0 ? (
          <div className="soft-suggestions__feedback soft-suggestions__feedback--error" role="alert">
            <h3>Saved private time needs a new choice.</h3>
            <p>
              Life Rhythm kept your correction instead of silently moving it. Current harder scheduling reality now conflicts with that time.
            </p>
            <ul className="soft-placements__list">
              {correctionConflicts.map(({ placement, violations }) => {
                const targetId = placement.targetKind === 'rhythm'
                  ? placement.rhythmId ?? placement.intentionId
                  : placement.intentionId;
                const protectedPlacement = placement.provenance.includes(
                  'User explicitly protected this private placement.',
                );
                return (
                  <li key={placement.id}>
                    <div className="soft-placements__item-copy">
                      <strong>{placementTitle(privatePlanState.titleByTargetId, targetId)}</strong>
                      <span>{placement.date} · {placement.start}-{placement.end}</span>
                      <p>{correctionConflictReason(violations)}</p>
                    </div>
                    <div
                      className="button-row"
                      aria-label={`Resolve saved-time conflict for ${placementTitle(privatePlanState.titleByTargetId, targetId)}`}
                    >
                      <Button
                        disabled={correctionBusyId !== null}
                        onClick={() => openMove(placement)}
                      >
                        Move
                      </Button>
                      {protectedPlacement ? (
                        <Button
                          disabled={correctionBusyId !== null}
                          onClick={() => void unprotectPlacement(placement)}
                        >
                          {correctionBusyId === placement.id ? 'Saving' : 'Unprotect'}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

      <Modal
        open={moveTarget !== null}
        onClose={() => { if (correctionBusyId === null) setMoveTarget(null); }}
        returnFocusTo={() => moveSucceededRef.current ? moveReturnFocusRef.current : null}
        title="Move this planned time"
      >
          <section className="soft-suggestions__feedback">
            <p>
              Choose the exact local time you want. Life Rhythm will reject hard conflicts rather than silently choosing another time.
            </p>
            {moveTiming ? (
              <p className="plan-section__context">
                Keeps the current {moveTiming.duration}-minute form
                {moveTiming.end ? ` · requested time ${moveStart}–${moveTiming.end}` : ' · this start would reach the end of the local day'}.
              </p>
            ) : null}
            <div className="life-shape-inline">
              <label>
                <span>Move date</span>
                <input
                  aria-label="Move date"
                  type="date"
                  value={moveDate}
                  onChange={(event) => setMoveDate(event.target.value)}
                />
              </label>
              <label>
                <span>Move start time</span>
                <input
                  aria-label="Move start time"
                  type="time"
                  value={moveStart}
                  onChange={(event) => setMoveStart(event.target.value)}
                />
              </label>
            </div>
            {placementFeedback ? (
              <div role="status" className={`soft-suggestions__feedback--${placementFeedback.kind}`}>
                {placementFeedback.lines.map((line) => <p key={line}>{line}</p>)}
              </div>
            ) : null}
            <div className="button-row">
              <Button
                disabled={correctionBusyId !== null || !moveDate || !moveStart}
                onClick={() => void saveMove()}
                variant="primary"
              >
                {correctionBusyId ? 'Saving move' : 'Save move'}
              </Button>
              <Button
                disabled={correctionBusyId !== null}
                onClick={() => setMoveTarget(null)}
              >
                Cancel
              </Button>
            </div>
          </section>
      </Modal>

      {placementFeedback && !moveTarget ? (
        <div className={`soft-suggestions__feedback soft-suggestions__feedback--${placementFeedback.kind}`} role="status">
          {placementFeedback.lines.map((line) => <p key={line}>{line}</p>)}
        </div>
      ) : null}

      <details
        className="plan-details-disclosure"
        onToggle={(event) => setPlanDetailsOpen(event.currentTarget.open)}
        open={planDetailsOpen}
      >
        <summary ref={planDetailsSummaryRef}>
          <span>Plan details</span>
          <span>Flexible times, boundaries and your choices</span>
        </summary>
        <div className="plan-details-disclosure__content" hidden={!planDetailsOpen}>

      <section
        className="private-plan plan-section plan-section--private"
        aria-labelledby="personal-private-plan-title"
      >
        <div className="soft-placements__header">
          <p className="section-label">Life Rhythm can arrange these times</p>
          <h2 id="personal-private-plan-title">Flexible plan</h2>
          <div className="plan-section__guidance">
            <p>
              Life Rhythm can place flexible private work inside usable or explicitly available time.
              It does not create, move, or cancel external calendar events.
            </p>
          </div>
        </div>

        {embeddedInDayLine ? null : privatePlanState.status === 'loading' ? (
          <div className="soft-placements__empty" role="status">
            <h3>Preparing the private plan.</h3>
          </div>
        ) : privatePlanState.status === 'error' ? (
          <div className="soft-suggestions__feedback soft-suggestions__feedback--error" role="alert">
            <h3>Flexible plan needs updating.</h3>
            {privatePlanState.errors.map((error) => <p key={error}>{error}</p>)}
            <p>Saved scheduler state was left unchanged.</p>
          </div>
        ) : automaticPlacements.length > 0 ? (
          <ul className="soft-placements__list">
            {automaticPlacements.map((placement) => {
              const targetId = placement.targetKind === 'rhythm'
                ? placement.rhythmId ?? placement.intentionId
                : placement.intentionId;
              return (
                <li key={placement.id}>
                  <div className="soft-placements__item-copy">
                    <div>
                      <strong>{placementTitle(privatePlanState.titleByTargetId, targetId)}</strong>
                      <span>{placement.start}-{placement.end}</span>
                    </div>
                    <p>
                      Flexibly planned
                      {placement.variantKind ? ` · ${placement.variantKind}` : ''}
                    </p>
                    {placementReasonLines(placement.provenance).length > 0 ? (
                      <details className="plan-section__details">
                        <summary>Why this time?</summary>
                        <ul>
                          {placementReasonLines(placement.provenance).map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                  <div className="button-row" aria-label={`Correction actions for ${placementTitle(privatePlanState.titleByTargetId, targetId)}`}>
                    <Button
                      disabled={correctionBusyId !== null}
                      onClick={() => openMove(placement)}
                    >
                      Move
                    </Button>
                    <Button
                      disabled={correctionBusyId !== null}
                      onClick={() => void protectPlacement(placement)}
                    >
                      {correctionBusyId === placement.id ? 'Saving' : 'Protect this time'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="soft-placements__empty">
            <h3>No flexible work planned for {dayShapePreview.selectedDay}.</h3>
            <p>Blank time is not assumed to be usable capacity.</p>
          </div>
        )}

        <div className="button-row">
          <Button
            disabled={privatePlanBusy !== null || privatePlanState.status === 'loading'}
            onClick={() => void refreshPrivatePlan()}
          >
            {privatePlanBusy === 'refresh' ? 'Refreshing plan' : 'Refresh flexible plan'}
          </Button>
        </div>

        {privatePlanState.status === 'ready' && privatePlanState.warnings.length > 0 ? (
          <details className="plan-section__details">
            <summary>Planning notes</summary>
            <ul>
              {privatePlanState.warnings.slice(0, 4).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        ) : null}

      </section>

      <section
        className="day-shape-preview plan-section plan-section--day-shape"
        aria-labelledby="personal-day-shape-title"
      >
          <div className="day-shape-preview__header">
            <div>
              <p className="section-label">Planning boundaries</p>
              <h2 id="personal-day-shape-title">Day Shape</h2>
              <p>{dayShapePreview.intro} {dayShapePreview.boundaryCopy}</p>
            </div>
            {!embeddedInDayLine ? (
              <label className="day-shape-preview__select">
                <span>Selected day</span>
                <select
                  onChange={(event) => {
                    setSelectedDay(event.target.value as DayName);
                    setSelectedPlacementDateOverride(null);
                  }}
                  value={dayShapePreview.selectedDay}
                >
                  {dayShapePreviewDays.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {hasDayShapeBlocks ? (
            <div className="day-shape-preview__groups">
              {dayShapePreview.groups.map((group) => (
                <section
                  className={`day-shape-preview__group day-shape-preview__group--${group.id}`}
                  key={group.id}
                  aria-labelledby={`personal-day-shape-${group.id}`}
                >
                  <div className="day-shape-preview__group-header">
                    <h3 id={`personal-day-shape-${group.id}`}>{group.title}</h3>
                    <p>{group.meaning}</p>
                  </div>
                  {group.blocks.length > 0 ? (
                    <ul>
                      {group.blocks.map((block) => (
                        <li key={block.id}>
                          <div className="day-shape-preview__block-main">
                            <strong>{block.label}</strong>
                            <span>{block.typeLabel}</span>
                          </div>
                          <div className="day-shape-preview__block-context">
                            <p className="day-shape-preview__time">{block.timeRange}</p>
                            <p>{block.schedulerUseMeaning}</p>
                            {block.notes ? <p className="day-shape-preview__notes">{block.notes}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="day-shape-preview__quiet">
                      No blocks in this category for {dayShapePreview.selectedDay}.
                    </p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="day-shape-preview__empty">
              <h3>{dayShapePreview.emptyState.title}</h3>
              <p>{dayShapePreview.emptyState.message}</p>
              <p>Add protected, loose, ask-first, or open-capacity blocks in Settings when useful.</p>
            </div>
          )}
      </section>

      <section
        className="soft-suggestions plan-section plan-section--suggestions"
        aria-labelledby="personal-soft-suggestions-title"
      >
          <div className="soft-suggestions__header">
            <p className="section-label">When you want to choose a time</p>
            <h2 id="personal-soft-suggestions-title">Place a Held task yourself</h2>
            <div className="plan-section__guidance">
              <p>
                Life Rhythm can privately plan Held tasks when they fit. You can also choose a specific available time yourself.
              </p>
              {preferredTask ? (
                <p className="plan-section__context">
                  Showing {preferredTask.title} first because you chose it in Held.
                </p>
              ) : null}
            </div>
          </div>

          {manualDataLoading ? (
            <div className="soft-suggestions__empty" aria-busy="true" role="status">
              <h3>Loading saved manual Plan data...</h3>
            </div>
          ) : manualDataFailed ? null : poolSoftSuggestions.suggestions.length > 0 ? (
            <ul className="soft-suggestions__list">
              {poolSoftSuggestions.suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <div className="soft-suggestions__item-copy">
                    <div>
                      <strong>{suggestion.taskTitle}</strong>
                      <span>{suggestion.blockLabel} · {suggestion.blockTimeRange}</span>
                    </div>
                    <p>Minimum: {suggestion.minimumLabel} · {suggestion.minimumMinutes} min</p>
                    <p>{suggestion.reason}</p>
                  </div>
                  <Button
                    className="soft-suggestions__placement-action"
                    disabled={placingSuggestionId === suggestion.id}
                    onClick={() => void addSoftPlacement(suggestion)}
                    variant="primary"
                  >
                    {placingSuggestionId === suggestion.id ? 'Choosing time' : 'Choose this time'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : poolReadState.status === 'partial' || placementReadState.status === 'partial' ? null : (
            <div className="soft-suggestions__empty">
              <h3>{suggestionEmptyTitle}</h3>
              <p>{suggestionEmptyMessage}</p>
            </div>
          )}

          {askFirstBlocks.length > 0 ? (
            <div className="soft-suggestions__ask-first">
              <h3>Ask-first time remains protected</h3>
              <p>Life Rhythm will not automatically place tasks here. A separate explicit choice is required.</p>
              <ul>
                {askFirstBlocks.map((block) => (
                  <li key={block.id}>
                    <strong>{block.label}</strong>
                    <span>{block.timeRange}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
      </section>

      <section
        className="soft-placements plan-section plan-section--placements"
        aria-labelledby="personal-soft-placements-title"
      >
          <div className="soft-placements__header">
            <p className="section-label">Times you chose</p>
            <h2 id="personal-soft-placements-title">Your chosen times</h2>
            <div className="plan-section__guidance">
              <p>
                These are times you chose yourself. They remain your choice and do not create external calendar events.
              </p>
            </div>
          </div>

          {placementReadState.status === 'loading' ? (
            <div className="soft-placements__empty" aria-busy="true" role="status">
              <h3>Loading saved manual placements...</h3>
            </div>
          ) : placementReadState.status === 'readFailed' ? null : visibleSoftPlacements.length > 0 ? (
            <ul className="soft-placements__list">
              {visibleSoftPlacements.filter((placement) =>
                !embeddedInDayLine || !placement.correctionKind || !dayLinePlacementIds.includes(placement.id),
              ).map((placement) => {
                const accepted = placement.correctionKind ? planPlacementForCorrection(placement) : null;
                const protectedPlacement = placement.correctionKind === 'protect' ||
                  placement.correctionKind === 'moveProtected';
                return (
                  <li key={placement.id}>
                    <div className="soft-placements__item-copy">
                      <div>
                        <strong>{placement.taskTitleSnapshot}</strong>
                        <span>{placement.blockLabelSnapshot} · {placement.start}-{placement.end}</span>
                      </div>
                      <p>
                        {placement.correctionKind
                          ? protectedPlacement
                            ? 'User-corrected · Protected'
                            : 'User-corrected'
                          : softPlacementStatusLabels[placement.status]}
                      </p>
                      {accepted && placementReasonLines(accepted.provenance).length > 0 ? (
                        <details className="plan-section__details">
                          <summary>Why this time?</summary>
                          <ul>
                            {placementReasonLines(accepted.provenance).map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                    {placement.correctionKind ? (
                      <div className="button-row" aria-label={`Correction actions for ${placement.taskTitleSnapshot}`}>
                        <Button
                          disabled={!accepted || correctionBusyId !== null}
                          onClick={() => accepted && openMove(accepted)}
                        >
                          Move
                        </Button>
                        {protectedPlacement ? (
                          <Button
                            disabled={!accepted || correctionBusyId !== null}
                            onClick={() => accepted && void unprotectPlacement(accepted)}
                          >
                            {correctionBusyId === placement.id ? 'Saving' : 'Unprotect'}
                          </Button>
                        ) : (
                          <Button
                            disabled={!accepted || correctionBusyId !== null}
                            onClick={() => accepted && void protectPlacement(accepted)}
                          >
                            {correctionBusyId === placement.id ? 'Saving' : 'Protect this time'}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        className="soft-placements__remove-action"
                        disabled={removingPlacementId === placement.id}
                        onClick={() => void removeSoftPlacement(placement)}
                      >
                        {removingPlacementId === placement.id ? 'Removing placement' : 'Remove placement'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : placementReadState.status === 'partial' ? null : (
            <div className="soft-placements__empty">
              <h3>No user-confirmed placements for {dayShapePreview.selectedDay}.</h3>
            </div>
          )}


      </section>
          {detailsFooter}
        </div>
      </details>
    </div>
  );
}
