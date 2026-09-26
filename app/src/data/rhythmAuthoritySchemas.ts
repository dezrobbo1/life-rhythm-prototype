import { z } from 'zod';
import {
  dayOfWeekSchema,
  idSchema,
  recurrencePeriodSchema,
  taskVersionSchema,
  timeWindowSchema,
} from './schemas';

function isRealLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day);
}

export const rhythmLocalDateSchema = z.string().refine(isRealLocalDate, 'Expected a real YYYY-MM-DD date');
const strictInstantSchema = z.string().datetime({ offset: true });

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const rhythmPlanStateSchema = z.enum(['enabled', 'paused', 'disabled']);

export const rhythmPlanSchema = z
  .object({
    id: idSchema,
    rhythmTemplateId: idSchema,
    state: rhythmPlanStateSchema,
    latestRecurrenceRevisionId: idSchema,
    initialEffectiveFromLocalDate: rhythmLocalDateSchema,
    preferredTime: timeWindowSchema,
    timezone: z.string().min(1).refine(isIanaTimezone, 'Expected an IANA timezone'),
    missedOccurrencePolicy: z.literal('skip'),
    planningMode: z.literal('automaticPrivate'),
    createdAt: strictInstantSchema,
    updatedAt: strictInstantSchema,
    pausedAt: strictInstantSchema.optional(),
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.state === 'paused' && !plan.pausedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Paused plans must record when they were paused.',
        path: ['pausedAt'],
      });
    }
    if (plan.state !== 'paused' && plan.pausedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pausedAt is only valid for a paused plan.',
        path: ['pausedAt'],
      });
    }
  });

export const rhythmRecurrenceRuleSchema = z
  .object({
    frequency: z.number().int().positive().max(672),
    period: recurrencePeriodSchema,
    preferredDays: z.array(dayOfWeekSchema),
    maxPerDay: z.number().int().positive().max(24),
  })
  .strict()
  .superRefine((rule, context) => {
    if (new Set(rule.preferredDays).size !== rule.preferredDays.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Preferred weekdays must be unique.',
        path: ['preferredDays'],
      });
    }
    if (rule.period === 'day' && rule.frequency > rule.maxPerDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A daily frequency cannot exceed max per day.',
        path: ['frequency'],
      });
    }
    const guaranteedDays = rule.period === 'day' ? 1 : rule.period === 'week' ? 7 : 28;
    if (rule.period !== 'day' && rule.frequency > guaranteedDays * rule.maxPerDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Frequency cannot fit inside every selected period at this maximum per day.',
        path: ['frequency'],
      });
    }
  });

export const rhythmRecurrenceRevisionSchema = z
  .object({
    id: idSchema,
    rhythmPlanId: idSchema,
    revisionNumber: z.number().int().positive(),
    effectiveFromLocalDate: rhythmLocalDateSchema,
    timezone: z.string().min(1).refine(isIanaTimezone, 'Expected an IANA timezone'),
    rule: rhythmRecurrenceRuleSchema,
    createdAt: strictInstantSchema,
  })
  .strict();

export const rhythmInstanceLifecycleSchema = z.enum([
  'eligible',
  'today',
  'inProgress',
  'paused',
  'closed',
]);
export const rhythmInstanceCompletionSchema = z.enum([
  'notStarted',
  'minimumDone',
  'done',
  'skipped',
]);
export const rhythmInstancePlanningSchema = z.enum([
  'unscheduled',
  'placed',
  'today',
  'closed',
]);

export const rhythmInstanceSchema = z
  .object({
    id: idSchema,
    rhythmTemplateId: idSchema,
    rhythmPlanId: idSchema,
    recurrenceRevisionId: idSchema,
    occurrenceKey: z.string().min(1),
    deduplicationKey: z.string().min(1),
    periodKey: z.string().min(1),
    slotNumber: z.number().int().positive(),
    eligibilityStartDate: rhythmLocalDateSchema,
    eligibilityEndDate: rhythmLocalDateSchema,
    minimum: taskVersionSchema,
    normal: taskVersionSchema,
    full: taskVersionSchema,
    recurrenceSnapshot: z
      .object({
        revisionNumber: z.number().int().positive(),
        effectiveFromLocalDate: rhythmLocalDateSchema,
        frequency: z.number().int().positive(),
        period: recurrencePeriodSchema,
        preferredDays: z.array(dayOfWeekSchema),
        maxPerDay: z.number().int().positive(),
        timezone: z.string().min(1).refine(isIanaTimezone, 'Expected an IANA timezone'),
      })
      .strict(),
    preferredTime: timeWindowSchema,
    lifecycleState: rhythmInstanceLifecycleSchema,
    completionState: rhythmInstanceCompletionSchema,
    planningState: rhythmInstancePlanningSchema,
    activeTaskId: idSchema.optional(),
    placementId: idSchema.optional(),
    createdAt: strictInstantSchema,
    updatedAt: strictInstantSchema,
  })
  .strict()
  .superRefine((instance, context) => {
    if (instance.eligibilityStartDate > instance.eligibilityEndDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eligibility start must not be after eligibility end.',
        path: ['eligibilityEndDate'],
      });
    }
    if (instance.lifecycleState === 'closed' && instance.completionState === 'notStarted') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A closed occurrence must record a completion or skip outcome.',
        path: ['completionState'],
      });
    }
  });

export type RhythmPlan = z.infer<typeof rhythmPlanSchema>;
export type RhythmPlanState = z.infer<typeof rhythmPlanStateSchema>;
export type RhythmRecurrenceRule = z.infer<typeof rhythmRecurrenceRuleSchema>;
export type RhythmRecurrenceRevision = z.infer<typeof rhythmRecurrenceRevisionSchema>;
export type RhythmInstance = z.infer<typeof rhythmInstanceSchema>;
