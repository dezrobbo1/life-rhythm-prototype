import { Card, Chip, EmptyState } from '../components';

export function PlanScreen() {
  return (
    <div className="screen-stack">
      <Card title="Plan">
        <p className="lede">Soft rhythm scaffold placeholder. No scheduler details are exposed here.</p>
        <div className="chip-row">
          <Chip>Fixed commitments later</Chip>
          <Chip>Hidden edges later</Chip>
        </div>
      </Card>
      <EmptyState
        message="The full scheduler will be ported in a later phase after the data layer is designed."
        title="Plan shell only"
      />
    </div>
  );
}

