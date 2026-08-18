import { z } from 'zod';
import { findBlockedDataClassKey } from './dataClassBoundary';
import {
  dayProfileFoundationSchema,
  dayProfileMigrationStateSchema,
  dayProfileSchema,
  dayOfWeekSchema,
  idSchema,
  lifeShapeSchedulerUseSchema,
  lifeShapeTimeBlockTypeSchema,
  lowCapacityPreferenceSchema,
  semanticAppVersionSchema,
  strictIsoDateTimeSchema,
  themeNameSchema,
  weekdayProfileAssignmentSchema,
} from './schemas';
import { settingsBackupSchema } from './settingsExport';

const appVersion = semanticAppVersionSchema;
const isoDateTime = strictIsoDateTimeSchema;
const settingsId = z.literal('settings');
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

const lifeShapeTimeBlockImportSchema = z
  .object({
    days: z.array(dayOfWeekSchema),
    end: timeOfDay,
    id: idSchema,
    label: z.string().min(1),
    notes: z.string().max(240).optional(),
    schedulerUse: lifeShapeSchedulerUseSchema.optional(),
    start: timeOfDay,
    type: lifeShapeTimeBlockTypeSchema,
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
    timeBlocks: z.array(lifeShapeTimeBlockImportSchema).default([]),
    travelMinutes: minuteAmount,
    usualWorkHours: usualWorkHoursImportSchema,
  })
  .strict();

export const settingsBackupV1ImportSettingsSchema = z
  .object({
    appVersion,
    createdAt: isoDateTime,
    id: settingsId,
    lifeShape: lifeShapeImportSchema,
    startBoostSafety: startBoostSafetyImportSchema,
    theme: themeNameSchema,
    updatedAt: isoDateTime,
  })
  .strict();

const lifeShapeV2ImportSchema = lifeShapeImportSchema.extend({
  timeBlocks: z.array(
    z
      .object({
        days: z.array(dayOfWeekSchema),
        end: timeOfDay,
        id: idSchema,
        label: z.string().min(1),
        notes: z.string().max(240).optional(),
        schedulerUse: lifeShapeSchedulerUseSchema,
        start: timeOfDay,
        type: lifeShapeTimeBlockTypeSchema,
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
      }),
  ),
});

export const settingsBackupV1ImportSchema = z
  .object({
    appVersion,
    exportedAt: isoDateTime,
    format: z.literal('life-rhythm-settings-backup'),
    settings: settingsBackupV1ImportSettingsSchema,
  })
  .strict();

export const settingsBackupV2ImportSettingsSchema = z
  .object({
    appVersion,
    createdAt: isoDateTime,
    dayProfileMigrationState: dayProfileMigrationStateSchema,
    dayProfiles: z.array(dayProfileSchema).length(2),
    id: settingsId,
    lifeShape: lifeShapeV2ImportSchema,
    startBoostSafety: startBoostSafetyImportSchema,
    theme: themeNameSchema,
    updatedAt: isoDateTime,
    weekdayProfileAssignments: z.array(weekdayProfileAssignmentSchema).length(7),
  })
  .strict()
  .superRefine((settings, context) => {
    const foundation = dayProfileFoundationSchema.safeParse({
      dayProfileMigrationState: settings.dayProfileMigrationState,
      dayProfiles: settings.dayProfiles,
      weekdayProfileAssignments: settings.weekdayProfileAssignments,
    });

    if (!foundation.success) {
      for (const issue of foundation.error.issues) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: issue.path,
        });
      }
    }

  });

export const settingsBackupV2ImportSchema = z
  .object({
    appVersion,
    exportedAt: isoDateTime,
    format: z.literal('life-rhythm-settings-backup'),
    formatVersion: z.literal(2),
    settings: settingsBackupV2ImportSettingsSchema,
  })
  .strict();

export const settingsBackupImportSchema = z.union([
  settingsBackupV2ImportSchema,
  settingsBackupV1ImportSchema,
]);

export type SettingsBackupImportPayload = z.infer<typeof settingsBackupImportSchema>;

export type SettingsBackupPreview = {
  appVersion: string;
  exportedAt: string;
  formatVersion: 1 | 2;
  lifeShapeSummary: string;
  profileFoundationSummary: string;
  settingsUpdatedAt: string;
  startBoostSafetySummary: string;
  theme: z.infer<typeof themeNameSchema>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function countEnabledSafetyFlags(settings: SettingsBackupImportPayload['settings']) {
  return Object.values(settings.startBoostSafety).filter(Boolean).length;
}

function buildPreview(payload: SettingsBackupImportPayload): SettingsBackupPreview {
  const workHours = payload.settings.lifeShape.usualWorkHours;
  const isVersion2 = 'formatVersion' in payload;

  return {
    appVersion: payload.appVersion,
    exportedAt: payload.exportedAt,
    formatVersion: isVersion2 ? 2 : 1,
    lifeShapeSummary: `${workHours.start}-${workHours.end}, ${payload.settings.lifeShape.transitionBufferMinutes} min buffer`,
    profileFoundationSummary: isVersion2
      ? `Profile foundation present; review state is ${payload.settings.dayProfileMigrationState.reviewState}. Presence does not activate derived availability.`
      : 'Profile foundation absent; a future restore would require migration and user review. No restore occurred.',
    settingsUpdatedAt: payload.settings.updatedAt,
    startBoostSafetySummary: `${countEnabledSafetyFlags(payload.settings)} safety choices on`,
    theme: payload.settings.theme,
  };
}

export function validateSettingsBackupImport(input: unknown): SettingsBackupImportValidationResult {
  if (!isRecord(input)) {
    return {
      errors: ['backup: Expected a settings backup object.'],
      ok: false,
    };
  }

  const blockedDataKey = findBlockedDataClassKey(input);

  if (blockedDataKey) {
    return {
      errors: [`${blockedDataKey}: Settings backup import cannot include app, legacy, task, rhythm, or migration data.`],
      ok: false,
    };
  }

  if (input.formatVersion === undefined) {
    const parsed = settingsBackupV1ImportSchema.safeParse(input);

    if (!parsed.success) {
      return {
        errors: issuesToMessages(parsed.error.issues),
        ok: false,
      };
    }

    return {
      ok: true,
      payload: parsed.data,
      preview: buildPreview(parsed.data),
    };
  }

  if (input.formatVersion !== 2) {
    return {
      errors: ['formatVersion: Expected 2, or omit the field for a legacy version-1 backup.'],
      ok: false,
    };
  }

  const parsed = settingsBackupV2ImportSchema.safeParse(input);

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
