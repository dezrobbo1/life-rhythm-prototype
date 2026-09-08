import type {
  InternalIntention,
  RhythmRequirement,
  SchedulingDomainModel,
  TaskVariant,
} from './schedulingModel';

export function usableMinimum(variants: TaskVariant[]): TaskVariant | undefined {
  return variants.find((variant) =>
    variant.kind === 'minimum' &&
    Number.isFinite(variant.minutes) && variant.minutes > 0 && variant.label.trim().length > 0,
  );
}

export function reducedDayAppliesToDate(input: SchedulingDomainModel, date: string): boolean {
  const policy = input.planningPolicy;
  return policy?.dayMode === 'reduced' &&
    (!policy.dayModeDate || policy.dayModeDate === date);
}

export function reducedDayUsesMinimum(input: SchedulingDomainModel, date: string): boolean {
  return reducedDayAppliesToDate(input, date) &&
    (input.planningPolicy?.reducedDay?.preferMinimumForFlexibleWork ?? true);
}

export function canUseReducedMinimum(
  intention: InternalIntention,
  input: SchedulingDomainModel,
  date: string,
): TaskVariant | undefined {
  const inFlight = intention.lifecycle.activeTaskStatus === 'inProgress' ||
    intention.lifecycle.activeTaskStatus === 'paused' ||
    intention.lifecycle.activeTaskStatus === 'minimumDone';
  const timeCritical = intention.priority === 'must' ||
    (intention.timing.timeConstraint !== undefined && intention.timing.timeConstraint !== 'flexible') ||
    Boolean(intention.timing.latestUsefulStartAt) || Boolean(intention.timing.notUsefulAfter);
  if (!reducedDayUsesMinimum(input, date) || !intention.eligibleForScheduling || inFlight || timeCritical) {
    return undefined;
  }
  return usableMinimum(intention.variants);
}

export function eligibleRhythmMinimum(
  rhythm: RhythmRequirement,
  input: SchedulingDomainModel,
  date: string,
): TaskVariant | undefined {
  if (!reducedDayUsesMinimum(input, date) ||
      !input.planningPolicy?.reducedDay?.minimumEligibleRhythmIds?.includes(rhythm.id)) return undefined;
  return usableMinimum(rhythm.variants);
}
