import { useEffect } from 'react';
import { maintainCurrentPrivatePlanForTimeDisruption } from '../../data/schedulerTimeDisruption';

const TIME_DISRUPTION_CHECK_INTERVAL_MS = 60_000;

type TimeDisruptionRepairWatcherProps = {
  onPlanChanged?: () => void;
};

export function TimeDisruptionRepairWatcher({
  onPlanChanged,
}: TimeDisruptionRepairWatcherProps) {
  useEffect(() => {
    let active = true;
    let checking = false;

    const check = async () => {
      if (!active || checking) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      checking = true;
      try {
        const result = await maintainCurrentPrivatePlanForTimeDisruption();
        if (active && result.ok && result.action === 'repaired') {
          onPlanChanged?.();
        }
      } catch {
        // Automatic private-plan maintenance is best-effort. User-owned task
        // and calendar state is never rolled back because a background check failed.
      } finally {
        checking = false;
      }
    };

    void check();

    const timer = window.setInterval(() => {
      void check();
    }, TIME_DISRUPTION_CHECK_INTERVAL_MS);
    const handleFocus = () => {
      void check();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onPlanChanged]);

  return null;
}
