import { useRef, useState } from 'react';
import { Button, Modal } from '../../components';
import { libraryCategories, type RhythmCategory } from './mockLibraryData';
import type { RhythmTemplate } from '../../data/schemas';

export type CreateRhythmInput = {
  category: RhythmCategory;
  effectiveFromLocalDate: string;
  frequency: number;
  fullAction: string;
  fullMinutes: number;
  maxPerDay: number;
  minimumAction: string;
  minimumMinutes: number;
  normalAction: string;
  normalMinutes: number;
  period: 'day' | 'week' | 'month';
  preferredDays: RhythmTemplate['schedule']['preferredDays'];
  preferredTime: RhythmTemplate['schedule']['bestTime'];
  purpose: string;
  timezone: string;
  title: string;
  turnOn: boolean;
};

export type RhythmFormInitial = Partial<CreateRhythmInput>;

type CreateRhythmModalProps = {
  initial?: RhythmFormInitial;
  mode?: 'create' | 'configure' | 'edit';
  onClose: () => void;
  onSave: (rhythm: CreateRhythmInput) => Promise<boolean> | boolean;
  open: boolean;
};

const rhythmCategories = libraryCategories.filter((category): category is RhythmCategory => category !== 'All');
const weekdays: RhythmTemplate['schedule']['preferredDays'] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

function todayLocalDate() {
  const date = new Date();
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1)
    .toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function positiveNumber(value: string, label: string, errors: string[]) {
  const number = Number(value);
  if (!/^\d+$/.test(value.trim()) || !Number.isInteger(number) || number <= 0) {
    errors.push(`${label} must be a positive whole number.`);
    return null;
  }
  return number;
}

