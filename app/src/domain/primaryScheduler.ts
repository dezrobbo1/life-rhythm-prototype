import { ClockAwareScheduler } from './clockAwareScheduler';

export type PrimarySchedulerStatus = 'gate5-clock-aware-reduced-day';
export const primarySchedulerStatus: PrimarySchedulerStatus = 'gate5-clock-aware-reduced-day';

/**
 * Canonical scheduler entry point for current MVP work.
 *
 * Gate 5 keeps Gate 4 rolling repair and schedule inertia, adds Reduced Day
 * right-sizing, and now makes every repair that supplies `now` remove elapsed
 * candidate time before private work can be placed again.
 */
export const scheduler = new ClockAwareScheduler();

export { ClockAwareScheduler } from './clockAwareScheduler';
export { Gate5ReducedDayScheduler } from './gate5ReducedDay';
export { RollingRepairScheduler } from './rollingRepair';
export { DeterministicScheduler } from './scheduler';
export type { SchedulerEngine } from './scheduler';
