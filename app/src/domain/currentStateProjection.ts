import type {
  ActiveTask,
  DayProfile,
  RhythmTemplate,
  Settings,
  SoftPlacement,
  TaskPoolItem,
} from '../data/schemas';
import type {
  RhythmInstance,
  RhythmPlan,
  RhythmRecurrenceRevision,
} from '../data/rhythmAuthoritySchemas';
import type {
  CapacityWindow,
  DayProfileContext,
  InternalIntention,
  InternalPlacement,
  RhythmRequirement,
  AppliedDurationLearning,
  SchedulingDomainModel,
  TaskVariant,
} from './schedulingModel';

export type CurrentPersistedSchedulingState = {
  settings: Settings;
  activeTasks: ActiveTask[];
  taskPoolItems: TaskPoolItem[];
  rhythmTemplates: RhythmTemplate[];
  rhythmPlans?: RhythmPlan[];
  rhythmRecurrenceRevisions?: RhythmRecurrenceRevision[];
  rhythmInstances?: RhythmInstance[];
  softPlacements: SoftPlacement[];
  durationLearningByTemplateId?: Record<string, AppliedDurationLearning>;
};

const schedulableActiveTaskStatuses: readonly ActiveTask['status'][] = [
  'active',
  'inProgress',
  'paused',
  'minimumDone',
];

function variantsFromRecord(
  record: Pick<ActiveTask | TaskPoolItem | RhythmTemplate, 'minimum' | 'normal' | 'full'>,
  templateId?: string,
  durationLearningByTemplateId?: CurrentPersistedSchedulingState['durationLearningByTemplateId'],
): TaskVariant[] {
  const learned = templateId ? durationLearningByTemplateId?.[templateId] : undefined;
  return [
    { kind: 'minimum', ...record.minimum },
    {
      kind: 'normal',
      ...record.normal,
      ...(learned
        ? {
            minutes: learned.schedulerMinutes,
            durationLearning: {
              ...learned,
              savedNormalMinutes: record.normal.minutes,
            },
          }
        : {}),
    },
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
    // Held items have no authored task type. Do not treat 'simple' as a
    // classification and accidentally apply Task type preferences.
    variants: variantsFromRecord(item, item.templateId),
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
    // The default 'simple' on an ad-hoc ActiveTask is also not user-authored.
    ...(task.source === 'library' ? { taskType: task.taskType } : {}),
    priority: task.priority,
    energy: task.energy,
    variants: variantsFromRecord(task, task.templateId),
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

function projectIntentions(
  activeTasks: ActiveTask[],
  taskPoolItems: TaskPoolItem[],
  durationLearningByTemplateId?: CurrentPersistedSchedulingState['durationLearningByTemplateId'],
): InternalIntention[] {
  const intentions = new Map<string, InternalIntention>();

  for (const item of taskPoolItems) {
    const intention = intentionFromPoolItem(item);
    intention.variants = variantsFromRecord(item, item.templateId, durationLearningByTemplateId);
    intentions.set(item.id, intention);
  }

  for (const task of activeTasks) {
    // A generated rhythm ActiveTask is an executable projection of its
    // canonical RhythmInstance, never a second schedulable intention.
    if (task.sourceRhythmInstanceId) continue;
    const intention = mergeActiveTask(task, intentions.get(task.id));
    intention.variants = variantsFromRecord(task, task.templateId, durationLearningByTemplateId);
    intentions.set(task.id, intention);
  }

  return [...intentions.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function projectRhythms(
  templates: RhythmTemplate[],
  plans?: RhythmPlan[],
  revisions?: RhythmRecurrenceRevision[],
  instances?: RhythmInstance[],
  durationLearningByTemplateId?: CurrentPersistedSchedulingState['durationLearningByTemplateId'],
): RhythmRequirement[] {
  // The compatibility path keeps pure Gate 3 fixture tests meaningful. Live
  // projection always supplies the three authority collections below.
  if (!plans || !revisions || !instances) {
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
        variants: variantsFromRecord(template, template.id, durationLearningByTemplateId),
        sourceRecords: [{ kind: 'rhythmTemplate' as const, id: template.id }],
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));

  return instances
    .filter((instance) => {
      if (instance.lifecycleState === 'closed') return false;
      const plan = planById.get(instance.rhythmPlanId);
      return plan?.state === 'enabled' || instance.lifecycleState !== 'eligible';
    })
    .flatMap((instance): RhythmRequirement[] => {
      const template = templateById.get(instance.rhythmTemplateId);
      const plan = planById.get(instance.rhythmPlanId);
      const revision = revisionById.get(instance.recurrenceRevisionId);
      if (
        !template ||
        template.archivedAt ||
        !plan ||
        plan.rhythmTemplateId !== instance.rhythmTemplateId ||
        !revision ||
        revision.rhythmPlanId !== plan.id
      ) return [];
      return [{
      id: instance.id,
      templateId: template.id,
      planId: plan.id,
      recurrenceRevisionId: revision.id,
      rhythmInstanceId: instance.id,
      title: template.title,
      area: template.area,
      frequency: 1,
      period: revision.rule.period,
      preferredDays: [...revision.rule.preferredDays],
      preferredTime: instance.preferredTime,
      maxPerDay: revision.rule.maxPerDay,
      eligibilityStartDate: instance.eligibilityStartDate,
      eligibilityEndDate: instance.eligibilityEndDate,
      lifecycleState: instance.lifecycleState as 'eligible' | 'today' | 'inProgress' | 'paused',
      variants: [
        { kind: 'minimum', ...instance.minimum },
        { kind: 'normal', ...instance.normal },
        { kind: 'full', ...instance.full },
      ],
      sourceRecords: [
        { kind: 'rhythmTemplate' as const, id: template.id },
        { kind: 'rhythmPlan' as const, id: plan.id },
        { kind: 'rhythmRecurrenceRevision' as const, id: revision.id },
        { kind: 'rhythmInstance' as const, id: instance.id },
      ],
    }];
    })
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
    intentions: projectIntentions(
      state.activeTasks,
      state.taskPoolItems,
      state.durationLearningByTemplateId,
    ),
    rhythms: projectRhythms(
      state.rhythmTemplates,
      state.rhythmPlans,
      state.rhythmRecurrenceRevisions,
      state.rhythmInstances,
      state.durationLearningByTemplateId,
    ),
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
