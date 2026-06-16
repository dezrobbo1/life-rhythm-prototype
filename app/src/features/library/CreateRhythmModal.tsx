import { useState } from 'react';
import { Button, Modal } from '../../components';
import { libraryCategories, type LibraryRhythm, type RhythmCategory } from './mockLibraryData';

export type CreateRhythmInput = {
  category: RhythmCategory;
  enabled: boolean;
  fullVersion: string;
  minimumVersion: string;
  normalVersion: string;
  purpose: string;
  title: string;
};

type CreateRhythmModalProps = {
  onClose: () => void;
  onSave: (rhythm: CreateRhythmInput) => Promise<void> | void;
  open: boolean;
};

const rhythmCategories = libraryCategories.filter((category): category is RhythmCategory => category !== 'All');

export function createMockLibraryRhythm(input: CreateRhythmInput): LibraryRhythm {
  return {
    boundaryNote: 'Custom rhythms are reusable planning templates. Enablement and Add to Today are preview-only.',
    category: input.category,
    categoryNote: 'Keep the rhythm optional, reusable, and small enough to return to.',
    chips: ['Custom', input.enabled ? 'Enabled' : 'Preview'],
    enabled: input.enabled,
    fullVersion: input.fullVersion || input.normalVersion || input.minimumVersion,
    id: `mock-rhythm-${Date.now()}`,
    minimumVersion: input.minimumVersion,
    normalVersion: input.normalVersion || input.minimumVersion,
    packIds: [],
    purpose: input.purpose,
    recommendedSize: 'Small',
    title: input.title,
    whyThisExists: 'This rhythm shows how reusable templates can stay available without becoming a Today task.',
  };
}

export function CreateRhythmModal({ onClose, onSave, open }: CreateRhythmModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RhythmCategory>('Household');
  const [purpose, setPurpose] = useState('');
  const [minimumVersion, setMinimumVersion] = useState('');
  const [normalVersion, setNormalVersion] = useState('');
  const [fullVersion, setFullVersion] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const canSave =
    title.trim().length > 0 &&
    purpose.trim().length > 0 &&
    minimumVersion.trim().length > 0;

  function resetForm() {
    setTitle('');
    setCategory('Household');
    setPurpose('');
    setMinimumVersion('');
    setNormalVersion('');
    setFullVersion('');
    setEnabled(true);
    setVersionsOpen(false);
  }

  function saveRhythm() {
    if (!canSave) return;

    onSave({
      category,
      enabled,
      fullVersion: fullVersion.trim(),
      minimumVersion: minimumVersion.trim(),
      normalVersion: normalVersion.trim(),
      purpose: purpose.trim(),
      title: title.trim(),
    });
    resetForm();
  }

  function closeModal() {
    resetForm();
    onClose();
  }

  return (
    <Modal onClose={closeModal} open={open} title="Create rhythm">
      <div className="add-task-form">
        <p className="lede">Reusable rhythm. Saved on this device. Enablement and Add to Today are preview-only.</p>
        <label>
          <span>Rhythm title</span>
          <input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label>
          <span>Category</span>
          <select onChange={(event) => setCategory(event.target.value as RhythmCategory)} value={category}>
            {rhythmCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Purpose</span>
          <input onChange={(event) => setPurpose(event.target.value)} value={purpose} />
        </label>
        <label>
          <span>Minimum version</span>
          <input onChange={(event) => setMinimumVersion(event.target.value)} value={minimumVersion} />
        </label>
        <label className="setup-toggle">
          <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
          <span>
            <strong>Enabled</strong>
            <small>Enabled rhythms can appear when useful. This choice is preview-only and does not schedule anything.</small>
          </span>
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
          <Button disabled={!canSave} onClick={saveRhythm} variant="primary">Save rhythm</Button>
          <Button onClick={closeModal}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
