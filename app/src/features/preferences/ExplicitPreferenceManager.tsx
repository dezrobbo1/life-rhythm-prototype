import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card } from '../../components';
import {
  exportExplicitPreferenceBackup,
  type ExplicitPreferenceBackupResult,
} from '../../data/explicitPreferenceBackup';
import {
  commitExplicitPreferenceDelete,
  commitExplicitPreferenceReset,
  commitExplicitPreferenceUpsert,
  explicitPreferenceTargetExpectation,
  type ExplicitPreferenceTargetExpectation,
  type PreferenceMutationCommitResult,
} from '../../data/explicitPreferenceMutationCoordinator';
import {
  DELETE_EXPLICIT_PREFERENCES_CONFIRMATION,
  loadExplicitPreferencesResult,
  type ExplicitPreferenceLoadResult,
} from '../../data/explicitPreferenceRepository';
import type {
  ExplicitPreference,
  ExplicitPreferenceWriteInput,
} from '../../data/explicitPreferenceSchema';
import {
  emptyExplicitPreferenceTargetCatalog,
  loadExplicitPreferenceTargetCatalog,
  targetOptionsForKind,
  type ExplicitPreferenceTargetCatalog,
  type ExplicitPreferenceTargetCatalogResult,
  type ExplicitPreferenceTargetKind,
} from '../../data/explicitPreferenceTargetCatalog';
import {
  ensureCurrentPrivatePlan,
  type PrivatePlanActionResult,
} from '../../data/schedulerPlanCoordinator';
import {
  explicitPreferenceExpiryLabel,
  explicitPreferenceSummary,
} from './explicitPreferencePresentation';

type DayOfWeek = ExplicitPreference['days'][number];

type PreferenceDraft = {
  id: string;
  relation: ExplicitPreference['relation'];
  targetKind: ExplicitPreferenceTargetKind;
  targetValue: string;
  days: DayOfWeek[];
  useTimeWindow: boolean;
  start: string;
  end: string;
  useExpiry: boolean;
  expiresLocal: string;
};

export type ExplicitPreferenceManagerProps = {
  onPlanChanged?: () => void;
  readPreferences?: () => Promise<ExplicitPreferenceLoadResult>;
  readTargets?: () => Promise<ExplicitPreferenceTargetCatalogResult>;
  savePreference?: (
    input: ExplicitPreferenceWriteInput,
    expectation: ExplicitPreferenceTargetExpectation,
  ) => Promise<PreferenceMutationCommitResult>;
  deletePreference?: (
    id: string,
    expectation: ExplicitPreferenceTargetExpectation,
  ) => Promise<PreferenceMutationCommitResult>;
  clearPreferences?: (confirmation: string) => Promise<PreferenceMutationCommitResult>;
  ensurePlan?: () => Promise<PrivatePlanActionResult>;
  exportPreferences?: () => Promise<ExplicitPreferenceBackupResult>;
};

const weekdays: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const targetKindLabels: Record<ExplicitPreferenceTargetKind, string> = {
  intention: 'Task',
  rhythm: 'Rhythm',
  area: 'Area',
  taskType: 'Task type',
};

function createPreferenceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `preference-${crypto.randomUUID()}`;
  }
  return `preference-${Date.now()}`;
}

