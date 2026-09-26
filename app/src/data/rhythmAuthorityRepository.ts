import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  rhythmInstanceSchema,
  rhythmLocalDateSchema,
  rhythmPlanSchema,
  rhythmPlanStateSchema,
  rhythmRecurrenceRevisionSchema,
  rhythmRecurrenceRuleSchema,
  type RhythmInstance,
  type RhythmPlan,
  type RhythmPlanState,
  type RhythmRecurrenceRevision,
} from './rhythmAuthoritySchemas';
import { rhythmTemplateSchema, type RhythmTemplate } from './schemas';
import { markRhythmInputRepairPending } from './schedulerPlanStateRepository';
import { buildMissingRhythmInstances } from '../domain/rhythmRecurrence';

function messages(label: string, issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => `${label}${issue.path.length ? `.${issue.path.join('.')}` : ''}: ${issue.message}`);
}

export type RhythmAuthorityReadResult =
  | {
      status: 'ok';
      templates: RhythmTemplate[];
      plans: RhythmPlan[];
      revisions: RhythmRecurrenceRevision[];
      instances: RhythmInstance[];
    }
  | { status: 'invalid' | 'readFailed'; errors: string[] };

export function validateRhythmAuthorityRelationships(
  templates: RhythmTemplate[],
  plans: RhythmPlan[],
  revisions: RhythmRecurrenceRevision[],
  instances: RhythmInstance[],
) {
  const errors: string[] = [];
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));
  const seenTemplates = new Set<string>();
  const seenRevisionNumbers = new Set<string>();
  const seenDeduplicationKeys = new Set<string>();

  for (const plan of plans) {
    if (seenTemplates.has(plan.rhythmTemplateId)) {
      errors.push(`rhythmPlans: More than one plan owns template ${plan.rhythmTemplateId}.`);
    }
    seenTemplates.add(plan.rhythmTemplateId);
    if (!templateById.has(plan.rhythmTemplateId)) {
      errors.push(`rhythmPlans.${plan.id}: Referenced template is missing.`);
    }
    const latest = revisionById.get(plan.latestRecurrenceRevisionId);
    if (!latest || latest.rhythmPlanId !== plan.id) {
      errors.push(`rhythmPlans.${plan.id}: Latest recurrence revision is missing or belongs to another plan.`);
    }
    const planRevisions = revisions
      .filter((revision) => revision.rhythmPlanId === plan.id)
      .sort((left, right) => left.revisionNumber - right.revisionNumber);
    if (planRevisions.length > 0) {
      const first = planRevisions[0];
      const highest = planRevisions[planRevisions.length - 1];
      if (first.revisionNumber !== 1 || first.effectiveFromLocalDate !== plan.initialEffectiveFromLocalDate) {
        errors.push(`rhythmPlans.${plan.id}: Initial recurrence revision does not match the plan start.`);
      }
      if (highest.id !== plan.latestRecurrenceRevisionId || highest.timezone !== plan.timezone) {
        errors.push(`rhythmPlans.${plan.id}: Latest recurrence revision or timezone is inconsistent.`);
      }
      planRevisions.forEach((revision, index) => {
        if (revision.revisionNumber !== index + 1) {
          errors.push(`rhythmRecurrenceRevisions.${revision.id}: Revision sequence is not contiguous.`);
        }
        if (index > 0 && revision.effectiveFromLocalDate < planRevisions[index - 1].effectiveFromLocalDate) {
          errors.push(`rhythmRecurrenceRevisions.${revision.id}: Effective date moves backwards.`);
        }
      });
    }
  }

  for (const revision of revisions) {
    const key = `${revision.rhythmPlanId}:${revision.revisionNumber}`;
    if (seenRevisionNumbers.has(key)) {
      errors.push(`rhythmRecurrenceRevisions: Duplicate revision ${key}.`);
    }
    seenRevisionNumbers.add(key);
    if (!planById.has(revision.rhythmPlanId)) {
      errors.push(`rhythmRecurrenceRevisions.${revision.id}: Referenced plan is missing.`);
    }
  }

  for (const instance of instances) {
    if (seenDeduplicationKeys.has(instance.deduplicationKey)) {
      errors.push(`rhythmInstances: Duplicate occurrence ${instance.deduplicationKey}.`);
    }
    seenDeduplicationKeys.add(instance.deduplicationKey);
    const plan = planById.get(instance.rhythmPlanId);
    const revision = revisionById.get(instance.recurrenceRevisionId);
    if (!plan || plan.rhythmTemplateId !== instance.rhythmTemplateId) {
      errors.push(`rhythmInstances.${instance.id}: Plan/template identity is inconsistent.`);
    }
    if (!revision || revision.rhythmPlanId !== instance.rhythmPlanId) {
      errors.push(`rhythmInstances.${instance.id}: Recurrence revision identity is inconsistent.`);
    }
    if (plan && revision) {
      const expectedOccurrenceKey = `${instance.periodKey}#${instance.slotNumber}`;
      const expectedDeduplicationKey = `${plan.id}:${expectedOccurrenceKey}`;
      const expectedId = `rhythm-instance:${encodeURIComponent(plan.id)}:${encodeURIComponent(expectedOccurrenceKey)}`;
      if (
        instance.occurrenceKey !== expectedOccurrenceKey ||
        instance.deduplicationKey !== expectedDeduplicationKey ||
        instance.id !== expectedId
      ) {
        errors.push(`rhythmInstances.${instance.id}: Stable occurrence identity is inconsistent.`);
      }
      const expectedSnapshot = {
        revisionNumber: revision.revisionNumber,
        effectiveFromLocalDate: revision.effectiveFromLocalDate,
        frequency: revision.rule.frequency,
        period: revision.rule.period,
        preferredDays: revision.rule.preferredDays,
        maxPerDay: revision.rule.maxPerDay,
        timezone: revision.timezone,
      };
      if (JSON.stringify(instance.recurrenceSnapshot) !== JSON.stringify(expectedSnapshot)) {
        errors.push(`rhythmInstances.${instance.id}: Recurrence snapshot does not match its revision.`);
      }
    }
  }
  return errors;
}

