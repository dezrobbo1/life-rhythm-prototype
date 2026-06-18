import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button, Card, Chip } from '../components';
import type { ThemeName } from '../app/theme';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import type {
  Settings,
  SettingsWriteInput,
  SettingsWriteResult,
} from '../data/settingsRepository';
import type { SettingsBackupExport } from '../data/settingsExport';
import {
  parseSettingsBackupImportJson,
  type SettingsBackupPreview,
} from '../data/settingsImportValidation';
import {
  parseSoftPlacementBackupJson,
  type SoftPlacementBackupExport,
  type SoftPlacementBackupPreview,
} from '../data/softPlacementBackup';
import {
  aboutRows,
  advancedRows,
  appearanceOptions,
  dataActions,
  dayOptions,
  defaultLifeShape,
  lowCapacityPreferenceOptions,
  schedulerUseOptions,
  safetyToggles,
  timeBlockTypeOptions,
  type LifeShapeState,
  type LifeShapeTimeBlockState,
} from '../features/setup/mockSetupData';
import {
  lifeShapeStateFromSettings,
  normalizeLifeShapeForm,
  safetySettingsFromState,
  safetyStateFromSettings,
} from '../features/setup/settingsForm';
import { buildSetupViewModel } from '../viewModels';

type SetupScreenProps = {
  onExportSettingsBackup?: () => Promise<SettingsBackupExport>;
  onExportSoftPlacementBackup?: () => Promise<SoftPlacementBackupExport | null>;
  onResetSettings?: () => Promise<Settings>;
  onSaveSettings?: (settings: SettingsWriteInput) => Promise<SettingsWriteResult>;
  onThemeChange?: (theme: ThemeName) => void;
  settings?: Settings;
  theme?: ThemeName;
};

const defaultSchedulerUseByTimeBlockType: Record<
  LifeShapeTimeBlockState['type'],
  LifeShapeTimeBlockState['schedulerUse']
> = {
  familyTime: 'unavailable',
  householdFlow: 'askFirst',
  looseTime: 'askFirst',
  openCapacity: 'available',
  protectedTime: 'unavailable',
  recoveryTime: 'unavailable',
};

