import { RollingRepairScheduler } from './rollingRepair';

export type PrimarySchedulerStatus = 'gate4-primary-rolling-repair';
export const primarySchedulerStatus: PrimarySchedulerStatus = 'gate4-primary-rolling-repair';

/**
 * Canonical scheduler entry point for current MVP work.
 *
 * New application/domain integration should use this export rather than the
 * Gate 3 compatibility singleton from scheduler.ts so repairPlan follows the
 * rolling-repair and schedule-inertia path.
 */
export const scheduler = new RollingRepairScheduler();

export { RollingRepairScheduler } from './rollingRepair';
export { DeterministicScheduler } from './scheduler';
export type { SchedulerEngine } from './scheduler';
