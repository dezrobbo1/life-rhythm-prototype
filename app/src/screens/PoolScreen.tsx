import { ScreenHero } from '../components';
import { TaskPoolPanel } from '../features/taskPool/TaskPoolPanel';

type PoolScreenProps = {
  captureRevision?: number;
  onOpenPlan?: (taskId: string) => void;
};

export function PoolScreen({ captureRevision, onOpenPlan }: PoolScreenProps = {}) {
  return (
    <div className="screen-stack pool-screen">
      <ScreenHero
        className="pool-hero"
        tagline="Things Life Rhythm is safely remembering without making them immediate demands."
        title="Held"
        titleId="pool-title"
      />
      <TaskPoolPanel captureRevision={captureRevision} onOpenPlan={onOpenPlan} />
    </div>
  );
}
