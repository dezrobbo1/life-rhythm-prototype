import { z } from 'zod';
import { idSchema, softPlacementDateSchema, strictIsoDateTimeSchema } from './schemas';

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
const variantKindSchema = z.enum(['minimum', 'normal', 'full']);
const placementOriginSchema = z.enum(['existingUserConfirmed', 'scheduler']);
const targetKindSchema = z.enum(['intention', 'rhythm']);
const preferenceTargetKindSchema = z.enum(['intention', 'rhythm', 'area', 'taskType']);
const preferenceRepairTargetSchema = z.object({
  targetKind: preferenceTargetKindSchema,
  targetValue: idSchema,
}).strict();
const appliedDurationLearningSchema = z.object({
  templateId: idSchema,
  source: z.enum(['learned', 'userOverride']),
  schedulerMinutes: z.number().int().positive(),
  sampleCount: z.number().int().nonnegative(),
  confidence: z.enum(['low', 'moderate', 'user']),
  medianActualMinutes: z.number().positive().optional(),
  upperQuartileActualMinutes: z.number().int().positive().optional(),
}).strict();

const schedulerDayModeContextSchema = z.object({
  dayMode: z.literal('reduced'),
  date: softPlacementDateSchema,
}).strict();

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export const persistedSchedulerPlacementSchema = z
  .object({
    id: idSchema,
    intentionId: idSchema,
    date: softPlacementDateSchema,
    start: localTimeSchema,
    end: localTimeSchema,
    timezone: z.string().min(1).optional(),
    origin: placementOriginSchema,
    sourcePlacementId: idSchema.optional(),
    targetKind: targetKindSchema.optional(),
    rhythmId: idSchema.optional(),
    rhythmTemplateId: idSchema.optional(),
    rhythmPlanId: idSchema.optional(),
    rhythmRecurrenceRevisionId: idSchema.optional(),
    rhythmInstanceId: idSchema.optional(),
    variantKind: variantKindSchema.optional(),
    provenance: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((placement, context) => {
    if (minutesFromTime(placement.start) >= minutesFromTime(placement.end)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Placement end must be later than start.',
        path: ['end'],
      });
    }

    if (placement.targetKind === 'rhythm' && !placement.rhythmId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rhythm placements must include rhythmId.',
        path: ['rhythmId'],
      });
    }

    if (placement.targetKind === 'rhythm') {
      const occurrenceIdentity = [
        placement.rhythmPlanId,
        placement.rhythmRecurrenceRevisionId,
        placement.rhythmInstanceId,
      ];
      const suppliedIdentityParts = occurrenceIdentity.filter(Boolean).length;
      if (suppliedIdentityParts > 0 &&
          (suppliedIdentityParts !== occurrenceIdentity.length || !placement.rhythmTemplateId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Concrete rhythm placements must retain template, plan, revision, and instance identity together.',
          path: ['rhythmInstanceId'],
        });
      }
      if (placement.rhythmInstanceId && placement.rhythmId !== placement.rhythmInstanceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Concrete rhythm placement target must be its instance identity.',
          path: ['rhythmId'],
        });
      }
    }
  });

const schedulerViolationCodeSchema = z.enum([
  'unknown-intention',
  'unknown-rhythm',
  'placement-overlap',
  'protected-window-overlap',
  'external-commitment-overlap',
  'outside-candidate-interval',
  'timing-constraint-violation',
  'capacity-limit-exceeded',
]);

export const persistedSchedulerViolationSchema = z
  .object({
    code: schedulerViolationCodeSchema,
    placementId: idSchema,
    conflictingId: idSchema.optional(),
    message: z.string().min(1),
  })
  .strict();

export const persistedRejectedPlacementSchema = z
  .object({
    placement: persistedSchedulerPlacementSchema,
    violations: z.array(persistedSchedulerViolationSchema),
  })
  .strict();

export const persistedSchedulerPlanSnapshotSchema = z
  .object({
    placements: z.array(persistedSchedulerPlacementSchema),
    unscheduledIntentionIds: z.array(idSchema),
    unscheduledRhythmIds: z.array(idSchema),
    rejectedExistingPlacements: z.array(persistedRejectedPlacementSchema),
  })
  .strict();

const schedulerRepairTriggerSchema = z.enum([
  'calendarChanged',
  'settingsChanged',
  'overrun',
  'missedStart',
  'completionChanged',
  'preferenceChanged',
  'durationLearningChanged',
  'userCorrection',
  'taskDefinitionChanged',
  'rhythmDefinitionChanged',
  'manualReplan',
]);

const schedulerRepairNowSchema = z
  .object({
    date: softPlacementDateSchema,
    time: localTimeSchema,
    timezone: z.string().min(1),
  })
  .strict();

