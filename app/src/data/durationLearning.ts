import { summariseDurations } from './behaviourStatistics';
import type { DurationLearningControl } from './durationLearningControlSchema';
import type { BehaviourEvent } from './schemas';

export type DurationLearningConfidence = 'insufficient' | 'low' | 'moderate';

export type DurationLearningEvidence = {
  templateId: string;
  sampleCount: number;
  medianActualMinutes: number;
  upperQuartileActualMinutes: number;
  minimumObservedMinutes: number;
  maximumObservedMinutes: number;
  confidence: DurationLearningConfidence;
};

export type AppliedDurationLearning = {
  templateId: string;
  source: 'learned' | 'userOverride';
  schedulerMinutes: number;
  sampleCount: number;
  confidence: 'low' | 'moderate' | 'user';
  medianActualMinutes?: number;
  upperQuartileActualMinutes?: number;
};

function confidenceFor(sampleCount: number): DurationLearningConfidence {
  if (sampleCount < 3) return 'insufficient';
  if (sampleCount < 5) return 'low';
  return 'moderate';
}

export function deriveDurationLearningEvidence(
  events: readonly BehaviourEvent[],
): DurationLearningEvidence[] {
  const groups = new Map<string, number[]>();

  for (const event of events) {
    if (
      event.eventType !== 'taskCompleted' ||
      !event.templateId ||
      event.actualMinutes === undefined ||
      event.actualMinutes <= 0
    ) {
      continue;
    }
    const values = groups.get(event.templateId);
    if (values) values.push(event.actualMinutes);
    else groups.set(event.templateId, [event.actualMinutes]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([templateId, minutes]) => {
      const summary = summariseDurations(minutes);
      if (
        summary.medianActualMinutes === null ||
        summary.upperQuartileActualMinutes === null ||
        summary.minimumObservedMinutes === null ||
        summary.maximumObservedMinutes === null
      ) {
        throw new Error('Positive duration evidence unexpectedly produced an empty summary.');
      }

      return {
        templateId,
        sampleCount: summary.sampleCount,
        medianActualMinutes: summary.medianActualMinutes,
        upperQuartileActualMinutes: summary.upperQuartileActualMinutes,
        minimumObservedMinutes: summary.minimumObservedMinutes,
        maximumObservedMinutes: summary.maximumObservedMinutes,
        confidence: confidenceFor(summary.sampleCount),
      };
    });
}

export function applyDurationLearningControls(
  evidence: readonly DurationLearningEvidence[],
  controls: readonly DurationLearningControl[],
): AppliedDurationLearning[] {
  const evidenceByTemplate = new Map(evidence.map((item) => [item.templateId, item]));
  const controlsByTemplate = new Map(controls.map((control) => [control.templateId, control]));
  const templateIds = [...new Set([
    ...evidence.map((item) => item.templateId),
    ...controls.map((control) => control.templateId),
  ])].sort();

  return templateIds.flatMap((templateId): AppliedDurationLearning[] => {
    const control = controlsByTemplate.get(templateId);
    const observed = evidenceByTemplate.get(templateId);

    if (control?.mode === 'disabled') return [];

    if (control?.mode === 'override') {
      return [{
        templateId,
        source: 'userOverride',
        schedulerMinutes: control.overrideMinutes!,
        sampleCount: observed?.sampleCount ?? 0,
        confidence: 'user',
        ...(observed
          ? {
              medianActualMinutes: observed.medianActualMinutes,
              upperQuartileActualMinutes: observed.upperQuartileActualMinutes,
            }
          : {}),
      }];
    }

    if (!observed || observed.confidence === 'insufficient') return [];

    return [{
      templateId,
      source: 'learned',
      schedulerMinutes: observed.upperQuartileActualMinutes,
      sampleCount: observed.sampleCount,
      confidence: observed.confidence,
      medianActualMinutes: observed.medianActualMinutes,
      upperQuartileActualMinutes: observed.upperQuartileActualMinutes,
    }];
  });
}

export function durationLearningByTemplateId(
  applied: readonly AppliedDurationLearning[],
) {
  return Object.fromEntries(applied.map((item) => [item.templateId, { ...item }]));
}
