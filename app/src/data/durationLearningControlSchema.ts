import { z } from 'zod';
import { idSchema, strictIsoDateTimeSchema } from './schemas';

export const DURATION_LEARNING_CONTROLS_RECORD_ID = 'learning:duration-controls:v1';

export const durationLearningControlModeSchema = z.enum(['disabled', 'override']);

const durationLearningControlBaseSchema = z
  .object({
    templateId: idSchema,
    mode: durationLearningControlModeSchema,
    overrideMinutes: z.number().int().positive().optional(),
  })
  .strict();

function validateControlMode(
  control: z.infer<typeof durationLearningControlBaseSchema>,
  context: z.RefinementCtx,
) {
  if (control.mode === 'override' && control.overrideMinutes === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'overrideMinutes is required for an override.',
      path: ['overrideMinutes'],
    });
  }
  if (control.mode === 'disabled' && control.overrideMinutes !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'overrideMinutes is not applicable while learning is disabled.',
      path: ['overrideMinutes'],
    });
  }
}

export const durationLearningControlWriteInputSchema =
  durationLearningControlBaseSchema.superRefine(validateControlMode);

export const durationLearningControlSchema = durationLearningControlBaseSchema
  .extend({
    createdAt: strictIsoDateTimeSchema,
    updatedAt: strictIsoDateTimeSchema,
  })
  .superRefine((control, context) => {
    validateControlMode(control, context);
    if (Date.parse(control.updatedAt) < Date.parse(control.createdAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'updatedAt must not precede createdAt.',
        path: ['updatedAt'],
      });
    }
  });

export const durationLearningControlStoreRecordSchema = z
  .object({
    id: z.literal(DURATION_LEARNING_CONTROLS_RECORD_ID),
    recordType: z.literal('durationLearningControls'),
    formatVersion: z.literal(1),
    appVersion: z.string().min(1),
    createdAt: strictIsoDateTimeSchema,
    updatedAt: strictIsoDateTimeSchema,
    controls: z.array(durationLearningControlSchema),
  })
  .strict()
  .superRefine((record, context) => {
    if (Date.parse(record.updatedAt) < Date.parse(record.createdAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'updatedAt must not precede createdAt.',
        path: ['updatedAt'],
      });
    }
    const ids = new Set<string>();
    record.controls.forEach((control, index) => {
      if (ids.has(control.templateId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each template may have only one duration-learning control.',
          path: ['controls', index, 'templateId'],
        });
      }
      ids.add(control.templateId);
      if (
        Date.parse(control.createdAt) < Date.parse(record.createdAt) ||
        Date.parse(control.updatedAt) > Date.parse(record.updatedAt)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Control timestamps must remain inside the store lifetime.',
          path: ['controls', index, 'updatedAt'],
        });
      }
    });
  });

export type DurationLearningControlWriteInput = z.infer<typeof durationLearningControlWriteInputSchema>;
export type DurationLearningControl = z.infer<typeof durationLearningControlSchema>;
export type DurationLearningControlStoreRecord = z.infer<typeof durationLearningControlStoreRecordSchema>;
