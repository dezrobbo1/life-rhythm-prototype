import { describe, expect, it } from 'vitest';
import {
  activeTaskSchema,
  rhythmTemplateSchema,
  settingsSchema,
  softPlacementSchema,
  taskPoolItemSchema,
} from '../data/schemas';
import { projectCurrentStateToSchedulingDomain } from './currentStateProjection';

const timestamp = '2026-09-03T10:00:00.000Z';

function versions() {
  return {
    minimum: { label: 'Open it', minutes: 5 },
    normal: { label: 'Do it', minutes: 20 },
    full: { label: 'Finish it fully', minutes: 40 },
  };
}

function settings() {
  return settingsSchema.parse({
    appVersion: '1.4.6',
    createdAt: timestamp,
    updatedAt: timestamp,
    lifeShape: {
      fixedCommitments: [
        {
          id: 'school-run',
          label: 'School run',
          days: ['Monday'],
          start: '08:00',
          end: '08:30',
          travelMinutes: 10,
          bufferMinutes: 5,
        },
      ],
      timeBlocks: [
        {
          id: 'family-evening',
          label: 'Family evening',
          type: 'familyTime',
          days: ['Monday'],
          start: '18:00',
          end: '20:00',
        },
      ],
    },
  });
}

describe('current persisted state projection', () => {
  it('merges linked Pool and Today records into one canonical intention', () => {
    const poolItem = taskPoolItemSchema.parse({
      id: 'task-one',
      title: 'Original captured title',
      area: 'admin',
      source: 'adhoc',
      status: 'today',
      createdAt: timestamp,
      updatedAt: timestamp,
      ...versions(),
    });
    const activeTask = activeTaskSchema.parse({
      id: 'task-one',
      source: 'adhoc',
      title: 'Current active title',
      area: 'admin',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      ...versions(),
    });

    const projected = projectCurrentStateToSchedulingDomain({
      settings: settings(),
      activeTasks: [activeTask],
      taskPoolItems: [poolItem],
      rhythmTemplates: [],
      softPlacements: [],
    });

    expect(projected.intentions).toHaveLength(1);
    expect(projected.intentions[0]).toMatchObject({
      id: 'task-one',
      title: 'Current active title',
      eligibleForScheduling: true,
      lifecycle: {
        activeTaskStatus: 'active',
        taskPoolStatus: 'today',
      },
    });
    expect(projected.intentions[0].sourceRecords).toEqual([
      { kind: 'taskPoolItem', id: 'task-one' },
      { kind: 'activeTask', id: 'task-one' },
    ]);
  });

  it('projects only enabled, unarchived rhythms as current scheduling requirements', () => {
    const enabled = rhythmTemplateSchema.parse({
      id: 'exercise',
      title: 'Exercise',
      area: 'movement',
      enabled: true,
      schedule: { frequency: 3, period: 'week', preferredDays: ['Monday', 'Wednesday', 'Saturday'] },
      createdAt: timestamp,
      updatedAt: timestamp,
      ...versions(),
    });
    const disabled = rhythmTemplateSchema.parse({
      id: 'disabled-rhythm',
      title: 'Disabled rhythm',
      area: 'house',
      enabled: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...versions(),
    });

    const projected = projectCurrentStateToSchedulingDomain({
      settings: settings(),
      activeTasks: [],
      taskPoolItems: [],
      rhythmTemplates: [disabled, enabled],
      softPlacements: [],
    });

    expect(projected.rhythms).toHaveLength(1);
    expect(projected.rhythms[0]).toMatchObject({
      templateId: 'exercise',
      frequency: 3,
      period: 'week',
    });
  });

  it('projects current private placements but excludes removed and completed placement history', () => {
    const planned = softPlacementSchema.parse({
      id: 'placement-live',
      taskId: 'task-one',
      taskTitleSnapshot: 'Task one',
      date: '2026-09-07',
      blockId: 'open-one',
      blockLabelSnapshot: 'Open capacity',
      start: '10:00',
      end: '10:20',
      placementSource: 'userConfirmed',
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'planned',
    });
    const removed = softPlacementSchema.parse({ ...planned, id: 'placement-removed', status: 'removed' });
    const completed = softPlacementSchema.parse({ ...planned, id: 'placement-completed', status: 'completedFromToday' });

    const projected = projectCurrentStateToSchedulingDomain({
      settings: settings(),
      activeTasks: [],
      taskPoolItems: [],
      rhythmTemplates: [],
      softPlacements: [removed, completed, planned],
    });

    expect(projected.placements.map((placement) => placement.id)).toEqual(['placement-live']);
  });

  it('projects current protected windows, fixed commitments and day-profile assignments without changing persistence', () => {
    const projected = projectCurrentStateToSchedulingDomain({
      settings: settings(),
      activeTasks: [],
      taskPoolItems: [],
      rhythmTemplates: [],
      softPlacements: [],
    });

    expect(projected.capacityWindows).toEqual([
      expect.objectContaining({
        sourceId: 'family-evening',
        schedulerUse: 'unavailable',
      }),
    ]);
    expect(projected.externalCommitments).toEqual([
      expect.objectContaining({
        sourceId: 'school-run',
        hard: true,
        travelBeforeMinutes: 10,
        transitionAfterMinutes: 5,
      }),
    ]);
    expect(projected.dayProfiles).toHaveLength(2);
    expect(projected.dayProfiles.find((profile) => profile.kind === 'workday')?.assignedWeekdays).toContain('Monday');
  });
});