export async function loadRhythmAuthorityResult(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<RhythmAuthorityReadResult> {
  try {
    const [templateRows, planRows, revisionRows, instanceRows] = await Promise.all([
      database.rhythmTemplates.toArray(),
      database.rhythmPlans.toArray(),
      database.rhythmRecurrenceRevisions.toArray(),
      database.rhythmInstances.toArray(),
    ]);
    const templates = rhythmTemplateSchema.array().safeParse(templateRows);
    const plans = rhythmPlanSchema.array().safeParse(planRows);
    const revisions = rhythmRecurrenceRevisionSchema.array().safeParse(revisionRows);
    const instances = rhythmInstanceSchema.array().safeParse(instanceRows);
    const errors = [
      ...(templates.success ? [] : messages('rhythmTemplates', templates.error.issues)),
      ...(plans.success ? [] : messages('rhythmPlans', plans.error.issues)),
      ...(revisions.success ? [] : messages('rhythmRecurrenceRevisions', revisions.error.issues)),
      ...(instances.success ? [] : messages('rhythmInstances', instances.error.issues)),
    ];
    if (!templates.success || !plans.success || !revisions.success || !instances.success) {
      return { status: 'invalid', errors };
    }
    errors.push(...validateRhythmAuthorityRelationships(templates.data, plans.data, revisions.data, instances.data));
    return errors.length > 0
      ? { status: 'invalid', errors }
      : {
          status: 'ok',
          templates: templates.data,
          plans: plans.data,
          revisions: revisions.data,
          instances: instances.data,
        };
  } catch {
    return { status: 'readFailed', errors: ['rhythms: Saved rhythm authority could not be read.'] };
  }
}

export type SaveRhythmConfigurationInput = {
  template: RhythmTemplate;
  state: RhythmPlanState;
  frequency: number;
  period: 'day' | 'week' | 'month';
  preferredDays: RhythmTemplate['schedule']['preferredDays'];
  preferredTime: RhythmTemplate['schedule']['bestTime'];
  maxPerDay: number;
  timezone: string;
  effectiveFromLocalDate: string;
  now?: string;
};

export type RhythmMutationResult =
  | { ok: true; template: RhythmTemplate; plan: RhythmPlan; revision: RhythmRecurrenceRevision }
  | { ok: false; errors: string[] };

function sameRecurrenceRule(
  revision: RhythmRecurrenceRevision,
  input: SaveRhythmConfigurationInput,
) {
  return revision.timezone === input.timezone &&
    JSON.stringify(revision.rule) === JSON.stringify({
      frequency: input.frequency,
      period: input.period,
      preferredDays: input.preferredDays,
      maxPerDay: input.maxPerDay,
    });
}

function localDateAt(instant: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(instant));
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  } catch {
    return null;
  }
}

