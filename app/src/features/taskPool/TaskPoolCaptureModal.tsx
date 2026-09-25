import { useRef, useState } from 'react';
import { Button, Modal } from '../../components';
import type { TaskPoolItem } from '../../data/schemas';
import type { TaskPoolCaptureInput, TaskPoolCaptureResult } from './taskPoolCapture';
import { resolveTaskVersions } from './taskVersionInput';

type TaskPoolArea = TaskPoolItem['area'];

type TaskPoolCaptureModalProps = {
  item?: TaskPoolItem | null;
  onClose: () => void;
  onSave: (task: TaskPoolCaptureInput) => Promise<TaskPoolCaptureResult> | TaskPoolCaptureResult;
  open: boolean;
};

const areaOptions: Array<{ label: string; value: TaskPoolArea }> = [
  { label: 'Admin', value: 'admin' },
  { label: 'Home', value: 'house' },
  { label: 'Food', value: 'food' },
  { label: 'Movement', value: 'movement' },
  { label: 'Work', value: 'work' },
  { label: 'Money', value: 'money' },
  { label: 'Health', value: 'health' },
  { label: 'Social', value: 'social' },
  { label: 'Anti-scroll', value: 'antidrift' },
  { label: 'Emotional recovery', value: 'emotion' },
  { label: 'Sensory load', value: 'sensory' },
  { label: 'Other', value: 'other' },
];