function isoToLocalInput(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => part.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function draftFromPreference(preference: ExplicitPreference): PreferenceDraft {
  return {
    id: preference.id,
    relation: preference.relation,
    targetKind: preference.targetKind,
    targetValue: preference.targetValue,
    days: [...preference.days],
    useTimeWindow: Boolean(preference.start && preference.end),
    start: preference.start ?? '09:00',
    end: preference.end ?? '10:00',
    useExpiry: Boolean(preference.expiresAt),
    expiresLocal: isoToLocalInput(preference.expiresAt),
  };
}

function newDraft(): PreferenceDraft {
  return {
    id: createPreferenceId(),
    relation: 'prefer',
    targetKind: 'area',
    targetValue: 'admin',
    days: [],
    useTimeWindow: false,
    start: '09:00',
    end: '10:00',
    useExpiry: false,
    expiresLocal: '',
  };
}

function downloadBackup(backup: Extract<ExplicitPreferenceBackupResult, { status: 'ok' }>) {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) return;

  const url = URL.createObjectURL(new Blob([backup.json], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backup.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ExplicitPreferenceManagerBody({
  onPlanChanged,
  readPreferences = loadExplicitPreferencesResult,
  readTargets = loadExplicitPreferenceTargetCatalog,
  savePreference = commitExplicitPreferenceUpsert,
  deletePreference = commitExplicitPreferenceDelete,
  clearPreferences = commitExplicitPreferenceReset,
  ensurePlan = ensureCurrentPrivatePlan,
  exportPreferences = exportExplicitPreferenceBackup,
}: ExplicitPreferenceManagerProps) {
  const [preferenceState, setPreferenceState] = useState<ExplicitPreferenceLoadResult | null>(null);
  const [catalogState, setCatalogState] = useState<ExplicitPreferenceTargetCatalogResult | null>(null);
  const [draft, setDraft] = useState<PreferenceDraft | null>(null);
  const [expectation, setExpectation] = useState<ExplicitPreferenceTargetExpectation | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | 'clear' | 'export' | 'retry' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [clearInput, setClearInput] = useState('');

  const catalog: ExplicitPreferenceTargetCatalog = catalogState ?? emptyExplicitPreferenceTargetCatalog();

  const refresh = useCallback(async () => {
    const [preferences, targets] = await Promise.all([
      readPreferences(),
      readTargets(),
    ]);
    setPreferenceState(preferences);
    setCatalogState(targets);
  }, [readPreferences, readTargets]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const targetOptions = useMemo(
    () => draft ? targetOptionsForKind(catalog, draft.targetKind) : [],
    [catalog, draft],
  );

  async function reconcilePlan(successMessage: string) {
    const result = await ensurePlan();
    if (result.ok) {
      onPlanChanged?.();
      setFeedback(`${successMessage} Flexible plan updated.`);
    } else {
      setFeedback(`${successMessage} Flexible plan still needs updating.`);
    }
    await refresh();
  }

  function beginCreate() {
    if (!preferenceState) return;
    const next = newDraft();
    const nextExpectation = explicitPreferenceTargetExpectation(preferenceState, next.id);
    if (!nextExpectation) {
      setFeedback('Saved preferences need attention before a new preference can be added.');
      return;
    }
    setDraft(next);
    setExpectation(nextExpectation);
    setFeedback('');
  }

  function beginEdit(preference: ExplicitPreference) {
    if (!preferenceState) return;
    const nextExpectation = explicitPreferenceTargetExpectation(preferenceState, preference.id);
    if (!nextExpectation) {
      setFeedback('Saved preferences need attention before this preference can be edited.');
      return;
    }
    setDraft(draftFromPreference(preference));
    setExpectation(nextExpectation);
    setFeedback('');
  }

  function updateTargetKind(targetKind: ExplicitPreferenceTargetKind) {
    const options = targetOptionsForKind(catalog, targetKind);
    setDraft((current) => current ? {
      ...current,
      targetKind,
      targetValue: options[0]?.value ?? '',
    } : current);
  }

  function toggleDay(day: DayOfWeek) {
    setDraft((current) => {
      if (!current) return current;
      const days = new Set(current.days);
      if (days.has(day)) days.delete(day);
      else days.add(day);
      return {
        ...current,
        days: weekdays.filter((candidate) => days.has(candidate)),
      };
    });
  }

  async function saveDraft() {
    if (!draft || !expectation) return;
    if (!draft.targetValue) {
      setFeedback('Choose a preference target before saving.');
      return;
    }
    if (draft.useTimeWindow && draft.start >= draft.end) {
      setFeedback('Preference end time must be later than its start time.');
      return;
    }

    const expiresAt = draft.useExpiry ? localInputToIso(draft.expiresLocal) : null;
    if (draft.useExpiry && !expiresAt) {
      setFeedback('Choose a valid expiry date and time.');
      return;
    }

    const input: ExplicitPreferenceWriteInput = {
      id: draft.id,
      targetKind: draft.targetKind,
      targetValue: draft.targetValue,
      relation: draft.relation,
      days: draft.days,
      ...(draft.useTimeWindow ? { start: draft.start, end: draft.end } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    };

    setBusy('save');
    try {
      const result = await savePreference(input, expectation);
      if (!result.ok) {
        setFeedback(result.errors.join(' '));
        await refresh();
        return;
      }
      setDraft(null);
      setExpectation(null);
      await reconcilePlan('Preference saved.');
    } catch {
      setFeedback('Preference could not be saved. Nothing else was changed.');
    } finally {
      setBusy(null);
    }
  }

  async function removePreference(preference: ExplicitPreference) {
    if (!preferenceState) return;
    const nextExpectation = explicitPreferenceTargetExpectation(preferenceState, preference.id);
    if (!nextExpectation) {
      setFeedback('Saved preferences changed. Reload before deleting.');
      return;
    }

    setBusy('delete');
    try {
      const result = await deletePreference(preference.id, nextExpectation);
      if (!result.ok) {
        setFeedback(result.errors.join(' '));
        await refresh();
        return;
      }
      await reconcilePlan(result.removed ? 'Preference removed.' : 'Preference was already absent.');
    } catch {
      setFeedback('Preference could not be removed. Nothing else was changed.');
    } finally {
      setBusy(null);
    }
  }

  async function clearAll() {
    setBusy('clear');
    try {
      const result = await clearPreferences(clearInput);
      if (!result.ok) {
        setFeedback(result.errors.join(' '));
        return;
      }
      setDraft(null);
      setExpectation(null);
      setClearInput('');
      await reconcilePlan(result.removed ? 'Scheduling preferences cleared.' : 'No saved preference content needed clearing.');
    } catch {
      setFeedback('Scheduling preferences could not be cleared.');
    } finally {
      setBusy(null);
    }
  }

  async function exportBackup() {
    setBusy('export');
    try {
      const result = await exportPreferences();
      if (result.status === 'missing') {
        setFeedback('No scheduling preference data is stored yet.');
        return;
      }
      if (result.status === 'readFailed') {
        setFeedback(result.errors.join(' '));
        return;
      }
      downloadBackup(result);
      setFeedback('Scheduling preference backup created on this device.');
    } catch {
      setFeedback('Scheduling preference backup could not be created.');
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    setBusy('retry');
    try {
      await refresh();
      setFeedback('Scheduling preferences rechecked.');
    } finally {
      setBusy(null);
    }
  }

  const healthy = preferenceState?.status === 'missing' || preferenceState?.status === 'ok';
  const preferences = preferenceState?.status === 'ok' ? preferenceState.preferences : [];

  return (
    <div className="setup-backup-checker" aria-label="Scheduling preference controls">
      {preferenceState === null ? <p role="status">Reading saved scheduling preferences...</p> : null}

      {preferenceState?.status === 'invalid' ? (
        <div className="setup-validation-summary" role="alert">
          <strong>Saved scheduling preferences need attention.</strong>
          <p>The saved bytes were left unchanged. You can export them before using the confirmed clear action below.</p>
        </div>
      ) : null}

      {preferenceState?.status === 'readFailed' ? (
        <div className="setup-validation-summary" role="alert">
          <strong>Scheduling preferences could not be read.</strong>
          <p>Nothing was changed. Retry before editing or clearing.</p>
          <Button disabled={busy !== null} onClick={() => void retry()}>Retry preferences</Button>
        </div>
      ) : null}

      {catalogState?.status === 'partial' ? (
        <p className="setup-note" role="status">
          Some saved task or rhythm records could not be used as preference targets. Readable targets remain available.
        </p>
      ) : catalogState?.status === 'readFailed' ? (
        <p className="setup-note" role="status">
          Saved task and rhythm names could not be read. Area and task-type preferences remain available.
        </p>
      ) : null}

      {healthy ? (
        <>
          <div className="setup-action-row">
            <Button disabled={busy !== null || draft !== null} onClick={beginCreate} variant="primary">
              Add preference
            </Button>
          </div>

          {preferences.length > 0 ? (
            <ul className="soft-placements__list" aria-label="Saved scheduling preferences">
              {preferences.map((preference) => (
                <li key={preference.id}>
                  <div className="soft-placements__item-copy">
                    <strong>{explicitPreferenceSummary(preference, catalog)}</strong>
                    {explicitPreferenceExpiryLabel(preference) ? (
                      <span>{explicitPreferenceExpiryLabel(preference)}</span>
                    ) : null}
                  </div>
                  <div className="setup-action-row">
                    <Button disabled={busy !== null || draft !== null} onClick={() => beginEdit(preference)}>Edit</Button>
                    <Button disabled={busy !== null || draft !== null} onClick={() => void removePreference(preference)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="setup-note">No saved scheduling preferences yet.</p>
          )}
        </>
      ) : null}

      {draft ? (
        <div className="setup-backup-panel">
          <div className="setup-subheading">
            <h3>{expectation?.preference ? 'Edit scheduling preference' : 'Add scheduling preference'}</h3>
            <p>This is soft guidance. Fixed commitments and protected time still win.</p>
          </div>

          <label className="life-shape-control">
            <span>Preference</span>
            <select
              aria-label="Preference direction"
              onChange={(event) => setDraft({ ...draft, relation: event.target.value as ExplicitPreference['relation'] })}
              value={draft.relation}
            >
              <option value="prefer">Prefer</option>
              <option value="avoid">Avoid</option>
            </select>
          </label>

          <label className="life-shape-control">
            <span>Target type</span>
            <select
              aria-label="Preference target type"
              onChange={(event) => updateTargetKind(event.target.value as ExplicitPreferenceTargetKind)}
              value={draft.targetKind}
            >
              {(Object.keys(targetKindLabels) as ExplicitPreferenceTargetKind[]).map((kind) => (
                <option key={kind} value={kind}>{targetKindLabels[kind]}</option>
              ))}
            </select>
          </label>

          <label className="life-shape-control">
            <span>Target</span>
            <select
              aria-label="Preference target"
              onChange={(event) => setDraft({ ...draft, targetValue: event.target.value })}
              value={draft.targetValue}
            >
              {!targetOptions.some((option) => option.value === draft.targetValue) && draft.targetValue ? (
                <option value={draft.targetValue}>
                  {draft.targetKind === 'intention' ? 'Unavailable saved task' : 'Unavailable saved rhythm'}
                </option>
              ) : null}
              {targetOptions.map((option) => (
                <option key={`${option.kind}:${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>Days</legend>
            <p className="setup-note">Leave every day unchecked to apply this preference every day.</p>
            <div className="setup-day-grid">
              {weekdays.map((day) => (
                <label key={day}>
                  <input
                    checked={draft.days.includes(day)}
                    onChange={() => toggleDay(day)}
                    type="checkbox"
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="setup-toggle">
            <input
              checked={draft.useTimeWindow}
              onChange={(event) => setDraft({ ...draft, useTimeWindow: event.target.checked })}
              type="checkbox"
            />
            <span>
              <strong>Use a time window</strong>
              <small>Otherwise the preference applies across its selected day.</small>
            </span>
          </label>

          {draft.useTimeWindow ? (
            <div className="life-shape-grid">
              <label className="life-shape-control">
                <span>Preference starts</span>
                <input
                  aria-label="Preference starts"
                  onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                  type="time"
                  value={draft.start}
                />
              </label>
              <label className="life-shape-control">
                <span>Preference ends</span>
                <input
                  aria-label="Preference ends"
                  onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                  type="time"
                  value={draft.end}
                />
              </label>
            </div>
          ) : null}

          <label className="setup-toggle">
            <input
              checked={draft.useExpiry}
              onChange={(event) => setDraft({
                ...draft,
                useExpiry: event.target.checked,
                expiresLocal: event.target.checked ? draft.expiresLocal : '',
              })}
              type="checkbox"
            />
            <span>
              <strong>Temporary preference</strong>
              <small>Keep it inspectable after expiry, but stop using it for new scheduling decisions.</small>
            </span>
          </label>

          {draft.useExpiry ? (
            <label className="life-shape-control">
              <span>Expires</span>
              <input
                aria-label="Preference expires"
                onChange={(event) => setDraft({ ...draft, expiresLocal: event.target.value })}
                type="datetime-local"
                value={draft.expiresLocal}
              />
            </label>
          ) : null}

          <div className="setup-action-row">
            <Button disabled={busy !== null} onClick={() => void saveDraft()} variant="primary">
              {busy === 'save' ? 'Saving preference' : 'Save preference'}
            </Button>
            <Button disabled={busy !== null} onClick={() => {
              setDraft(null);
              setExpectation(null);
              setFeedback('');
            }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="setup-backup-panel">
        <div className="setup-subheading">
          <h3>Preference data</h3>
          <p>Export only scheduling preference data, or clear it with explicit confirmation.</p>
        </div>
        <div className="setup-action-row">
          <Button disabled={busy !== null} onClick={() => void exportBackup()}>Export scheduling preferences</Button>
        </div>
        <label className="life-shape-control life-shape-control--wide">
          <span>Type {DELETE_EXPLICIT_PREFERENCES_CONFIRMATION} to clear scheduling preferences</span>
          <input
            aria-label={`Type ${DELETE_EXPLICIT_PREFERENCES_CONFIRMATION} to clear scheduling preferences`}
            onChange={(event) => setClearInput(event.target.value)}
            value={clearInput}
          />
        </label>
        <Button
          disabled={busy !== null || clearInput !== DELETE_EXPLICIT_PREFERENCES_CONFIRMATION}
          onClick={() => void clearAll()}
        >
          {busy === 'clear' ? 'Clearing preferences' : 'Clear scheduling preferences'}
        </Button>
        <p className="setup-note">Tasks, rhythms, calendar data, behaviour history and ordinary settings are not deleted.</p>
      </div>

      {feedback ? <p className="setup-note" role="status">{feedback}</p> : null}
    </div>
  );
}

export function ExplicitPreferenceManager(props: ExplicitPreferenceManagerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <div className="setup-section-heading">
        <h2>Scheduling preferences</h2>
        <p>Optional soft guidance for when Life Rhythm places flexible tasks and rhythms.</p>
      </div>
      <p className="setup-note">Preferences never override fixed commitments or protected time.</p>
      <div className="setup-action-row">
        <Button onClick={() => setOpen((value) => !value)}>
          {open ? 'Close scheduling preferences' : 'Manage scheduling preferences'}
        </Button>
      </div>
      {open ? <ExplicitPreferenceManagerBody {...props} /> : null}
    </Card>
  );
}
