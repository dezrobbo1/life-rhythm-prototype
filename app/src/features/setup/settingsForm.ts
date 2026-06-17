import type { ThemeName } from '../../app/theme';
import {
  lifeShapeSettingsSchema,
  startBoostSafetySettingsSchema,
  type LifeShapeSettings,
  type LifeShapeTimeBlock,
  type Settings,
  type StartBoostSafetySettings,
} from '../../data/schemas';
import { defaultLifeShape, safetyToggles, type LifeShapeState } from './mockSetupData';

export type SetupSettingsDraft = {
  lifeShape: LifeShapeSettings;
  startBoostSafety: StartBoostSafetySettings;
  theme: ThemeName;
};

function parseMinuteField(value: string): number {
  const trimmed = value.trim();

  return trimmed.length === 0 ? 0 : Number(trimmed);
}

export function normalizeLifeShapeForm(lifeShape: LifeShapeState): LifeShapeSettings {
  const fixedCommitmentLabel = lifeShape.fixedCommitments.trim();
  const travelMinutes = parseMinuteField(lifeShape.commuteMinutes);

  return lifeShapeSettingsSchema.parse({
    commuteMinutes: travelMinutes,
    fixedCommitments:
      fixedCommitmentLabel.length > 0
        ? [
            {
              id: 'setup-fixed-commitments',
              label: fixedCommitmentLabel,
            },
          ]
        : [],
    lowCapacityPreference: lifeShape.lowCapacityPreference,
    mealAnchors: {
      breakfast: lifeShape.breakfastAnchor,
      dinner: lifeShape.dinnerAnchor,
      lunch: lifeShape.lunchAnchor,
    },
    sleepWakeAnchors: {
      sleep: lifeShape.sleepAnchor,
      wake: lifeShape.wakeAnchor,
    },
    timeBlocks: lifeShape.timeBlocks.map((block) => ({
      days: block.days,
      end: block.end,
      id: block.id,
      label: block.label.trim(),
      notes: block.notes.trim().length > 0 ? block.notes.trim() : undefined,
      schedulerUse: block.schedulerUse,
      start: block.start,
      type: block.type,
    })),
    transitionBufferMinutes: parseMinuteField(lifeShape.transitionBuffer),
    travelMinutes,
    usualWorkHours: {
      start: lifeShape.workStart,
      end: lifeShape.workEnd,
    },
  });
}

export function safetyStateFromSettings(settings: Settings): Record<string, boolean> {
  const safety = startBoostSafetySettingsSchema.parse(settings.startBoostSafety);

  return Object.fromEntries(safetyToggles.map((toggle) => [toggle.id, safety[toggle.id]]));
}

export function safetySettingsFromState(safetyState: Record<string, boolean>): StartBoostSafetySettings {
  return startBoostSafetySettingsSchema.parse(
    Object.fromEntries(safetyToggles.map((toggle) => [toggle.id, Boolean(safetyState[toggle.id])])),
  );
}

export function lifeShapeStateFromSettings(settings: Settings | undefined): LifeShapeState {
  if (!settings) {
    return defaultLifeShape;
  }

  const lifeShape = lifeShapeSettingsSchema.parse(settings.lifeShape);
  const firstCommitment = lifeShape.fixedCommitments[0];

  return {
    breakfastAnchor: lifeShape.mealAnchors.breakfast,
    commuteMinutes: String(lifeShape.commuteMinutes),
    dinnerAnchor: lifeShape.mealAnchors.dinner,
    fixedCommitments: firstCommitment?.label ?? '',
    lunchAnchor: lifeShape.mealAnchors.lunch,
    lowCapacityPreference: lifeShape.lowCapacityPreference,
    sleepAnchor: lifeShape.sleepWakeAnchors.sleep,
    timeBlocks: lifeShape.timeBlocks.map(timeBlockStateFromSettings),
    transitionBuffer: String(lifeShape.transitionBufferMinutes),
    wakeAnchor: lifeShape.sleepWakeAnchors.wake,
    workEnd: lifeShape.usualWorkHours.end,
    workStart: lifeShape.usualWorkHours.start,
  };
}

function timeBlockStateFromSettings(block: LifeShapeTimeBlock) {
  return {
    days: [...block.days],
    end: block.end,
    id: block.id,
    label: block.label,
    notes: block.notes ?? '',
    schedulerUse: block.schedulerUse,
    start: block.start,
    type: block.type,
  };
}
