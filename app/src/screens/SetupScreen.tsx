import { Card, Chip, EmptyState } from '../components';

export function SetupScreen() {
  return (
    <div className="screen-stack">
      <Card title="Setup">
        <p className="lede">Local settings placeholder for appearance, data, safety, and app information.</p>
        <div className="chip-row">
          <Chip>Themes change colour only</Chip>
          <Chip>Local-first later</Chip>
        </div>
      </Card>
      <EmptyState
        message="Dexie, Zod, export/import, and migration inspection are stubbed only in this phase."
        title="Setup storage not connected"
      />
    </div>
  );
}

