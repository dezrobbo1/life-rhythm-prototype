// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const learningMocks = vi.hoisted(() => ({
  read: vi.fn(),
}));
const controlMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));
const mutationMocks = vi.hoisted(() => ({
  expectation: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
}));
const catalogueMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));
const planMocks = vi.hoisted(() => ({
  ensure: vi.fn(),
}));

vi.mock('../../data/durationLearning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/durationLearning')>();
  return { ...actual, readDurationLearningEventsResult: learningMocks.read };
});
vi.mock('../../data/durationLearningControlRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/durationLearningControlRepository')>();
  return { ...actual, loadDurationLearningControlsResult: controlMocks.load };
});
vi.mock('../../data/durationLearningControlMutationCoordinator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/durationLearningControlMutationCoordinator')>();
  return {
    ...actual,
    durationLearningControlExpectation: mutationMocks.expectation,
    commitDurationLearningControlUpsert: mutationMocks.upsert,
    commitDurationLearningControlDelete: mutationMocks.remove,
  };
});
vi.mock('../../data/durationLearningTemplateCatalogue', () => ({
  loadDurationLearningTemplateCatalogue: catalogueMocks.load,
}));
vi.mock('../../data/schedulerPlanCoordinator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/schedulerPlanCoordinator')>();
  return { ...actual, ensureCurrentPrivatePlan: planMocks.ensure };
});

import { createBehaviourEvent } from '../../data/behaviourEventRepository';
import { DurationLearningPanel } from './DurationLearningPanel';

function completion(id: string, minutes: number) {
  return createBehaviourEvent({
    action: 'complete',
    before: { taskStatus: 'inProgress', minimumAchieved: false },
    after: { taskStatus: 'done', minimumAchieved: false },
    eventType: 'taskCompleted',
    id,
    occurredAt: `2026-09-2${id.at(-1)}T09:00:00.000Z`,
    provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
    source: 'user',
    taskId: `task-${id}`,
    templateId: 'paperwork',
    actualMinutes: minutes,
  });
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function setupHealthy(samples = [20, 30, 40]) {
  learningMocks.read.mockResolvedValue({
    status: 'ok',
    events: samples.map((minutes, index) => completion(`sample-${index + 1}`, minutes)),
    invalidRecordCount: 0,
    eventSnapshot: 'snapshot',
  });
  controlMocks.load.mockResolvedValue({ status: 'missing', controls: [] });
  catalogueMocks.load.mockResolvedValue({
    status: 'ok',
    templates: [{
      templateId: 'paperwork',
      title: 'Weekly paperwork',
      savedNormalMinutes: 20,
    }],
    warnings: [],
  });
}

describe('Gate 7E DurationLearningPanel', () => {
  it('shows explainable evidence without exposing internal template IDs', async () => {
    setupHealthy();

    render(<DurationLearningPanel />);

    expect(await screen.findByText('Weekly paperwork')).toBeTruthy();
    expect(screen.getByText(/Saved Normal duration: 20 minutes/)).toBeTruthy();
    expect(screen.getByText(/3 trusted completed instances/)).toBeTruthy();
    expect(screen.getByText(/Median 30 minutes/)).toBeTruthy();
    expect(screen.getByText(/conservative observed estimate 40 minutes/)).toBeTruthy();
    expect(screen.getByText(/reserves 40 minutes with low confidence/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('templateId');
  });

  it('saves an explicit correction through the target-scoped coordinator and reconciles the plan', async () => {
    setupHealthy();
    mutationMocks.expectation.mockReturnValue({ templateId: 'paperwork', control: null });
    mutationMocks.upsert.mockResolvedValue({
      ok: true,
      control: {},
      controls: [],
    });
    planMocks.ensure.mockResolvedValue({
      ok: true,
      mode: 'repaired',
      plan: {
        placements: [],
        rejectedExistingPlacements: [],
        unscheduledIntentionIds: [],
        unscheduledRhythmIds: [],
      },
      titleByTargetId: {},
      updatedAt: '2026-09-25T00:00:00.000Z',
      warnings: [],
    });
    const onPlanChanged = vi.fn();
    const user = userEvent.setup();

    render(<DurationLearningPanel onPlanChanged={onPlanChanged} />);

    const input = await screen.findByLabelText('Corrected minutes for Weekly paperwork');
    await user.clear(input);
    await user.type(input, '28');
    await user.click(screen.getByRole('button', { name: 'Use corrected duration' }));

    await waitFor(() => expect(mutationMocks.upsert).toHaveBeenCalledTimes(1));
    expect(mutationMocks.upsert).toHaveBeenCalledWith({
      templateId: 'paperwork',
      mode: 'override',
      overrideMinutes: 28,
    }, { templateId: 'paperwork', control: null });
    expect(planMocks.ensure).toHaveBeenCalledTimes(1);
    expect(onPlanChanged).toHaveBeenCalledTimes(1);
  });

  it('keeps explicit controls visible when behaviour evidence cannot be read', async () => {
    learningMocks.read.mockResolvedValue({
      status: 'readFailed',
      errors: ['durationLearning: Behaviour history could not be read; saved durations remain authoritative.'],
    });
    controlMocks.load.mockResolvedValue({
      status: 'ok',
      record: {
        id: 'learning:duration-controls:v1',
        recordType: 'durationLearningControls',
        formatVersion: 1,
        appVersion: '1.4.6',
        createdAt: '2026-09-25T00:00:00.000Z',
        updatedAt: '2026-09-25T00:00:00.000Z',
        controls: [],
      },
      controls: [{
        templateId: 'paperwork',
        mode: 'override',
        overrideMinutes: 28,
        createdAt: '2026-09-25T00:00:00.000Z',
        updatedAt: '2026-09-25T00:00:00.000Z',
      }],
    });
    catalogueMocks.load.mockResolvedValue({
      status: 'ok',
      templates: [{
        templateId: 'paperwork',
        title: 'Weekly paperwork',
        savedNormalMinutes: 20,
      }],
      warnings: [],
    });

    render(<DurationLearningPanel />);

    expect(await screen.findByText(/Behaviour history could not be read/)).toBeTruthy();
    expect(screen.getByText(/Your corrected duration is 28 minutes/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use learning again' })).toBeTruthy();
  });
});
