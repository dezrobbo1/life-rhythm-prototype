import { useState } from 'react';
import { AppIcon, Button, Chip } from '../../components';
import type { AppIconName } from '../../components/AppIcon/AppIcon';
import type { LibraryRhythm } from './mockLibraryData';

export type LibraryRhythmConfigurationView = {
  state: 'enabled' | 'paused' | 'disabled' | 'unconfigured';
  frequency?: number;
  period?: 'day' | 'week' | 'month';
  minimumMinutes?: number;
  normalMinutes?: number;
  fullMinutes?: number;
  preferredDays?: string[];
  preferredTime?: string;
};

type LibraryRhythmCardProps = {
  configuration: LibraryRhythmConfigurationView;
  onAddToday: (rhythm: LibraryRhythm) => void;
  onConfigure: (rhythm: LibraryRhythm) => void;
  onSetState: (rhythmId: string, state: 'enabled' | 'paused' | 'disabled') => void;
  rhythm: LibraryRhythm;
};

const categoryIcons: Record<LibraryRhythm['category'], AppIconName> = {
  'Anti-scroll': 'antiDrift', 'Emotional recovery': 'emotion', Food: 'food', Household: 'home', Money: 'money',
  Motivation: 'startBoost', Movement: 'movement', 'Sensory load': 'sensory', Sleep: 'sleep',
  'Social support': 'social', 'Start Boost': 'startBoost', 'Work focus': 'work',
};

function stateLabel(state: LibraryRhythmConfigurationView['state']) {
  if (state === 'enabled') return 'On';
  if (state === 'paused') return 'Paused';
  if (state === 'disabled') return 'Off';
  return 'Needs configuration';
}

export function LibraryRhythmCard({ configuration, onAddToday, onConfigure, onSetState, rhythm }: LibraryRhythmCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const configured = configuration.state !== 'unconfigured';
  return (
    <article className="library-card" aria-labelledby={`${rhythm.id}-title`}>
      <div className="library-card__header">
        <div className="library-card__title-row"><span className="library-card__icon" aria-hidden="true"><AppIcon name={categoryIcons[rhythm.category]} size={20} /></span><div><p className="library-card__category">{rhythm.category}</p><h3 id={`${rhythm.id}-title`}>{rhythm.title}</h3><p>{rhythm.purpose}</p></div></div>
        <span className={`library-card__state ${configuration.state === 'enabled' ? 'is-enabled' : ''}`}>{stateLabel(configuration.state)}</span>
      </div>
      <div className="library-card__size">
        {configured ? <><strong>{configuration.minimumMinutes} min Minimum</strong><span>{configuration.frequency} per {configuration.period}</span></> : <><strong>Choose your minutes</strong><span>Catalogue actions are suggestions until you configure them.</span></>}
      </div>
      <div className="chip-row library-card__chips" aria-label={`${rhythm.title} cues`}>{rhythm.chips.slice(0, 2).map((chip) => <Chip key={chip}>{chip}</Chip>)}</div>
      <div className="library-card__actions">
        {configuration.state === 'unconfigured' ? <Button onClick={() => onConfigure(rhythm)} variant="primary">Configure and turn on</Button> : null}
        {configuration.state === 'disabled' || configuration.state === 'paused' ? <Button onClick={() => onSetState(rhythm.id, 'enabled')} variant="primary">Turn on rhythm</Button> : null}
        {configuration.state === 'enabled' ? <Button onClick={() => onSetState(rhythm.id, 'paused')}>Pause rhythm</Button> : null}
        {configuration.state === 'enabled' || configuration.state === 'paused' ? <Button onClick={() => onSetState(rhythm.id, 'disabled')}>Turn off rhythm</Button> : null}
        {configured ? <Button onClick={() => onConfigure(rhythm)}>Edit rhythm</Button> : null}
        <Button onClick={() => onAddToday(rhythm)}>{configured ? 'Add to Today once' : 'Configure to add once'}</Button>
        <Button aria-controls={`${rhythm.id}-details`} aria-expanded={detailsOpen} onClick={() => setDetailsOpen((value) => !value)}>Details</Button>
      </div>
      {detailsOpen ? <div className="library-card__details" id={`${rhythm.id}-details`}>
        <section><h4>Why this rhythm exists</h4><p>{rhythm.whyThisExists}</p></section>
        <section><h4>{configured ? 'Your action versions' : 'Catalogue action ideas'}</h4><dl><div><dt>Minimum</dt><dd>{rhythm.minimumVersion}{configured ? ` · ${configuration.minimumMinutes} min` : ''}</dd></div><div><dt>Normal</dt><dd>{rhythm.normalVersion}{configured ? ` · ${configuration.normalMinutes} min` : ''}</dd></div><div><dt>Full</dt><dd>{rhythm.fullVersion}{configured ? ` · ${configuration.fullMinutes} min` : ''}</dd></div></dl></section>
        {configured ? <section><h4>Your recurrence</h4><p>{configuration.frequency} per {configuration.period}; maximum and preferred timing remain editable.</p>{configuration.preferredDays?.length ? <p>Preferred days: {configuration.preferredDays.join(', ')}.</p> : <p>No preferred weekdays.</p>}<p>Preferred time: {configuration.preferredTime}.</p></section> : null}
        <section><h4>Boundary note</h4><p>{rhythm.boundaryNote}</p></section><section><h4>Category note</h4><p>{rhythm.categoryNote}</p></section>
      </div> : null}
    </article>
  );
}