export function SetupScreen({
  onExportSettingsBackup,
  onExportSoftPlacementBackup,
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
  const [settingsBackupErrors, setSettingsBackupErrors] = useState<string[]>([]);
  const [settingsBackupJson, setSettingsBackupJson] = useState('');
  const [settingsBackupPreview, setSettingsBackupPreview] = useState<SettingsBackupPreview | null>(null);
  const [softPlacementBackupErrors, setSoftPlacementBackupErrors] = useState<string[]>([]);
  const [softPlacementBackupJson, setSoftPlacementBackupJson] = useState('');
  const [softPlacementBackupPreview, setSoftPlacementBackupPreview] = useState<SoftPlacementBackupPreview | null>(null);
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

  function addTimeBlock() {
    setLifeShape((current) => ({
      ...current,
      timeBlocks: [
        ...current.timeBlocks,
        {
          days: ['Monday'],
          end: '12:00',
          id: `life-shape-block-${current.timeBlocks.length + 1}`,
          label: 'Protected time',
          notes: '',
          schedulerUse: 'unavailable',
          start: '11:00',
          type: 'protectedTime',
        },
      ],
    }));
    setStatus('Life shape updated. Save settings when ready.');
  }

  function removeTimeBlock(blockId: string) {
    setLifeShape((current) => ({
      ...current,
      timeBlocks: current.timeBlocks.filter((block) => block.id !== blockId),
    }));
    setStatus('Life shape updated. Save settings when ready.');
  }

  function updateTimeBlock<Key extends keyof LifeShapeTimeBlockState>(
    blockId: string,
    key: Key,
    value: LifeShapeTimeBlockState[Key],
  ) {
    setLifeShape((current) => ({
      ...current,
      timeBlocks: current.timeBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              [key]: value,
            }
          : block,
      ),
    }));
    setStatus('Life shape updated. Save settings when ready.');
  }

  function updateTimeBlockType(blockId: string, type: LifeShapeTimeBlockState['type']) {
    setLifeShape((current) => ({
      ...current,
      timeBlocks: current.timeBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              schedulerUse: defaultSchedulerUseByTimeBlockType[type],
              type,
            }
          : block,
      ),
    }));
    setStatus('Life shape updated. Save settings when ready.');
  }

  function toggleTimeBlockDay(blockId: string, day: string) {
    setLifeShape((current) => ({
      ...current,
      timeBlocks: current.timeBlocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        const daySet = new Set(block.days);

        if (daySet.has(day)) {
          daySet.delete(day);
        } else {
          daySet.add(day);
        }

        return {
          ...block,
          days: Array.from(daySet),
        };
      }),
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

  async function exportSettingsOnlyBackup() {
    if (!onExportSettingsBackup) {
      setStatus('Settings backup export is not connected in this render.');
      return;
    }

    try {
      await onExportSettingsBackup();
      setStatus('Settings backup created on this device.');
    } catch {
      setStatus('Settings backup was not created. Try saving settings first.');
    }
  }

  async function exportSoftPlacementsBackup() {
    if (!onExportSoftPlacementBackup) {
      setStatus('Soft placement backup export is not connected in this render.');
      return;
    }

    try {
      const backup = await onExportSoftPlacementBackup();

      setStatus(backup ? 'Soft placement backup created on this device.' : 'No saved soft placements to export yet.');
    } catch {
      setStatus('Soft placement backup was not created.');
    }
  }

  function checkSettingsBackup() {
    const result = parseSettingsBackupImportJson(settingsBackupJson);

    if (result.ok) {
      setSettingsBackupErrors([]);
      setSettingsBackupPreview(result.preview);
      setStatus('Settings backup looks valid. Restore is not connected yet.');
      return;
    }

    setSettingsBackupErrors(result.errors);
    setSettingsBackupPreview(null);
    setStatus('Backup check found an issue. Nothing changed on this device.');
  }

  function checkSoftPlacementBackup() {
    const result = parseSoftPlacementBackupJson(softPlacementBackupJson);

    if (result.ok) {
      setSoftPlacementBackupErrors([]);
      setSoftPlacementBackupPreview(result.preview);
      setStatus('Soft placement backup looks valid. Restore is not connected yet.');
      return;
    }

    setSoftPlacementBackupErrors(result.errors);
    setSoftPlacementBackupPreview(null);
    setStatus('This soft placement backup could not be used.');
  }

  async function readSettingsBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    try {
      setSettingsBackupJson(await file.text());
      setSettingsBackupErrors([]);
      setSettingsBackupPreview(null);
      setStatus('Settings backup loaded. Choose Check settings backup.');
    } catch {
      setSettingsBackupErrors(['backup: Settings backup file could not be read.']);
      setSettingsBackupPreview(null);
      setStatus('Backup check found an issue. Nothing changed on this device.');
    }
  }

  async function readSoftPlacementBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    try {
      setSoftPlacementBackupJson(await file.text());
      setSoftPlacementBackupErrors([]);
      setSoftPlacementBackupPreview(null);
      setStatus('Soft placement backup loaded. Choose Check soft placement backup.');
    } catch {
      setSoftPlacementBackupErrors(['backup: Soft placement backup file could not be read.']);
      setSoftPlacementBackupPreview(null);
      setStatus('This soft placement backup could not be used.');
    }
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

          <section className="life-shape-control life-shape-control--wide" aria-labelledby="time-to-leave-alone-title">
            <div className="setup-subheading">
              <h3 id="time-to-leave-alone-title">Time to leave alone</h3>
              <p>Not every open gap is available.</p>
              <p>Life Rhythm will not place tasks here unless you allow it. Loose time can stay loose.</p>
            </div>
            <div className="setup-action-row">
              <Button onClick={addTimeBlock}>Add block</Button>
            </div>
            {lifeShape.timeBlocks.length === 0 ? (
              <small>No time blocks added yet.</small>
            ) : (
              <div className="life-shape-time-blocks">
                {lifeShape.timeBlocks.map((block, index) => (
                  <fieldset className="life-shape-time-block" key={block.id}>
                    <legend>Time block {index + 1}</legend>
                    <label>
                      <span>Label</span>
                      <input
                        aria-label={`Time block ${index + 1} label`}
                        onChange={(event) => updateTimeBlock(block.id, 'label', event.target.value)}
                        value={block.label}
                      />
                    </label>
                    <label>
                      <span>Type</span>
                      <select
                        aria-label={`Time block ${index + 1} type`}
                        onChange={(event) =>
                          updateTimeBlockType(block.id, event.target.value as LifeShapeTimeBlockState['type'])
                        }
                        value={block.type}
                      >
                        {timeBlockTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <fieldset className="life-shape-days">
                      <legend>Days</legend>
                      <div className="life-shape-day-grid">
                        {dayOptions.map((day) => (
                          <label key={day}>
                            <input
                              checked={block.days.includes(day)}
                              onChange={() => toggleTimeBlockDay(block.id, day)}
                              type="checkbox"
                            />
                            <span>{day.slice(0, 3)}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="life-shape-inline">
                      <label>
                        <span>Start</span>
                        <input
                          aria-label={`Time block ${index + 1} start`}
                          onChange={(event) => updateTimeBlock(block.id, 'start', event.target.value)}
                          type="time"
                          value={block.start}
                        />
                      </label>
                      <label>
                        <span>End</span>
                        <input
                          aria-label={`Time block ${index + 1} end`}
                          onChange={(event) => updateTimeBlock(block.id, 'end', event.target.value)}
                          type="time"
                          value={block.end}
                        />
                      </label>
                    </div>
                    <label>
                      <span>Scheduler use</span>
                      <select
                        aria-label={`Time block ${index + 1} scheduler use`}
                        onChange={(event) =>
                          updateTimeBlock(block.id, 'schedulerUse', event.target.value as LifeShapeTimeBlockState['schedulerUse'])
                        }
                        value={block.schedulerUse}
                      >
                        {schedulerUseOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Notes</span>
                      <textarea
                        aria-label={`Time block ${index + 1} notes`}
                        onChange={(event) => updateTimeBlock(block.id, 'notes', event.target.value)}
                        rows={2}
                        value={block.notes}
                      />
                    </label>
                    <Button onClick={() => removeTimeBlock(block.id)}>Remove block</Button>
                  </fieldset>
                ))}
              </div>
            )}
          </section>
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
          <p>This is the only settings area here that changes saved data on this device.</p>
        </div>
        <div className="setup-action-row">
          <Button onClick={saveCurrentSettings} variant="primary">Save settings</Button>
          <Button onClick={resetCurrentSettings}>Reset settings to defaults</Button>
        </div>
        <p className="setup-note">Save writes theme, Start Boost safety, and Life shape only. Reset returns those settings to defaults.</p>
        <p className="setup-note setup-note--quiet">Tasks, rhythms, packs, imports, dev tickets, and future modules are not changed.</p>
      </Card>

      <Card>
        <div className="setup-section-heading">
          <h2>Backup and recovery</h2>
          <p>Export settings or check a backup. Checking does not restore.</p>
        </div>
        <p className="setup-note">{setupViewModel.dataPreview.copy}</p>
        <div className="setup-backup-panel">
          <div className="setup-subheading">
            <h3>Export settings</h3>
            <p>This backup includes settings only. Tasks and rhythms are not included yet.</p>
            <p>Creates a settings-only file when you choose it.</p>
          </div>
          <div className="setup-action-row">
            <Button onClick={exportSettingsOnlyBackup} variant="primary">Export settings backup</Button>
          </div>
        </div>
        <div className="setup-backup-checker" aria-labelledby="settings-backup-check-title">
          <div className="setup-subheading">
            <h3 id="settings-backup-check-title">Check settings backup</h3>
            <p>Read-only check. Restore/import is not connected yet.</p>
          </div>
          <label className="life-shape-control life-shape-control--wide">
            <span>Settings backup JSON</span>
            <textarea
              aria-label="Settings backup JSON"
              onChange={(event) => {
                setSettingsBackupJson(event.target.value);
                setSettingsBackupErrors([]);
                setSettingsBackupPreview(null);
              }}
              placeholder="Paste a settings backup JSON file here."
              rows={6}
              value={settingsBackupJson}
            />
            <small>Checking a backup does not change anything on this device.</small>
          </label>
          <div className="setup-action-row">
            <label className="setup-file-picker">
              <span>Select settings backup file</span>
              <input
                accept="application/json,.json"
                aria-label="Select settings backup file"
                onChange={readSettingsBackupFile}
                type="file"
              />
            </label>
            <Button onClick={checkSettingsBackup}>Check settings backup</Button>
          </div>
          {settingsBackupPreview ? (
            <dl aria-label="Settings backup preview" className="setup-about-list">
              <div>
                <dt>Theme</dt>
                <dd>{settingsBackupPreview.theme}</dd>
              </div>
              <div>
                <dt>Start Boost safety</dt>
                <dd>{settingsBackupPreview.startBoostSafetySummary}</dd>
              </div>
              <div>
                <dt>Life shape</dt>
                <dd>{settingsBackupPreview.lifeShapeSummary}</dd>
              </div>
              <div>
                <dt>Exported</dt>
                <dd>{settingsBackupPreview.exportedAt}</dd>
              </div>
            </dl>
          ) : null}
          {settingsBackupErrors.length > 0 ? (
            <div className="setup-validation-summary">
              <strong>Backup check notes</strong>
              <p>Nothing changed on this device. The first items to review are below.</p>
              <ul aria-label="Settings backup errors" className="setup-validation-list">
                {settingsBackupErrors.slice(0, 3).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="setup-backup-panel">
          <div className="setup-subheading">
            <h3>Export soft placements</h3>
            <p>This backup includes saved soft placements only, including removed placement records.</p>
            <p>It does not include tasks or calendar events. No calendar events are created.</p>
          </div>
          <div className="setup-action-row">
            <Button onClick={exportSoftPlacementsBackup}>Export soft placement backup</Button>
          </div>
        </div>
        <div className="setup-backup-checker" aria-labelledby="soft-placement-backup-check-title">
          <div className="setup-subheading">
            <h3 id="soft-placement-backup-check-title">Check soft placement backup</h3>
            <p>This checks the file only. Nothing is restored.</p>
            <p>No calendar events are created.</p>
          </div>
          <label className="life-shape-control life-shape-control--wide">
            <span>Soft placement backup JSON</span>
            <textarea
              aria-label="Soft placement backup JSON"
              onChange={(event) => {
                setSoftPlacementBackupJson(event.target.value);
                setSoftPlacementBackupErrors([]);
                setSoftPlacementBackupPreview(null);
              }}
              placeholder="Paste a soft placement backup JSON file here."
              rows={6}
              value={softPlacementBackupJson}
            />
            <small>This checks soft placement backups only. It does not restore placements.</small>
          </label>
          <div className="setup-action-row">
            <label className="setup-file-picker">
              <span>Select soft placement backup file</span>
              <input
                accept="application/json,.json"
                aria-label="Select soft placement backup file"
                onChange={readSoftPlacementBackupFile}
                type="file"
              />
            </label>
            <Button onClick={checkSoftPlacementBackup}>Check soft placement backup</Button>
          </div>
          {softPlacementBackupPreview ? (
            <dl aria-label="Soft placement backup preview" className="setup-about-list">
              <div>
                <dt>Placements</dt>
                <dd>{softPlacementBackupPreview.placementCount}</dd>
              </div>
              <div>
                <dt>Statuses</dt>
                <dd>{softPlacementBackupPreview.statusSummary}</dd>
              </div>
              <div>
                <dt>Titles</dt>
                <dd>{softPlacementBackupPreview.placementTitles.join(', ') || 'No placement titles in backup.'}</dd>
              </div>
              <div>
                <dt>Exported</dt>
                <dd>{softPlacementBackupPreview.exportedAt}</dd>
              </div>
            </dl>
          ) : null}
          {softPlacementBackupErrors.length > 0 ? (
            <div className="setup-validation-summary">
              <strong>Backup check notes</strong>
              <p>Nothing changed on this device. The first items to review are below.</p>
              <ul aria-label="Soft placement backup errors" className="setup-validation-list">
                {softPlacementBackupErrors.slice(0, 3).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="setup-later-actions" aria-label="Later backup actions">
          {dataActions.filter((action) => action.id !== 'exportBackup').map((action) => (
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
