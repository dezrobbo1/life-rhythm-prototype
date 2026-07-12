import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from '../../components';
import type { TaskPoolItem } from '../../data/schemas';

type TaskPoolDeferModalProps = {
  item: TaskPoolItem | null;
  onClose: () => void;
  onSave: (bringBackAfter: string) => Promise<boolean> | boolean;
  open: boolean;
};

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function toDateTimeLocalValue(date: Date): string {
  return [
    date.getFullYear(),
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

function defaultBringBackValue(item: TaskPoolItem | null): string {
  if (item?.bringBackAfter) {
    const existing = new Date(item.bringBackAfter);

    if (!Number.isNaN(existing.getTime()) && existing.getTime() > Date.now()) {
      return toDateTimeLocalValue(existing);
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return toDateTimeLocalValue(tomorrow);
}

export function TaskPoolDeferModal({
  item,
  onClose,
  onSave,
  open,
}: TaskPoolDeferModalProps) {
  const [bringBackAfter, setBringBackAfter] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setBringBackAfter(defaultBringBackValue(item));
      setSaveError('');
    }
  }, [item, open]);

  function closeModal() {
    setSaveError('');
    setSaving(false);
    savingRef.current = false;
    onClose();
  }

  async function saveDeferral() {
    if (!item || savingRef.current) return;

    const parsed = new Date(bringBackAfter);

    if (Number.isNaN(parsed.getTime())) {
      setSaveError('Choose a valid date and time.');
      return;
    }

    if (parsed.getTime() <= Date.now()) {
      setSaveError('Choose a time later than now.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const saved = await onSave(parsed.toISOString());

      if (!saved) {
        setSaveError('The task was not held for later. Nothing else changed.');
      }
    } catch {
      setSaveError('The task was not held for later. Nothing else changed.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const modalTitle = item?.status === 'deferred' ? 'Choose another time' : 'Bring back later';

  return (
    <Modal onClose={closeModal} open={open} title={modalTitle}>
      <div className="add-task-form task-pool-defer-form">
        <p className="lede">
          Choose when this should return for a calm review. Nothing moves into Today automatically.
        </p>
        {item ? (
          <section className="task-pool-defer-form__context" aria-labelledby="task-pool-defer-item-title">
            <h3 id="task-pool-defer-item-title">{item.title}</h3>
            <p>Minimum: {item.minimum.label}</p>
          </section>
        ) : null}
        <label>
          <span>Bring back after</span>
          <input
            aria-label="Bring back after"
            min={toDateTimeLocalValue(new Date(Date.now() + 60_000))}
            onChange={(event) => {
              setBringBackAfter(event.target.value);
              setSaveError('');
            }}
            type="datetime-local"
            value={bringBackAfter}
          />
          <small>You can still bring it to Today earlier if you choose.</small>
        </label>
        {saveError ? <p className="form-feedback" role="alert">{saveError}</p> : null}
        <div className="modal-actions">
          <Button disabled={!item || saving} onClick={saveDeferral} variant="primary">
            {saving ? 'Holding for later...' : 'Hold until then'}
          </Button>
          <Button onClick={closeModal}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
