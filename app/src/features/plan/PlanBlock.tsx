import { useState } from 'react';
import { Button } from '../../components';
import type { PlanBlock as PlanBlockData, PlanItem } from './mockPlanData';

type PlanBlockProps = {
  block: PlanBlockData;
};

export function PlanBlock({ block }: PlanBlockProps) {
  const fixedItems = block.items.filter((item) => item.type === 'fixed');
  const rhythmItems = block.items.filter((item) => item.type !== 'fixed');
  const orderedItems = [...fixedItems, ...rhythmItems];

  return (
    <section className={`plan-block plan-block--${block.state}`} aria-labelledby={`${block.id}-title`}>
      <div className="plan-block__header">
        <div>
          <h2 id={`${block.id}-title`}>{block.label}</h2>
          <p>{block.softTimeRange}</p>
        </div>
        <span className="plan-block__status">{block.summary}</span>
      </div>
      {orderedItems.length > 0 ? (
        <div className="plan-block__items">
          {orderedItems.map((item) => (
            <PlanItemCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="plan-block__empty">No planned actions here. Keep this space soft.</p>
      )}
    </section>
  );
}

type PlanItemCardProps = {
  item: PlanItem;
};

function PlanItemCard({ item }: PlanItemCardProps) {
  const [edgesOpen, setEdgesOpen] = useState(false);
  const hiddenEdges = item.hiddenEdges ?? [];
  const hasHiddenEdges = hiddenEdges.length > 0;

  return (
    <article className={`plan-item plan-item--${item.type}`} aria-labelledby={`${item.id}-title`}>
      <div className="plan-item__main">
        <div>
          <div className="plan-item__meta">
            <span>{item.area}</span>
            <span>{item.type === 'fixed' ? 'Fixed commitment' : 'Soft rhythm'}</span>
          </div>
          <h3 id={`${item.id}-title`}>{item.title}</h3>
          <p>{item.tone}</p>
        </div>
        <span className="plan-item__range">{item.softRange}</span>
      </div>
      <p className="plan-item__adjustment">{item.suggestedAdjustment}</p>
      <div className="plan-item__actions" aria-label={`${item.title} low-pressure actions`}>
        <Button>Move later</Button>
        <Button>Shrink</Button>
        <Button>Restart with one action</Button>
      </div>
      {hasHiddenEdges ? (
        <div className="hidden-edges">
          <button
            aria-label={`Show hidden edges for ${item.title} (${hiddenEdges.length} soft edges)`}
            aria-controls={`${item.id}-hidden-edges`}
            aria-expanded={edgesOpen}
            className="hidden-edges__toggle"
            onClick={() => setEdgesOpen((isOpen) => !isOpen)}
            type="button"
          >
            Hidden edges
            <span>{hiddenEdges.length} soft edges</span>
          </button>
          {edgesOpen ? (
            <ul className="hidden-edges__list" id={`${item.id}-hidden-edges`}>
              {hiddenEdges.map((edge) => (
                <li key={edge.id}>
                  <strong>{edge.kind}</strong>
                  <span>{edge.label}</span>
                  <em>{edge.range}</em>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
