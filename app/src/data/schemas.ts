import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoDateTime = z.string().min(1, 'Expected an ISO timestamp');
const timeOfDay = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM');

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
    startBoostSafety: z
      .object({
        avoidFoodRewards: z.boolean().default(false),
        avoidShoppingRewards: z.boolean().default(false),
        avoidScrollingRewards: z.boolean().default(true),
        avoidUrgencyCountdowns: z.boolean().default(false),
        avoidAccountabilityPrompts: z.boolean().default(false),
        avoidStreakPressure: z.boolean().default(true),
      })
      .default({}),
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
    status: z.enum(['active', 'parked', 'completed', 'archived']).default('active'),
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
export type RhythmTemplate = z.infer<typeof rhythmTemplateSchema>;
export type ActiveTask = z.infer<typeof activeTaskSchema>;
export type TaskHistory = z.infer<typeof taskHistorySchema>;
export type CompletionLog = z.infer<typeof completionLogSchema>;
export type ResetLog = z.infer<typeof resetLogSchema>;
export type StartBoostLog = z.infer<typeof startBoostLogSchema>;
export type DevTicket = z.infer<typeof devTicketSchema>;
export type MigrationLog = z.infer<typeof migrationLogSchema>;
export type AppExport = z.infer<typeof appExportSchema>;