export function CreateRhythmModal({ initial = {}, mode = 'create', onClose, onSave, open }: CreateRhythmModalProps) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [category, setCategory] = useState<RhythmCategory>(initial.category ?? 'Household');
  const [purpose, setPurpose] = useState(initial.purpose ?? '');
  const [minimumAction, setMinimumAction] = useState(initial.minimumAction ?? '');
  const [minimumMinutes, setMinimumMinutes] = useState(initial.minimumMinutes?.toString() ?? '');
  const [normalAction, setNormalAction] = useState(initial.normalAction ?? '');
  const [normalMinutes, setNormalMinutes] = useState(initial.normalMinutes?.toString() ?? '');
  const [fullAction, setFullAction] = useState(initial.fullAction ?? '');
  const [fullMinutes, setFullMinutes] = useState(initial.fullMinutes?.toString() ?? '');
  const [frequency, setFrequency] = useState(initial.frequency?.toString() ?? '1');
  const [period, setPeriod] = useState<CreateRhythmInput['period']>(initial.period ?? 'week');
  const [preferredDays, setPreferredDays] = useState<CreateRhythmInput['preferredDays']>(initial.preferredDays ?? []);
  const [preferredTime, setPreferredTime] = useState<CreateRhythmInput['preferredTime']>(initial.preferredTime ?? 'anytime');
  const [effectiveFromLocalDate, setEffectiveFromLocalDate] = useState(initial.effectiveFromLocalDate ?? todayLocalDate());
  const [maxPerDay, setMaxPerDay] = useState(initial.maxPerDay?.toString() ?? '1');
  const [turnOn, setTurnOn] = useState(initial.turnOn ?? true);
  const [versionsOpen, setVersionsOpen] = useState(Boolean(initial.normalAction || initial.fullAction));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const savingRef = useRef(false);
  const canSave = title.trim().length > 0 && minimumAction.trim().length > 0 && minimumMinutes.trim().length > 0;

  async function saveRhythm() {
    if (!canSave || savingRef.current) return;
    const nextErrors: string[] = [];
    const minimum = positiveNumber(minimumMinutes, 'Minimum duration in minutes', nextErrors);
    const frequencyValue = positiveNumber(frequency, 'Frequency', nextErrors);
    const maxPerDayValue = positiveNumber(maxPerDay, 'Maximum per day', nextErrors);
    const hasNormal = normalAction.trim().length > 0 || normalMinutes.trim().length > 0;
    const normal = hasNormal ? positiveNumber(normalMinutes, 'Normal duration in minutes', nextErrors) : minimum;
    if (hasNormal && !normalAction.trim()) nextErrors.push('Normal action is required when Normal minutes are entered.');
    const hasFull = fullAction.trim().length > 0 || fullMinutes.trim().length > 0;
    const full = hasFull ? positiveNumber(fullMinutes, 'Full duration in minutes', nextErrors) : normal;
    if (hasFull && !fullAction.trim()) nextErrors.push('Full action is required when Full minutes are entered.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFromLocalDate)) nextErrors.push('Effective from must be a valid local date.');
    else if (effectiveFromLocalDate < todayLocalDate()) nextErrors.push('Effective from must be today or a future local date.');
    if (period === 'day' && frequencyValue && maxPerDayValue && frequencyValue > maxPerDayValue) {
      nextErrors.push('For a daily rhythm, Maximum per day must be at least the frequency.');
    }
    if (maxPerDayValue && maxPerDayValue > 24) {
      nextErrors.push('Maximum per day must be 24 or fewer.');
    }
    const guaranteedDays = period === 'day' ? 1 : period === 'week' ? 7 : 28;
    if (period !== 'day' && frequencyValue && maxPerDayValue && frequencyValue > guaranteedDays * maxPerDayValue) {
      nextErrors.push('Frequency cannot fit inside every selected period at this Maximum per day.');
    }
    if (nextErrors.length > 0 || !minimum || !normal || !full || !frequencyValue || !maxPerDayValue) {
      setErrors(nextErrors);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setErrors([]);
    try {
      const saved = await onSave({
        category,
        effectiveFromLocalDate,
        frequency: frequencyValue,
        fullAction: hasFull ? fullAction.trim() : (hasNormal ? normalAction.trim() : minimumAction.trim()),
        fullMinutes: full,
        maxPerDay: maxPerDayValue,
        minimumAction: minimumAction.trim(),
        minimumMinutes: minimum,
        normalAction: hasNormal ? normalAction.trim() : minimumAction.trim(),
        normalMinutes: normal,
        period,
        preferredDays,
        preferredTime,
        purpose: purpose.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        title: title.trim(),
        turnOn,
      });
      if (!saved) setErrors(['Rhythm was not saved. Check the fields and try again.']);
    } catch {
      setErrors(['Rhythm was not saved. Check the fields and try again.']);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function toggleDay(day: RhythmTemplate['schedule']['preferredDays'][number]) {
    setPreferredDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day]);
  }

  const modalTitle = mode === 'create' ? 'Create rhythm' : mode === 'edit' ? 'Edit rhythm' : 'Configure rhythm';
  return (
    <Modal onClose={onClose} open={open} title={modalTitle}>
      <div className="add-task-form rhythm-config-form">
        <p className="lede">Set the actions, minutes, and flexible frequency this rhythm will actually use.</p>
        {mode === 'configure' && initial.minimumMinutes !== undefined ? (
          <p className="form-notice">Review every saved action and duration before turning this rhythm on. Older rhythm minutes may have been filled automatically.</p>
        ) : null}
        <label><span>Rhythm title</span><input onChange={(event) => setTitle(event.target.value)} value={title} /></label>
        <label><span>Category</span><select aria-label="Category" onChange={(event) => setCategory(event.target.value as RhythmCategory)} value={category}>{rhythmCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>Purpose (optional)</span><input onChange={(event) => setPurpose(event.target.value)} value={purpose} /></label>
        <fieldset>
          <legend>Minimum</legend><p>The smallest useful version.</p>
          <label><span>Minimum action</span><input onChange={(event) => setMinimumAction(event.target.value)} value={minimumAction} /></label>
          <label><span>Minimum minutes</span><input inputMode="numeric" min="1" onChange={(event) => setMinimumMinutes(event.target.value)} type="number" value={minimumMinutes} /></label>
        </fieldset>
        <button aria-expanded={versionsOpen} className="add-task-form__toggle" onClick={() => setVersionsOpen((value) => !value)} type="button">Optional Normal and Full versions <span>{versionsOpen ? 'Hide' : 'Show'}</span></button>
        {versionsOpen ? <div className="add-task-form__optional">
          <fieldset><legend>Normal</legend><p>Leave both blank to inherit the exact Minimum action and minutes.</p><label><span>Normal action</span><input onChange={(event) => setNormalAction(event.target.value)} value={normalAction} /></label><label><span>Normal minutes</span><input inputMode="numeric" min="1" onChange={(event) => setNormalMinutes(event.target.value)} type="number" value={normalMinutes} /></label></fieldset>
          <fieldset><legend>Full</legend><p>Leave both blank to inherit the exact preceding action and minutes.</p><label><span>Full action</span><input onChange={(event) => setFullAction(event.target.value)} value={fullAction} /></label><label><span>Full minutes</span><input inputMode="numeric" min="1" onChange={(event) => setFullMinutes(event.target.value)} type="number" value={fullMinutes} /></label></fieldset>
        </div> : null}
        <fieldset>
          <legend>Flexible frequency</legend>
          <div className="rhythm-config-form__frequency">
            <label><span>Times</span><input inputMode="numeric" min="1" onChange={(event) => setFrequency(event.target.value)} type="number" value={frequency} /></label>
            <label><span>Per</span><select onChange={(event) => setPeriod(event.target.value as CreateRhythmInput['period'])} value={period}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
            <label><span>Maximum per day</span><input inputMode="numeric" min="1" onChange={(event) => setMaxPerDay(event.target.value)} type="number" value={maxPerDay} /></label>
          </div>
          <fieldset className="rhythm-config-form__days"><legend>Preferred days (optional)</legend>{weekdays.map((day) => <label key={day}><input checked={preferredDays.includes(day)} onChange={() => toggleDay(day)} type="checkbox" /> <span>{day.slice(0, 3)}</span></label>)}</fieldset>
          <label><span>Preferred time</span><select onChange={(event) => setPreferredTime(event.target.value as CreateRhythmInput['preferredTime'])} value={preferredTime}><option value="anytime">Anytime</option><option value="morning">Morning</option><option value="midday">Midday</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="after work">After work</option><option value="shutdown">Shutdown</option></select></label>
          <label><span>Effective from</span><input onChange={(event) => setEffectiveFromLocalDate(event.target.value)} type="date" value={effectiveFromLocalDate} /></label>
        </fieldset>
        <label className="setup-toggle"><input checked={turnOn} onChange={(event) => setTurnOn(event.target.checked)} type="checkbox" /><span><strong>Turn on after saving</strong><small>Creates durable recurring intent. Clear it to save the configuration disabled.</small></span></label>
        {errors.length > 0 ? <div className="form-feedback" role="alert"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <div className="modal-actions"><Button disabled={!canSave || saving} onClick={() => { void saveRhythm(); }} variant="primary">{saving ? 'Saving rhythm...' : 'Save rhythm'}</Button><Button onClick={onClose}>Cancel</Button></div>
      </div>
    </Modal>
  );
}
