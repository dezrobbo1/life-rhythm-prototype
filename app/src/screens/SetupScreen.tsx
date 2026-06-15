import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip } from '../components';
import type { ThemeName } from '../app/theme';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import type {
  Settings,
  SettingsWriteInput,
  SettingsWriteResult,
} from '../data/settingsRepository';
import {
  aboutRows,
  advancedRows,
  appearanceOptions,
  dataActions,
  defaultLifeShape,
  lowCapacityPreferenceOptions,
  safetyToggles,
  type LifeShapeState,
} from '../features/setup/mockSetupData';
import {
  lifeShapeStateFromSettings,
  normalizeLifeShapeForm,
  safetySettingsFromState,
  safetyStateFromSettings,
} from '../features/setup/settingsForm';
import { buildSetupViewModel } from '../viewModels';

type SetupScreenProps = {
  onResetSettings?: () => Promise<Settings>;
  onSaveSettings?: (settings: SettingsWriteInput) => Promise<SettingsWriteResult>;
  onThemeChange?: (theme: ThemeName) => void;
  settings?: Settings;
  theme?: ThemeName;
};

export function SetupScreen({
  onResetSettings,
  onSaveSettings,
  onThemeChange,
  settings,
  theme = 'exhale',
}: SetupScreenProps = {}) {
  const { snapshot } = useAppSnapshot();
  const initialSetupViewModel = useMemo(() => buildSetupViewModel(snapshot), [snapshot]);
  const [localTheme, setLocalTheme] = useState<ThemeName>(theme);
  const [safetyState, setSafetyState] = useState<Record<string, boolean>>(() =>
    settings ? safetyStateFromSettings(settings) : Object.fromEntries(Object.entries(initialSetupViewModel.startBoostSafety)),
  );
  const [lifeShape, setLifeShape] = useState<LifeShapeState>(() => lifeShapeStateFromSettings(settings));
  const [status, setStatus] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!settings) return;

    setLocalTheme(settings.theme);
    setSafetyState(safetyStateFromSettings(settings));
    setLifeShape(lifeShapeStateFromSettings(settings));
  }, [settings]);

  function toggleSafety(id: string) {
    setSafetyState((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function chooseTheme(nextTheme: ThemeName) {
    setLocalTheme(nextTheme);
    onThemeChange?.(nextTheme);
  }

  function updateLifeShape<Key extends keyof LifeShapeState>(key: Key, value: LifeShapeState[Key]) {
    setLifeShape((current) => ({
      ...current,
      [key]: value,
    }));
    setStatus('Life shape updated. Save settings when ready.');
  }

  async function saveCurrentSettings() {
    if (!onSaveSettings) {
      setStatus('Settings save controls are not connected in this render.');
      return;
    }

    try {
      const result = await onSaveSettings({
        lifeShape: normalizeLifeShapeForm(lifeShape),
        startBoostSafety: safetySettingsFromState(safetyState),
        theme: selectedTheme,
      });

      setStatus(result.ok ? 'Settings saved on this device.' : 'Settings were not saved. Check work hours and travel numbers.');
    } catch {
      setStatus('Settings were not saved. Check work hours and travel numbers.');
    }
  }

  async function resetCurrentSettings() {
    if (!onResetSettings) {
      setLifeShape(defaultLifeShape);
      setStatus('Settings reset to defaults for this preview render.');
      return;
    }

    const resetSettings = await onResetSettings();

    setLocalTheme(resetSettings.theme);
    setSafetyState(safetyStateFromSettings(resetSettings));
    setLifeShape(lifeShapeStateFromSettings(resetSettings));
    setStatus('Settings reset to defaults on this device.');
  }

  const selectedTheme = onThemeChange ? theme : localTheme;
  const setupViewModel = useMemo(
    () =>
      buildSetupViewModel({
        ...snapshot,
        settings: {
          ...snapshot.settings,
          theme: selectedTheme,
        },
      }),
    [selectedTheme, snapshot],
  );

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
          {setupViewModel.themeChoices.map((option) => {
            const copy = appearanceOptions.find((appearance) => appearance.id === option.id);

            return (
            <button
              aria-checked={selectedTheme === option.id}
              className="setup-theme-option"
              key={option.id}
              onClick={() => chooseTheme(option.id)}
              role="radio"
              type="button"
            >
              <strong>{option.label}</strong>
              <span>{copy?.description ?? 'Colour-only theme option.'}</span>
            </button>
            );
          })}
        </div>
        <div className="chip-row">
          <Chip>Selected: {setupViewModel.themeChoices.find((option) => option.id === selectedTheme)?.label}</Chip>
          <Chip>Colour only</Chip>
        </div>
      </Card>

      <Card>
        <div className="setup-section-heading">
          <h2>Life shape</h2>
          <p>Saved on this device when you choose Save settings.</p>
        </div>
        <div className="life-shape-grid">
          <fieldset className="life-shape-fieldset">
            <legend>Usual work hours</legend>
            <div className="life-shape-inline">
              <label>
                <span>Work starts</span>
                <input
                  aria-label="Work starts"
                  onChange={(event) => updateLifeShape('workStart', event.target.value)}
                  type="time"
                  value={lifeShape.workStart}
                />
              </label>
              <label>
                <span>Work ends</span>
                <input
                  aria-label="Work ends"
                  onChange={(event) => updateLifeShape('workEnd', event.target.value)}
                  type="time"
                  value={lifeShape.workEnd}
                />
              </label>
            </div>
          </fieldset>

          <label className="life-shape-control">
            <span>Commute / travel time</span>
            <input
              aria-label="Commute / travel time"
              min="0"
              onChange={(event) => updateLifeShape('commuteMinutes', event.target.value)}
              type="number"
              value={lifeShape.commuteMinutes}
            />
            <small>Minutes usually needed around leaving or arriving.</small>
          </label>

          <label className="life-shape-control life-shape-control--wide">
            <span>Fixed commitments</span>
            <textarea
              aria-label="Fixed commitments"
              onChange={(event) => updateLifeShape('fixedCommitments', event.target.value)}
              rows={3}
              value={lifeShape.fixedCommitments}
            />
            <small>Appointments, care, school runs, or other fixed edges.</small>
          </label>

          <label className="life-shape-control">
            <span>Transition buffer</span>
            <select
              aria-label="Transition buffer"
              onChange={(event) => updateLifeShape('transitionBuffer', event.target.value)}
              value={lifeShape.transitionBuffer}
            >
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </label>

          <fieldset className="life-shape-fieldset life-shape-fieldset--wide">
            <legend>Meal anchors</legend>
            <div className="life-shape-inline">
              <label>
                <span>Breakfast</span>
                <input
                  aria-label="Breakfast anchor"
                  onChange={(event) => updateLifeShape('breakfastAnchor', event.target.value)}
                  type="time"
                  value={lifeShape.breakfastAnchor}
                />
              </label>
              <label>
                <span>Lunch</span>
                <input
                  aria-label="Lunch anchor"
                  onChange={(event) => updateLifeShape('lunchAnchor', event.target.value)}
                  type="time"
                  value={lifeShape.lunchAnchor}
                />
              </label>
              <label>
                <span>Dinner</span>
                <input
                  aria-label="Dinner anchor"
                  onChange={(event) => updateLifeShape('dinnerAnchor', event.target.value)}
                  type="time"
                  value={lifeShape.dinnerAnchor}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="life-shape-fieldset">
            <legend>Sleep / wake anchor</legend>
            <div className="life-shape-inline">
              <label>
                <span>Wake</span>
                <input
                  aria-label="Wake anchor"
                  onChange={(event) => updateLifeShape('wakeAnchor', event.target.value)}
                  type="time"
                  value={lifeShape.wakeAnchor}
                />
              </label>
              <label>
                <span>Sleep</span>
                <input
                  aria-label="Sleep anchor"
                  onChange={(event) => updateLifeShape('sleepAnchor', event.target.value)}
                  type="time"
                  value={lifeShape.sleepAnchor}
                />
              </label>
            </div>
          </fieldset>

          <label className="life-shape-control">
            <span>Low-capacity day preference</span>
            <select
              aria-label="Low-capacity day preference"
              onChange={(event) => updateLifeShape('lowCapacityPreference', event.target.value)}
              value={lifeShape.lowCapacityPreference}
            >
              {lowCapacityPreferenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="setup-note">Settings only. Future planning can use this shape later, but this does not schedule anything.</p>
      </Card>

      <Card>
        <div className="setup-section-heading">
          <h2>Start Boost safety</h2>
          <p>Safety choices are saved on this device when you choose Save settings.</p>
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
          <h2>Save settings</h2>
          <p>Save theme, Start Boost safety, and Life shape only.</p>
        </div>
        <div className="setup-action-row">
          <Button onClick={saveCurrentSettings} variant="primary">Save settings</Button>
          <Button onClick={resetCurrentSettings}>Reset settings to defaults</Button>
        </div>
        <p className="setup-note">This does not save tasks, rhythms, packs, resets, imports, dev tickets, or future modules.</p>
      </Card>

      <Card>
        <div className="setup-section-heading">
          <h2>Data and backup</h2>
          <p>Settings can be saved on this device. Backup and import stay later-only.</p>
        </div>
        <p className="setup-note">{setupViewModel.dataPreview.copy}</p>
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
        <div className="setup-section-heading setup-section-heading--quiet">
          <h2>Future modules</h2>
          <p>Future modules: planned, inactive for now.</p>
        </div>
        <div className="chip-row chip-row--quiet">
          {setupViewModel.futureModules.map((module) => (
            <Chip key={module.id}>{module.label}: {module.enabled ? 'Active' : 'Inactive'}</Chip>
          ))}
        </div>
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
