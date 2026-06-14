import { Button, Card, Chip, EmptyState } from '../components';

export function LibraryScreen() {
  return (
    <div className="screen-stack">
      <Card title="Library">
        <p className="lede">Rhythm catalogue placeholder. Quick packs will enable rhythms later, not fill Today.</p>
        <div className="chip-row">
          <Chip>Templates inactive by default</Chip>
          <Chip>Add to Today stays explicit</Chip>
        </div>
      </Card>
      <EmptyState
        action={<Button variant="primary">Create rhythm later</Button>}
        message="Template storage and library controls will be implemented after schemas and migrations are approved."
        title="No library data in scaffold"
      />
    </div>
  );
}

