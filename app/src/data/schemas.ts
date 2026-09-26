import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoDateTime = z.string().min(1, 'Expected an ISO timestamp');
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
const strictIsoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const strictIsoDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export const appVersionSchema = z.string().min(1);
export const semanticAppVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, 'Expected a valid app version');
export const idSchema = z.string().min(1);

export const themeNameSchema = z.enum(['exhale', 'clear', 'grounded']);
export const dayOfWeekSchema = z.enum([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

export const areaSchema = z.enum([
  'house',
  'food',
  'movement',
  'work',
  'money',
  'antidrift',
  'sensory',
  'emotion',
  'social',
  'health',
  'admin',
  'other',
]);

export const taskTypeSchema = z.enum([
  'simple',
  'house',
  'admin',
  'work',
  'food',
  'exercise',
  'leaving',
  'kids',
  'avoided',
  'sensory',
  'emotion',
  'social',
]);

export const taskPrioritySchema = z.enum(['normal', 'important', 'must']);
export const taskKindSchema = z.enum(['adhoc', 'repeating']);
export const completionStyleSchema = z.enum(['flexible', 'must', 'checkpoint']);
export const energySchema = z.enum(['low', 'medium', 'high']);
export const timeConstraintSchema = z.enum(['flexible', 'dueBy', 'fixedAt', 'expiresAfter']);
export const missedPolicySchema = z.enum([
  'ask',
  'park',
  'notToday',
  'minimumOnly',
  'followUpPrompt',
  'hideUntilReview',
  'archiveIfExpired',
]);
export const activeTaskStatusSchema = z.enum([
  'active',
  'inProgress',
  'paused',
  'minimumDone',
  'done',
  'parked',
  'skipped',
  'notToday',
]);
export const taskPoolItemStatusSchema = z.enum([
  'captured',
  'suggested',
  'softPlaced',
  'today',
  'parked',
  'notToday',
  'deferred',
  'noLongerNeeded',
]);
export const taskPoolItemSourceSchema = z.enum(['adhoc', 'rhythm', 'library', 'custom']);
export const softPlacementSourceSchema = z.literal('userConfirmed');
export const softPlacementStatusSchema = z.enum(['planned', 'moved', 'removed', 'completedFromToday']);
export const startBarrierSchema = z.enum([
  'none',
  'big',
  'unclear',
  'boring',
  'lowEnergy',
  'timeShort',
  'emotional',
  'needInfo',
  'phoneContact',
  'phonePull',
]);
export const timeWindowSchema = z.enum([
  'anytime',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'shutdown',
  'after work',
]);
export const lateHandlingSchema = z.enum(['moveNext', 'fallback', 'keep', 'ask', 'missed']);
export const bufferModeSchema = z.enum(['auto', 'none', 'light', 'normal', 'heavy', 'leaving']);
export const recurrencePeriodSchema = z.enum(['day', 'week', 'month']);
export const lifeShapeTimeBlockTypeSchema = z.enum([
  'protectedTime',
  'recoveryTime',
  'looseTime',
  'householdFlow',
  'familyTime',
  'openCapacity',
]);
export const lifeShapeSchedulerUseSchema = z.enum(['unavailable', 'askFirst', 'available']);
export const dayProfileKindSchema = z.enum(['workday', 'nonWorkday']);
export const dayProfileWorkPlanningUseSchema = z.enum([
  'workRhythmsOnly',
  'unavailable',
  'askFirst',
  'allowSuitableTasks',
]);
export const dayProfileMigrationReviewStateSchema = z.enum([
  'notStarted',
  'needsReview',
  'reviewedAndEnabled',
]);

export const WORKDAY_PROFILE_ID = 'profile-workday';
export const NON_WORKDAY_PROFILE_ID = 'profile-non-workday';
export const ALL_WEEKDAYS = dayOfWeekSchema.options;

const minuteAmountSchema = z.number().int().min(0).max(480);
const transitionBufferMinutesSchema = z.number().int().min(0).max(180);
const defaultSchedulerUseByBlockType: Record<
  z.infer<typeof lifeShapeTimeBlockTypeSchema>,
  z.infer<typeof lifeShapeSchedulerUseSchema>
> = {
  familyTime: 'unavailable',
  householdFlow: 'askFirst',
  looseTime: 'askFirst',
  openCapacity: 'available',
  protectedTime: 'unavailable',
  recoveryTime: 'unavailable',
};

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function isValidIsoLocalDate(value: string): boolean {
  const match = strictIsoDatePattern.exec(value);

  if (!match) {
    return false;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidStrictIsoDateTime(value: string): boolean {
  const match = strictIsoDateTimePattern.exec(value);

  if (!match) {
    return false;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, millisecondValue = '0'] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const millisecond = Number(millisecondValue.padEnd(3, '0'));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second &&
    date.getUTCMilliseconds() === millisecond
  );
}

export const strictIsoDateTimeSchema = z
  .string()
  .regex(strictIsoDateTimePattern, 'Expected a valid ISO timestamp')
  .refine(isValidStrictIsoDateTime, 'Expected a valid ISO timestamp');

export const activeTaskDeadlineIsoDateTimeSchema = strictIsoDateTimeSchema;

export const softPlacementDateSchema = z
  .string()
  .regex(strictIsoDatePattern, 'Expected YYYY-MM-DD')
  .refine(isValidIsoLocalDate, 'Expected a valid local date');

type ActiveTaskDeadlineFields = {
  dueAt?: string;
  expiresAfter?: string;
  fixedAt?: string;
  latestUsefulStartAt?: string;
  notUsefulAfter?: string;
  timeConstraint?: z.infer<typeof timeConstraintSchema>;
};

function validateActiveTaskDeadlineFields(
  task: ActiveTaskDeadlineFields,
  context: z.RefinementCtx,
  basePath: Array<string | number> = [],
) {
  const timeConstraint = task.timeConstraint ?? 'flexible';

  if (task.dueAt && timeConstraint !== 'dueBy') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'dueAt is only valid for dueBy tasks.',
      path: [...basePath, 'dueAt'],
    });
  }

  if (task.fixedAt && timeConstraint !== 'fixedAt') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'fixedAt is only valid for fixedAt tasks.',
      path: [...basePath, 'fixedAt'],
    });
  }

  if (task.expiresAfter && timeConstraint !== 'expiresAfter') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'expiresAfter is only valid for expiresAfter tasks.',
      path: [...basePath, 'expiresAfter'],
    });
  }

  if (
    task.latestUsefulStartAt &&
    task.notUsefulAfter &&
    Date.parse(task.latestUsefulStartAt) > Date.parse(task.notUsefulAfter)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'latestUsefulStartAt must not be after notUsefulAfter.',
      path: [...basePath, 'latestUsefulStartAt'],
    });
  }
}

