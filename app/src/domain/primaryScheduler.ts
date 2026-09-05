import { SchedulerReviewGuardScheduler } from './schedulerReviewGuards';

export type PrimarySchedulerStatus = 'gate5-primary-review-guards';
export const primarySchedulerStatus: PrimarySchedulerStatus = 'gate5-primary-review-guards';

/**
 * Canonical scheduler entry point for current MVP work.
 *
 * Gate 5 keeps Gate 4 rolling repair and schedule inertia, adds Reduced Day
 * right-sizing, and applies cross-gate safety guards for elapsed repair time,
 * rolling weekly rhythm frequency, and explicit Reduced Day rhythm opt-in.
 * New application/domain integration should use this export rather than a
 * compatibility scheduler from an earlier gate.
 */
export const scheduler = new SchedulerReviewGuardScheduler();

export { SchedulerReviewGuardScheduler } from './schedulerReviewGuards';
export { Gate5ReducedDayScheduler } from './gate5ReducedDay';
export { RollingRepairScheduler } from './rollingRepair';
export { DeterministicScheduler } from './scheduler';
export type { SchedulerEngine } from './scheduler';
