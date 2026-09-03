import type {
  ActiveTask,
  DayProfile,
  RhythmTemplate,
  Settings,
  SoftPlacement,
  TaskPoolItem,
} from '../data/schemas';
import type {
  CapacityWindow,
  DayProfileContext,
  InternalIntention,
  InternalPlacement,
  RhythmRequirement,
  SchedulingDomainModel,
  TaskVariant,
} from './schedulingModel';

export type CurrentPersistedSchedulingState = {
  settings: Settings;
  activeTasks: ActiveTask[];
  taskPoolItems: TaskPoolItem[];
  rhythmTemplates: RhythmTemplate[];
  softPlacements: SoftPlacement[];
};

const schedulableActiveTaskStatuses: readonly ActiveTask['status'][] = [
  'active',
  'inProgress',
  'paused',
  'minimumDone',
];

function variantsFromRecord(record: Pick<ActiveTask | TaskPoolItem | RhythmTemplate, 'minimum' | 'normal' | 'full'>): TaskVariant[] {
  return [
    { kind: 'minimum', ...record.minimum },
    { kind: 'normal', ...record.normal },
    { kind: 'full', ...record.full },
  ];
}

function poolItemEligible(item: TaskPoolItem): boolean {
  return item.status === 'captured' || item.status === 'suggested' || item.status === 'softPlaced';
}

function activeTaskEligible(task: ActiveTask): boolean {
  return schedulableActiveTaskStatuses.includes(task.status);
}

function intentionFromPoolItem(item: TaskPoolItem): InternalIntention {
  return {
    id: item.id,
    title: item.title,
    area: item.area,
    purpose: item.purpose,
    templateId: item.templateId,
    variants: variantsFromRecord(item),
    timing: {
      timeConstraint: item.timeConstraint,
      dueAt: item.dueAt,
      fixedAt: item.fixedAt,
      expiresAfter: item.expiresAfter,
      latestUsefulStartAt: item.latestUsefulStartAt,
      notUsefulAfter: item.notUsefulAfter,
      minimumStillUsefulAfterDeadline: item.minimumStillUsefulAfterDeadline,
    },
    lifecycle: {
      taskPoolStatus: item.status,
      bringBackAfter: item.bringBackAfter,
    },
    eligibleForScheduling: poolItemEligible(item),
    sourceRecords: [{ kind: 'taskPoolItem', id: item.id }],
  };
}

function mergeActiveTask(task: ActiveTask, existing?: InternalIntention): InternalIntention {
  const sourceRecords = existing?.sourceRecords ?? [];

  return {
    id: task.id,
    title: task.title,
    area: task.area,
    purpose: task.purpose,
    templateId: task.templateId ?? existing?.templateId,
    taskType: task.taskType,
    priority: task.priority,
    energy: task.energy,
    variants: variantsFromRecord(task),
    timing: {
      timeConstraint: task.timeConstraint,
      dueAt: task.dueAt,
      fixedAt: task.fixedAt,
      expiresAfter: task.expiresAfter,
      latestUsefulStartAt: task.latestUsefulStartAt,
      notUsefulAfter: task.notUsefulAfter,
      minimumStillUsefulAfterDeadline: task.minimumStillUsefulAfterDeadline,
    },
    lifecycle: {
      activeTaskStatus: task.status,
      taskPoolStatus: existing?.lifecycle.taskPoolStatus,
      bringBackAfter: existing?.lifecycle.bringBackAfter,
    },
    eligibleForScheduling: activeTaskEligible(task),
    sourceRecords: [...sourceRecords, { kind: 'activeTask', id: task.id }],
  };
}

function projectIntentions(activeTasks: ActiveTask[], taskPoolItems: TaskPoolItem[]): InternalIntention[] {
  const intentions = new Map<string, InternalIntention>();

  for (const item of taskPoolItems) {
    intentions.set(item.id, intentionFromPoolItem(item));
  }

  for (const task of activeTasks) {
    intentions.set(task.id, mergeActiveTask(task, intentions.get(task.id)));
  }

  return [...intentions.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function projectRhythms(templates: RhythmTemplate[]): RhythmRequirement[] {
  return templates
    .filter((template) => template.enabled && !template.archivedAt)
    .map((template) => ({
      id: `rhythm:${template.id}`,
      templateId: template.id,
      title: template.title,
      area: template.area,
      frequency: template.schedule.frequency,
      period: template.schedule.period,
      preferredDays: [...template.schedule.preferredDays],
      preferredTime: template.schedule.bestTime,
      maxPerDay: template.schedule.maxPerDay,
      variants: variantsFromRecord(template),
      sourceRecords: [{ kind: 'rhythmTemplate' as const, id: template.id }],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function projectCapacityWindows(settings: Settings): CapacityWindow[] {
  return settings.lifeShape.timeBlocks
    .map((block) => ({
      id: `window:${block.id}`,
      title: block.label,
      category: block.type,
      interval: {
        kind: 'recurringLocal' as const,
        days: [...block.days],
        start: block.start,
        end: block.end,
      },
      schedulerUse: block.schedulerUse,
      sourceId: block.id,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function projectDayProfile(profile: DayProfile, settings: Settings): DayProfileContext {
  const assignedWeekdays = settings.weekdayProfileAssignments
    .filter((assignment) => assignment.profileId === profile.id)
    .map((assignment) => assignment.weekday);

  return {
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    assignedWeekdays,
    usableDay: profile.usableDay
      ? { start: profile.usableDay.start, end: profile.usableDay.end }
      : undefined,
    workPeriod: profile.workPeriod
      ? { start: profile.workPeriod.start, end: profile.workPeriod.end }
      : undefined,
    workPlanningUse: profile.workPlanningUse,
  };
}

function projectPlacements(placements: SoftPlacement[]): InternalPlacement[] {
  return placements
    .filter((placement) => placement.status === 'planned' || placement.status === 'moved')
    .map((placement) => ({
      id: placement.id,
      intentionId: placement.taskId,
      date: placement.date,
      start: placement.start,
      end: placement.end,
      origin: 'existingUserConfirmed' as const,
      sourcePlacementId: placement.id,
      provenance: [
        'Projected from an existing user-confirmed private soft placement.',
        `Source block: ${placement.blockLabelSnapshot}`,
      ],
    }))
    .sort((a, b) => `${a.date}:${a.start}:${a.id}`.localeCompare(`${b.date}:${b.start}:${b.id}`));
}

export function projectCurrentStateToSchedulingDomain(
  state: CurrentPersistedSchedulingState,
): SchedulingDomainModel {
  return {
    intentions: projectIntentions(state.activeTasks, state.taskPoolItems),
    rhythms: projectRhythms(state.rhythmTemplates),
    externalCommitments: state.settings.lifeShape.fixedCommitments
      .map((commitment) => ({
        id: `commitment:${commitment.id}`,
        title: commitment.label,
        source: 'settingsFixedCommitment' as const,
        sourceId: commitment.id,
        interval: {
          kind: 'recurringLocal' as const,
          days: [...commitment.days],
          start: commitment.start,
          end: commitment.end,
        },
        hard: Boolean(commitment.start && commitment.end),
        travelBeforeMinutes: commitment.travelMinutes,
        transitionAfterMinutes: commitment.bufferMinutes,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    capacityWindows: projectCapacityWindows(state.settings),
    placements: projectPlacements(state.softPlacements),
    dayProfiles: state.settings.dayProfiles
      .map((profile) => projectDayProfile(profile, state.settings))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
