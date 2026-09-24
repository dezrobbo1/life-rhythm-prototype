import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card } from '../../components';
import {
  commitExplicitPreferenceDelete,
  commitExplicitPreferenceUpsert,
  explicitPreferenceTargetExpectation,
  type ExplicitPreferenceTargetExpectation,
} from '../../data/explicitPreferenceMutationCoordinator';
import {
  DELETE_EXPLICIT_PREFERENCES_CONFIRMATION,
  commitExplicitPreferenceReset,
  loadPreferenceTargetCatalogue,
  type PreferenceTargetOption,
} from '../../data/explicitPreferenceControls';
import {
  loadExplicitPreferencesResult,
  type ExplicitPreferenceLoadResult,
} from '../../data/explicitPreferenceRepository';
import type {
  ExplicitPreference,
  ExplicitPreferenceWriteInput,
} from '../../data/explicitPreferenceSchema';
import { buildExplicitPreferenceBackup } from '../../data/explicitPreferenceBackup';
import { ensureCurrentPrivatePlan } from '../../data/schedulerPlanCoordinator';

const weekdays = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

type TargetKind = ExplicitPreferenceWriteInput['targetKind'];
type Relation = ExplicitPreferenceWriteInput['relation'];

type FormState = {
  id: string;
  targetKind: TargetKind;
  targetValue: string;
  relation: Relation;
  days: string[];
  start: string;
  end: string;
  expiresLocal: string;
};

type SchedulingPreferencesPanelProps = {
  onPlanChanged?: () => void;
};

function newPreferenceId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `preference:${uuid}` : `preference:${Date.now().toString(36)}`;
}

