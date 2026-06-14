import { Card } from '../components';
import { PlanBlock } from '../features/plan/PlanBlock';
import { mockPlanBlocks, planRoomMessage } from '../features/plan/mockPlanData';

export function PlanScreen() {
  return (
    <div className="screen-stack plan-screen">
      <section className="plan-hero" aria-labelledby="plan-title">
        <p className="eyebrow">Soft rhythm scaffold</p>
        <h1 id="plan-title">Plan</h1>
        <p>Plan the shape of your day, not every minute.</p>
      </section>
      <Card>
        <div className="plan-room-message">
          <div>
            <h2>{planRoomMessage.label}</h2>
            <p>{planRoomMessage.body}</p>
          </div>
          <span>Power underneath. Calm on the surface.</span>
        </div>
      </Card>
      <div className="plan-blocks" aria-label="Broad day blocks">
        {mockPlanBlocks.map((block) => (
          <PlanBlock block={block} key={block.id} />
        ))}
      </div>
    </div>
  );
}
