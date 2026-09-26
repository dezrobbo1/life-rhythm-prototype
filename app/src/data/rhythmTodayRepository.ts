import type { SchedulerPlan } from '../domain/schedulingModel';
import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import { rhythmInstanceSchema } from './rhythmAuthoritySchemas';
import { activeTaskSchema, rhythmTemplateSchema, type ActiveTask } from './schemas';
import { appendBehaviourEvent, createBehaviourEvent } from './behaviourEventRepository';
import { markRhythmInputRepairPending, markTaskInputRepairPending } from './schedulerPlanStateRepository';
import { loadRhythmAuthorityResult } from './rhythmAuthorityRepository';

export function activeTaskIdForRhythmInstance(instanceId: string) {
  return `rhythm-task:${encodeURIComponent(instanceId)}`;
}

function taskFromRhythmInstance(
  instance: ReturnType<typeof rhythmInstanceSchema.parse>,
  template: ReturnType<typeof rhythmTemplateSchema.parse>,
  now: string,
  plannedVariantKind: 'minimum' | 'normal' | 'full' = 'normal',
) {
  return activeTaskSchema.parse({
    id: instance.activeTaskId ?? activeTaskIdForRhythmInstance(instance.id),
    templateId: instance.rhythmTemplateId,
    sourceRhythmInstanceId: instance.id,
    plannedVariantKind,
    source: 'library',
    title: template.title,
    area: template.area,
    taskType: template.taskType,
    kind: 'repeating',
    completionStyle: template.completionStyle,
    priority: template.priority,
    energy: template.energy,
    startBarrier: template.startBarrier,
    purpose: template.purpose,
    minimum: instance.minimum,
    normal: instance.normal,
    full: instance.full,
    fallback: template.fallback,
    schedule: { ...template.schedule, catchupAllowed: false },
    showToday: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

export async function syncScheduledRhythmOccurrencesToToday(
  plan: SchedulerPlan,
  localDate: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  now = new Date().toISOString(),
): Promise<{ ok: true; tasks: ActiveTask[]; mutated: boolean } | { ok: false; errors: string[] }> {
  const placements = plan.placements.filter((placement) =>
    placement.targetKind === 'rhythm' && placement.rhythmInstanceId && placement.date === localDate,
  );
  try {
    return await database.transaction(
      'rw',
      [
        database.rhythmPlans,
        database.rhythmRecurrenceRevisions,
        database.rhythmInstances,
        database.rhythmTemplates,
        database.activeTasks,
        database.schedulerPlanState,
      ],
      async () => {
        const authority = await loadRhythmAuthorityResult(database);
        if (authority.status !== 'ok') throw new Error(authority.errors.join(' '));
        const tasks: ActiveTask[] = [];
        let mutated = false;
        const seenInstanceIds = new Set<string>();
        for (const placement of placements) {
          if (seenInstanceIds.has(placement.rhythmInstanceId!)) {
            throw new Error(`Occurrence ${placement.rhythmInstanceId} has duplicate Today placements.`);
          }
          seenInstanceIds.add(placement.rhythmInstanceId!);
          const parsedInstance = rhythmInstanceSchema.safeParse(
            await database.rhythmInstances.get(placement.rhythmInstanceId!),
          );
          if (!parsedInstance.success) {
            throw new Error(`Occurrence ${placement.rhythmInstanceId} could not be read safely.`);
          }
          const instance = parsedInstance.data;
          if (instance.lifecycleState === 'closed') continue;
          if (
            placement.rhythmTemplateId !== instance.rhythmTemplateId ||
            placement.rhythmPlanId !== instance.rhythmPlanId ||
            placement.rhythmRecurrenceRevisionId !== instance.recurrenceRevisionId
          ) {
            throw new Error(`Placement ${placement.id} has inconsistent rhythm identity.`);
          }
          const parsedTemplate = rhythmTemplateSchema.safeParse(
            await database.rhythmTemplates.get(instance.rhythmTemplateId),
          );
          if (!parsedTemplate.success) {
            throw new Error(`Rhythm ${instance.rhythmTemplateId} could not be read safely.`);
          }
          const taskId = instance.activeTaskId ?? activeTaskIdForRhythmInstance(instance.id);
          const existingRow = await database.activeTasks.get(taskId);
          const existing = existingRow ? activeTaskSchema.safeParse(existingRow) : null;
          if (existing && (!existing.success || existing.data.sourceRhythmInstanceId !== instance.id)) {
            throw new Error(`Today identity ${taskId} belongs to different saved work.`);
          }
          const task = existing?.success
            ? existing.data
            : taskFromRhythmInstance(
                instance,
                parsedTemplate.data,
                now,
                placement.variantKind ?? 'normal',
              );
          const routingChanged = !existing?.success ||
            instance.lifecycleState === 'eligible' ||
            instance.planningState !== 'today' ||
            instance.activeTaskId !== task.id ||
            instance.placementId !== placement.id;
          const nextInstance = rhythmInstanceSchema.parse({
            ...instance,
            lifecycleState: instance.lifecycleState === 'eligible' ? 'today' : instance.lifecycleState,
            planningState: 'today',
            activeTaskId: task.id,
            placementId: placement.id,
            updatedAt: now,
          });
          if (!existing?.success) await database.activeTasks.put(task);
          if (routingChanged) {
            await database.rhythmInstances.put(nextInstance);
            const marked = await markRhythmInputRepairPending(database, `instance:${instance.id}`, now);
            if (!marked.ok) throw new Error(marked.errors.join(' '));
            mutated = true;
          }
          tasks.push(task);
        }
        return { ok: true as const, tasks, mutated };
      },
    );
  } catch {
    return { ok: false, errors: ['Scheduled rhythm occurrences could not be prepared for Today.'] };
  }
}

export async function addRhythmToTodayOnce(
  templateId: string,
  localDate: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  now = new Date().toISOString(),
): Promise<
  | { ok: true; task: ActiveTask; reusedGeneratedOccurrence: boolean; alreadyExists: boolean }
  | { ok: false; errors: string[] }
> {
  try {
    return await database.transaction(
      'rw',
      [
        database.rhythmTemplates,
        database.rhythmPlans,
        database.rhythmRecurrenceRevisions,
        database.rhythmInstances,
        database.activeTasks,
        database.taskHistory,
        database.schedulerPlanState,
      ],
      async () => {
        const authority = await loadRhythmAuthorityResult(database);
        if (authority.status !== 'ok') {
          return { ok: false as const, errors: authority.errors };
        }
        const configuredTemplate = authority.templates.find((item) => item.id === templateId);
        const confirmedPlan = authority.plans.find((item) => item.rhythmTemplateId === templateId);
        if (!configuredTemplate || !confirmedPlan) {
          return { ok: false as const, errors: ['Configure the rhythm durations before adding it to Today.'] };
        }
        const template = rhythmTemplateSchema.parse(configuredTemplate);
        const liveInstance = authority.instances
          .filter((instance) => instance.rhythmTemplateId === templateId)
          .filter((instance) =>
            instance.lifecycleState !== 'closed' &&
            instance.eligibilityStartDate <= localDate &&
            instance.eligibilityEndDate >= localDate,
          )
          .sort((left, right) => left.slotNumber - right.slotNumber || left.id.localeCompare(right.id))[0];

        if (liveInstance) {
          const taskId = liveInstance.activeTaskId ?? activeTaskIdForRhythmInstance(liveInstance.id);
          const storedTask = await database.activeTasks.get(taskId);
          if (storedTask) {
            const parsedTask = activeTaskSchema.safeParse(storedTask);
            if (!parsedTask.success || parsedTask.data.sourceRhythmInstanceId !== liveInstance.id) {
              return { ok: false as const, errors: ['The matching Today occurrence has conflicting saved identity.'] };
            }
            return {
              ok: true as const,
              task: parsedTask.data,
              reusedGeneratedOccurrence: true,
              alreadyExists: true,
            };
          }
          const task = taskFromRhythmInstance(liveInstance, template, now);
          const instance = rhythmInstanceSchema.parse({
            ...liveInstance,
            lifecycleState: 'today',
            planningState: 'today',
            activeTaskId: task.id,
            updatedAt: now,
          });
          await database.activeTasks.put(task);
          await database.rhythmInstances.put(instance);
          const marked = await markRhythmInputRepairPending(database, `instance:${instance.id}`, now);
          if (!marked.ok) throw new Error(marked.errors.join(' '));
          await appendBehaviourEvent(createBehaviourEvent({
            action: 'addToToday',
            after: { taskStatus: 'active' },
            eventType: 'taskAddedToToday',
            occurredAt: now,
            provenance: { origin: 'userAction', mechanism: 'todayCapture' },
            source: 'user',
            taskId: task.id,
            templateId,
            rhythmInstanceId: instance.id,
          }), database);
          return { ok: true as const, task, reusedGeneratedOccurrence: true, alreadyExists: false };
        }

        const occurrenceKey = `manual:${templateId}:${localDate}`;
        const taskId = `manual-rhythm-task:${encodeURIComponent(templateId)}:${localDate}`;
        const storedTask = await database.activeTasks.get(taskId);
        if (storedTask) {
          const parsedTask = activeTaskSchema.safeParse(storedTask);
          if (!parsedTask.success || parsedTask.data.manualRhythmOccurrenceKey !== occurrenceKey) {
            return { ok: false as const, errors: ['The matching manual Today identity is not safe to reuse.'] };
          }
          return {
            ok: true as const,
            task: parsedTask.data,
            reusedGeneratedOccurrence: false,
            alreadyExists: true,
          };
        }
        const task = activeTaskSchema.parse({
          id: taskId,
          templateId,
          manualRhythmOccurrenceKey: occurrenceKey,
          source: 'library',
          title: template.title,
          area: template.area,
          taskType: template.taskType,
          kind: 'adhoc',
          completionStyle: template.completionStyle,
          priority: template.priority,
          energy: template.energy,
          startBarrier: template.startBarrier,
          purpose: template.purpose,
          minimum: template.minimum,
          normal: template.normal,
          full: template.full,
          fallback: template.fallback,
          schedule: { ...template.schedule, catchupAllowed: false },
          showToday: true,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        await database.activeTasks.put(task);
        const marked = await markTaskInputRepairPending(database, task.id, now);
        if (!marked.ok) throw new Error(marked.errors.join(' '));
        await appendBehaviourEvent(createBehaviourEvent({
          action: 'addToToday',
          after: { taskStatus: 'active' },
          eventType: 'taskAddedToToday',
          occurredAt: now,
          provenance: { origin: 'userAction', mechanism: 'todayCapture' },
          source: 'user',
          taskId: task.id,
          templateId,
        }), database);
        return { ok: true as const, task, reusedGeneratedOccurrence: false, alreadyExists: false };
      },
    );
  } catch {
    return { ok: false, errors: ['The rhythm was not added to Today. Existing data remain unchanged.'] };
  }
}