function dateTimeLocalToIso(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function isoToLocal(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function submittedIso(value: string, original?: string) {
  return original && value === isoToLocal(original) ? original : dateTimeLocalToIso(value);
}

export function TaskPoolCaptureModal({ item, onClose, onSave, open }: TaskPoolCaptureModalProps) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [area, setArea] = useState<TaskPoolArea>(item?.area ?? 'other');
  const [minimumVersion, setMinimumVersion] = useState(item?.minimum.label ?? '');
  const [minimumMinutes, setMinimumMinutes] = useState(item ? String(item.minimum.minutes) : '');
  const [normalVersion, setNormalVersion] = useState(item?.normal.label ?? '');
  const [normalMinutes, setNormalMinutes] = useState(item ? String(item.normal.minutes) : '');
  const [fullVersion, setFullVersion] = useState(item?.full.label ?? '');
  const [fullMinutes, setFullMinutes] = useState(item ? String(item.full.minutes) : '');
  const [purpose, setPurpose] = useState(item?.purpose ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [timeConstraint, setTimeConstraint] = useState<NonNullable<TaskPoolCaptureInput['timeConstraint']>>(item?.timeConstraint ?? 'flexible');
  const [dueAt, setDueAt] = useState(isoToLocal(item?.dueAt));
  const [fixedAt, setFixedAt] = useState(isoToLocal(item?.fixedAt));
  const [expiresAfter, setExpiresAfter] = useState(isoToLocal(item?.expiresAfter));
  const [latestUsefulStartAt, setLatestUsefulStartAt] = useState(isoToLocal(item?.latestUsefulStartAt));
  const [notUsefulAfter, setNotUsefulAfter] = useState(isoToLocal(item?.notUsefulAfter));
  const [missedPolicy, setMissedPolicy] = useState<NonNullable<TaskPoolCaptureInput['missedPolicy']>>(item?.missedPolicy ?? 'ask');
  const [minimumStillUsefulAfterDeadline, setMinimumStillUsefulAfterDeadline] = useState(Boolean(item?.minimumStillUsefulAfterDeadline));
  const [detailsOpen, setDetailsOpen] = useState(Boolean(item));
  const [timeEdgeOpen, setTimeEdgeOpen] = useState(Boolean(item?.dueAt || item?.fixedAt || item?.expiresAfter || item?.latestUsefulStartAt || item?.notUsefulAfter || item?.minimumStillUsefulAfterDeadline || item?.missedPolicy));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const canSave = title.trim().length > 0 && minimumVersion.trim().length > 0;

  function resetForm() {
    setTitle('');
    setArea('other');
    setMinimumVersion('');
    setMinimumMinutes('');
    setNormalVersion('');
    setNormalMinutes('');
    setFullVersion('');
    setFullMinutes('');
    setPurpose('');
    setNotes('');
    setTimeConstraint('flexible');
    setDueAt('');
    setFixedAt('');
    setExpiresAfter('');
    setLatestUsefulStartAt('');
    setNotUsefulAfter('');
    setMissedPolicy('ask');
    setMinimumStillUsefulAfterDeadline(false);
    setDetailsOpen(false);
    setTimeEdgeOpen(false);
    setSaveError('');
  }

  async function saveTask() {
    if (!canSave || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const versions = { minimumVersion, minimumMinutes, normalVersion, normalMinutes, fullVersion, fullMinutes };
      const parsedVersions = resolveTaskVersions(versions);
      if (!parsedVersions.ok) {
        setSaveError(parsedVersions.error);
        return;
      }
      const dueAtIso = submittedIso(dueAt, item?.dueAt);
      const fixedAtIso = submittedIso(fixedAt, item?.fixedAt);
      const expiresAfterIso = submittedIso(expiresAfter, item?.expiresAfter);
      const latestUsefulStartAtIso = submittedIso(latestUsefulStartAt, item?.latestUsefulStartAt);
      const notUsefulAfterIso = submittedIso(notUsefulAfter, item?.notUsefulAfter);

      if ((timeConstraint === 'flexible' || timeConstraint === 'dueBy') && dueAt.trim() && !dueAtIso) {
        setSaveError('Task was not captured. Check the useful-before time.');
        return;
      }

      if (notUsefulAfter.trim() && !notUsefulAfterIso) {
        setSaveError('Task was not captured. Check the useful-until time.');
        return;
      }
      if (timeConstraint === 'fixedAt' && !fixedAtIso) {
        setSaveError('Add the fixed time or choose a different useful window.');
        return;
      }
      if (timeConstraint === 'expiresAfter' && !expiresAfterIso) {
        setSaveError('Add when it expires or choose a different useful window.');
        return;
      }
      if (timeConstraint === 'dueBy' && !dueAtIso) {
        setSaveError('Add the useful-before time or choose Flexible.');
        return;
      }
      if (latestUsefulStartAt.trim() && !latestUsefulStartAtIso) {
        setSaveError('Check the last useful start time.');
        return;
      }
      if (latestUsefulStartAtIso && notUsefulAfterIso &&
          Date.parse(latestUsefulStartAtIso) > Date.parse(notUsefulAfterIso)) {
        setSaveError('Last useful start needs to be before the useful-until time.');
        return;
      }

      const effectiveConstraint = timeConstraint === 'flexible' && dueAtIso ? 'dueBy' : timeConstraint;

      const result = await onSave({
        area,
        ...(effectiveConstraint !== 'flexible' ? { timeConstraint: effectiveConstraint } : {}),
        ...(effectiveConstraint === 'dueBy' && dueAtIso ? { dueAt: dueAtIso } : {}),
        ...(effectiveConstraint === 'fixedAt' && fixedAtIso ? { fixedAt: fixedAtIso } : {}),
        ...(effectiveConstraint === 'expiresAfter' && expiresAfterIso ? { expiresAfter: expiresAfterIso } : {}),
        ...(latestUsefulStartAtIso ? { latestUsefulStartAt: latestUsefulStartAtIso } : {}),
        ...(missedPolicy !== 'ask' ? { missedPolicy } : {}),
        fullVersion: fullVersion.trim(),
        fullMinutes: fullMinutes.trim(),
        ...(minimumStillUsefulAfterDeadline ? { minimumStillUsefulAfterDeadline: true } : {}),
        minimumVersion: minimumVersion.trim(),
        minimumMinutes: minimumMinutes.trim(),
        normalVersion: normalVersion.trim(),
        normalMinutes: normalMinutes.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(notUsefulAfterIso ? { notUsefulAfter: notUsefulAfterIso } : {}),
        ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
        title: title.trim(),
      });

      if (result.ok) {
        resetForm();
        return;
      }

      setSaveError(result.errors.join(' '));
    } catch {
      setSaveError('Task was not captured. Check the required fields.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function closeModal() {
    resetForm();
    onClose();
  }

  return (
    <Modal onClose={closeModal} open={open} title={item ? 'Edit task' : 'Capture task'}>
      <div className="add-task-form">
        <p className="lede">{item
          ? 'Correct this task without changing its place in Held or Today. Older saved times may have been filled in automatically; check them before saving.'
          : 'Held outside Today. Life Rhythm may quietly find a private time for it.'}</p>
        <label>
          <span>Task title</span>
          <input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label>
          <span>Area</span>
          <select onChange={(event) => setArea(event.target.value as TaskPoolArea)} value={area}>
            {areaOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p>Other is the starting area. Change it if a more specific area fits.</p>
        <div className="task-version-pair">
          <label><span>Minimum version</span><input onChange={(event) => setMinimumVersion(event.target.value)} value={minimumVersion} /></label>
          <label><span>Minimum minutes</span><input inputMode="numeric" onChange={(event) => setMinimumMinutes(event.target.value)} value={minimumMinutes} /></label>
        </div>
        <button
          aria-expanded={detailsOpen}
          className="add-task-form__toggle"
          onClick={() => setDetailsOpen((openDetails) => !openDetails)}
          type="button"
        >
          Optional details
          <span>{detailsOpen ? 'Hide' : 'Show'}</span>
        </button>
        <p>Without a Normal or Full version, Life Rhythm uses the preceding action and its minutes exactly.</p>
        {detailsOpen ? (
          <div className="add-task-form__optional">
            <div className="task-version-pair">
              <label><span>Normal version</span><input onChange={(event) => setNormalVersion(event.target.value)} value={normalVersion} /></label>
              <label><span>Normal minutes</span><input inputMode="numeric" onChange={(event) => setNormalMinutes(event.target.value)} value={normalMinutes} /></label>
            </div>
            <div className="task-version-pair">
              <label><span>Full version</span><input onChange={(event) => setFullVersion(event.target.value)} value={fullVersion} /></label>
              <label><span>Full minutes</span><input inputMode="numeric" onChange={(event) => setFullMinutes(event.target.value)} value={fullMinutes} /></label>
            </div>
            <label>
              <span>Purpose</span>
              <input onChange={(event) => setPurpose(event.target.value)} value={purpose} />
            </label>
            <label>
              <span>Notes</span>
              <textarea onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />
            </label>
          </div>
        ) : null}
        <button
          aria-expanded={timeEdgeOpen}
          className="add-task-form__toggle"
          onClick={() => setTimeEdgeOpen((openTimeEdge) => !openTimeEdge)}
          type="button"
        >
          Optional useful window
          <span>{timeEdgeOpen ? 'Hide' : 'Show'}</span>
        </button>
        {timeEdgeOpen ? (
          <section className="add-task-form__section" aria-labelledby="task-pool-time-edge-title">
            <div>
              <h3 id="task-pool-time-edge-title">Useful window</h3>
              <p>Optional. This tells Life Rhythm when the task helps.</p>
            </div>
            <label>
              <span>Time edge type</span>
              <select onChange={(event) => setTimeConstraint(event.target.value as NonNullable<TaskPoolCaptureInput['timeConstraint']>)} value={timeConstraint}>
                <option value="flexible">Flexible</option>
                <option value="dueBy">Useful before</option>
                <option value="fixedAt">Fixed at</option>
                <option value="expiresAfter">Expires after</option>
              </select>
            </label>
            {timeConstraint === 'flexible' || timeConstraint === 'dueBy' ? <label>
              <span>Useful before</span>
              <input onChange={(event) => setDueAt(event.target.value)} type="datetime-local" value={dueAt} />
            </label> : null}
            {timeConstraint === 'fixedAt' ? <label>
              <span>Fixed at</span>
              <input onChange={(event) => setFixedAt(event.target.value)} type="datetime-local" value={fixedAt} />
            </label> : null}
            {timeConstraint === 'expiresAfter' ? <label>
              <span>Expires after</span>
              <input onChange={(event) => setExpiresAfter(event.target.value)} type="datetime-local" value={expiresAfter} />
            </label> : null}
            <label>
              <span>Last useful start</span>
              <input onChange={(event) => setLatestUsefulStartAt(event.target.value)} type="datetime-local" value={latestUsefulStartAt} />
            </label>
            <label>
              <span>Useful until</span>
              <input onChange={(event) => setNotUsefulAfter(event.target.value)} type="datetime-local" value={notUsefulAfter} />
            </label>
            <label className="add-task-form__checkbox">
              <input
                checked={minimumStillUsefulAfterDeadline}
                onChange={(event) => setMinimumStillUsefulAfterDeadline(event.target.checked)}
                type="checkbox"
              />
              <span>Minimum still helps</span>
            </label>
            <label>
              <span>If it stops being useful</span>
              <select onChange={(event) => setMissedPolicy(event.target.value as NonNullable<TaskPoolCaptureInput['missedPolicy']>)} value={missedPolicy}>
                <option value="ask">Ask me</option><option value="park">Park</option>
                <option value="notToday">Not today</option><option value="minimumOnly">Minimum only</option>
                <option value="followUpPrompt">Follow-up prompt</option><option value="hideUntilReview">Hide until review</option>
                <option value="archiveIfExpired">Archive if expired</option>
              </select>
            </label>
          </section>
        ) : null}
        {saveError ? <p className="form-feedback" role="alert">{saveError}</p> : null}
        <div className="modal-actions">
          <Button disabled={!canSave || saving} onClick={saveTask} variant="primary">
            {saving ? 'Saving task...' : item ? 'Save changes' : 'Save captured task'}
          </Button>
          <Button onClick={closeModal}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
