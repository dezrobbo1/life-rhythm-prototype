import { summariseDurations } from './behaviourStatistics';
import type { DurationLearningControl } from './durationLearningControlSchema';
import type { Table } from 'dexie';
import type { AppliedDurationLearning } from '../domain/schedulingModel';
import { behaviourEventSchema, type BehaviourEvent, type TaskHistory } from './schemas';

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

export type DurationLearningEventReadResult =
  | {
      status: 'ok' | 'partial';
      events: BehaviourEvent[];
      invalidRecordCount: number;
      eventSnapshot: string;
    }
  | { status: 'readFailed'; errors: string[] };

type DurationLearningEventStore = {
  taskHistory: Pick<Table<TaskHistory, string>, 'toArray'>;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

export function durationLearningEventSnapshot(rows: readonly unknown[]) {
  const behaviourRows = rows
    .filter((row) =>
      typeof row === 'object' &&
      row !== null &&
      (row as { recordKind?: unknown }).recordKind === 'behaviourEvent')
    .map(stableValue)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify(behaviourRows);
}

export async function readDurationLearningEventsResult(
  store: DurationLearningEventStore,
): Promise<DurationLearningEventReadResult> {
  try {
    const rows = await store.taskHistory.toArray();
    let invalidRecordCount = 0;
    const events = rows.flatMap((row) => {
      if ((row as { recordKind?: unknown }).recordKind !== 'behaviourEvent') return [];
      const parsed = behaviourEventSchema.safeParse(row);
      if (!parsed.success) {
        invalidRecordCount += 1;
        return [];
      }
      return [parsed.data];
    }).sort((left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
      left.id.localeCompare(right.id));

    return {
      status: invalidRecordCount > 0 ? 'partial' : 'ok',
      events,
      invalidRecordCount,
      eventSnapshot: durationLearningEventSnapshot(rows),
    };
  } catch {
    return {
      status: 'readFailed',
      errors: ['durationLearning: Behaviour history could not be read; saved durations remain authoritative.'],
    };
  }
}

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
      event.rhythmInstanceId ||
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

export function durationLearningSchedulingChangedTemplateIds(
  before: readonly AppliedDurationLearning[],
  after: readonly AppliedDurationLearning[],
) {
  const schedulingKey = (item: AppliedDurationLearning) =>
    JSON.stringify({ source: item.source, schedulerMinutes: item.schedulerMinutes });
  const beforeById = new Map(before.map((item) => [item.templateId, schedulingKey(item)]));
  const afterById = new Map(after.map((item) => [item.templateId, schedulingKey(item)]));

  return [...new Set([...beforeById.keys(), ...afterById.keys()])]
    .filter((templateId) => beforeById.get(templateId) !== afterById.get(templateId))
    .sort();
}

export function durationLearningByTemplateId(
  applied: readonly AppliedDurationLearning[],
) {
  return Object.fromEntries(applied.map((item) => [item.templateId, { ...item }]));
}
