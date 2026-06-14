import { useState } from 'react';
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
  onSave: (task: MockAddTaskInput) => void;
  open: boolean;
};

export function AddTaskModal({ onClose, onSave, open }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('Home admin');
  const [minimumVersion, setMinimumVersion] = useState('');
  const [normalVersion, setNormalVersion] = useState('');
  const [fullVersion, setFullVersion] = useState('');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const canSave = title.trim().length > 0 && area.trim().length > 0 && minimumVersion.trim().length > 0;

  function saveTask() {
    if (!canSave) return;

    onSave({
      area: area.trim(),
      fullVersion: fullVersion.trim(),
      minimumVersion: minimumVersion.trim(),
      normalVersion: normalVersion.trim(),
      title: title.trim(),
    });
    setTitle('');
    setArea('Home admin');
    setMinimumVersion('');
    setNormalVersion('');
    setFullVersion('');
    setVersionsOpen(false);
  }

  return (
    <Modal onClose={onClose} open={open} title="Add one task">
      <div className="add-task-form">
        <p className="lede">Mock only. This adds one in-memory task for the preview.</p>
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
        <div className="modal-actions">
          <Button disabled={!canSave} onClick={saveTask} variant="primary">Save mock task</Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
