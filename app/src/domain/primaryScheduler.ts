import { RollingHorizonScheduler } from './rollingHorizonScheduler';

export type PrimarySchedulerStatus = 'gate5-clock-aware-rolling-horizon';
export const primarySchedulerStatus: PrimarySchedulerStatus = 'gate5-clock-aware-rolling-horizon';

/**
 * Canonical scheduler entry point for current MVP work.
 *
 * Gate 5 keeps Gate 4 rolling repair and schedule inertia, adds Reduced Day
 * right-sizing, removes elapsed candidate time whenever a repair supplies
 * `now`, and treats weekly rhythm frequency across the rolling horizon rather
 * than granting a full quota to every partial Monday-anchored calendar week.
 */
export const scheduler = new RollingHorizonScheduler();

export { RollingHorizonScheduler } from './rollingHorizonScheduler';
export { ClockAwareScheduler } from './clockAwareScheduler';
export { Gate5ReducedDayScheduler } from './gate5ReducedDay';
export { RollingRepairScheduler } from './rollingRepair';
export { DeterministicScheduler } from './scheduler';
export type { SchedulerEngine } from './scheduler';
