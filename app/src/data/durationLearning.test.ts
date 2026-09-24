import { describe, expect, it } from 'vitest';
import { createBehaviourEvent } from './behaviourEventRepository';
import {
  applyDurationLearningControls,
  deriveDurationLearningEvidence,
} from './durationLearning';

function completion(
  id: string,
  templateId: string,
  actualMinutes: number,
) {
  return createBehaviourEvent({
    action: 'complete',
    before: { taskStatus: 'inProgress', minimumAchieved: false },
    after: { taskStatus: 'done', minimumAchieved: false },
    eventType: 'taskCompleted',
    id,
    occurredAt: `2026-09-2${Number(id.slice(-1)) || 1}T09:00:00.000Z`,
    provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
    source: 'user',
    taskId: `task-${id}`,
    templateId,
    actualMinutes,
  });
}

describe('Gate 7E duration learning', () => {
  it('uses only positive template-linked completion samples', () => {
    const evidence = deriveDurationLearningEvidence([
      completion('sample-1', 'paperwork', 20),
      completion('sample-2', 'paperwork', 0),
      completion('sample-3', 'paperwork', 40),
      completion('sample-4', 'paperwork', 30),
      completion('other-1', 'other', 15),
    ]);

    expect(evidence).toEqual([
      {
        templateId: 'other',
        sampleCount: 1,
        medianActualMinutes: 15,
        upperQuartileActualMinutes: 15,
        minimumObservedMinutes: 15,
        maximumObservedMinutes: 15,
        confidence: 'insufficient',
      },
      {
        templateId: 'paperwork',
        sampleCount: 3,
        medianActualMinutes: 30,
        upperQuartileActualMinutes: 40,
        minimumObservedMinutes: 20,
        maximumObservedMinutes: 40,
        confidence: 'low',
      },
    ]);
  });

  it('does not adapt automatically before three observations and uses the upper quartile afterwards', () => {
    const two = deriveDurationLearningEvidence([
      completion('sample-1', 'paperwork', 20),
      completion('sample-2', 'paperwork', 30),
    ]);
    expect(applyDurationLearningControls(two, [])).toEqual([]);

    const five = deriveDurationLearningEvidence([
      completion('sample-1', 'paperwork', 20),
      completion('sample-2', 'paperwork', 25),
      completion('sample-3', 'paperwork', 30),
      completion('sample-4', 'paperwork', 35),
      completion('sample-5', 'paperwork', 50),
    ]);
    expect(applyDurationLearningControls(five, [])).toEqual([{
      templateId: 'paperwork',
      source: 'learned',
      schedulerMinutes: 35,
      sampleCount: 5,
      confidence: 'moderate',
      medianActualMinutes: 30,
      upperQuartileActualMinutes: 35,
    }]);
  });

  it('lets explicit disable and correction outrank the learned estimate', () => {
    const evidence = deriveDurationLearningEvidence([
      completion('sample-1', 'paperwork', 20),
      completion('sample-2', 'paperwork', 25),
      completion('sample-3', 'paperwork', 30),
      completion('sample-4', 'paperwork', 35),
      completion('sample-5', 'paperwork', 50),
    ]);

    expect(applyDurationLearningControls(evidence, [{
      templateId: 'paperwork',
      mode: 'disabled',
      createdAt: first,
      updatedAt: first,
    }])).toEqual([]);

    expect(applyDurationLearningControls(evidence, [{
      templateId: 'paperwork',
      mode: 'override',
      overrideMinutes: 28,
      createdAt: first,
      updatedAt: first,
    }])).toEqual([{
      templateId: 'paperwork',
      source: 'userOverride',
      schedulerMinutes: 28,
      sampleCount: 5,
      confidence: 'user',
      medianActualMinutes: 30,
      upperQuartileActualMinutes: 35,
    }]);
  });
});

const first = '2026-09-25T00:00:00.000Z';
