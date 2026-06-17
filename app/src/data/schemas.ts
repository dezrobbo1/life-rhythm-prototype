import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoDateTime = z.string().min(1, 'Expected an ISO timestamp');
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
const strictIsoDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export const appVersionSchema = z.string().min(1);
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

const minuteAmountSchema = z.number().int().min(0).max(480);
const transitionBufferMinutesSchema = z.number().int().min(0).max(180);

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
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

export const activeTaskDeadlineIsoDateTimeSchema = z
  .string()
  .regex(strictIsoDateTimePattern, 'Expected a valid ISO timestamp')
  .refine(isValidStrictIsoDateTime, 'Expected a valid ISO timestamp');

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
  });

export const settingsSchema = z
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

    validateActiveTaskDeadlineFields(task, context);
  });

export const taskHistorySchema = z
  .object({
    id: idSchema,
    taskId: idSchema,
    eventType: z.enum(['created', 'edited', 'moved', 'shrunk', 'parked', 'restored', 'deleted']),
    occurredAt: isoDateTime,
    summary: z.string().min(1),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();

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
export type StartBoostSafetySettings = z.infer<typeof startBoostSafetySettingsSchema>;
export type LifeShapeSettings = z.infer<typeof lifeShapeSettingsSchema>;
export type RhythmTemplate = z.infer<typeof rhythmTemplateSchema>;
export type ActiveTask = z.infer<typeof activeTaskSchema>;
export type ActiveTaskStatus = z.infer<typeof activeTaskStatusSchema>;
export type TaskHistory = z.infer<typeof taskHistorySchema>;
export type CompletionLog = z.infer<typeof completionLogSchema>;
export type ResetLog = z.infer<typeof resetLogSchema>;
export type StartBoostLog = z.infer<typeof startBoostLogSchema>;
export type DevTicket = z.infer<typeof devTicketSchema>;
export type MigrationLog = z.infer<typeof migrationLogSchema>;
export type AppExport = z.infer<typeof appExportSchema>;
