import { RollingRhythmWindowScheduler } from './rollingRhythmWindow';

export type PrimarySchedulerStatus = 'gate5-primary-reduced-day';
export const primarySchedulerStatus: PrimarySchedulerStatus = 'gate5-primary-reduced-day';

/**
 * Canonical scheduler entry point for current MVP work.
 *
 * Gate 5 keeps Gate 4 rolling repair and schedule inertia, adds the explicit
 * Reduced Day policy for right-sizing reversible private work, and applies
 * weekly rhythm frequency across rolling planning windows rather than calendar
 * week boundaries. New application/domain integration should use this export
 * rather than a compatibility scheduler from an earlier gate.
 */
export const scheduler = new RollingRhythmWindowScheduler();

export { RollingRhythmWindowScheduler } from './rollingRhythmWindow';
export { Gate5ReducedDayScheduler } from './gate5ReducedDay';
export { RollingRepairScheduler } from './rollingRepair';
export { DeterministicScheduler } from './scheduler';
export type { SchedulerEngine } from './scheduler';