export async function saveRhythmConfiguration(
  input: SaveRhythmConfigurationInput,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<RhythmMutationResult> {
  const timestamp = input.now ?? new Date().toISOString();
  const template = rhythmTemplateSchema.safeParse({
    ...input.template,
    enabled: false,
    schedule: {
      ...input.template.schedule,
      frequency: input.frequency,
      period: input.period,
      preferredDays: input.preferredDays,
      bestTime: input.preferredTime,
      maxPerDay: input.maxPerDay,
      catchupAllowed: false,
    },
    updatedAt: timestamp,
  });
  const state = rhythmPlanStateSchema.safeParse(input.state);
  const rule = rhythmRecurrenceRuleSchema.safeParse({
    frequency: input.frequency,
    period: input.period,
    preferredDays: input.preferredDays,
    maxPerDay: input.maxPerDay,
  });
  const date = rhythmLocalDateSchema.safeParse(input.effectiveFromLocalDate);
  if (!template.success || !state.success || !rule.success || !date.success) {
    return {
      ok: false,
      errors: [
        ...(template.success ? [] : messages('template', template.error.issues)),
        ...(state.success ? [] : ['state: Expected enabled, paused, or disabled.']),
        ...(rule.success ? [] : messages('recurrence', rule.error.issues)),
        ...(date.success ? [] : ['effectiveFromLocalDate: Expected YYYY-MM-DD.']),
      ],
    };
  }
  const today = localDateAt(timestamp, input.timezone);
  if (!today || input.effectiveFromLocalDate < today) {
    return { ok: false, errors: ['effectiveFromLocalDate: Recurrence changes must take effect today or later.'] };
  }

  try {
    return await database.transaction(
      'rw',
      [
        database.rhythmTemplates,
        database.rhythmPlans,
        database.rhythmRecurrenceRevisions,
        database.rhythmInstances,
        database.schedulerPlanState,
      ],
      async () => {
        const existingTemplates = rhythmTemplateSchema.array().safeParse(
          (await database.rhythmTemplates.toArray()).filter((row) => row.id !== template.data.id),
        );
        const allPlans = rhythmPlanSchema.array().safeParse(await database.rhythmPlans.toArray());
        const allRevisions = rhythmRecurrenceRevisionSchema.array().safeParse(
          await database.rhythmRecurrenceRevisions.toArray(),
        );
        const allInstances = rhythmInstanceSchema.array().safeParse(await database.rhythmInstances.toArray());
        if (!existingTemplates.success || !allPlans.success || !allRevisions.success || !allInstances.success) {
          return { ok: false as const, errors: ['Saved rhythm authority is malformed. No change was made.'] };
        }
        const planId = `rhythm-plan:${template.data.id}`;
        const matchingPlans = allPlans.data.filter((plan) => plan.rhythmTemplateId === template.data.id);
        if (matchingPlans.length > 1) {
          return { ok: false as const, errors: ['More than one saved plan owns this rhythm. No change was made.'] };
        }
        const existingPlanRow = matchingPlans[0];
        const existingPlan = existingPlanRow ? rhythmPlanSchema.safeParse(existingPlanRow) : null;
        if (existingPlan && !existingPlan.success) {
          return { ok: false as const, errors: ['plan: Saved rhythm plan is malformed. No change was made.'] };
        }
        const planIdentity = existingPlan?.success ? existingPlan.data.id : planId;
        const validRevisions = allRevisions.data.filter((revision) => revision.rhythmPlanId === planIdentity);
        const latest = validRevisions.sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
        const reusesLatestRevision = Boolean(latest && sameRecurrenceRule(latest, input));
        if (latest && !reusesLatestRevision && input.effectiveFromLocalDate < latest.effectiveFromLocalDate) {
          return { ok: false as const, errors: ['effectiveFromLocalDate: A new recurrence revision cannot take effect before the latest saved revision.'] };
        }
        const revisionNumber = reusesLatestRevision
          ? latest.revisionNumber
          : (latest?.revisionNumber ?? 0) + 1;
        const revisionId = reusesLatestRevision
          ? latest.id
          : `rhythm-revision:${encodeURIComponent(planIdentity)}:${revisionNumber}`;
        const revision = rhythmRecurrenceRevisionSchema.parse({
          id: revisionId,
          rhythmPlanId: planIdentity,
          revisionNumber,
          effectiveFromLocalDate: reusesLatestRevision
            ? latest.effectiveFromLocalDate
            : input.effectiveFromLocalDate,
          timezone: input.timezone,
          rule: rule.data,
          createdAt: reusesLatestRevision ? latest.createdAt : timestamp,
        });
        const plan = rhythmPlanSchema.parse({
          id: planIdentity,
          rhythmTemplateId: template.data.id,
          state: state.data,
          latestRecurrenceRevisionId: revision.id,
          initialEffectiveFromLocalDate: existingPlan?.success
            ? existingPlan.data.initialEffectiveFromLocalDate
            : input.effectiveFromLocalDate,
          preferredTime: input.preferredTime,
          timezone: input.timezone,
          missedOccurrencePolicy: 'skip',
          planningMode: 'automaticPrivate',
          createdAt: existingPlan?.success ? existingPlan.data.createdAt : timestamp,
          updatedAt: timestamp,
          ...(state.data === 'paused' ? { pausedAt: timestamp } : {}),
        });

        const candidatePlans = [...allPlans.data.filter((item) => item.id !== plan.id), plan];
        const candidateRevisions = [
          ...allRevisions.data.filter((item) => item.id !== revision.id),
          revision,
        ];
        const relationshipErrors = validateRhythmAuthorityRelationships(
          [...existingTemplates.data, template.data],
          candidatePlans,
          candidateRevisions,
          allInstances.data,
        );
        if (relationshipErrors.length > 0) {
          return { ok: false as const, errors: relationshipErrors };
        }

        await database.rhythmTemplates.put(template.data);
        await database.rhythmRecurrenceRevisions.put(revision);
        await database.rhythmPlans.put(plan);
        const marked = await markRhythmInputRepairPending(database, `template:${template.data.id}`, timestamp);
        if (!marked.ok) throw new Error(marked.errors.join(' '));
        return { ok: true as const, template: template.data, plan, revision };
      },
    );
  } catch {
    return { ok: false, errors: ['Rhythm configuration was not saved. Existing data remain unchanged.'] };
  }
}

export async function setRhythmPlanState(
  templateId: string,
  nextState: RhythmPlanState,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  now = new Date().toISOString(),
): Promise<{ ok: true; plan: RhythmPlan } | { ok: false; errors: string[] }> {
  const parsedState = rhythmPlanStateSchema.safeParse(nextState);
  if (!parsedState.success) return { ok: false, errors: ['state: Invalid rhythm state.'] };
  try {
    return await database.transaction('rw', database.rhythmPlans, database.schedulerPlanState, async () => {
      const row = await database.rhythmPlans.where('rhythmTemplateId').equals(templateId).first();
      const parsed = rhythmPlanSchema.safeParse(row);
      if (!parsed.success) return { ok: false as const, errors: ['Configure this rhythm before changing its state.'] };
      const plan = rhythmPlanSchema.parse({
        ...parsed.data,
        state: parsedState.data,
        updatedAt: now,
        ...(parsedState.data === 'paused' ? { pausedAt: now } : { pausedAt: undefined }),
      });
      await database.rhythmPlans.put(plan);
      const marked = await markRhythmInputRepairPending(database, `template:${templateId}`, now);
      if (!marked.ok) throw new Error(marked.errors.join(' '));
      return { ok: true as const, plan };
    });
  } catch {
    return { ok: false, errors: ['Rhythm state was not saved. Existing data remain unchanged.'] };
  }
}

export async function generateRhythmInstancesForHorizon(
  horizonStartDate: string,
  horizonEndDate: string,
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
  now = new Date().toISOString(),
): Promise<{ ok: true; created: RhythmInstance[] } | { ok: false; errors: string[] }> {
  try {
    return await database.transaction(
      'rw',
      [
        database.rhythmTemplates,
        database.rhythmPlans,
        database.rhythmRecurrenceRevisions,
        database.rhythmInstances,
        database.schedulerPlanState,
      ],
      async () => {
        const [templates, plans, revisions, existing] = await Promise.all([
          database.rhythmTemplates.toArray(), database.rhythmPlans.toArray(),
          database.rhythmRecurrenceRevisions.toArray(), database.rhythmInstances.toArray(),
        ]);
        const parsedTemplates = rhythmTemplateSchema.array().safeParse(templates);
        const parsedPlans = rhythmPlanSchema.array().safeParse(plans);
        const parsedRevisions = rhythmRecurrenceRevisionSchema.array().safeParse(revisions);
        const parsedExisting = rhythmInstanceSchema.array().safeParse(existing);
        if (!parsedTemplates.success || !parsedPlans.success || !parsedRevisions.success || !parsedExisting.success) {
          return { ok: false as const, errors: ['Saved rhythm authority is malformed. No occurrences were generated.'] };
        }
        const relationshipErrors = validateRhythmAuthorityRelationships(
          parsedTemplates.data, parsedPlans.data, parsedRevisions.data, parsedExisting.data,
        );
        if (relationshipErrors.length > 0) return { ok: false as const, errors: relationshipErrors };
        const templateById = new Map(parsedTemplates.data.map((template) => [template.id, template]));
        const created: RhythmInstance[] = [];
        for (const plan of parsedPlans.data.filter((candidate) => candidate.state === 'enabled')) {
          const template = templateById.get(plan.rhythmTemplateId);
          if (!template || template.archivedAt) continue;
          const missing = buildMissingRhythmInstances({
            plan,
            template,
            revisions: parsedRevisions.data.filter((revision) => revision.rhythmPlanId === plan.id),
            existing: [...parsedExisting.data, ...created],
            horizonStartDate,
            horizonEndDate,
            createdAt: now,
          }).map((instance) => rhythmInstanceSchema.parse(instance));
          created.push(...missing);
        }
        if (created.length > 0) {
          await database.rhythmInstances.bulkPut(created);
          for (const templateId of [...new Set(created.map((instance) => instance.rhythmTemplateId))]) {
            const marked = await markRhythmInputRepairPending(database, `template:${templateId}`, now);
            if (!marked.ok) throw new Error(marked.errors.join(' '));
          }
        }
        return { ok: true as const, created };
      },
    );
  } catch {
    return { ok: false, errors: ['Rhythm occurrences could not be generated safely.'] };
  }
}
