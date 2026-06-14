import { Card, Chip, EmptyState } from '../components';

export function ResetScreen() {
  return (
    <div className="screen-stack">
      <Card title="Reset">
        <p className="lede">Relief-valve placeholder for restart and review flows.</p>
        <div className="chip-row">
          <Chip>No catch-up pile</Chip>
          <Chip>No scoring</Chip>
        </div>
      </Card>
      <EmptyState
        message="Reset actions will hide, move, or shrink later. This scaffold does not alter live data."
        title="Reset tools not ported yet"
      />
    </div>
  );
}

