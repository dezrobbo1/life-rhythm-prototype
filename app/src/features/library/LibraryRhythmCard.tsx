import { useState } from 'react';
import { Button, Chip } from '../../components';
import type { LibraryRhythm } from './mockLibraryData';

type LibraryRhythmCardProps = {
  enabled: boolean;
  onAddToday: (rhythm: LibraryRhythm) => void;
  onToggleEnabled: (rhythmId: string) => void;
  rhythm: LibraryRhythm;
};

export function LibraryRhythmCard({
  enabled,
  onAddToday,
  onToggleEnabled,
  rhythm,
}: LibraryRhythmCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const visibleChips = rhythm.chips.slice(0, 2);

  return (
    <article className="library-card" aria-labelledby={`${rhythm.id}-title`}>
      <div className="library-card__header">
        <div>
          <p className="library-card__category">{rhythm.category}</p>
          <h3 id={`${rhythm.id}-title`}>{rhythm.title}</h3>
          <p>{rhythm.purpose}</p>
        </div>
        <span className={`library-card__state ${enabled ? 'is-enabled' : ''}`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="library-card__size">
        <strong>{rhythm.recommendedSize}</strong>
        <span>{rhythm.minimumVersion}</span>
      </div>
      <div className="chip-row library-card__chips" aria-label={`${rhythm.title} cues`}>
        {visibleChips.map((chip) => (
          <Chip key={chip}>{chip}</Chip>
        ))}
      </div>
      <div className="library-card__actions">
        <Button onClick={() => onToggleEnabled(rhythm.id)} variant="primary">
          {enabled ? 'Disable rhythm' : 'Enable rhythm'}
        </Button>
        <Button onClick={() => onAddToday(rhythm)}>Add to Today now</Button>
        <Button
          aria-controls={`${rhythm.id}-details`}
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((isOpen) => !isOpen)}
        >
          Details
        </Button>
      </div>
      {detailsOpen ? (
        <div className="library-card__details" id={`${rhythm.id}-details`}>
          <section>
            <h4>Why this rhythm exists</h4>
            <p>{rhythm.whyThisExists}</p>
          </section>
          <section>
            <h4>Versions</h4>
            <dl>
              <div>
                <dt>Minimum</dt>
                <dd>{rhythm.minimumVersion}</dd>
              </div>
              <div>
                <dt>Normal</dt>
                <dd>{rhythm.normalVersion}</dd>
              </div>
              <div>
                <dt>Full</dt>
                <dd>{rhythm.fullVersion}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h4>Boundary note</h4>
            <p>{rhythm.boundaryNote}</p>
          </section>
          <section>
            <h4>Category note</h4>
            <p>{rhythm.categoryNote}</p>
          </section>
        </div>
      ) : null}
    </article>
  );
}
