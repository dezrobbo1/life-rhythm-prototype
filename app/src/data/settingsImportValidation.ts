import { z } from 'zod';
import {
  appVersionSchema,
  dayOfWeekSchema,
  idSchema,
  lowCapacityPreferenceSchema,
  themeNameSchema,
} from './schemas';
import { settingsBackupSchema } from './settingsExport';

const isoDateTime = z.string().min(1, 'Expected an ISO timestamp');
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
const minuteAmount = z.number().int().min(0).max(480);
const transitionBufferMinutes = z.number().int().min(0).max(180);

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);

  return hours * 60 + minutes;
}

const startBoostSafetyImportSchema = z
  .object({
    avoidAccountabilityPrompts: z.boolean(),
    avoidFoodRewards: z.boolean(),
    avoidScrollingRewards: z.boolean(),
    avoidShoppingRewards: z.boolean(),
    avoidStreakPressure: z.boolean(),
    avoidUrgencyCountdowns: z.boolean(),
  })
  .strict();

const usualWorkHoursImportSchema = z
  .object({
    days: z.array(dayOfWeekSchema),
    end: timeOfDay,
    start: timeOfDay,
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

const fixedCommitmentImportSchema = z
  .object({
    bufferMinutes: transitionBufferMinutes,
    days: z.array(dayOfWeekSchema),
    end: timeOfDay.optional(),
    id: idSchema,
    label: z.string().min(1),
    start: timeOfDay.optional(),
    travelMinutes: minuteAmount,
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

const lifeShapeImportSchema = z
  .object({
    commuteMinutes: minuteAmount,
    fixedCommitments: z.array(fixedCommitmentImportSchema),
    lowCapacityPreference: lowCapacityPreferenceSchema,
    mealAnchors: z
      .object({
        breakfast: timeOfDay,
        dinner: timeOfDay,
        lunch: timeOfDay,
      })
      .strict(),
    sleepWakeAnchors: z
      .object({
        sleep: timeOfDay,
        wake: timeOfDay,
      })
      .strict(),
    transitionBufferMinutes,
    travelMinutes: minuteAmount,
    usualWorkHours: usualWorkHoursImportSchema,
  })
  .strict();

const settingsBackupImportSettingsSchema = z
  .object({
    appVersion: appVersionSchema,
    createdAt: isoDateTime,
    id: idSchema,
    lifeShape: lifeShapeImportSchema,
    startBoostSafety: startBoostSafetyImportSchema,
    theme: themeNameSchema,
    updatedAt: isoDateTime,
  })
  .strict();

export const settingsBackupImportSchema = z
  .object({
    appVersion: appVersionSchema,
    exportedAt: isoDateTime,
    format: z.literal('life-rhythm-settings-backup'),
    settings: settingsBackupImportSettingsSchema,
  })
  .strict();

export type SettingsBackupImportPayload = z.infer<typeof settingsBackupImportSchema>;

export type SettingsBackupPreview = {
  appVersion: string;
  exportedAt: string;
  lifeShapeSummary: string;
  settingsUpdatedAt: string;
  startBoostSafetySummary: string;
  theme: SettingsBackupImportPayload['settings']['theme'];
};

export type SettingsBackupImportValidationResult =
  | {
      ok: true;
      payload: SettingsBackupImportPayload;
      preview: SettingsBackupPreview;
    }
  | {
      errors: string[];
      ok: false;
    };

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'backup';

    return `${path}: ${issue.message}`;
  });
}

function countEnabledSafetyFlags(settings: SettingsBackupImportPayload['settings']) {
  return Object.values(settings.startBoostSafety).filter(Boolean).length;
}

function buildPreview(payload: SettingsBackupImportPayload): SettingsBackupPreview {
  const workHours = payload.settings.lifeShape.usualWorkHours;

  return {
    appVersion: payload.appVersion,
    exportedAt: payload.exportedAt,
    lifeShapeSummary: `${workHours.start}-${workHours.end}, ${payload.settings.lifeShape.transitionBufferMinutes} min buffer`,
    settingsUpdatedAt: payload.settings.updatedAt,
    startBoostSafetySummary: `${countEnabledSafetyFlags(payload.settings)} safety choices on`,
    theme: payload.settings.theme,
  };
}

export function validateSettingsBackupImport(input: unknown): SettingsBackupImportValidationResult {
  const parsed = settingsBackupImportSchema.safeParse(input);

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
    };
  }

  const exportCompatible = settingsBackupSchema.safeParse(parsed.data);

  if (!exportCompatible.success) {
    return {
      errors: issuesToMessages(exportCompatible.error.issues),
      ok: false,
    };
  }

  return {
    ok: true,
    payload: parsed.data,
    preview: buildPreview(parsed.data),
  };
}

export function parseSettingsBackupImportJson(json: string): SettingsBackupImportValidationResult {
  try {
    return validateSettingsBackupImport(JSON.parse(json) as unknown);
  } catch {
    return {
      errors: ['backup: Settings backup JSON is malformed.'],
      ok: false,
    };
  }
}
