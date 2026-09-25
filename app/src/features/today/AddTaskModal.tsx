import { useRef, useState } from 'react';
import { Button, Modal } from '../../components';
import type { ActiveTask } from '../../data/schemas';
import { resolveTaskVersions, type TaskVersionInput } from '../taskPool/taskVersionInput';

export type MockAddTaskInput = TaskVersionInput & {
  area: string;
  dueAt?: string;
  expiresAfter?: string;
  fixedAt?: string;
  latestUsefulStartAt?: string;
  minimumStillUsefulAfterDeadline?: boolean;
  missedPolicy?: 'ask' | 'park' | 'notToday' | 'minimumOnly' | 'followUpPrompt' | 'hideUntilReview' | 'archiveIfExpired';
  notUsefulAfter?: string;
  timeConstraint?: 'flexible' | 'dueBy' | 'fixedAt' | 'expiresAfter';
  title: string;
};

type AddTaskModalProps = {
  task?: ActiveTask | null;
  onClose: () => void;
  onSave: (task: MockAddTaskInput) => Promise<boolean | string> | boolean | string;
  open: boolean;
};

function isoToLocal(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function submittedIso(value: string, original?: string) {
  if (original && value === isoToLocal(original)) return original;
  if (!value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function AddTaskModal({ task, onClose, onSave, open }: AddTaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [area, setArea] = useState(task?.area ?? 'other');
  const [minimumVersion, setMinimumVersion] = useState(task?.minimum.label ?? '');
  const [minimumMinutes, setMinimumMinutes] = useState(task ? String(task.minimum.minutes) : '');
  const [normalVersion, setNormalVersion] = useState(task?.normal.label ?? '');
  const [normalMinutes, setNormalMinutes] = useState(task ? String(task.normal.minutes) : '');
  const [fullVersion, setFullVersion] = useState(task?.full.label ?? '');
  const [fullMinutes, setFullMinutes] = useState(task ? String(task.full.minutes) : '');
  const [timeConstraint, setTimeConstraint] = useState<NonNullable<MockAddTaskInput['timeConstraint']>>(task?.timeConstraint ?? 'flexible');
  const [dueAt, setDueAt] = useState(isoToLocal(task?.dueAt));
  const [fixedAt, setFixedAt] = useState(isoToLocal(task?.fixedAt));
  const [expiresAfter, setExpiresAfter] = useState(isoToLocal(task?.expiresAfter));
  const [latestUsefulStartAt, setLatestUsefulStartAt] = useState(isoToLocal(task?.latestUsefulStartAt));
  const [notUsefulAfter, setNotUsefulAfter] = useState(isoToLocal(task?.notUsefulAfter));
  const [minimumStillUsefulAfterDeadline, setMinimumStillUsefulAfterDeadline] = useState(Boolean(task?.minimumStillUsefulAfterDeadline));
  const [missedPolicy, setMissedPolicy] = useState<NonNullable<MockAddTaskInput['missedPolicy']>>(task?.missedPolicy ?? 'ask');
  const [versionsOpen, setVersionsOpen] = useState(Boolean(task));
  const [timeEdgeOpen, setTimeEdgeOpen] = useState(Boolean(task?.timeConstraint && task.timeConstraint !== 'flexible' || task?.dueAt || task?.fixedAt || task?.expiresAfter || task?.latestUsefulStartAt || task?.notUsefulAfter || task?.minimumStillUsefulAfterDeadline || task?.missedPolicy));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const canSave = title.trim().length > 0 && area.trim().length > 0 && minimumVersion.trim().length > 0;

  function buildTimeEdgeInput():
    | { ok: true; timeEdge: Partial<MockAddTaskInput> }
    | { ok: false; message: string } {
    const dueAtIso = submittedIso(dueAt, task?.dueAt);
    const fixedAtIso = submittedIso(fixedAt, task?.fixedAt);
    const expiresAfterIso = submittedIso(expiresAfter, task?.expiresAfter);
    const latestUsefulStartAtIso = submittedIso(latestUsefulStartAt, task?.latestUsefulStartAt);
    const notUsefulAfterIso = submittedIso(notUsefulAfter, task?.notUsefulAfter);

    if (timeConstraint === 'dueBy' && !dueAtIso) {
      return { message: 'Add a due-by time, or keep this flexible.', ok: false };
    }

    if (timeConstraint === 'fixedAt' && !fixedAtIso) {
      return { message: 'Add the fixed time, or keep this flexible.', ok: false };
    }

    if (timeConstraint === 'expiresAfter' && !expiresAfterIso) {
      return { message: 'Add when this stops being useful, or keep this flexible.', ok: false };
    }
    if (latestUsefulStartAt.trim() && !latestUsefulStartAtIso) {
      return { message: 'Check the last useful start time.', ok: false };
    }
    if (notUsefulAfter.trim() && !notUsefulAfterIso) {
      return { message: 'Check the not-useful-after time.', ok: false };
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
        ...(timeConstraint === 'dueBy' && dueAtIso ? { dueAt: dueAtIso } : {}),
        ...(timeConstraint === 'fixedAt' && fixedAtIso ? { fixedAt: fixedAtIso } : {}),
        ...(timeConstraint === 'expiresAfter' && expiresAfterIso ? { expiresAfter: expiresAfterIso } : {}),
        ...(latestUsefulStartAtIso ? { latestUsefulStartAt: latestUsefulStartAtIso } : {}),
        ...(notUsefulAfterIso ? { notUsefulAfter: notUsefulAfterIso } : {}),
        ...(minimumStillUsefulAfterDeadline ? { minimumStillUsefulAfterDeadline: true } : {}),
        ...(missedPolicy !== 'ask' ? { missedPolicy } : {}),
      },
    };
  }

  function resetForm() {
    setTitle('');
    setArea('other');
    setMinimumVersion('');
    setMinimumMinutes('');
    setNormalVersion('');
    setNormalMinutes('');
    setFullVersion('');
    setFullMinutes('');
    setTimeConstraint('flexible');
    setDueAt('');
    setFixedAt('');
    setExpiresAfter('');
    setLatestUsefulStartAt('');
    setNotUsefulAfter('');
    setMinimumStillUsefulAfterDeadline(false);
    setMissedPolicy('ask');
    setVersionsOpen(false);
    setTimeEdgeOpen(false);
    setSaveError('');
  }

  async function saveTask() {
    if (!canSave || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const parsedVersions = resolveTaskVersions({
        minimumVersion, minimumMinutes, normalVersion, normalMinutes, fullVersion, fullMinutes,
      });
      if (!parsedVersions.ok) {
        setSaveError(parsedVersions.error);
        return;
      }
      const timeEdgeInput = buildTimeEdgeInput();

      if (!timeEdgeInput.ok) {
        setSaveError(timeEdgeInput.message);
        return;
      }

      const saved = await onSave({
        area: area.trim(),
        ...timeEdgeInput.timeEdge,
        fullVersion: fullVersion.trim(),
        fullMinutes: fullMinutes.trim(),
        minimumVersion: minimumVersion.trim(),
        minimumMinutes: minimumMinutes.trim(),
        normalVersion: normalVersion.trim(),
        normalMinutes: normalMinutes.trim(),
        title: title.trim(),
      });

      if (saved === true) {
        resetForm();
        return;
      }

      setSaveError(typeof saved === 'string' ? saved : 'One-off was not saved. Check the required fields.');
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
    <Modal onClose={closeModal} open={open} title={task ? 'Edit one-off' : 'Add one-off'}>
      <div className="add-task-form">
        <p className="lede">{task
          ? 'Correct this one-off without changing its status. Older saved times may have been filled in automatically; check them before saving.'
          : 'For today only. Saved on this device. It will not go into Library.'}</p>
        <label>
          <span>Task title</span>
          <input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label>
          <span>Area</span>
          <select onChange={(event) => setArea(event.target.value as ActiveTask['area'])} value={area}>
            <option value="other">Other</option><option value="admin">Admin</option>
            <option value="house">Home</option><option value="food">Food</option>
            <option value="movement">Movement</option><option value="work">Work</option>
            <option value="money">Money</option><option value="health">Health</option>
            <option value="social">Social</option><option value="antidrift">Anti-scroll</option>
            <option value="emotion">Emotional recovery</option><option value="sensory">Sensory load</option>
          </select>
        </label>
        <p>Other is the starting area. Change it if a more specific area fits.</p>
        <div className="task-version-pair">
          <label><span>Minimum version</span><input onChange={(event) => setMinimumVersion(event.target.value)} value={minimumVersion} /></label>
          <label><span>Minimum minutes</span><input inputMode="numeric" onChange={(event) => setMinimumMinutes(event.target.value)} value={minimumMinutes} /></label>
        </div>
        <button
          aria-expanded={versionsOpen}
          className="add-task-form__toggle"
          onClick={() => setVersionsOpen((openVersions) => !openVersions)}
          type="button"
        >
          Optional normal/full versions
          <span>{versionsOpen ? 'Hide' : 'Show'}</span>
        </button>
        <p>Without a Normal or Full version, Life Rhythm uses the preceding action and its minutes exactly.</p>
        {versionsOpen ? (
          <div className="add-task-form__optional">
            <div className="task-version-pair">
              <label><span>Normal version</span><input onChange={(event) => setNormalVersion(event.target.value)} value={normalVersion} /></label>
              <label><span>Normal minutes</span><input inputMode="numeric" onChange={(event) => setNormalMinutes(event.target.value)} value={normalMinutes} /></label>
            </div>
            <div className="task-version-pair">
              <label><span>Full version</span><input onChange={(event) => setFullVersion(event.target.value)} value={fullVersion} /></label>
              <label><span>Full minutes</span><input inputMode="numeric" onChange={(event) => setFullMinutes(event.target.value)} value={fullMinutes} /></label>
            </div>
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
        {timeEdgeOpen ? <section className="add-task-form__section" aria-labelledby="one-off-time-edge-title">
          <div>
            <h3 id="one-off-time-edge-title">Time edge</h3>
            <p>Optional. This describes when the task is useful.</p>
            <p>Life Rhythm can use this when choosing a private time. Minimum still counts if it helps.</p>
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
        </section> : null}
        {saveError ? <p className="form-feedback" role="alert">{saveError}</p> : null}
        <div className="modal-actions">
          <Button disabled={!canSave || saving} onClick={saveTask} variant="primary">
            {saving ? 'Saving one-off...' : task ? 'Save changes' : 'Save one-off'}
          </Button>
          <Button onClick={closeModal}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