export const startBoostSafetySettingsSchema = z
  .object({
    avoidFoodRewards: z.boolean().default(false),
    avoidShoppingRewards: z.boolean().default(false),
    avoidScrollingRewards: z.boolean().default(true),
    avoidUrgencyCountdowns: z.boolean().default(false),
    avoidAccountabilityPrompts: z.boolean().default(false),
    avoidStreakPressure: z.boolean().default(true),
  })
  .default({});

export const usualWorkHoursSettingsSchema = z
  .object({
    days: z.array(dayOfWeekSchema).default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    start: timeOfDay.default('08:00'),
    end: timeOfDay.default('16:00'),
  })
  .strict()
  .superRefine((workHours, context) => {
    if (minutesFromTime(workHours.start) >= minutesFromTime(workHours.end)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Work end must be later than work start.',
        path: ['end'],
      });
    }
  });

export const mealAnchorsSettingsSchema = z
  .object({
    breakfast: timeOfDay.default('07:00'),
    lunch: timeOfDay.default('12:00'),
    dinner: timeOfDay.default('18:00'),
  })
  .strict();

export const sleepWakeAnchorsSettingsSchema = z
  .object({
    wake: timeOfDay.default('06:30'),
    sleep: timeOfDay.default('21:30'),
  })
  .strict();

export const fixedCommitmentSettingsSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    days: z.array(dayOfWeekSchema).default([]),
    start: timeOfDay.optional(),
    end: timeOfDay.optional(),
    travelMinutes: minuteAmountSchema.default(0),
    bufferMinutes: transitionBufferMinutesSchema.default(0),
  })
  .strict()
  .superRefine((commitment, context) => {
    if (commitment.start && commitment.end && minutesFromTime(commitment.start) >= minutesFromTime(commitment.end)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fixed commitment end must be later than start.',
        path: ['end'],
      });
    }
  });

export const lifeShapeTimeBlockSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    type: lifeShapeTimeBlockTypeSchema,
    days: z.array(dayOfWeekSchema).default([]),
    start: timeOfDay,
    end: timeOfDay,
    notes: z.string().max(240).optional(),
    schedulerUse: lifeShapeSchedulerUseSchema.optional(),
  })
  .strict()
  .superRefine((block, context) => {
    if (minutesFromTime(block.start) >= minutesFromTime(block.end)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Time block end must be later than start.',
        path: ['end'],
      });
    }
  })
  .transform((block) => ({
    ...block,
    schedulerUse: block.schedulerUse ?? defaultSchedulerUseByBlockType[block.type],
  }));

export const lowCapacityPreferenceSchema = z.enum([
  'protect-evening',
  'lighter-morning',
  'minimum-first',
]);

export const lifeShapeSettingsSchema = z
  .object({
    usualWorkHours: usualWorkHoursSettingsSchema.default({
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      start: '08:00',
      end: '16:00',
    }),
    commuteMinutes: minuteAmountSchema.default(0),
    travelMinutes: minuteAmountSchema.default(0),
    fixedCommitments: z.array(fixedCommitmentSettingsSchema).default([]),
    transitionBufferMinutes: transitionBufferMinutesSchema.default(10),
    mealAnchors: mealAnchorsSettingsSchema.default({
      breakfast: '07:00',
      lunch: '12:00',
      dinner: '18:00',
    }),
    sleepWakeAnchors: sleepWakeAnchorsSettingsSchema.default({
      wake: '06:30',
      sleep: '21:30',
    }),
    lowCapacityPreference: lowCapacityPreferenceSchema.default('protect-evening'),
    timeBlocks: z.array(lifeShapeTimeBlockSchema).default([]),
  })
  .strict()
  .default({
    usualWorkHours: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      start: '08:00',
      end: '16:00',
    },
    commuteMinutes: 0,
    travelMinutes: 0,
    fixedCommitments: [],
    transitionBufferMinutes: 10,
    mealAnchors: {
      breakfast: '07:00',
      lunch: '12:00',
      dinner: '18:00',
    },
    sleepWakeAnchors: {
      wake: '06:30',
      sleep: '21:30',
    },
    lowCapacityPreference: 'protect-evening',
    timeBlocks: [],
  });

const dayProfileTimeRangeSchema = z
  .object({
    end: timeOfDay,
    start: timeOfDay,
  })
  .passthrough()
  .superRefine((range, context) => {
    if (minutesFromTime(range.start) >= minutesFromTime(range.end)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End must be later than start.',
        path: ['end'],
      });
    }
  });

export const dayProfileSchema = z
  .object({
    id: idSchema,
    kind: dayProfileKindSchema,
    name: z.string().min(1),
    usableDay: dayProfileTimeRangeSchema.optional(),
    workPeriod: dayProfileTimeRangeSchema.optional(),
    workPlanningUse: dayProfileWorkPlanningUseSchema,
  })
  .passthrough();

export const weekdayProfileAssignmentSchema = z
  .object({
    profileId: idSchema,
    weekday: dayOfWeekSchema,
  })
  .strict();

export const dayProfileMigrationStateSchema = z
  .object({
    legacyCommuteTransitionContext: z
      .object({
        commuteMinutes: minuteAmountSchema,
        transitionBufferMinutes: transitionBufferMinutesSchema,
    })
      .strict(),
    legacyLowCapacityPreference: lowCapacityPreferenceSchema,
    legacyMealAnchors: z
      .object({
        breakfast: timeOfDay,
        dinner: timeOfDay,
        lunch: timeOfDay,
      })
      .strict(),
    legacySleepWakeAnchors: z
      .object({
        sleep: timeOfDay,
        wake: timeOfDay,
      })
      .strict(),
    legacyTravelContext: z
      .object({
        travelMinutes: minuteAmountSchema,
      })
      .strict(),
    reviewedAt: strictIsoDateTimeSchema.optional(),
    reviewState: dayProfileMigrationReviewStateSchema,
    sourceSettingsVersion: appVersionSchema,
  })
  .strict();

