export type TaskReentryState =
  | 'noReviewNeeded'
  | 'dueEdgePassed'
  | 'latestUsefulStartPassed'
  | 'fixedOpportunityPassed'
  | 'expired'
  | 'notUsefulAnymore';

export type TaskReentryAction =
  | 'tryMinimum'
  | 'park'
  | 'notToday'
  | 'noLongerNeeded'
  | 'reviewLater';

export type TaskReentryInput = {
  status?: 'active' | 'inProgress' | 'paused' | 'minimumDone' | 'done' | 'parked' | 'skipped' | 'notToday';
  timeConstraint?: 'flexible' | 'dueBy' | 'fixedAt' | 'expiresAfter';
  dueAt?: string;
  fixedAt?: string;
  expiresAfter?: string;
  latestUsefulStartAt?: string;
  notUsefulAfter?: string;
  minimumStillUsefulAfterDeadline?: boolean;
  missedPolicy?: 'ask' | 'park' | 'notToday' | 'minimumOnly' | 'followUpPrompt' | 'hideUntilReview' | 'archiveIfExpired';
  minimum?: {
    label?: string;
    minutes?: number;
  };
  minimumAchieved?: boolean;
  noLongerNeededSupported?: boolean;
};

export type TaskReentryAssessment = {
  state: TaskReentryState;
  needsReview: boolean;
  minimumStillUseful: boolean;
  validActions: TaskReentryAction[];
  recommendedAction?: TaskReentryAction;
  reason?: string;
  usefulness?: string;
};

function instant(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasPassed(value: string | undefined, nowMs: number) {
  const parsed = instant(value);
  return parsed !== null && parsed <= nowMs;
}

function hasUsableMinimum(minimum: TaskReentryInput['minimum']) {
  return Boolean(
    minimum &&
    typeof minimum.label === 'string' &&
    minimum.label.trim() &&
    typeof minimum.minutes === 'number' &&
    Number.isInteger(minimum.minutes) &&
    minimum.minutes > 0,
  );
}

function stateAt(input: TaskReentryInput, nowMs: number): TaskReentryState {
  if (input.status && input.status !== 'active') return 'noReviewNeeded';
  if (hasPassed(input.notUsefulAfter, nowMs)) return 'notUsefulAnymore';
  if (input.timeConstraint === 'expiresAfter' && hasPassed(input.expiresAfter, nowMs)) return 'expired';
  if (input.timeConstraint === 'fixedAt' && hasPassed(input.fixedAt, nowMs)) return 'fixedOpportunityPassed';
  if (input.timeConstraint === 'dueBy' && hasPassed(input.dueAt, nowMs)) return 'dueEdgePassed';
  if (hasPassed(input.latestUsefulStartAt, nowMs)) return 'latestUsefulStartPassed';
  return 'noReviewNeeded';
}

function copyForState(
  state: Exclude<TaskReentryState, 'noReviewNeeded'>,
  minimumStillUseful: boolean,
) {
  if (state === 'dueEdgePassed') {
    return {
      reason: 'Useful-before time has passed.',
      usefulness: minimumStillUseful
        ? 'Minimum may still help.'
        : 'Choose what still makes sense; nothing moves automatically.',
    };
  }

  if (state === 'latestUsefulStartPassed') {
    return {
      reason: 'The latest useful start has passed.',
      usefulness: minimumStillUseful
        ? 'Minimum may still help.'
        : 'The original start opportunity has narrowed.',
    };
  }

  if (state === 'fixedOpportunityPassed') {
    return {
      reason: 'The original fixed-time opportunity has passed.',
      usefulness: minimumStillUseful
        ? 'Minimum may still help.'
        : 'It has not been converted into flexible work.',
    };
  }

  if (state === 'expired') {
    return {
      reason: 'The original action has expired.',
      usefulness: 'It will not be moved forward automatically.',
    };
  }

  return {
    reason: 'This is past its useful window.',
    usefulness: 'The original task is no longer useful in this window.',
  };
}

function recommendation(
  input: TaskReentryInput,
  state: TaskReentryState,
  minimumStillUseful: boolean,
): TaskReentryAction | undefined {
  if (input.missedPolicy === 'park' || input.missedPolicy === 'hideUntilReview') return 'park';
  if (input.missedPolicy === 'notToday') return 'notToday';
  if (input.missedPolicy === 'minimumOnly') return minimumStillUseful ? 'tryMinimum' : undefined;
  if (input.missedPolicy === 'followUpPrompt') return 'reviewLater';
  if (
    input.missedPolicy === 'archiveIfExpired' &&
    (state === 'expired' || state === 'notUsefulAnymore') &&
    input.noLongerNeededSupported
  ) {
    return 'noLongerNeeded';
  }
  return undefined;
}

export function assessTaskReentry(input: TaskReentryInput, now: Date | string): TaskReentryAssessment {
  const nowMs = typeof now === 'string' ? Date.parse(now) : now.getTime();
  if (Number.isNaN(nowMs)) {
    return {
      state: 'noReviewNeeded',
      needsReview: false,
      minimumStillUseful: false,
      validActions: [],
    };
  }

  const state = stateAt(input, nowMs);
  if (state === 'noReviewNeeded') {
    return {
      state,
      needsReview: false,
      minimumStillUseful: false,
      validActions: [],
    };
  }

  const terminalWindow = state === 'expired' || state === 'notUsefulAnymore';
  const minimumStillUseful = Boolean(
    !terminalWindow &&
    !input.minimumAchieved &&
    input.minimumStillUsefulAfterDeadline &&
    hasUsableMinimum(input.minimum),
  );
  const validActions: TaskReentryAction[] = [
    ...(minimumStillUseful ? ['tryMinimum' as const] : []),
    'park',
    'notToday',
    ...(terminalWindow && input.noLongerNeededSupported && input.missedPolicy === 'archiveIfExpired'
      ? ['noLongerNeeded' as const]
      : []),
    'reviewLater',
  ];
  const copy = copyForState(state, minimumStillUseful);

  return {
    state,
    needsReview: true,
    minimumStillUseful,
    validActions,
    recommendedAction: recommendation(input, state, minimumStillUseful),
    ...copy,
  };
}
