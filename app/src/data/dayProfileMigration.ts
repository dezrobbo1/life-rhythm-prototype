import { findBlockedDataClassKey } from './dataClassBoundary';
import {
  ALL_WEEKDAYS,
  NON_WORKDAY_PROFILE_ID,
  WORKDAY_PROFILE_ID,
  legacySettingsSchema,
  profileAwareSettingsSchema,
  type DayOfWeek,
  type LegacySettings,
  type Settings,
} from './schemas';

const profileFoundationKeys = [
  'dayProfiles',
  'weekdayProfileAssignments',
  'dayProfileMigrationState',
] as const;

export type LegacySettingsConflict = {
  field: string;
  legacyRootValue: unknown;
  lifeShapeValue: unknown;
};

export type DayProfileMigrationResult =
  | {
      conflicts: LegacySettingsConflict[];
      ok: true;
      settings: Settings;
      status: 'migrated' | 'unchanged';
    }
  | {
      errors: string[];
      ok: false;
      profileFoundationPresent: boolean;
      status: 'invalid';
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'settings';

    return `${path}: ${issue.message}`;
  });
}

function sameWeekdaySet(first: DayOfWeek[], second: DayOfWeek[]) {
  const firstSet = new Set(first);
  const secondSet = new Set(second);

  return firstSet.size === secondSet.size && [...firstSet].every((weekday) => secondSet.has(weekday));
}

function collectLegacyConflicts(settings: LegacySettings): LegacySettingsConflict[] {
  const comparisons: Array<{
    field: string;
    legacyRootValue: unknown;
    lifeShapeValue: unknown;
    matches?: boolean;
  }> = [
    {
      field: 'workDays',
      legacyRootValue: settings.workDays,
      lifeShapeValue: settings.lifeShape.usualWorkHours.days,
      matches: sameWeekdaySet(settings.workDays, settings.lifeShape.usualWorkHours.days),
    },
    {
      field: 'workStart',
      legacyRootValue: settings.workStart,
      lifeShapeValue: settings.lifeShape.usualWorkHours.start,
    },
    {
      field: 'workEnd',
      legacyRootValue: settings.workEnd,
      lifeShapeValue: settings.lifeShape.usualWorkHours.end,
    },
    {
      field: 'wakeTime',
      legacyRootValue: settings.wakeTime,
      lifeShapeValue: settings.lifeShape.sleepWakeAnchors.wake,
    },
    {
      field: 'bedTime',
      legacyRootValue: settings.bedTime,
      lifeShapeValue: settings.lifeShape.sleepWakeAnchors.sleep,
    },
    {
      field: 'breakfastTime',
      legacyRootValue: settings.breakfastTime,
      lifeShapeValue: settings.lifeShape.mealAnchors.breakfast,
    },
    {
      field: 'lunchTime',
      legacyRootValue: settings.lunchTime,
      lifeShapeValue: settings.lifeShape.mealAnchors.lunch,
    },
    {
      field: 'dinnerTime',
      legacyRootValue: settings.dinnerTime,
      lifeShapeValue: settings.lifeShape.mealAnchors.dinner,
    },
  ];

  return comparisons
    .filter((comparison) =>
      comparison.matches === undefined
        ? comparison.legacyRootValue !== comparison.lifeShapeValue
        : !comparison.matches,
    )
    .map(({ field, legacyRootValue, lifeShapeValue }) => ({
      field,
      legacyRootValue,
      lifeShapeValue,
    }));
}

function migrateLegacySettings(settings: LegacySettings): DayProfileMigrationResult {
  const workdays = new Set(settings.lifeShape.usualWorkHours.days);
  const candidate = {
    ...settings,
    dayProfileMigrationState: {
      legacyCommuteTransitionContext: {
        commuteMinutes: settings.lifeShape.commuteMinutes,
        transitionBufferMinutes: settings.lifeShape.transitionBufferMinutes,
      },
      legacyLowCapacityPreference: settings.lifeShape.lowCapacityPreference,
      legacyMealAnchors: settings.lifeShape.mealAnchors,
      legacySleepWakeAnchors: settings.lifeShape.sleepWakeAnchors,
      legacyTravelContext: {
        travelMinutes: settings.lifeShape.travelMinutes,
      },
      reviewState: 'needsReview',
      sourceSettingsVersion: settings.appVersion,
    },
    dayProfiles: [
      {
        id: WORKDAY_PROFILE_ID,
        kind: 'workday',
        name: 'Workday',
        workPeriod: {
          end: settings.lifeShape.usualWorkHours.end,
          start: settings.lifeShape.usualWorkHours.start,
        },
        workPlanningUse: 'workRhythmsOnly',
      },
      {
        id: NON_WORKDAY_PROFILE_ID,
        kind: 'nonWorkday',
        name: 'Non-workday',
        workPlanningUse: 'unavailable',
      },
    ],
    weekdayProfileAssignments: ALL_WEEKDAYS.map((weekday) => ({
      profileId: workdays.has(weekday) ? WORKDAY_PROFILE_ID : NON_WORKDAY_PROFILE_ID,
      weekday,
    })),
  };
  const parsed = profileAwareSettingsSchema.safeParse(candidate);

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
      profileFoundationPresent: false,
      status: 'invalid',
    };
  }

  return {
    conflicts: collectLegacyConflicts(settings),
    ok: true,
    settings: parsed.data,
    status: 'migrated',
  };
}

export function migrateSettingsDayProfileFoundation(input: unknown): DayProfileMigrationResult {
  if (!isRecord(input)) {
    return {
      errors: ['settings: Expected a stored settings object.'],
      ok: false,
      profileFoundationPresent: false,
      status: 'invalid',
    };
  }

  // Day profiles stay forward-compatible via passthrough, so a malformed or
  // newer row could otherwise hide another data class inside a profile object.
  const blockedDataClassKey = findBlockedDataClassKey(input);

  if (blockedDataClassKey) {
    return {
      errors: [
        `${blockedDataClassKey}: Settings cannot hold task, rhythm, placement, scheduler, calendar, legacy, migration or telemetry data.`,
      ],
      ok: false,
      profileFoundationPresent: false,
      status: 'invalid',
    };
  }

  const presentFoundationKeys = profileFoundationKeys.filter((key) =>
    Object.prototype.hasOwnProperty.call(input, key),
  );

  if (presentFoundationKeys.length > 0 && presentFoundationKeys.length < profileFoundationKeys.length) {
    return {
      errors: ['settings: Day-profile foundation is incomplete and was not rebuilt from legacy fields.'],
      ok: false,
      profileFoundationPresent: true,
      status: 'invalid',
    };
  }

  if (presentFoundationKeys.length === profileFoundationKeys.length) {
    const parsed = profileAwareSettingsSchema.safeParse(input);

    if (!parsed.success) {
      return {
        errors: issuesToMessages(parsed.error.issues),
        ok: false,
        profileFoundationPresent: true,
        status: 'invalid',
      };
    }

    return {
      conflicts: collectLegacyConflicts(parsed.data),
      ok: true,
      settings: parsed.data,
      status: 'unchanged',
    };
  }

  const legacy = legacySettingsSchema.safeParse(input);

  if (!legacy.success) {
    return {
      errors: issuesToMessages(legacy.error.issues),
      ok: false,
      profileFoundationPresent: false,
      status: 'invalid',
    };
  }

  return migrateLegacySettings(legacy.data);
}
