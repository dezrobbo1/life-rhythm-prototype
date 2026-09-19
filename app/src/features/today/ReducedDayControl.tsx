import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal/Modal';
import {
  applyReduceToday,
  loadTodayDayMode,
  previewReduceToday,
  returnTodayToNormal,
  undoTodayPlanChange,
  type ReducedDayPreview,
  type ReducedDayPreviewCategory,
} from '../../data/reducedDayCoordinator';

const categoryLabels: Record<ReducedDayPreviewCategory, string> = {
  stays: 'Stays',
  getsSmaller: 'Gets smaller',
  moves: 'Moves',
  noLongerFits: 'No longer fits',
};

type ReducedDayControlProps = {
  onPlanChanged?: () => void;
  refreshVersion?: number;
  showUndo?: boolean;
};

export function ReducedDayControl({
  onPlanChanged,
  refreshVersion = 0,
  showUndo = true,
}: ReducedDayControlProps = {}) {
  const [dayMode, setDayMode] = useState<'loading' | 'error' | 'normal' | 'reduced'>('loading');
  const [preview, setPreview] = useState<ReducedDayPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'apply' | 'normal' | 'undo' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modeReadAttempt, setModeReadAttempt] = useState(0);
  const submissionInFlight = useRef(false);
  const controlRef = useRef<HTMLElement | null>(null);
  const restorePreviewFocus = useRef(false);
  const restoreModeFocus = useRef(false);

  useEffect(() => {
    let active = true;
    setDayMode('loading');
    setError('');
    setMessage('');
    loadTodayDayMode({ readOnly: true }).then((result) => {
      if (!active) return;
      if (result.ok) {
        setDayMode(result.dayMode);
        setPreview(result.preview ?? null);
      }
      else {
        setDayMode('error');
        setError(result.errors[0] ?? 'Today’s scheduling state could not be read.');
      }
    }).catch(() => {
      if (!active) return;
      setDayMode('error');
      setError('Today’s scheduling state could not be read.');
    });
    return () => { active = false; };
  }, [refreshVersion, modeReadAttempt]);

  useEffect(() => {
    if (dayMode === 'loading' || !restoreModeFocus.current) return;
    restoreModeFocus.current = false;
    controlRef.current
      ?.querySelector<HTMLButtonElement>(
        '.reduced-day-control__open, .reduced-day-control__active button, .reduced-day-control__retry',
      )
      ?.focus();
  }, [dayMode]);

  useEffect(() => {
    if (open || !restorePreviewFocus.current) return;
    restorePreviewFocus.current = false;
    controlRef.current
      ?.querySelector<HTMLButtonElement>('.reduced-day-control__open')
      ?.focus();
  }, [open]);

  function closePreview() {
    if (busy === 'apply') return;
    restorePreviewFocus.current = true;
    setOpen(false);
  }

  async function openPreview() {
    setBusy('preview');
    setError('');
    const result = await previewReduceToday();
    setBusy(null);
    if (!result.ok) {
      setError(result.errors[0] ?? 'A Reduced Day preview could not be prepared.');
      return;
    }
    setPreview(result.preview);
    setOpen(true);
  }

  async function apply() {
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setBusy('apply');
    setError('');
    const result = await applyReduceToday();
    submissionInFlight.current = false;
    setBusy(null);
    if (!result.ok) {
      setError(result.errors[0] ?? 'Reduced Day was not applied. Your current plan is unchanged.');
      return;
    }
    setPreview(result.preview);
    setDayMode('reduced');
    setOpen(false);
    setMessage('Today is reduced. The applied result was recomputed from current information.');
    onPlanChanged?.();
  }

  async function returnToNormal() {
    if (busy) return;
    setBusy('normal');
    setError('');
    const result = await returnTodayToNormal();
    setBusy(null);
    if (!result.ok) {
      setError(result.errors[0] ?? 'Today could not return to Normal. Your current plan is unchanged.');
      return;
    }
    setPreview(result.preview);
    setDayMode('normal');
    setMessage('Today returned to Normal using current information.');
    onPlanChanged?.();
  }

  async function undo() {
    if (busy) return;
    setBusy('undo');
    setError('');
    const result = await undoTodayPlanChange();
    setBusy(null);
    if (!result.ok) {
      setError(result.errors[0] ?? 'The latest private-plan change could not be undone.');
      return;
    }
    setPreview(result.preview);
    setDayMode(result.dayMode);
    setMessage('The latest private-plan change and its day mode were restored together.');
    onPlanChanged?.();
  }

  const categories = preview
    ? (Object.keys(categoryLabels) as ReducedDayPreviewCategory[])
      .map((category) => ({ category, items: preview.items.filter((item) => item.category === category) }))
      .filter(({ items }) => items.length > 0)
    : [];

  return (
    <section aria-label="Reduced Day controls" className="reduced-day-control" ref={controlRef}>
      {dayMode === 'reduced' ? (
        <div className="reduced-day-control__active">
          <div>
            <p className="section-label">Reduced Day active</p>
            <p>Only today uses the reduced scheduling policy.</p>
          </div>
          <div className="reduced-day-control__actions">
            <Button disabled={busy !== null} onClick={() => void returnToNormal()}>
              {busy === 'normal' ? 'Returning to Normal' : 'Return to normal day'}
            </Button>
            {showUndo ? (
              <Button disabled={busy !== null} onClick={() => void undo()}>
                {busy === 'undo' ? 'Restoring' : 'Undo last change'}
              </Button>
            ) : null}
          </div>
        </div>
      ) : dayMode === 'normal' ? (
        <Button
          className="reduced-day-control__open"
          disabled={busy !== null}
          onClick={() => void openPreview()}
        >
          {busy === 'preview' ? 'Preparing preview' : 'Reduce today'}
        </Button>
      ) : dayMode === 'loading' ? (
        <p aria-busy="true" className="surface-read-state__inline" role="status">
          Reading today’s day mode...
        </p>
      ) : (
        <Button
          className="reduced-day-control__retry"
          onClick={() => {
            restoreModeFocus.current = true;
            setModeReadAttempt((attempt) => attempt + 1);
          }}
        >
          Retry day mode
        </Button>
      )}

      {message ? <p className="reduced-day-control__message" role="status">{message}</p> : null}
      {error ? <p className="reduced-day-control__error" role="alert">{error}</p> : null}

      <Modal onClose={closePreview} open={open} title="Reduce today">
        <div className="reduced-day-preview">
          <p className="lede">Review what the scheduler can safely change for today.</p>
          {preview?.initialPlan ? (
            <p>No earlier private plan exists. Applying will create the first plan directly in Reduced Day.</p>
          ) : categories.length > 0 ? categories.map(({ category, items }) => (
            <section key={category}>
              <h3>{categoryLabels[category]}</h3>
              <ul>{items.map((item) => (
                <li key={`${category}:${item.targetId}`}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  {item.reason ? <small>{item.reason}</small> : null}
                </li>
              ))}</ul>
            </section>
          )) : (
            <p>The current plan is already as reduced as the scheduler can safely make it.</p>
          )}
          <div className="reduced-day-preview__actions">
            <Button disabled={busy === 'apply'} onClick={closePreview}>Cancel</Button>
            <Button disabled={busy === 'apply'} onClick={() => void apply()} variant="primary">
              {busy === 'apply' ? 'Applying reduced day' : 'Apply reduced day'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
