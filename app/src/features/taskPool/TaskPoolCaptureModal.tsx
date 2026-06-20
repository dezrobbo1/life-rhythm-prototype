import { useRef, useState } from 'react';
import { Button, Modal } from '../../components';
import type { TaskPoolItem } from '../../data/schemas';

type TaskPoolArea = TaskPoolItem['area'];

export type TaskPoolCaptureInput = {
  area: TaskPoolArea;
  dueAt?: string;
  fullVersion: string;
  minimumStillUsefulAfterDeadline?: boolean;
  minimumVersion: string;
  normalVersion: string;
  notes?: string;
  notUsefulAfter?: string;
  purpose?: string;
  timeConstraint?: 'dueBy';
  title: string;
};

type TaskPoolCaptureModalProps = {
  onClose: () => void;
  onSave: (task: TaskPoolCaptureInput) => Promise<boolean> | boolean;
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

export function TaskPoolCaptureModal({ onClose, onSave, open }: TaskPoolCaptureModalProps) {
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<TaskPoolArea>('admin');
  const [minimumVersion, setMinimumVersion] = useState('');
  const [normalVersion, setNormalVersion] = useState('');
  const [fullVersion, setFullVersion] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notUsefulAfter, setNotUsefulAfter] = useState('');
  const [minimumStillUsefulAfterDeadline, setMinimumStillUsefulAfterDeadline] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [timeEdgeOpen, setTimeEdgeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const canSave = title.trim().length > 0 && minimumVersion.trim().length > 0;

  function resetForm() {
    setTitle('');
    setArea('admin');
    setMinimumVersion('');
    setNormalVersion('');
    setFullVersion('');
    setPurpose('');
    setNotes('');
    setDueAt('');
    setNotUsefulAfter('');
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
      const dueAtIso = dateTimeLocalToIso(dueAt);
      const notUsefulAfterIso = dateTimeLocalToIso(notUsefulAfter);

      if (dueAt.trim() && !dueAtIso) {
        setSaveError('Task was not captured. Check the useful-before time.');
        return;
      }

      if (notUsefulAfter.trim() && !notUsefulAfterIso) {
        setSaveError('Task was not captured. Check the useful-until time.');
        return;
      }

      const saved = await onSave({
        area,
        ...(dueAtIso ? { dueAt: dueAtIso, timeConstraint: 'dueBy' as const } : {}),
        fullVersion: fullVersion.trim(),
        ...(minimumStillUsefulAfterDeadline ? { minimumStillUsefulAfterDeadline: true } : {}),
        minimumVersion: minimumVersion.trim(),
        normalVersion: normalVersion.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(notUsefulAfterIso ? { notUsefulAfter: notUsefulAfterIso } : {}),
        ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
        title: title.trim(),
      });

      if (saved) {
        resetForm();
        return;
      }

      setSaveError('Task was not captured. Check the required fields.');
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
    <Modal onClose={closeModal} open={open} title="Capture task">
      <div className="add-task-form">
        <p className="lede">Safely held for later. This does not add it to Today.</p>
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
        <label>
          <span>Minimum version</span>
          <input onChange={(event) => setMinimumVersion(event.target.value)} value={minimumVersion} />
        </label>
        <button
          aria-expanded={detailsOpen}
          className="add-task-form__toggle"
          onClick={() => setDetailsOpen((openDetails) => !openDetails)}
          type="button"
        >
          Optional details
          <span>{detailsOpen ? 'Hide' : 'Show'}</span>
        </button>
        {detailsOpen ? (
          <div className="add-task-form__optional">
            <label>
              <span>Normal version</span>
              <input onChange={(event) => setNormalVersion(event.target.value)} value={normalVersion} />
            </label>
            <label>
              <span>Full version</span>
              <input onChange={(event) => setFullVersion(event.target.value)} value={fullVersion} />
            </label>
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
              <p>Optional. This records context only.</p>
              <p>No schedule created.</p>
            </div>
            <label>
              <span>Useful before</span>
              <input onChange={(event) => setDueAt(event.target.value)} type="datetime-local" value={dueAt} />
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
          </section>
        ) : null}
        {saveError ? <p className="form-feedback" role="alert">{saveError}</p> : null}
        <div className="modal-actions">
          <Button disabled={!canSave || saving} onClick={saveTask} variant="primary">
            {saving ? 'Capturing task...' : 'Save captured task'}
          </Button>
          <Button onClick={closeModal}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
