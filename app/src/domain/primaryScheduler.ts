import { Gate5ReducedDayScheduler } from './gate5ReducedDay';

export type PrimarySchedulerStatus = 'gate5-primary-reduced-day';
export const primarySchedulerStatus: PrimarySchedulerStatus = 'gate5-primary-reduced-day';

/**
 * Canonical scheduler entry point for current MVP work.
 *
 * Gate 5 keeps Gate 4 rolling repair and schedule inertia, then adds an
 * explicit Reduced Day policy for right-sizing reversible private work. New
 * application/domain integration should use this export rather than a
 * compatibility scheduler from an earlier gate.
 */
export const scheduler = new Gate5ReducedDayScheduler();

export { Gate5ReducedDayScheduler } from './gate5ReducedDay';
export { RollingRepairScheduler } from './rollingRepair';
export { DeterministicScheduler } from './scheduler';
export type { SchedulerEngine } from './scheduler';
