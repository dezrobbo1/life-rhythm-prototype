import { useState } from 'react';
import { Button, Card, Chip } from '../components';
import type { ThemeName } from '../app/theme';
import {
  aboutRows,
  advancedRows,
  appearanceOptions,
  dataActions,
  safetyToggles,
} from '../features/setup/mockSetupData';

export function SetupScreen() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>('exhale');
  const [safetyState, setSafetyState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(safetyToggles.map((toggle) => [toggle.id, toggle.defaultEnabled])),
  );
  const [status, setStatus] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function toggleSafety(id: string) {
    setSafetyState((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  return (
    <div className="screen-stack setup-screen">
      <section className="setup-hero" aria-labelledby="setup-title">
        <p className="eyebrow">Control room</p>
        <h1 id="setup-title">Setup</h1>
        <p>Adjust the app without changing your whole day.</p>
      </section>

      {status ? <p className="setup-confirmation" role="status">{status}</p> : null}

      <Card>
        <div className="setup-section-heading">
          <h2>Appearance</h2>
          <p>Themes change colour only. Layout, task logic, copy and scheduling stay the same.</p>
        </div>
        <div className="setup-theme-grid" role="radiogroup" aria-label="Appearance theme">
          {appearanceOptions.map((option) => (
            <button
              aria-checked={selectedTheme === option.id}
              className="setup-theme-option"
              key={option.id}
              onClick={() => setSelectedTheme(option.id)}
              role="radio"
              type="button"
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
        <div className="chip-row">
          <Chip>Selected: {appearanceOptions.find((option) => option.id === selectedTheme)?.label}</Chip>
          <Chip>Colour only</Chip>
        </div>
      </Card>

      <Card>
        <div className="setup-section-heading">
          <h2>Start Boost safety</h2>
          <p>Mock exclusions for support suggestions. Nothing is saved yet.</p>
        </div>
        <div className="setup-toggle-list">
          {safetyToggles.map((toggle) => (
            <label className="setup-toggle" key={toggle.id}>
              <input
                checked={safetyState[toggle.id]}
                onChange={() => toggleSafety(toggle.id)}
                type="checkbox"
              />
              <span>
                <strong>{toggle.label}</strong>
                <small>{toggle.helper}</small>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <div className="setup-section-heading">
          <h2>Data and backup</h2>
          <p>Stored in this browser later. Export before resetting. You control what you share.</p>
        </div>
        <p className="setup-note">Backup, import and export actions are not connected in this mock surface.</p>
        <div className="setup-action-row">
          {dataActions.map((action) => (
            <Button key={action.id} onClick={() => setStatus(`${action.label}: ${action.helper}`)}>
              {action.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="setup-section-heading">
          <h2>Dev tickets</h2>
          <p>Local testing notes for later review.</p>
        </div>
        <div className="setup-dev-card">
          <div>
            <h3>Capture a local note later</h3>
            <p>Dev tickets are local testing notes, not a support desk or live GitHub integration.</p>
          </div>
          <Button onClick={() => setStatus('Dev tickets are not connected yet.')}>Open dev tickets later</Button>
        </div>
      </Card>

      <Card>
        <div className="setup-section-heading">
          <h2>About Life Rhythm</h2>
          <p>Start small. Keep rhythm.</p>
        </div>
        <dl className="setup-about-list">
          {aboutRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <button
          aria-expanded={advancedOpen}
          className="setup-advanced-toggle"
          onClick={() => setAdvancedOpen((open) => !open)}
          type="button"
        >
          <span>
            <strong>Advanced</strong>
            <small>Protected actions and migration notes</small>
          </span>
          <em>{advancedOpen ? 'Hide' : 'Show'}</em>
        </button>
        {advancedOpen ? (
          <div className="setup-advanced-panel">
            {advancedRows.map((row) => (
              <article key={row.title}>
                <h3>{row.title}</h3>
                <p>{row.body}</p>
              </article>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
