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

export function ReducedDayControl() {
  const [dayMode, setDayMode] = useState<'loading' | 'normal' | 'reduced'>('loading');
  const [preview, setPreview] = useState<ReducedDayPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'apply' | 'normal' | 'undo' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submissionInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    loadTodayDayMode().then((result) => {
      if (!active) return;
      if (result.ok) {
        setDayMode(result.dayMode);
        if (result.preview) setPreview(result.preview);
      }
      else {
        setDayMode('normal');
        setError(result.errors[0] ?? 'Today’s scheduling state could not be read.');
      }
    });
    return () => { active = false; };
  }, []);

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
  }

  const categories = preview
    ? (Object.keys(categoryLabels) as ReducedDayPreviewCategory[])
      .map((category) => ({ category, items: preview.items.filter((item) => item.category === category) }))
      .filter(({ items }) => items.length > 0)
    : [];

  return (
    <section aria-label="Reduced Day controls" className="reduced-day-control">
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
            <Button disabled={busy !== null} onClick={() => void undo()}>
              {busy === 'undo' ? 'Restoring' : 'Undo last change'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="reduced-day-control__open"
          disabled={busy !== null || dayMode === 'loading'}
          onClick={() => void openPreview()}
        >
          {busy === 'preview' ? 'Preparing preview' : 'Reduce today'}
        </Button>
      )}

      {message ? <p className="reduced-day-control__message" role="status">{message}</p> : null}
      {error ? <p className="reduced-day-control__error" role="alert">{error}</p> : null}

      {dayMode === 'reduced' && preview ? (
        <div aria-label="Changed by Reduced Day" className="reduced-day-changed">
          <p className="section-label">Changed</p>
          {categories.length > 0 ? categories.map(({ category, items }) => (
            <section key={category}>
              <h3>{categoryLabels[category]}</h3>
              <ul>{items.map((item) => (
                <li key={`${category}:${item.targetId}`}>
                  <strong>{item.title}</strong><span>{item.detail}</span>
                  {item.reason ? <small>{item.reason}</small> : null}
                </li>
              ))}</ul>
            </section>
          )) : <p>No private-plan changes were needed.</p>}
        </div>
      ) : null}

      <Modal onClose={() => busy !== 'apply' && setOpen(false)} open={open} title="Reduce today">
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
            <Button disabled={busy === 'apply'} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy === 'apply'} onClick={() => void apply()} variant="primary">
              {busy === 'apply' ? 'Applying reduced day' : 'Apply reduced day'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
