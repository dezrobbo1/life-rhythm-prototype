import type { RhythmTemplate } from '../data/schemas';
import type {
  RhythmInstance,
  RhythmPlan,
  RhythmRecurrenceRevision,
} from '../data/rhythmAuthoritySchemas';

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function addLocalDays(value: string, amount: number) {
  const { year, month, day } = dateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1)
    .toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
}

function weekdayIndex(value: string) {
  const { year, month, day } = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function mondayStart(value: string) {
  return addLocalDays(value, -((weekdayIndex(value) + 6) % 7));
}

function monthEnd(value: string) {
  const { year, month } = dateParts(value);
  const date = new Date(Date.UTC(year, month, 0));
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1)
    .toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
}

export function recurrencePeriodIdentity(
  period: 'day' | 'week' | 'month',
  value: string,
) {
  if (period === 'day') return `day:${value}`;
  if (period === 'week') return `week:${mondayStart(value)}`;
  return `month:${value.slice(0, 7)}`;
}

function periodBounds(period: 'day' | 'week' | 'month', value: string) {
  if (period === 'day') return { start: value, end: value };
  if (period === 'week') {
    const start = mondayStart(value);
    return { start, end: addLocalDays(start, 6) };
  }
  return { start: `${value.slice(0, 7)}-01`, end: monthEnd(value) };
}

function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  for (let value = start; value <= end; value = addLocalDays(value, 1)) dates.push(value);
  return dates;
}

function latestDate(values: string[]) {
  const sorted = [...values].sort();
  return sorted[sorted.length - 1];
}

function latestRevisionForDate(
  revisions: readonly RhythmRecurrenceRevision[],
  date: string,
) {
  return [...revisions]
    .filter((revision) => revision.effectiveFromLocalDate <= date)
    .sort((left, right) =>
      right.effectiveFromLocalDate.localeCompare(left.effectiveFromLocalDate) ||
      right.revisionNumber - left.revisionNumber,
    )[0];
}

function nextRevisionDate(
  revisions: readonly RhythmRecurrenceRevision[],
  revision: RhythmRecurrenceRevision,
) {
  return revisions
    .filter((candidate) => candidate.effectiveFromLocalDate > revision.effectiveFromLocalDate)
    .sort((left, right) => left.effectiveFromLocalDate.localeCompare(right.effectiveFromLocalDate))[0]
    ?.effectiveFromLocalDate;
}

export type GenerateRhythmInstancesInput = {
  plan: RhythmPlan;
  template: RhythmTemplate;
  revisions: RhythmRecurrenceRevision[];
  existing: RhythmInstance[];
  horizonStartDate: string;
  horizonEndDate: string;
  createdAt: string;
};

/**
 * Deterministic flexible-quota generation. The horizon controls which periods
 * are opened, while each occurrence retains the full remaining local period as
 * its eligibility window. Existing slot keys are never rewritten or reused.
 */
