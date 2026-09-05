import { Gate5ReducedDayScheduler } from './gate5ReducedDay';
import { clipSchedulingInputToNow } from './schedulingClock';
import type {
  SchedulerChange,
  SchedulerPlan,
  SchedulingDomainModel,
} from './schedulingModel';

/**
 * Current scheduler guard that makes rolling repair explicitly aware of the
 * repair clock. Any repair supplied with `now` loses elapsed candidate time
 * before the deterministic scheduler can place private work again.
 */
export class ClockAwareScheduler extends Gate5ReducedDayScheduler {
  repairPlan(currentPlan: SchedulerPlan, change: SchedulerChange): SchedulerPlan {
    if (!change.now) {
      return super.repairPlan(currentPlan, change);
    }

    const nextInput: SchedulingDomainModel = clipSchedulingInputToNow(
      change.nextInput,
      change.now,
    );

    return super.repairPlan(currentPlan, {
      ...change,
      nextInput,
    });
  }
}
