import { Button, Card, Chip, EmptyState } from '../components';

export function TodayScreen() {
  return (
    <div className="screen-stack">
      <Card title="Today">
        <p className="lede">Placeholder re-entry surface for the future architecture.</p>
        <div className="chip-row">
          <Chip>No auto-seeded tasks</Chip>
          <Chip>One clear next action later</Chip>
        </div>
      </Card>
      <EmptyState
        action={<Button variant="primary">Add one task later</Button>}
        message="Future work will port Today without flooding it from the rhythm library."
        title="Choose rhythms to turn on"
      />
    </div>
  );
}