function formatDateTimeLocal(instant?: string) {
  if (!instant) return '';
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    date.getFullYear().toString().padStart(4, '0'),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function emptyForm(options: PreferenceTargetOption[]): FormState {
  const firstArea = options.find((option) => option.kind === 'area');
  return {
    id: newPreferenceId(),
    targetKind: 'area',
    targetValue: firstArea?.value ?? 'admin',
    relation: 'prefer',
    days: [],
    start: '',
    end: '',
    expiresLocal: '',
  };
}

function formFromPreference(preference: ExplicitPreference): FormState {
  return {
    id: preference.id,
    targetKind: preference.targetKind,
    targetValue: preference.targetValue,
    relation: preference.relation,
    days: [...preference.days],
    start: preference.start ?? '',
    end: preference.end ?? '',
    expiresLocal: formatDateTimeLocal(preference.expiresAt),
  };
}

function targetKindLabel(kind: TargetKind) {
  switch (kind) {
    case 'intention': return 'Task';
    case 'rhythm': return 'Rhythm';
    case 'taskType': return 'Task type';
    case 'area':
    default: return 'Area';
  }
}

function preferenceSummary(
  preference: ExplicitPreference,
  options: PreferenceTargetOption[],
) {
  const target = options.find((option) =>
    option.kind === preference.targetKind && option.value === preference.targetValue);
  const targetLabel = target?.label ??
    (preference.targetKind === 'intention'
      ? 'Saved task no longer available'
      : preference.targetKind === 'rhythm'
        ? 'Saved rhythm no longer available'
        : 'Saved category no longer available');
  const relation = preference.relation === 'prefer' ? 'Prefer' : 'Avoid';
  const days = preference.days.length === 0 ? 'every day' : preference.days.join(', ');
  const time = preference.start && preference.end
    ? `${preference.start}–${preference.end}`
    : 'any time';
  const expired = preference.expiresAt && Date.parse(preference.expiresAt) <= Date.now()
    ? ' · expired'
    : '';
  return `${relation} ${targetKindLabel(preference.targetKind).toLowerCase()} “${targetLabel}” · ${days} · ${time}${expired}`;
}

function downloadJson(fileName: string, json: string) {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) return;

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.download = fileName;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SchedulingPreferencesPanel({
  onPlanChanged,
}: SchedulingPreferencesPanelProps) {
  const [loadResult, setLoadResult] = useState<ExplicitPreferenceLoadResult>({
    status: 'missing',
    preferences: [],
  });
  const [catalogue, setCatalogue] = useState<PreferenceTargetOption[]>([]);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [expectation, setExpectation] = useState<ExplicitPreferenceTargetExpectation | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [clearInput, setClearInput] = useState('');

  const refresh = useCallback(async () => {
    const [preferences, targets] = await Promise.all([
      loadExplicitPreferencesResult(),
      loadPreferenceTargetCatalogue(),
    ]);
    setLoadResult(preferences);
    if (targets.status === 'ok') {
      setCatalogue(targets.options);
      setCatalogueError(targets.warnings[0] ?? null);
    } else {
      setCatalogue([]);
      setCatalogueError(targets.errors.join(' '));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const preferences = loadResult.status === 'ok' ? loadResult.preferences : [];
  const targetOptions = useMemo(
    () => form ? catalogue.filter((option) => option.kind === form.targetKind) : [],
    [catalogue, form],
  );

  async function reconcilePlan(successMessage: string) {
    const plan = await ensureCurrentPrivatePlan();
    if (plan.ok) {
      onPlanChanged?.();
      setStatus(successMessage);
      return;
    }
    setStatus(
      `${successMessage.replace(/\.$/, '')}, but the flexible plan still needs updating. ${plan.errors[0] ?? ''}`.trim(),
    );
  }

  function beginNew() {
    const next = emptyForm(catalogue);
    const nextExpectation = explicitPreferenceTargetExpectation(loadResult, next.id);
    if (!nextExpectation) {
      setStatus('Saved scheduling preferences need attention before a new preference can be added.');
      return;
    }
    setForm(next);
    setExpectation(nextExpectation);
    setStatus('');
  }

  function beginEdit(preference: ExplicitPreference) {
    const nextExpectation = explicitPreferenceTargetExpectation(loadResult, preference.id);
    if (!nextExpectation) {
      setStatus('Reload scheduling preferences before editing this item.');
      return;
    }
    setForm(formFromPreference(preference));
    setExpectation(nextExpectation);
    setStatus('');
  }

  function chooseTargetKind(kind: TargetKind) {
    const first = catalogue.find((option) => option.kind === kind);
    setForm((current) => current ? {
      ...current,
      targetKind: kind,
      targetValue: first?.value ?? '',
    } : current);
  }

  function toggleDay(day: string) {
    setForm((current) => {
      if (!current) return current;
      const set = new Set(current.days);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...current, days: weekdays.filter((item) => set.has(item)) };
    });
  }

  async function savePreference() {
    if (!form || !expectation) return;
    if (!form.targetValue) {
      setStatus('Choose a target for this scheduling preference.');
      return;
    }
    if ((form.start === '') !== (form.end === '')) {
      setStatus('Add both a start and end time, or leave both blank.');
      return;
    }

    let expiresAt: string | undefined;
    if (form.expiresLocal) {
      const expiry = new Date(form.expiresLocal);
      if (!Number.isFinite(expiry.getTime())) {
        setStatus('Choose a valid expiry date and time.');
        return;
      }
      expiresAt = expiry.toISOString();
    }

    const input: ExplicitPreferenceWriteInput = {
      id: form.id,
      targetKind: form.targetKind,
      targetValue: form.targetValue,
      relation: form.relation,
      days: form.days as ExplicitPreferenceWriteInput['days'],
      ...(form.start && form.end ? { start: form.start, end: form.end } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    };

    setBusy(true);
    try {
      const result = await commitExplicitPreferenceUpsert(input, expectation);
      if (!result.ok) {
        setStatus(result.errors.join(' '));
        await refresh();
        return;
      }
      setForm(null);
      setExpectation(null);
      await refresh();
      await reconcilePlan('Scheduling preference saved and the flexible plan is up to date.');
    } catch {
      setStatus('Scheduling preference was not saved. Nothing else changed.');
    } finally {
      setBusy(false);
    }
  }

  async function removePreference(preference: ExplicitPreference) {
    const currentExpectation = explicitPreferenceTargetExpectation(loadResult, preference.id);
    if (!currentExpectation) {
      setStatus('Reload scheduling preferences before removing this item.');
      return;
    }

    setBusy(true);
    try {
      const result = await commitExplicitPreferenceDelete(preference.id, currentExpectation);
      if (!result.ok) {
        setStatus(result.errors.join(' '));
        await refresh();
        return;
      }
      setForm(null);
      setExpectation(null);
      await refresh();
      await reconcilePlan('Scheduling preference removed and the flexible plan is up to date.');
    } catch {
      setStatus('Scheduling preference was not removed. Nothing else changed.');
    } finally {
      setBusy(false);
    }
  }

  async function exportPreferences() {
    setBusy(true);
    try {
      const result = await buildExplicitPreferenceBackup();
      if (!result.ok) {
        setStatus(result.errors.join(' '));
        return;
      }
      downloadJson(result.fileName, result.json);
      setStatus('Scheduling preferences export created on this device.');
    } catch {
      setStatus('Scheduling preferences could not be exported. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  async function clearPreferences() {
    setBusy(true);
    try {
      const result = await commitExplicitPreferenceReset(clearInput);
      if (!result.ok) {
        setStatus(result.errors.join(' '));
        return;
      }
      setClearInput('');
      setForm(null);
      setExpectation(null);
      await refresh();
      if (result.removed) {
        await reconcilePlan('Scheduling preferences cleared and the flexible plan is up to date.');
      } else {
        setStatus('There were no scheduling preferences to clear.');
      }
    } catch {
      setStatus('Scheduling preferences were not cleared. Nothing else changed.');
    } finally {
      setBusy(false);
    }
  }

  const healthy = loadResult.status === 'missing' || loadResult.status === 'ok';

  return (
    <Card>
      <div className="setup-section-heading">
        <h2>Scheduling preferences</h2>
        <p>Soft guidance for where flexible private work fits best. Protected and unavailable time still wins.</p>
      </div>

      {loadResult.status === 'invalid' || loadResult.status === 'readFailed' ? (
        <div className="setup-validation-summary" role="alert">
          <strong>Saved scheduling preferences need attention.</strong>
          <p>
            {loadResult.errors.join(' ')} Existing bytes were not replaced.{' '}
            {loadResult.status === 'invalid'
              ? 'You can export them or use the confirmed clear action below.'
              : 'Retry after storage becomes readable; destructive recovery is disabled while bytes cannot be read.'}
          </p>
        </div>
      ) : preferences.length === 0 ? (
        <p className="setup-note">No saved scheduling preferences yet.</p>
      ) : (
        <ul className="soft-placements__list" aria-label="Saved scheduling preferences">
          {preferences.map((preference) => (
            <li key={preference.id}>
              <div className="soft-placements__item-copy">
                <strong>{preferenceSummary(preference, catalogue)}</strong>
                {preference.expiresAt ? <p>Expiry: {new Date(preference.expiresAt).toLocaleString()}</p> : null}
              </div>
              <div className="setup-action-row">
                <Button disabled={busy || !healthy} onClick={() => beginEdit(preference)}>Edit</Button>
                <Button disabled={busy || !healthy} onClick={() => void removePreference(preference)}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {catalogueError ? <p role="status">{catalogueError}</p> : null}

      {!form ? (
        <div className="setup-action-row">
          <Button disabled={busy || !healthy || catalogue.length === 0} onClick={beginNew} variant="primary">
            Add scheduling preference
          </Button>
        </div>
      ) : (
        <fieldset disabled={busy} className="life-shape-block-editor">
          <legend>{expectation?.preference ? 'Edit scheduling preference' : 'Add scheduling preference'}</legend>
          <label>
            <span>Guidance</span>
            <select
              aria-label="Preference guidance"
              onChange={(event) => setForm({ ...form, relation: event.target.value as Relation })}
              value={form.relation}
            >
              <option value="prefer">Prefer</option>
              <option value="avoid">Avoid</option>
            </select>
          </label>
          <label>
            <span>Target type</span>
            <select
              aria-label="Preference target type"
              onChange={(event) => chooseTargetKind(event.target.value as TargetKind)}
              value={form.targetKind}
            >
              <option value="area">Area</option>
              <option value="taskType">Task type</option>
              <option value="intention">Task</option>
              <option value="rhythm">Rhythm</option>
            </select>
          </label>
          <label>
            <span>{targetKindLabel(form.targetKind)}</span>
            <select
              aria-label="Preference target"
              onChange={(event) => setForm({ ...form, targetValue: event.target.value })}
              value={form.targetValue}
            >
              {targetOptions.length === 0 ? (
                <option value="">No saved {targetKindLabel(form.targetKind).toLowerCase()} available</option>
              ) : targetOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Days</legend>
            <label>
              <input
                checked={form.days.length === 0}
                onChange={() => setForm({
                  ...form,
                  days: form.days.length === 0 ? ['Monday'] : [],
                })}
                type="checkbox"
              />
              Every day
            </label>
            {weekdays.map((day) => (
              <label key={day}>
                <input
                  checked={form.days.includes(day)}
                  disabled={form.days.length === 0}
                  onChange={() => toggleDay(day)}
                  type="checkbox"
                />
                {day}
              </label>
            ))}
          </fieldset>
          <div className="setup-action-row">
            <label>
              <span>Start time (optional)</span>
              <input
                aria-label="Preference start time"
                onChange={(event) => setForm({ ...form, start: event.target.value })}
                type="time"
                value={form.start}
              />
            </label>
            <label>
              <span>End time (optional)</span>
              <input
                aria-label="Preference end time"
                onChange={(event) => setForm({ ...form, end: event.target.value })}
                type="time"
                value={form.end}
              />
            </label>
          </div>
          <label>
            <span>Expires (optional)</span>
            <input
              aria-label="Preference expiry"
              onChange={(event) => setForm({ ...form, expiresLocal: event.target.value })}
              type="datetime-local"
              value={form.expiresLocal}
            />
          </label>
          <div className="setup-action-row">
            <Button onClick={() => void savePreference()} variant="primary">
              {expectation?.preference ? 'Save preference' : 'Add preference'}
            </Button>
            <Button onClick={() => {
              setForm(null);
              setExpectation(null);
              setStatus('');
            }}>Cancel</Button>
          </div>
        </fieldset>
      )}

      <div className="setup-backup-panel">
        <div className="setup-subheading">
          <h3>Export scheduling preferences</h3>
          <p>Creates local JSON containing only the explicit-preference record, including recovery bytes if the record is malformed.</p>
        </div>
        <Button disabled={busy} onClick={() => void exportPreferences()}>Export scheduling preferences</Button>
      </div>

      <div className="setup-backup-panel">
        <div className="setup-subheading">
          <h3>Clear scheduling preferences</h3>
          <p>Clears only explicit scheduling preferences. Tasks, rhythms, calendars, behaviour history, and ordinary settings are not deleted.</p>
        </div>
        <label>
          <span>Type {DELETE_EXPLICIT_PREFERENCES_CONFIRMATION} to clear these preferences</span>
          <input
            aria-label={`Type ${DELETE_EXPLICIT_PREFERENCES_CONFIRMATION} to clear scheduling preferences`}
            onChange={(event) => setClearInput(event.target.value)}
            value={clearInput}
          />
        </label>
        <Button
          disabled={
            busy ||
            loadResult.status === 'readFailed' ||
            clearInput !== DELETE_EXPLICIT_PREFERENCES_CONFIRMATION
          }
          onClick={() => void clearPreferences()}
        >
          Clear scheduling preferences
        </Button>
      </div>

      {status ? <p role="status">{status}</p> : null}
    </Card>
  );
}
