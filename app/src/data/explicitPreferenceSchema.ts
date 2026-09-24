import { z } from 'zod';
import {
  areaSchema,
  dayOfWeekSchema,
  strictIsoDateTimeSchema,
  taskTypeSchema,
} from './schemas';

export const EXPLICIT_PREFERENCES_RECORD_ID = 'preferences:explicit:v1';
export const explicitPreferenceIdSchema = z.string().min(1).refine(
  (value) => value.trim().length > 0,
  'Expected a nonblank identifier.',
);
const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
const coreShape = {
  id: explicitPreferenceIdSchema,
  targetKind: z.enum(['intention', 'rhythm', 'area', 'taskType']),
  targetValue: explicitPreferenceIdSchema,
  relation: z.enum(['prefer', 'avoid']),
  days: z.array(dayOfWeekSchema).max(7)
    .refine((days) => new Set(days).size === days.length, 'Duplicate weekdays are not allowed.')
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

function validateCore(preference: PreferenceCore, context: z.RefinementCtx) {
  if ((preference.start === undefined) !== (preference.end === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['end'],
      message: 'Start and end must both be present or both be omitted.' });
  }
  if (preference.start !== undefined && preference.end !== undefined && preference.start >= preference.end) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['end'],
      message: 'End must be later than start; overnight windows are not supported in v0.' });
  }
  if (preference.targetKind === 'area' && !areaSchema.safeParse(preference.targetValue).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetValue'], message: 'Expected a known area.' });
  }
  if (preference.targetKind === 'taskType' && !taskTypeSchema.safeParse(preference.targetValue).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetValue'], message: 'Expected a known task type.' });
  }
}

export const explicitPreferenceWriteInputSchema = z.object(coreShape).strict().superRefine(validateCore);

export const explicitPreferenceSchema = z.object({
  ...coreShape,
  source: z.literal('explicitPersistent'),
  provenance: z.object({ actor: z.literal('user'), mechanism: z.literal('explicitPreference') }).strict(),
  createdAt: strictIsoDateTimeSchema,
  updatedAt: strictIsoDateTimeSchema,
}).strict().superRefine((preference, context) => {
  validateCore(preference, context);
  if (Date.parse(preference.updatedAt) < Date.parse(preference.createdAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['updatedAt'], message: 'Update cannot precede creation.' });
  }
  if (preference.expiresAt && Date.parse(preference.expiresAt) <= Date.parse(preference.createdAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Expiry must follow creation.' });
  }
});

export const explicitPreferenceStoreRecordSchema = z.object({
  id: z.literal(EXPLICIT_PREFERENCES_RECORD_ID),
  recordType: z.literal('explicitPreferenceStore'),
  formatVersion: z.literal(1),
  appVersion: z.string().min(1),
  createdAt: strictIsoDateTimeSchema,
  updatedAt: strictIsoDateTimeSchema,
  preferences: z.array(explicitPreferenceSchema),
}).strict().superRefine((record, context) => {
  const seen = new Set<string>();
  if (Date.parse(record.updatedAt) < Date.parse(record.createdAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['updatedAt'], message: 'Update cannot precede creation.' });
  }
  for (const [index, preference] of record.preferences.entries()) {
    if (seen.has(preference.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['preferences', index, 'id'],
        message: 'Preference IDs must be unique.' });
    }
    seen.add(preference.id);
    if (Date.parse(preference.createdAt) < Date.parse(record.createdAt) ||
        Date.parse(preference.updatedAt) > Date.parse(record.updatedAt)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['preferences', index],
        message: 'Preference timestamps must be within the store lifetime.' });
    }
  }
});

export type ExplicitPreference = z.infer<typeof explicitPreferenceSchema>;
export type ExplicitPreferenceStoreRecord = z.infer<typeof explicitPreferenceStoreRecordSchema>;
export type ExplicitPreferenceWriteInput = z.input<typeof explicitPreferenceWriteInputSchema>;
