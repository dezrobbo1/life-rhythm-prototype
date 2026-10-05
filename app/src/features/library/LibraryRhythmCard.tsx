import { useState } from 'react';
import { AppIcon, Button } from '../../components';
import type { AppIconName } from '../../components/AppIcon/AppIcon';
import type { LibraryRhythm } from './mockLibraryData';

export type LibraryRhythmConfigurationView = {
  state: 'enabled' | 'paused' | 'disabled' | 'unconfigured' | 'unavailable';
  frequency?: number;
  period?: 'day' | 'week' | 'month';
  minimumMinutes?: number;
  normalMinutes?: number;
  fullMinutes?: number;
  preferredDays?: string[];
  preferredTime?: string;
};

type LibraryRhythmCardProps = {
  actionsDisabled: boolean;
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
  if (state === 'unavailable') return 'Saved state unavailable';
  return 'Needs configuration';
}

export function LibraryRhythmCard({ actionsDisabled, configuration, onAddToday, onConfigure, onSetState, rhythm }: LibraryRhythmCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const configured = configuration.state !== 'unconfigured' && configuration.state !== 'unavailable';
  const canTurnOn = configuration.state === 'paused' || configuration.state === 'disabled';

  return (
    <article className={`library-card ${configured ? 'library-card--personal' : 'library-card--suggestion'}`} aria-labelledby={`${rhythm.id}-title`}>
      <div className="library-card__header">
        <div className="library-card__title-row">
          <span className="library-card__icon" aria-hidden="true"><AppIcon name={categoryIcons[rhythm.category]} size={20} /></span>
          <div>
            <p className="library-card__category">{rhythm.category}</p>
            <h3 id={`${rhythm.id}-title`}>{rhythm.title}</h3>
            <p>{rhythm.purpose}</p>
          </div>
        </div>
        <span className={`library-card__state ${configuration.state === 'enabled' ? 'is-enabled' : ''}`}>{stateLabel(configuration.state)}</span>
      </div>

      <div className="library-card__size">
        {configured ? <><strong>{configuration.minimumMinutes} min minimum</strong><span>{configuration.frequency} per {configuration.period}</span></>
          : configuration.state === 'unavailable' ? <><strong>Saved details unavailable</strong><span>Read the catalogue while Life Rhythm retries.</span></>
            : <><strong>Set up with your real minutes</strong><span>Suggestion only · nothing is active</span></>}
      </div>

      {configuration.state === 'paused' || configuration.state === 'disabled' ? (
        <p className="library-card__state-note">No new occurrences while {configuration.state === 'paused' ? 'paused' : 'off'}. Your rhythm and history remain saved.</p>
      ) : null}

      <div className="library-card__actions">
        {configuration.state === 'unconfigured' ? <Button disabled={actionsDisabled} onClick={() => onConfigure(rhythm)} variant="primary">Configure and turn on</Button> : null}
        {canTurnOn ? <Button disabled={actionsDisabled} onClick={() => onSetState(rhythm.id, 'enabled')} variant="primary">Turn on rhythm</Button> : null}
        {configuration.state === 'enabled' ? <Button disabled={actionsDisabled} onClick={() => onAddToday(rhythm)} variant="primary">Add to Today once</Button> : null}
        {configured && configuration.state !== 'enabled' ? <Button disabled={actionsDisabled} onClick={() => onAddToday(rhythm)}>Add to Today once</Button> : null}
        {configuration.state === 'unavailable' ? <Button disabled>Configuration unavailable</Button> : null}
      </div>

      <details className="library-card__more">
        <summary>More about {rhythm.title}</summary>
        <div className="library-card__secondary-actions">
          {configuration.state === 'enabled' ? <Button disabled={actionsDisabled} onClick={() => onSetState(rhythm.id, 'paused')}>Pause rhythm</Button> : null}
          {configuration.state === 'enabled' || configuration.state === 'paused' ? <Button disabled={actionsDisabled} onClick={() => onSetState(rhythm.id, 'disabled')}>Turn off rhythm</Button> : null}
          {configured ? <Button disabled={actionsDisabled} onClick={() => onConfigure(rhythm)}>Edit rhythm</Button> : null}
          <Button aria-controls={`${rhythm.id}-details`} aria-expanded={detailsOpen} onClick={() => setDetailsOpen((value) => !value)}>Details</Button>
        </div>
        {detailsOpen ? <div className="library-card__details" id={`${rhythm.id}-details`}>
          <section><h4>Why this rhythm exists</h4><p>{rhythm.whyThisExists}</p></section>
          <section><h4>{configured ? 'Your action versions' : 'Catalogue action ideas'}</h4><dl><div><dt>Minimum</dt><dd>{rhythm.minimumVersion}{configured ? ` · ${configuration.minimumMinutes} min` : ''}</dd></div><div><dt>Normal</dt><dd>{rhythm.normalVersion}{configured ? ` · ${configuration.normalMinutes} min` : ''}</dd></div><div><dt>Full</dt><dd>{rhythm.fullVersion}{configured ? ` · ${configuration.fullMinutes} min` : ''}</dd></div></dl></section>
          {configured ? <section><h4>Your recurrence</h4><p>{configuration.frequency} per {configuration.period}; maximum and preferred timing remain editable.</p>{configuration.preferredDays?.length ? <p>Preferred days: {configuration.preferredDays.join(', ')}.</p> : <p>No preferred weekdays.</p>}<p>Preferred time: {configuration.preferredTime}.</p></section> : null}
          <section><h4>Boundary note</h4><p>{rhythm.boundaryNote}</p></section>
          <section><h4>Category note</h4><p>{rhythm.categoryNote}</p></section>
        </div> : null}
      </details>
    </article>
  );
}
