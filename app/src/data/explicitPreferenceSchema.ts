import { z } from 'zod';
import {
  areaSchema,
  dayOfWeekSchema,
  idSchema,
  strictIsoDateTimeSchema,
  taskTypeSchema,
} from './schemas';

export const EXPLICIT_PREFERENCES_RECORD_ID = 'preferences:explicit:v1';

const localTimeSchema = z
  .string()
  .regex(/^([01]\\d|2[0-3]):[0-5]\\d$/, 'Expected HH:MM');

const preferenceCoreShape = {
  id: idSchema,
  targetKind: z.enum(['intention', 'rhythm', 'area', 'taskType']),
  targetValue: idSchema,
  relation: z.enum(['prefer', 'avoid']),
  days: z
    .array(dayOfWeekSchema)
    .max(7)
    .refine((days) => new Set(days).size === days.length, 'Days must not contain duplicates.')
    .default([]),
  start: localTimeSchema.optional(),
  end: localTimeSchema.optional(),
  expiresAt: strictIsoDateTimeSchema.optional(),
} as const;

type PreferenceCore = {
  targetKind: 'intention' | 'rhythm' | 'area' | 'taskType';
  targetValue: string;
  start?: string;
  end?: string;
};

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function validatePreferenceCore(
  preference: PreferenceCore,
  context: z.RefinementCtx,
) {
  if ((preference.start === undefined) !== (preference.end === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Start and end must either both be present or both be omitted.',
      path: preference.start === undefined ? ['start'] : ['end'],
    });
  }

  if (
    preference.start !== undefined &&
    preference.end !== undefined &&
    minutesFromTime(preference.start) >= minutesFromTime(preference.end)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End must be later than start.',
      path: ['end'],
    });
  }

  if (
    preference.targetKind === 'area' &&
    !areaSchema.safeParse(preference.targetValue).success
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Area preferences must target a known area.',
      path: ['targetValue'],
    });
  }

  if (
    preference.targetKind === 'taskType' &&
    !taskTypeSchema.safeParse(preference.targetValue).success
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Task-type preferences must target a known task type.',
      path: ['targetValue'],
    });
  }
}

export const explicitPreferenceWriteInputSchema = z
  .object(preferenceCoreShape)
  .strict()
  .superRefine(validatePreferenceCore);

export const explicitPreferenceSchema = z
  .object({
    ...preferenceCoreShape,
    source: z.literal('explicitPersistent'),
    provenance: z
      .object({
        actor: z.literal('user'),
        mechanism: z.literal('explicitPreference'),
      })
      .strict(),
    createdAt: strictIsoDateTimeSchema,
    updatedAt: strictIsoDateTimeSchema,
  })
  .strict()
  .superRefine(validatePreferenceCore);

export const explicitPreferenceStoreRecordSchema = z
  .object({
    id: z.literal(EXPLICIT_PREFERENCES_RECORD_ID),
    recordType: z.literal('explicitPreferenceStore'),
    formatVersion: z.literal(1),
    appVersion: z.string().min(1),
    createdAt: strictIsoDateTimeSchema,
    updatedAt: strictIsoDateTimeSchema,
    preferences: z.array(explicitPreferenceSchema),
  })
  .strict()
  .superRefine((record, context) => {
    const seen = new Set<string>();
    for (const [index, preference] of record.preferences.entries()) {
      if (seen.has(preference.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Preference IDs must be unique.',
          path: ['preferences', index, 'id'],
        });
      }
      seen.add(preference.id);
    }
  });

export type ExplicitPreference = z.infer<typeof explicitPreferenceSchema>;
export type ExplicitPreferenceStoreRecord = z.infer<typeof explicitPreferenceStoreRecordSchema>;
export type ExplicitPreferenceWriteInput = z.input<typeof explicitPreferenceWriteInputSchema>;
