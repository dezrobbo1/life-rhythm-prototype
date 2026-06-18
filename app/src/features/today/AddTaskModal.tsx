import { useRef, useState } from 'react';
import { Button, Modal } from '../../components';

export type MockAddTaskInput = {
  area: string;
  dueAt?: string;
  expiresAfter?: string;
  fixedAt?: string;
  fullVersion: string;
  latestUsefulStartAt?: string;
  minimumVersion: string;
  minimumStillUsefulAfterDeadline?: boolean;
  missedPolicy?: 'ask' | 'park' | 'notToday' | 'minimumOnly' | 'followUpPrompt' | 'hideUntilReview' | 'archiveIfExpired';
  normalVersion: string;
  notUsefulAfter?: string;
  timeConstraint?: 'flexible' | 'dueBy' | 'fixedAt' | 'expiresAfter';
  title: string;
};

type AddTaskModalProps = {
  onClose: () => void;
  onSave: (task: MockAddTaskInput) => Promise<boolean> | boolean;
  open: boolean;
};

export function AddTaskModal({ onClose, onSave, open }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('Home admin');
  const [minimumVersion, setMinimumVersion] = useState('');
  const [normalVersion, setNormalVersion] = useState('');
  const [fullVersion, setFullVersion] = useState('');
  const [timeConstraint, setTimeConstraint] = useState<NonNullable<MockAddTaskInput['timeConstraint']>>('flexible');
  const [dueAt, setDueAt] = useState('');
  const [fixedAt, setFixedAt] = useState('');
  const [expiresAfter, setExpiresAfter] = useState('');
  const [latestUsefulStartAt, setLatestUsefulStartAt] = useState('');
  const [notUsefulAfter, setNotUsefulAfter] = useState('');
  const [minimumStillUsefulAfterDeadline, setMinimumStillUsefulAfterDeadline] = useState(false);
  const [missedPolicy, setMissedPolicy] = useState<NonNullable<MockAddTaskInput['missedPolicy']>>('ask');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const canSave = title.trim().length > 0 && area.trim().length > 0 && minimumVersion.trim().length > 0;

  function dateTimeLocalToIso(value: string): string | undefined {
    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const parsed = new Date(trimmed);

    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  function buildTimeEdgeInput():
    | { ok: true; timeEdge: Partial<MockAddTaskInput> }
    | { ok: false; message: string } {
    const dueAtIso = dateTimeLocalToIso(dueAt);
    const fixedAtIso = dateTimeLocalToIso(fixedAt);
    const expiresAfterIso = dateTimeLocalToIso(expiresAfter);
    const latestUsefulStartAtIso = dateTimeLocalToIso(latestUsefulStartAt);
    const notUsefulAfterIso = dateTimeLocalToIso(notUsefulAfter);

    if (timeConstraint === 'dueBy' && !dueAtIso) {
      return { message: 'Add a due-by time, or keep this flexible.', ok: false };
    }

    if (timeConstraint === 'fixedAt' && !fixedAtIso) {
      return { message: 'Add the fixed time, or keep this flexible.', ok: false };
    }

    if (timeConstraint === 'expiresAfter' && !expiresAfterIso) {
      return { message: 'Add when this stops being useful, or keep this flexible.', ok: false };
    }

    if (
      latestUsefulStartAtIso &&
      notUsefulAfterIso &&
      Date.parse(latestUsefulStartAtIso) > Date.parse(notUsefulAfterIso)
    ) {
      return { message: 'Last useful start needs to be before the not-useful-after time.', ok: false };
    }

    return {
      ok: true,
      timeEdge: {
        ...(timeConstraint !== 'flexible' ? { timeConstraint } : {}),
        ...(dueAtIso ? { dueAt: dueAtIso } : {}),
        ...(fixedAtIso ? { fixedAt: fixedAtIso } : {}),
        ...(expiresAfterIso ? { expiresAfter: expiresAfterIso } : {}),
        ...(latestUsefulStartAtIso ? { latestUsefulStartAt: latestUsefulStartAtIso } : {}),
        ...(notUsefulAfterIso ? { notUsefulAfter: notUsefulAfterIso } : {}),
        ...(minimumStillUsefulAfterDeadline ? { minimumStillUsefulAfterDeadline: true } : {}),
        ...(missedPolicy !== 'ask' ? { missedPolicy } : {}),
      },
    };
  }

  function resetForm() {
    setTitle('');
    setArea('Home admin');
    setMinimumVersion('');
    setNormalVersion('');
    setFullVersion('');
    setTimeConstraint('flexible');
    setDueAt('');
    setFixedAt('');
    setExpiresAfter('');
    setLatestUsefulStartAt('');
    setNotUsefulAfter('');
    setMinimumStillUsefulAfterDeadline(false);
    setMissedPolicy('ask');
    setVersionsOpen(false);
    setSaveError('');
  }

  async function saveTask() {
    if (!canSave || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const timeEdgeInput = buildTimeEdgeInput();

      if (!timeEdgeInput.ok) {
        setSaveError(timeEdgeInput.message);
        return;
      }

      const saved = await onSave({
        area: area.trim(),
        ...timeEdgeInput.timeEdge,
        fullVersion: fullVersion.trim(),
        minimumVersion: minimumVersion.trim(),
        normalVersion: normalVersion.trim(),
        title: title.trim(),
      });

      if (saved) {
        resetForm();
        return;
      }

      setSaveError('One-off was not saved. Check the required fields.');
    } catch {
      setSaveError('One-off was not saved. Check the required fields.');
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
    <Modal onClose={closeModal} open={open} title="Add one-off">
      <div className="add-task-form">
        <p className="lede">For today only. Saved on this device. It will not go into Library.</p>
        <label>
          <span>Task title</span>
          <input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label>
          <span>Area</span>
          <input onChange={(event) => setArea(event.target.value)} value={area} />
        </label>
        <label>
          <span>Minimum version</span>
          <input onChange={(event) => setMinimumVersion(event.target.value)} value={minimumVersion} />
        </label>
        <button
          aria-expanded={versionsOpen}
          className="add-task-form__toggle"
          onClick={() => setVersionsOpen((openVersions) => !openVersions)}
          type="button"
        >
          Optional normal/full versions
          <span>{versionsOpen ? 'Hide' : 'Show'}</span>
        </button>
        {versionsOpen ? (
          <div className="add-task-form__optional">
            <label>
              <span>Normal version</span>
              <input onChange={(event) => setNormalVersion(event.target.value)} value={normalVersion} />
            </label>
            <label>
              <span>Full version</span>
              <input onChange={(event) => setFullVersion(event.target.value)} value={fullVersion} />
            </label>
          </div>
        ) : null}
        <section className="add-task-form__section" aria-labelledby="one-off-time-edge-title">
          <div>
            <h3 id="one-off-time-edge-title">Time edge</h3>
            <p>Optional. This describes when the task is useful.</p>
            <p>This does not schedule the task. Minimum still counts if it helps.</p>
          </div>
          <label>
            <span>Time edge type</span>
            <select
              aria-label="Time edge type"
              onChange={(event) => setTimeConstraint(event.target.value as NonNullable<MockAddTaskInput['timeConstraint']>)}
              value={timeConstraint}
            >
              <option value="flexible">Flexible</option>
              <option value="dueBy">Due by</option>
              <option value="fixedAt">Fixed at</option>
              <option value="expiresAfter">Expires after</option>
            </select>
          </label>
          {timeConstraint === 'dueBy' ? (
            <label>
              <span>Due by</span>
              <input onChange={(event) => setDueAt(event.target.value)} type="datetime-local" value={dueAt} />
            </label>
          ) : null}
          {timeConstraint === 'fixedAt' ? (
            <label>
              <span>Fixed at</span>
              <input onChange={(event) => setFixedAt(event.target.value)} type="datetime-local" value={fixedAt} />
            </label>
          ) : null}
          {timeConstraint === 'expiresAfter' ? (
            <label>
              <span>Expires after</span>
              <input
                onChange={(event) => setExpiresAfter(event.target.value)}
                type="datetime-local"
                value={expiresAfter}
              />
            </label>
          ) : null}
          <div className="add-task-form__optional">
            <label>
              <span>Last useful start</span>
              <input
                onChange={(event) => setLatestUsefulStartAt(event.target.value)}
                type="datetime-local"
                value={latestUsefulStartAt}
              />
            </label>
            <label>
              <span>Not useful after</span>
              <input onChange={(event) => setNotUsefulAfter(event.target.value)} type="datetime-local" value={notUsefulAfter} />
            </label>
            <label className="add-task-form__checkbox">
              <input
                checked={minimumStillUsefulAfterDeadline}
                onChange={(event) => setMinimumStillUsefulAfterDeadline(event.target.checked)}
                type="checkbox"
              />
              <span>Minimum still helps after the time edge</span>
            </label>
            <label>
              <span>If it stops being useful</span>
              <select
                aria-label="If it stops being useful"
                onChange={(event) => setMissedPolicy(event.target.value as NonNullable<MockAddTaskInput['missedPolicy']>)}
                value={missedPolicy}
              >
                <option value="ask">Ask me</option>
                <option value="park">Park</option>
                <option value="notToday">Not today</option>
                <option value="minimumOnly">Minimum only</option>
                <option value="followUpPrompt">Follow-up prompt</option>
                <option value="hideUntilReview">Hide until review</option>
                <option value="archiveIfExpired">Archive if expired</option>
              </select>
            </label>
          </div>
        </section>
        {saveError ? <p className="form-feedback" role="alert">{saveError}</p> : null}
        <div className="modal-actions">
          <Button disabled={!canSave || saving} onClick={saveTask} variant="primary">
            {saving ? 'Saving one-off...' : 'Save one-off'}
          </Button>
          <Button onClick={closeModal}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
