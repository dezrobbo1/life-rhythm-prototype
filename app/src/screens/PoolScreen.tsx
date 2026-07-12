import { ScreenHero } from '../components';
import { TaskPoolPanel } from '../features/taskPool/TaskPoolPanel';

type PoolScreenProps = {
  onOpenPlan?: () => void;
};

export function PoolScreen({ onOpenPlan }: PoolScreenProps = {}) {
  return (
    <div className="screen-stack pool-screen">
      <ScreenHero
        className="pool-hero"
        eyebrow="Holding Tray"
        icon="pool"
        tagline="Safely hold tasks here without turning them into immediate demands."
        title="Pool"
        titleId="pool-title"
      />
      <TaskPoolPanel onOpenPlan={onOpenPlan} />
    </div>
  );
}