const defaultDayProfiles = [
  {
    id: WORKDAY_PROFILE_ID,
    kind: 'workday' as const,
    name: 'Workday',
    workPeriod: {
      end: '16:00',
      start: '08:00',
    },
    workPlanningUse: 'workRhythmsOnly' as const,
  },
  {
    id: NON_WORKDAY_PROFILE_ID,
    kind: 'nonWorkday' as const,
    name: 'Non-workday',
    workPlanningUse: 'unavailable' as const,
  },
];

const defaultWeekdayProfileAssignments = ALL_WEEKDAYS.map((weekday) => ({
  profileId:
    weekday === 'Saturday' || weekday === 'Sunday'
      ? NON_WORKDAY_PROFILE_ID
      : WORKDAY_PROFILE_ID,
  weekday,
}));

const defaultDayProfileMigrationState = {
  legacyCommuteTransitionContext: {
    commuteMinutes: 0,
    transitionBufferMinutes: 10,
  },
  legacyLowCapacityPreference: 'protect-evening' as const,
  legacyMealAnchors: {
    breakfast: '07:00',
    dinner: '18:00',
    lunch: '12:00',
  },
  legacySleepWakeAnchors: {
    sleep: '21:30',
    wake: '06:30',
  },
  legacyTravelContext: {
    travelMinutes: 0,
  },
  reviewState: 'notStarted' as const,
  sourceSettingsVersion: '1.4.6',
};

const dayProfilesSchema = z.array(dayProfileSchema).length(2);
const weekdayProfileAssignmentsSchema = z.array(weekdayProfileAssignmentSchema).length(7);

type DayProfileFoundationInput = {
  dayProfileMigrationState: z.infer<typeof dayProfileMigrationStateSchema>;
  dayProfiles: z.infer<typeof dayProfileSchema>[];
  weekdayProfileAssignments: z.infer<typeof weekdayProfileAssignmentSchema>[];
};

