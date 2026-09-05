import { z } from 'zod';
import { idSchema, softPlacementDateSchema, strictIsoDateTimeSchema } from './schemas';

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
const variantKindSchema = z.enum(['minimum', 'normal', 'full']);
const placementOriginSchema = z.enum(['existingUserConfirmed', 'scheduler']);
const targetKindSchema = z.enum(['intention', 'rhythm']);

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
  'overrun',
  'missedStart',
  'completionChanged',
  'userCorrection',
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
  });

const schedulerRepairMetadataSchema = z
  .object({
    trigger: schedulerRepairTriggerSchema.optional(),
    reason: z.string().min(1),
    now: schedulerRepairNowSchema.optional(),
    frozenPastPlacementIds: z.array(idSchema),
    preservedPlacementIds: z.array(idSchema),
    changes: z.array(schedulerPlanChangeSchema),
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
    plan: persistedSchedulerPlanSchema,
  })
  .strict();

export type SchedulerPlanStateRecord = z.infer<typeof schedulerPlanStateRecordSchema>;
