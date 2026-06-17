import { useRef, useState } from 'react';
import { Button, Modal } from '../../components';

export type MockAddTaskInput = {
  area: string;
  fullVersion: string;
  minimumVersion: string;
  normalVersion: string;
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
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const canSave = title.trim().length > 0 && area.trim().length > 0 && minimumVersion.trim().length > 0;

  function resetForm() {
    setTitle('');
    setArea('Home admin');
    setMinimumVersion('');
    setNormalVersion('');
    setFullVersion('');
    setVersionsOpen(false);
    setSaveError('');
  }

  async function saveTask() {
    if (!canSave || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const saved = await onSave({
        area: area.trim(),
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