function validateDayProfileFoundation(
  foundation: DayProfileFoundationInput,
  context: z.RefinementCtx,
) {
  const profileIds = foundation.dayProfiles.map((profile) => profile.id);
  const profileKinds = foundation.dayProfiles.map((profile) => profile.kind);
  const uniqueProfileIds = new Set(profileIds);
  const uniqueProfileKinds = new Set(profileKinds);

  if (uniqueProfileIds.size !== profileIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Day profile IDs must be unique.',
      path: ['dayProfiles'],
    });
  }

  if (uniqueProfileKinds.size !== profileKinds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Day profile kinds must be unique.',
      path: ['dayProfiles'],
    });
  }

  const workday = foundation.dayProfiles.find((profile) => profile.kind === 'workday');
  const nonWorkday = foundation.dayProfiles.find((profile) => profile.kind === 'nonWorkday');

  if (workday?.id !== WORKDAY_PROFILE_ID) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `The Workday profile must use ID ${WORKDAY_PROFILE_ID}.`,
      path: ['dayProfiles'],
    });
  }

  if (nonWorkday?.id !== NON_WORKDAY_PROFILE_ID) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `The Non-workday profile must use ID ${NON_WORKDAY_PROFILE_ID}.`,
      path: ['dayProfiles'],
    });
  }

  const assignedWeekdays = foundation.weekdayProfileAssignments.map((assignment) => assignment.weekday);
  const uniqueAssignedWeekdays = new Set(assignedWeekdays);

  if (uniqueAssignedWeekdays.size !== assignedWeekdays.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each weekday must be assigned exactly once.',
      path: ['weekdayProfileAssignments'],
    });
  }

  for (const weekday of ALL_WEEKDAYS) {
    if (!uniqueAssignedWeekdays.has(weekday)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${weekday} must have a profile assignment.`,
        path: ['weekdayProfileAssignments'],
      });
    }
  }

  for (const [index, assignment] of foundation.weekdayProfileAssignments.entries()) {
    if (!uniqueProfileIds.has(assignment.profileId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assignment must reference an existing day profile.',
        path: ['weekdayProfileAssignments', index, 'profileId'],
      });
    }
  }
}

export const dayProfileFoundationSchema = z
  .object({
    dayProfileMigrationState: dayProfileMigrationStateSchema,
    dayProfiles: dayProfilesSchema,
    weekdayProfileAssignments: weekdayProfileAssignmentsSchema,
  })
  .strict()
  .superRefine(validateDayProfileFoundation);

export const legacySettingsSchema = z
  .object({
    id: idSchema.default('settings'),
    appVersion: appVersionSchema,
    theme: themeNameSchema.default('exhale'),
    workDays: z.array(dayOfWeekSchema).default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    workStart: timeOfDay.default('08:00'),
    workEnd: timeOfDay.default('16:00'),
    wakeTime: timeOfDay.default('06:30'),
    bedTime: timeOfDay.default('21:30'),
    breakfastTime: timeOfDay.default('07:00'),
    lunchTime: timeOfDay.default('12:00'),
    dinnerTime: timeOfDay.default('18:00'),
    startBoostSafety: startBoostSafetySettingsSchema,
    lifeShape: lifeShapeSettingsSchema,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

export const profileAwareSettingsSchema = legacySettingsSchema
  .extend({
    dayProfileMigrationState: dayProfileMigrationStateSchema,
    dayProfiles: dayProfilesSchema,
    weekdayProfileAssignments: weekdayProfileAssignmentsSchema,
  })
  .superRefine(validateDayProfileFoundation);

export const settingsSchema = legacySettingsSchema
  .extend({
    dayProfileMigrationState: dayProfileMigrationStateSchema.default(defaultDayProfileMigrationState),
    dayProfiles: dayProfilesSchema.default(defaultDayProfiles),
    weekdayProfileAssignments: weekdayProfileAssignmentsSchema.default(defaultWeekdayProfileAssignments),
  })
  .superRefine(validateDayProfileFoundation);

export const taskVersionSchema = z
  .object({
    label: z.string().min(1),
    minutes: z.number().int().positive(),
  })
  .strict();

export const schedulePolicySchema = z
  .object({
    bestTime: timeWindowSchema.default('anytime'),
    fixedTime: timeOfDay.optional(),
    targetDate: isoDate.optional(),
    lateHandling: lateHandlingSchema.default('moveNext'),
    bufferMode: bufferModeSchema.default('auto'),
    prepMinutes: z.number().int().min(0).default(0),
    travelMinutes: z.number().int().min(0).default(0),
    cleanupMinutes: z.number().int().min(0).default(0),
    transitionMinutes: z.number().int().min(0).default(0),
    frequency: z.number().int().min(0).default(0),
    period: recurrencePeriodSchema.default('week'),
    preferredDays: z.array(dayOfWeekSchema).default([]),
    maxPerDay: z.number().int().positive().default(1),
    movable: z.boolean().default(true),
    droppable: z.boolean().default(true),
    catchupAllowed: z.boolean().default(true),
  })
  .strict();

export const rhythmTemplateSchema = z
  .object({
    id: idSchema,
    source: z.enum(['built-in', 'custom']).default('custom'),
    title: z.string().min(1),
    area: areaSchema,
    taskType: taskTypeSchema.default('simple'),
    kind: taskKindSchema.default('repeating'),
    completionStyle: completionStyleSchema.default('flexible'),
    priority: taskPrioritySchema.default('normal'),
    energy: energySchema.default('medium'),
    startBarrier: startBarrierSchema.default('unclear'),
    purpose: z.string().max(240).optional(),
    minimum: taskVersionSchema,
    normal: taskVersionSchema,
    full: taskVersionSchema,
    fallback: z.string().max(240).optional(),
    schedule: schedulePolicySchema.default({}),
    enabled: z.boolean().default(false),
    archivedAt: isoDateTime.optional(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

export const activeTaskSchema = z
  .object({
    id: idSchema,
    templateId: idSchema.optional(),
    sourceRhythmInstanceId: idSchema.optional(),
    manualRhythmOccurrenceKey: z.string().min(1).optional(),
    plannedVariantKind: z.enum(['minimum', 'normal', 'full']).optional(),
    source: z.enum(['adhoc', 'library', 'custom']),
    title: z.string().min(1),
    area: areaSchema,
    taskType: taskTypeSchema.default('simple'),
    kind: taskKindSchema.default('adhoc'),
    completionStyle: completionStyleSchema.default('flexible'),
    priority: taskPrioritySchema.default('normal'),
    energy: energySchema.default('medium'),
    startBarrier: startBarrierSchema.default('unclear'),
    purpose: z.string().max(240).optional(),
    minimum: taskVersionSchema,
    normal: taskVersionSchema,
    full: taskVersionSchema,
    fallback: z.string().max(240).optional(),
    schedule: schedulePolicySchema.default({}),
    showToday: z.boolean().default(false),
    status: activeTaskStatusSchema.default('active'),
    timeConstraint: timeConstraintSchema.optional(),
    dueAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    fixedAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    expiresAfter: activeTaskDeadlineIsoDateTimeSchema.optional(),
    latestUsefulStartAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    notUsefulAfter: activeTaskDeadlineIsoDateTimeSchema.optional(),
    minimumStillUsefulAfterDeadline: z.boolean().optional(),
    missedPolicy: missedPolicySchema.optional(),
    minimumAchievedAt: strictIsoDateTimeSchema.optional(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict()
  .superRefine((task, context) => {
    if (task.source === 'library' && !task.templateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Library active tasks must reference a templateId.',
        path: ['templateId'],
      });
    }

    if (task.sourceRhythmInstanceId && task.source !== 'library') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Generated rhythm occurrences must use the Library task source.',
        path: ['sourceRhythmInstanceId'],
      });
    }

    if (task.sourceRhythmInstanceId && !task.templateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Generated rhythm occurrences must retain their template identity.',
        path: ['templateId'],
      });
    }

    if (task.sourceRhythmInstanceId && task.manualRhythmOccurrenceKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A Today task cannot be both a generated and manual rhythm occurrence.',
        path: ['manualRhythmOccurrenceKey'],
      });
    }

    if (task.manualRhythmOccurrenceKey && (task.source !== 'library' || !task.templateId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Manual rhythm occurrences must retain their Library template identity.',
        path: ['manualRhythmOccurrenceKey'],
      });
    }

    validateActiveTaskDeadlineFields(task, context);
  });

export const taskPoolItemSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    area: areaSchema,
    source: taskPoolItemSourceSchema,
    status: taskPoolItemStatusSchema.default('captured'),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    minimum: taskVersionSchema,
    normal: taskVersionSchema,
    full: taskVersionSchema,
    purpose: z.string().max(240).optional(),
    notes: z.string().max(500).optional(),
    templateId: idSchema.optional(),
    rhythmInstanceId: idSchema.optional(),
    timeConstraint: timeConstraintSchema.optional(),
    dueAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    fixedAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    expiresAfter: activeTaskDeadlineIsoDateTimeSchema.optional(),
    latestUsefulStartAt: activeTaskDeadlineIsoDateTimeSchema.optional(),
    notUsefulAfter: activeTaskDeadlineIsoDateTimeSchema.optional(),
    minimumStillUsefulAfterDeadline: z.boolean().optional(),
    missedPolicy: missedPolicySchema.optional(),
    bringBackAfter: activeTaskDeadlineIsoDateTimeSchema.optional(),
  })
  .strict()
  .superRefine((item, context) => {
    validateActiveTaskDeadlineFields(item, context);
  });

export const softPlacementSchema = z
  .object({
    id: idSchema,
    taskId: idSchema,
    taskTitleSnapshot: z.string().min(1),
    date: softPlacementDateSchema,
    blockId: idSchema,
    blockLabelSnapshot: z.string().min(1),
    start: timeOfDay,
    end: timeOfDay,
    placementSource: softPlacementSourceSchema,
    createdAt: activeTaskDeadlineIsoDateTimeSchema,
    updatedAt: activeTaskDeadlineIsoDateTimeSchema,
    status: softPlacementStatusSchema,
  })
  .strict()
  .superRefine((placement, context) => {
    const startTime = timeOfDay.safeParse(placement.start);
    const endTime = timeOfDay.safeParse(placement.end);

    if (
      startTime.success &&
      endTime.success &&
      minutesFromTime(placement.start) >= minutesFromTime(placement.end)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'start must be before end.',
        path: ['end'],
      });
    }
  });

export const legacyTaskHistorySchema = z
  .object({
    id: idSchema,
    taskId: idSchema,
    eventType: z.enum(['created', 'edited', 'moved', 'shrunk', 'parked', 'restored', 'deleted']),
    occurredAt: isoDateTime,
    summary: z.string().min(1),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();

export const behaviourEventTypeSchema = z.enum([
  'taskCaptured',
  'taskCreated',
  'taskAddedToToday',
  'taskStarted',
  'taskPaused',
  'taskResumed',
  'taskContinued',
  'taskMinimumAchieved',
  'taskCompleted',
  'taskParked',
  'taskNotToday',
  'taskDeferred',
  'taskNoLongerNeeded',
  'userPlacementCreated',
  'userPlacementMoved',
  'userPlacementRemoved',
  'schedulerPlacementAdded',
  'schedulerPlacementMoved',
  'schedulerPlacementRemoved',
  'schedulerPlacementVariantChanged',
  'schedulerRepairUndone',
]);

export const behaviourEventFactSchema = z
  .object({
    taskStatus: activeTaskStatusSchema.optional(),
    poolStatus: taskPoolItemStatusSchema.optional(),
    placementStatus: z
      .enum(['planned', 'moved', 'removed', 'completedFromToday', 'automatic'])
      .optional(),
    date: softPlacementDateSchema.optional(),
    start: timeOfDay.optional(),
    end: timeOfDay.optional(),
    variantKind: z.enum(['minimum', 'normal', 'full']).optional(),
    minimumAchieved: z.boolean().optional(),
    bringBackAfter: activeTaskDeadlineIsoDateTimeSchema.optional(),
  })
  .strict();

const behaviourTimezoneFormatters = new Map<string, Intl.DateTimeFormat>();
const invalidBehaviourTimezones = new Set<string>();

function behaviourTimezoneFormatter(value: string): Intl.DateTimeFormat | null {
  const cached = behaviourTimezoneFormatters.get(value);
  if (cached) return cached;
  if (invalidBehaviourTimezones.has(value)) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: value,
      year: 'numeric',
    });
    behaviourTimezoneFormatters.set(value, formatter);
    return formatter;
  } catch {
    invalidBehaviourTimezones.add(value);
    return null;
  }
}

function isIanaTimezone(value: string): boolean {
  return behaviourTimezoneFormatter(value) !== null;
}

function localDateInTimezone(occurredAt: string, timezone: string): string | null {
  try {
    const formatter = behaviourTimezoneFormatter(timezone);
    if (!formatter) return null;
    const parts = formatter.formatToParts(new Date(occurredAt));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  } catch {
    return null;
  }
}

type BehaviourEventFactShape = z.infer<typeof behaviourEventFactSchema>;
type BehaviourEventTransitionFact = {
  taskStatus?: readonly z.infer<typeof activeTaskStatusSchema>[] | 'absent';
  poolStatus?: readonly z.infer<typeof taskPoolItemStatusSchema>[] | 'absent';
  placementStatus?: readonly NonNullable<BehaviourEventFactShape['placementStatus']>[];
  variantKind?: readonly NonNullable<BehaviourEventFactShape['variantKind']>[] | 'absent';
  minimumAchieved?: readonly boolean[] | 'absent';
  bringBackAfter?: 'present' | 'absent';
};
type BehaviourEventTransitionRule = {
  provenance?: readonly [
    'userAction' | 'initialPlanBuild' | 'automaticRepair' | 'undo',
    string,
  ];
  before: BehaviourEventTransitionFact | null;
  after: BehaviourEventTransitionFact | null;
  change?: 'minimumAchieved' | 'minimumPreserved' | 'placementPosition' | 'placementVariant' | 'poolDeferral';
};
type BehaviourEventVariantRule = {
  action: string;
  source: 'user' | 'scheduler';
  provenance: readonly (readonly [
    'userAction' | 'initialPlanBuild' | 'automaticRepair' | 'undo',
    string,
  ])[];
  ids: 'task' | 'userPlacement' | 'schedulerTarget' | 'none';
  before: 'required' | 'optional' | 'forbidden';
  after: 'required' | 'optional' | 'forbidden';
  facts: 'task' | 'pool' | 'taskOrPool' | 'placement' | 'none';
  transitions: readonly BehaviourEventTransitionRule[];
};

const behaviourEventVariantRules = {
  taskCaptured: {
    action: 'capture', source: 'user', provenance: [['userAction', 'taskPoolCapture']], ids: 'task', before: 'forbidden', after: 'required', facts: 'pool',
    transitions: [{ before: null, after: { bringBackAfter: 'absent', poolStatus: ['captured'] } }],
  },
  taskCreated: {
    action: 'create', source: 'user', provenance: [['userAction', 'todayCapture']], ids: 'task', before: 'forbidden', after: 'required', facts: 'task',
    transitions: [{ before: null, after: { minimumAchieved: 'absent', taskStatus: ['active'] } }],
  },
  taskAddedToToday: {
    action: 'addToToday', source: 'user', provenance: [['userAction', 'taskLifecycle'], ['userAction', 'todayCapture']], ids: 'task', before: 'optional', after: 'required', facts: 'taskOrPool',
    transitions: [
      {
        provenance: ['userAction', 'taskLifecycle'],
        before: {
          poolStatus: ['captured', 'suggested', 'softPlaced', 'today', 'parked', 'notToday', 'deferred'],
          taskStatus: 'absent',
          bringBackAfter: 'absent',
          minimumAchieved: 'absent',
        },
        after: {
          bringBackAfter: 'absent',
          minimumAchieved: 'absent',
          poolStatus: ['today'],
          taskStatus: ['active'],
        },
      },
      {
        provenance: ['userAction', 'todayCapture'],
        before: null,
        after: { minimumAchieved: 'absent', poolStatus: 'absent', taskStatus: ['active'] },
      },
    ],
  },
  taskStarted: {
    action: 'start', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'task',
    transitions: [{ before: { taskStatus: ['active', 'parked', 'skipped', 'notToday'] }, after: { taskStatus: ['inProgress'] }, change: 'minimumPreserved' }],
  },
  taskPaused: {
    action: 'pause', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'task',
    transitions: [{ before: { taskStatus: ['inProgress'] }, after: { taskStatus: ['paused'] }, change: 'minimumPreserved' }],
  },
  taskResumed: {
    action: 'resume', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'task',
    transitions: [{ before: { taskStatus: ['paused'] }, after: { taskStatus: ['inProgress'] }, change: 'minimumPreserved' }],
  },
  taskContinued: {
    action: 'continue', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'task',
    transitions: [
      { before: { taskStatus: ['minimumDone'], minimumAchieved: [true] }, after: { taskStatus: ['inProgress'], minimumAchieved: [true] }, change: 'minimumPreserved' },
      { before: { taskStatus: ['minimumDone'], minimumAchieved: [false] }, after: { taskStatus: ['inProgress'], minimumAchieved: [true] }, change: 'minimumAchieved' },
    ],
  },
  taskMinimumAchieved: {
    action: 'minimumDone', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'task',
    transitions: [{ before: { taskStatus: ['active', 'inProgress', 'paused'], minimumAchieved: [false] }, after: { taskStatus: ['minimumDone'], minimumAchieved: [true] }, change: 'minimumAchieved' }],
  },
  taskCompleted: {
    action: 'complete', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'task',
    transitions: [{ before: { taskStatus: ['active', 'inProgress', 'paused', 'minimumDone'] }, after: { taskStatus: ['done'] }, change: 'minimumPreserved' }],
  },
  taskParked: {
    action: 'park', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'task',
    transitions: [{ before: { taskStatus: ['active', 'inProgress', 'paused', 'minimumDone', 'skipped', 'notToday'] }, after: { taskStatus: ['parked'] }, change: 'minimumPreserved' }],
  },
  taskNotToday: {
    action: 'notToday', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'task',
    transitions: [{ before: { taskStatus: ['active', 'inProgress', 'paused', 'minimumDone', 'parked'] }, after: { taskStatus: ['notToday', 'skipped'] }, change: 'minimumPreserved' }],
  },
  taskDeferred: {
    action: 'defer', source: 'user', provenance: [['userAction', 'taskPoolDeferral']], ids: 'task', before: 'required', after: 'required', facts: 'pool',
    transitions: [{
      before: { poolStatus: ['captured', 'suggested', 'parked', 'notToday', 'deferred'] },
      after: { poolStatus: ['deferred'], bringBackAfter: 'present' },
      change: 'poolDeferral',
    }],
  },
  taskNoLongerNeeded: {
    action: 'noLongerNeeded', source: 'user', provenance: [['userAction', 'taskLifecycle']], ids: 'task', before: 'required', after: 'required', facts: 'pool',
    transitions: [{
      before: { bringBackAfter: 'absent', poolStatus: ['captured', 'suggested', 'softPlaced', 'today', 'parked', 'notToday', 'deferred'] },
      after: { bringBackAfter: 'absent', poolStatus: ['noLongerNeeded'] },
    }],
  },
  userPlacementCreated: {
    action: 'createPlacement', source: 'user', provenance: [['userAction', 'softPlacement']], ids: 'userPlacement', before: 'forbidden', after: 'required', facts: 'placement',
    transitions: [{ before: null, after: { placementStatus: ['planned'], variantKind: 'absent' } }],
  },
  userPlacementMoved: {
    action: 'movePlacement', source: 'user', provenance: [['userAction', 'softPlacement']], ids: 'userPlacement', before: 'required', after: 'required', facts: 'placement',
    transitions: [{
      before: { placementStatus: ['planned', 'moved'], variantKind: 'absent' },
      after: { placementStatus: ['moved'], variantKind: 'absent' },
      change: 'placementPosition',
    }],
  },
  userPlacementRemoved: {
    action: 'removePlacement', source: 'user', provenance: [['userAction', 'softPlacement']], ids: 'userPlacement', before: 'required', after: 'required', facts: 'placement',
    transitions: [{
      before: { placementStatus: ['planned', 'moved', 'completedFromToday'], variantKind: 'absent' },
      after: { placementStatus: ['removed'], variantKind: 'absent' },
    }],
  },
  schedulerPlacementAdded: {
    action: 'addAutomaticPlacement', source: 'scheduler', provenance: [['initialPlanBuild', 'schedulerInitialBuild'], ['automaticRepair', 'schedulerRepair']], ids: 'schedulerTarget', before: 'forbidden', after: 'required', facts: 'placement',
    transitions: [{ before: null, after: { placementStatus: ['automatic'] } }],
  },
  schedulerPlacementMoved: {
    action: 'moveAutomaticPlacement', source: 'scheduler', provenance: [['automaticRepair', 'schedulerRepair']], ids: 'schedulerTarget', before: 'required', after: 'required', facts: 'placement',
    transitions: [{
      before: { placementStatus: ['automatic'] },
      after: { placementStatus: ['automatic'] },
      change: 'placementPosition',
    }],
  },
  schedulerPlacementRemoved: {
    action: 'removeAutomaticPlacement', source: 'scheduler', provenance: [['automaticRepair', 'schedulerRepair']], ids: 'schedulerTarget', before: 'required', after: 'forbidden', facts: 'placement',
    transitions: [{ before: { placementStatus: ['automatic'] }, after: null }],
  },
  schedulerPlacementVariantChanged: {
    action: 'changeAutomaticPlacementVariant', source: 'scheduler', provenance: [['automaticRepair', 'schedulerRepair']], ids: 'schedulerTarget', before: 'required', after: 'required', facts: 'placement',
    transitions: [{
      before: { placementStatus: ['automatic'] },
      after: { placementStatus: ['automatic'] },
      change: 'placementVariant',
    }],
  },
  schedulerRepairUndone: {
    action: 'undoRepair', source: 'user', provenance: [['undo', 'schedulerRepairUndo']], ids: 'none', before: 'forbidden', after: 'forbidden', facts: 'none',
    transitions: [{ before: null, after: null }],
  },
} as const satisfies Record<z.infer<typeof behaviourEventTypeSchema>, BehaviourEventVariantRule>;

function snapshotMatchesTransition(
  snapshot: BehaviourEventFactShape | undefined,
  expected: BehaviourEventTransitionFact | null,
) {
  if (expected === null) return snapshot === undefined;
  if (!snapshot) return false;

  if (
    expected.taskStatus === 'absent'
      ? snapshot.taskStatus !== undefined
      : expected.taskStatus && !expected.taskStatus.includes(snapshot.taskStatus as never)
  ) return false;
  if (
    expected.poolStatus === 'absent'
      ? snapshot.poolStatus !== undefined
      : expected.poolStatus && !expected.poolStatus.includes(snapshot.poolStatus as never)
  ) return false;
  if (
    expected.placementStatus &&
    !expected.placementStatus.includes(snapshot.placementStatus as never)
  ) return false;
  if (
    expected.variantKind === 'absent'
      ? snapshot.variantKind !== undefined
      : expected.variantKind && !expected.variantKind.includes(snapshot.variantKind as never)
  ) return false;
  if (
    expected.minimumAchieved === 'absent'
      ? snapshot.minimumAchieved !== undefined
      : expected.minimumAchieved &&
        !expected.minimumAchieved.includes(snapshot.minimumAchieved as never)
  ) return false;
  if (expected.bringBackAfter === 'present' && !snapshot.bringBackAfter) return false;
  if (expected.bringBackAfter === 'absent' && snapshot.bringBackAfter !== undefined) return false;

  return true;
}

function transitionChangeMatches(
  before: BehaviourEventFactShape | undefined,
  after: BehaviourEventFactShape | undefined,
  change: BehaviourEventTransitionRule['change'],
) {
  if (!change) return true;
  if (!before || !after) return false;

  if (change === 'minimumAchieved') {
    return before.minimumAchieved === false && after.minimumAchieved === true;
  }
  if (change === 'minimumPreserved') {
    return typeof before.minimumAchieved === 'boolean' &&
      before.minimumAchieved === after.minimumAchieved;
  }
  if (change === 'placementPosition') {
    return before.date !== after.date || before.start !== after.start || before.end !== after.end;
  }
  if (change === 'placementVariant') {
    return before.variantKind !== after.variantKind;
  }

  return before.poolStatus !== after.poolStatus || before.bringBackAfter !== after.bringBackAfter;
}

export const behaviourEventSchema = z
  .object({
    recordKind: z.literal('behaviourEvent'),
    version: z.literal(1),
    id: idSchema,
    eventType: behaviourEventTypeSchema,
    occurredAt: activeTaskDeadlineIsoDateTimeSchema,
    localDate: softPlacementDateSchema,
    timezone: z.string().min(1).refine(isIanaTimezone, 'Expected an IANA timezone'),
    taskId: idSchema.optional(),
    templateId: idSchema.optional(),
    rhythmId: idSchema.optional(),
    rhythmInstanceId: idSchema.optional(),
    placementId: idSchema.optional(),
    source: z.enum(['user', 'scheduler']),
    action: z.enum([
      'capture',
      'create',
      'addToToday',
      'start',
      'pause',
      'resume',
      'continue',
      'minimumDone',
      'complete',
      'park',
      'notToday',
      'defer',
      'noLongerNeeded',
      'createPlacement',
      'movePlacement',
      'removePlacement',
      'addAutomaticPlacement',
      'moveAutomaticPlacement',
      'removeAutomaticPlacement',
      'changeAutomaticPlacementVariant',
      'undoRepair',
    ]),
    before: behaviourEventFactSchema.optional(),
    after: behaviourEventFactSchema.optional(),
    actualMinutes: z.number().int().nonnegative().optional(),
    provenance: z
      .object({
        origin: z.enum(['userAction', 'initialPlanBuild', 'automaticRepair', 'undo']),
        mechanism: z.string().min(1),
        trigger: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((event, context) => {
    const expectedLocalDate = localDateInTimezone(event.occurredAt, event.timezone);
    if (expectedLocalDate !== event.localDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'localDate must match occurredAt in timezone.',
        path: ['localDate'],
      });
    }

    const rule = behaviourEventVariantRules[event.eventType];
    if (event.action !== rule.action) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Expected ${rule.action}.`, path: ['action'] });
    }
    if (event.source !== rule.source) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Expected ${rule.source}.`, path: ['source'] });
    }
    const provenanceMatches = rule.provenance.some(
      ([origin, mechanism]) => event.provenance.origin === origin && event.provenance.mechanism === mechanism,
    );
    if (!provenanceMatches) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provenance does not match the event type.',
        path: ['provenance'],
      });
    }
    if (
      event.provenance.trigger &&
      event.provenance.mechanism !== 'schedulerRepair' &&
      event.provenance.mechanism !== 'schedulerRepairUndo'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A trigger is not applicable to this provenance.',
        path: ['provenance', 'trigger'],
      });
    }

    const requireField = (field: 'taskId' | 'placementId') => {
      if (!event[field]) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} is required.`, path: [field] });
      }
    };
    const forbidField = (field: 'taskId' | 'templateId' | 'rhythmId' | 'rhythmInstanceId' | 'placementId') => {
      if (event[field]) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} is not applicable.`, path: [field] });
      }
    };

    if (rule.ids === 'task') {
      requireField('taskId');
      forbidField('rhythmId');
      forbidField('placementId');
    } else if (rule.ids === 'userPlacement') {
      requireField('taskId');
      requireField('placementId');
      forbidField('templateId');
      forbidField('rhythmId');
      forbidField('rhythmInstanceId');
    } else if (rule.ids === 'schedulerTarget') {
      if (Boolean(event.taskId) === Boolean(event.rhythmId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Exactly one scheduler target ID is required.',
          path: ['taskId'],
        });
      }
      const initialBuild = event.provenance.origin === 'initialPlanBuild';
      if (initialBuild) requireField('placementId');
      else forbidField('placementId');
    } else {
      forbidField('taskId');
      forbidField('templateId');
      forbidField('rhythmId');
      forbidField('rhythmInstanceId');
      forbidField('placementId');
    }

    const validateSnapshotPresence = (
      field: 'before' | 'after',
      requirement: 'required' | 'optional' | 'forbidden',
    ) => {
      if (requirement === 'required' && !event[field]) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} is required.`, path: [field] });
      }
      if (requirement === 'forbidden' && event[field]) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} is not applicable.`, path: [field] });
      }
    };
    validateSnapshotPresence('before', rule.before);
    validateSnapshotPresence('after', rule.after);

    const snapshots = [event.before, event.after].filter(Boolean);
    for (const snapshot of snapshots) {
      if (!snapshot) continue;
      const allowedFactFields = rule.facts === 'task'
        ? ['taskStatus', 'minimumAchieved']
        : rule.facts === 'pool'
          ? ['poolStatus', 'bringBackAfter']
          : rule.facts === 'taskOrPool'
            ? ['taskStatus', 'poolStatus', 'minimumAchieved', 'bringBackAfter']
            : rule.facts === 'placement'
              ? ['placementStatus', 'date', 'start', 'end', 'variantKind']
              : [];
      if (Object.keys(snapshot).some((field) => !allowedFactFields.includes(field))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Snapshot contains facts that are not applicable to this event.',
          path: ['after'],
        });
      }
      if (rule.facts === 'task' && !snapshot.taskStatus) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Task status fact is required.', path: ['after'] });
      }
      if (rule.facts === 'pool' && !snapshot.poolStatus) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Pool status fact is required.', path: ['after'] });
      }
      if (rule.facts === 'taskOrPool' && !snapshot.taskStatus && !snapshot.poolStatus) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Task or pool status fact is required.', path: ['after'] });
      }
      if (
        rule.facts === 'placement' &&
        (!snapshot.placementStatus || !snapshot.date || !snapshot.start || !snapshot.end)
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Complete placement facts are required.', path: ['after'] });
      }
    }

    const transitionMatches = (rule.transitions as readonly BehaviourEventTransitionRule[]).some((transition) => {
      const provenanceMatchesTransition = !transition.provenance || (
        event.provenance.origin === transition.provenance[0] &&
        event.provenance.mechanism === transition.provenance[1]
      );

      return provenanceMatchesTransition &&
        snapshotMatchesTransition(event.before, transition.before) &&
        snapshotMatchesTransition(event.after, transition.after) &&
        transitionChangeMatches(event.before, event.after, transition.change);
    });
    if (!transitionMatches) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Before and after facts do not match the event transition.',
        path: ['after'],
      });
    }

    if (event.actualMinutes !== undefined && event.eventType !== 'taskCompleted') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'actualMinutes is only valid for task completion.',
        path: ['actualMinutes'],
      });
    }
  });

export const taskHistorySchema = z.union([legacyTaskHistorySchema, behaviourEventSchema]);

export const completionLogSchema = z
  .object({
    id: idSchema,
    taskId: idSchema,
    templateId: idSchema.optional(),
    completedAt: isoDateTime,
    localDate: isoDate,
    mode: z.enum(['Minimum', 'Normal', 'Full', 'Done']),
    area: areaSchema,
    actualMinutes: z.number().int().positive().optional(),
    plannedMinutes: z.number().int().positive().optional(),
    startBoostLogId: idSchema.optional(),
  })
  .strict();

export const resetLogSchema = z
  .object({
    id: idSchema,
    occurredAt: isoDateTime,
    localDate: isoDate,
    action: z.enum(['tooMuchToday', 'moveExtras', 'restartOneAction', 'reviewTomorrow', 'clearTodayState', 'fullAppReset']),
    summary: z.string().min(1),
    affectedTaskIds: z.array(idSchema).default([]),
  })
  .strict();

export const startBoostLogSchema = z
  .object({
    id: idSchema,
    taskId: idSchema,
    templateId: idSchema.optional(),
    barrier: startBarrierSchema,
    supportId: idSchema,
    result: z.enum(['yes', 'bit', 'no', 'harder', 'skipped']).optional(),
    usedAt: isoDateTime,
  })
  .strict();

export const devTicketSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    type: z.enum(['Bug', 'Change request', 'UX noise', 'Evidence question', 'Review note', 'Other']),
    priority: z.enum(['Low', 'Medium', 'High', 'Blocking']),
    status: z.enum(['Open', 'Done']).default('Open'),
    area: z.enum([
      'Today',
      'Plan',
      'Library',
      'Reset',
      'Setup',
      'Start Boost',
      'Task model',
      'Design',
      'Source library',
      'Other',
    ]),
    appVersion: appVersionSchema,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    description: z.string().default(''),
    expectedBehaviour: z.string().default(''),
    actualBehaviour: z.string().default(''),
    stepsToReproduce: z.string().default(''),
    screenshotNote: z.string().default(''),
  })
  .strict();

export const migrationLogSchema = z
  .object({
    id: idSchema,
    sourceKey: z.literal('lifeRhythm_v146'),
    inspectedAt: isoDateTime,
    status: z.enum(['planned', 'completed', 'failed', 'skipped']),
    summary: z.string().min(1),
    counts: z
      .object({
        settings: z.number().int().min(0).default(0),
        rhythmTemplates: z.number().int().min(0).default(0),
        activeTasks: z.number().int().min(0).default(0),
        taskHistory: z.number().int().min(0).default(0),
        completionLogs: z.number().int().min(0).default(0),
        resetLogs: z.number().int().min(0).default(0),
        startBoostLogs: z.number().int().min(0).default(0),
        devTickets: z.number().int().min(0).default(0),
      })
      .strict(),
    warnings: z.array(z.string()).default([]),
  })
  .strict();

export const appExportSchema = z
  .object({
    format: z.literal('life-rhythm-app-export'),
    exportedAt: isoDateTime,
    appVersion: appVersionSchema,
    settings: settingsSchema,
    rhythmTemplates: z.array(rhythmTemplateSchema),
    activeTasks: z.array(activeTaskSchema),
    taskHistory: z.array(taskHistorySchema),
    completionLog: z.array(completionLogSchema),
    resetLog: z.array(resetLogSchema),
    startBoostLog: z.array(startBoostLogSchema),
    devTickets: z.array(devTicketSchema),
    migrationLog: z.array(migrationLogSchema),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;
export type LegacySettings = z.infer<typeof legacySettingsSchema>;
export type StartBoostSafetySettings = z.infer<typeof startBoostSafetySettingsSchema>;
export type LifeShapeSettings = z.infer<typeof lifeShapeSettingsSchema>;
export type LifeShapeTimeBlock = z.infer<typeof lifeShapeTimeBlockSchema>;
export type DayProfile = z.infer<typeof dayProfileSchema>;
export type WeekdayProfileAssignment = z.infer<typeof weekdayProfileAssignmentSchema>;
export type DayProfileMigrationState = z.infer<typeof dayProfileMigrationStateSchema>;
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export type RhythmTemplate = z.infer<typeof rhythmTemplateSchema>;
export type ActiveTask = z.infer<typeof activeTaskSchema>;
export type ActiveTaskStatus = z.infer<typeof activeTaskStatusSchema>;
export type TaskPoolItem = z.infer<typeof taskPoolItemSchema>;
export type TaskPoolItemStatus = z.infer<typeof taskPoolItemStatusSchema>;
export type SoftPlacement = z.infer<typeof softPlacementSchema>;
export type SoftPlacementStatus = z.infer<typeof softPlacementStatusSchema>;
export type TaskHistory = z.infer<typeof taskHistorySchema>;
export type BehaviourEvent = z.infer<typeof behaviourEventSchema>;
export type BehaviourEventFact = z.infer<typeof behaviourEventFactSchema>;
export type CompletionLog = z.infer<typeof completionLogSchema>;
export type ResetLog = z.infer<typeof resetLogSchema>;
export type StartBoostLog = z.infer<typeof startBoostLogSchema>;
export type DevTicket = z.infer<typeof devTicketSchema>;
export type MigrationLog = z.infer<typeof migrationLogSchema>;
export type AppExport = z.infer<typeof appExportSchema>;
