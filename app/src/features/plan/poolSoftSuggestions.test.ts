import { describe, expect, it } from 'vitest';
import { taskPoolItemSchema, type SoftPlacement, type TaskPoolItem } from '../../data/schemas';
import { buildPoolSoftSuggestions } from './poolSoftSuggestions';

function poolItem(overrides: Partial<TaskPoolItem> = {}): TaskPoolItem {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-07-01T00:00:00.000Z',
    full: { label: 'Complete the whole form', minutes: 20 },
    id: 'pool-school-form',
    minimum: { label: 'Open the form', minutes: 5 },
    normal: { label: 'Fill the first page', minutes: 10 },
    source: 'adhoc',
    status: 'captured',
    title: 'Send school form',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  });
}

const openBlock = {
  days: ['Monday'] as const,
  end: '10:30',
  id: 'open-morning',
  label: 'Open morning capacity',
  schedulerUse: 'available' as const,
  start: '10:00',
  type: 'openCapacity' as const,
};

describe('Pool soft suggestions', () => {
  it('pairs a safely held task with explicit open capacity', () => {
    const result = buildPoolSoftSuggestions({
      existingPlacements: [],
      items: [poolItem()],
      selectedDate: '2026-07-13',
      selectedDay: 'Monday',
      timeBlocks: [openBlock],
    });

    expect(result).toMatchObject({
      eligibleTaskCount: 1,
      openCapacityBlockCount: 1,
      suggestions: [
        {
          blockId: 'open-morning',
          minimumLabel: 'Open the form',
          taskId: 'pool-school-form',
          taskTitle: 'Send school form',
        },
      ],
    });
  });

  it('does not treat ask-first, unavailable, or blank time as capacity', () => {
    const result = buildPoolSoftSuggestions({
      existingPlacements: [],
      items: [poolItem()],
      selectedDate: '2026-07-13',
      selectedDay: 'Monday',
      timeBlocks: [
        { ...openBlock, id: 'ask-first', schedulerUse: 'askFirst' },
        { ...openBlock, id: 'protected', schedulerUse: 'unavailable', type: 'protectedTime' },
      ],
    });

    expect(result.openCapacityBlockCount).toBe(0);
    expect(result.suggestions).toEqual([]);
  });

  it('requires the minimum version to fit and avoids occupied blocks', () => {
    const existingPlacement: SoftPlacement = {
      blockId: 'open-morning',
      blockLabelSnapshot: 'Open morning capacity',
      createdAt: '2026-07-01T00:00:00.000Z',
      date: '2026-07-13',
      end: '10:30',
      id: 'existing-placement',
      placementSource: 'userConfirmed',
      start: '10:00',
      status: 'planned',
      taskId: 'another-task',
      taskTitleSnapshot: 'Another task',
      updatedAt: '2026-07-01T00:00:00.000Z',
    };
    const result = buildPoolSoftSuggestions({
      existingPlacements: [existingPlacement],
      items: [poolItem(), poolItem({ id: 'large-task', minimum: { label: 'Long minimum', minutes: 45 } })],
      selectedDate: '2026-07-13',
      selectedDay: 'Monday',
      timeBlocks: [openBlock],
    });

    expect(result.eligibleTaskCount).toBe(2);
    expect(result.suggestions).toEqual([]);
  });

  it('respects useful edges unless the minimum is explicitly still helpful', () => {
    const expiredTask = poolItem({
      dueAt: '2026-07-13T09:30:00.000Z',
      timeConstraint: 'dueBy',
    });
    const minimumStillHelps = poolItem({
      dueAt: '2026-07-13T09:30:00.000Z',
      id: 'minimum-still-helps',
      minimumStillUsefulAfterDeadline: true,
      timeConstraint: 'dueBy',
    });

    const result = buildPoolSoftSuggestions({
      existingPlacements: [],
      items: [expiredTask, minimumStillHelps],
      selectedDate: '2026-07-13',
      selectedDay: 'Monday',
      timeBlocks: [openBlock],
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      taskId: 'minimum-still-helps',
      reason: 'The original useful edge has passed, but you marked the minimum as still helpful.',
    });
  });

  it('does not suggest deferred work before its bring-back time', () => {
    const result = buildPoolSoftSuggestions({
      existingPlacements: [],
      items: [poolItem({
        bringBackAfter: '2026-07-13T12:00:00.000Z',
        status: 'deferred',
      })],
      selectedDate: '2026-07-13',
      selectedDay: 'Monday',
      timeBlocks: [openBlock],
    });

    expect(result.suggestions).toEqual([]);
  });
});