export function buildMissingRhythmInstances(
  input: GenerateRhythmInstancesInput,
): RhythmInstance[] {
  if (input.plan.state !== 'enabled') return [];
  if (input.horizonEndDate < input.horizonStartDate) return [];

  const revisions = [...input.revisions]
    .filter((revision) => revision.rhythmPlanId === input.plan.id)
    .sort((left, right) =>
      left.effectiveFromLocalDate.localeCompare(right.effectiveFromLocalDate) ||
      left.revisionNumber - right.revisionNumber,
    );
  if (revisions.length === 0) return [];

  const periodStarts = new Map<string, { period: 'day' | 'week' | 'month'; date: string }>();
  for (const date of datesBetween(input.horizonStartDate, input.horizonEndDate)) {
    const revision = latestRevisionForDate(revisions, date);
    if (!revision || date < input.plan.initialEffectiveFromLocalDate) continue;
    const identity = recurrencePeriodIdentity(revision.rule.period, date);
    periodStarts.set(identity, { period: revision.rule.period, date });
  }

  const existingKeys = new Set(input.existing.map((instance) => instance.deduplicationKey));
  const generated: RhythmInstance[] = [];

  for (const [periodKey, identity] of [...periodStarts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const bounds = periodBounds(identity.period, identity.date);
    const alreadyInPeriod = input.existing.filter((instance) =>
      instance.rhythmPlanId === input.plan.id && instance.periodKey === periodKey,
    );
    const usedSlots = new Set(alreadyInPeriod.map((instance) => instance.slotNumber));
    let generatedCount = 0;

    const segmentScanEnd = bounds.end < input.horizonEndDate ? bounds.end : input.horizonEndDate;
    const segmentDates = datesBetween(
      latestDate([bounds.start, input.horizonStartDate, input.plan.initialEffectiveFromLocalDate]),
      segmentScanEnd,
    );
    const segmentRevisionIds: string[] = [];
    for (const date of segmentDates) {
      const revision = latestRevisionForDate(revisions, date);
      if (revision && !segmentRevisionIds.includes(revision.id)) segmentRevisionIds.push(revision.id);
    }

    for (const revisionId of segmentRevisionIds) {
      const revision = revisions.find((candidate) => candidate.id === revisionId)!;
      const nextEffective = nextRevisionDate(revisions, revision);
      const eligibilityStartDate = latestDate([
        bounds.start,
        input.horizonStartDate,
        input.plan.initialEffectiveFromLocalDate,
        revision.effectiveFromLocalDate,
      ]);
      const eligibilityEndDate = nextEffective && nextEffective <= bounds.end
        ? addLocalDays(nextEffective, -1)
        : bounds.end;
      if (eligibilityStartDate > eligibilityEndDate) continue;

      const existingOrGenerated = alreadyInPeriod.length + generatedCount;
      // The first generated window fixes this period's feasible entitlement.
      // A moving horizon must not turn yesterday's unused quota into debt.
      const observedStart = alreadyInPeriod.length > 0
        ? alreadyInPeriod.reduce((earliest, instance) =>
          instance.eligibilityStartDate < earliest ? instance.eligibilityStartDate : earliest,
        alreadyInPeriod[0].eligibilityStartDate)
        : input.horizonStartDate;
      const capacityStart = latestDate([
        bounds.start, observedStart, input.plan.initialEffectiveFromLocalDate,
        revision.effectiveFromLocalDate,
      ]);
      const capacityDates = capacityStart <= eligibilityEndDate
        ? datesBetween(capacityStart, eligibilityEndDate).length
        : 0;
      // Earlier-revision slots already count toward the new frequency, but
      // do not use up the days newly available after this prospective edit.
      const priorRevisionCount = alreadyInPeriod.filter((instance) =>
        instance.recurrenceSnapshot.effectiveFromLocalDate < revision.effectiveFromLocalDate,
      ).length;
      const feasibleTotal = Math.min(
        revision.rule.frequency,
        priorRevisionCount + capacityDates * revision.rule.maxPerDay,
      );
      const feasibleSlots = Math.max(0, feasibleTotal - existingOrGenerated);

      for (let count = 0; count < feasibleSlots; count += 1) {
        let slotNumber = 1;
        while (usedSlots.has(slotNumber)) slotNumber += 1;
        usedSlots.add(slotNumber);
        const occurrenceKey = `${periodKey}#${slotNumber}`;
        const deduplicationKey = `${input.plan.id}:${occurrenceKey}`;
        if (existingKeys.has(deduplicationKey)) continue;
        existingKeys.add(deduplicationKey);
        const id = `rhythm-instance:${encodeURIComponent(input.plan.id)}:${encodeURIComponent(occurrenceKey)}`;

        generated.push({
          id,
          rhythmTemplateId: input.template.id,
          rhythmPlanId: input.plan.id,
          recurrenceRevisionId: revision.id,
          occurrenceKey,
          deduplicationKey,
          periodKey,
          slotNumber,
          eligibilityStartDate,
          eligibilityEndDate,
          minimum: { ...input.template.minimum },
          normal: { ...input.template.normal },
          full: { ...input.template.full },
          recurrenceSnapshot: {
            revisionNumber: revision.revisionNumber,
            effectiveFromLocalDate: revision.effectiveFromLocalDate,
            frequency: revision.rule.frequency,
            period: revision.rule.period,
            preferredDays: [...revision.rule.preferredDays],
            maxPerDay: revision.rule.maxPerDay,
            timezone: revision.timezone,
          },
          preferredTime: input.plan.preferredTime,
          lifecycleState: 'eligible',
          completionState: 'notStarted',
          planningState: 'unscheduled',
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        });
        generatedCount += 1;
      }
    }
  }

  return generated.sort((left, right) => left.deduplicationKey.localeCompare(right.deduplicationKey));
}