const schedulerPlacementPointSchema = z
  .object({
    date: softPlacementDateSchema,
    start: localTimeSchema,
    end: localTimeSchema,
    variantKind: variantKindSchema.optional(),
  })
  .strict()
  .superRefine((point, context) => {
    if (minutesFromTime(point.start) >= minutesFromTime(point.end)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Placement end must be later than start.',
        path: ['end'],
      });
    }
  });

const schedulerPlanChangeKindSchema = z.enum(['moved', 'added', 'removed', 'variantChanged']);

const schedulerPlanChangeSchema = z
  .object({
    kind: schedulerPlanChangeKindSchema,
    targetKind: targetKindSchema,
    targetId: idSchema,
    rhythmTemplateId: idSchema.optional(),
    rhythmPlanId: idSchema.optional(),
    rhythmRecurrenceRevisionId: idSchema.optional(),
    rhythmInstanceId: idSchema.optional(),
    from: schedulerPlacementPointSchema.optional(),
    to: schedulerPlacementPointSchema.optional(),
    reason: z.string().min(1),
  })
  .strict()
  .superRefine((change, context) => {
    if (change.kind === 'added' && !change.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Added changes must include the new placement point.',
        path: ['to'],
      });
    }

    if (change.kind === 'removed' && !change.from) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Removed changes must include the previous placement point.',
        path: ['from'],
      });
    }

    if ((change.kind === 'moved' || change.kind === 'variantChanged') && (!change.from || !change.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${change.kind} changes must include both placement points.`,
        path: ['to'],
      });
    }
    const occurrenceIdentity = [
      change.rhythmTemplateId,
      change.rhythmPlanId,
      change.rhythmRecurrenceRevisionId,
      change.rhythmInstanceId,
    ];
    const suppliedIdentityParts = occurrenceIdentity.filter(Boolean).length;
    if (suppliedIdentityParts > 0 && (change.targetKind !== 'rhythm' || suppliedIdentityParts !== 4)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Concrete rhythm change identity must remain complete.',
        path: ['rhythmInstanceId'],
      });
    }
  });

const schedulerRepairMetadataSchema = z
  .object({
    trigger: schedulerRepairTriggerSchema.optional(),
    reason: z.string().min(1),
    now: schedulerRepairNowSchema.optional(),
    frozenPastPlacementIds: z.array(idSchema),
    preservedPlacementIds: z.array(idSchema),
    changes: z.array(schedulerPlanChangeSchema),
    appliedPreferenceRepairTargets: z.array(preferenceRepairTargetSchema).optional(),
    appliedDurationLearningTemplateIds: z.array(idSchema).optional(),
    previousDurationLearningApplied: z.array(appliedDurationLearningSchema).optional(),
    taskDefinitionRepairApplied: z.boolean().optional(),
    rhythmDefinitionRepairApplied: z.boolean().optional(),
    settingsDefinitionRepairApplied: z.boolean().optional(),
    undo: persistedSchedulerPlanSnapshotSchema,
  })
  .strict();

export const persistedSchedulerPlanSchema = persistedSchedulerPlanSnapshotSchema.extend({
  repair: schedulerRepairMetadataSchema.optional(),
});

export const schedulerPlanStateRecordSchema = z
  .object({
    id: z.literal('current'),
    version: z.literal(1),
    updatedAt: strictIsoDateTimeSchema,
    calendarRepairPendingAt: strictIsoDateTimeSchema.optional(),
    settingsRepairPendingAt: strictIsoDateTimeSchema.optional(),
    preferenceRepairPendingAt: strictIsoDateTimeSchema.optional(),
    preferenceRepairTargets: z.array(preferenceRepairTargetSchema).optional(),
    taskInputRepairPendingAt: strictIsoDateTimeSchema.optional(),
    taskInputRepairTargetIds: z.array(idSchema).optional(),
    rhythmInputRepairPendingAt: strictIsoDateTimeSchema.optional(),
    rhythmInputRepairTargetIds: z.array(idSchema).optional(),
    durationLearningApplied: z.array(appliedDurationLearningSchema).optional(),
    dayModeContext: schedulerDayModeContextSchema.optional(),
    undoDayModeContext: schedulerDayModeContextSchema.nullable().optional(),
    plan: persistedSchedulerPlanSchema,
  })
  .strict();

export type PreferenceRepairTarget = z.infer<typeof preferenceRepairTargetSchema>;
export type PersistedAppliedDurationLearning = z.infer<typeof appliedDurationLearningSchema>;
export type SchedulerPlanStateRecord = z.infer<typeof schedulerPlanStateRecordSchema>;
