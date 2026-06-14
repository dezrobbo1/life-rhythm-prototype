import { useEffect, useState } from 'react';
import { Modal } from '../../components';
import type { MockTask, StartBarrier } from './mockTodayData';

const feedbackOptions = ['Yes', 'A bit', 'No', 'Made it harder', 'Skip'];
const activationOptions = [
  'Read the first action',
  'Set up the space',
  'Do the 30-second start',
];

type StartBoostProps = {
  onClose: () => void;
  open: boolean;
  task: MockTask;
};

export function StartBoost({ onClose, open, task }: StartBoostProps) {
  const [selectedBarrier, setSelectedBarrier] = useState<StartBarrier | null>(null);
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);
  const [selectedActivation, setSelectedActivation] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedBarrier(null);
      setSelectedSupportId(null);
      setSelectedActivation(null);
    }
  }, [open]);

  function chooseBarrier(barrier: StartBarrier) {
    setSelectedBarrier(barrier);
    setSelectedSupportId(null);
  }

  return (
    <Modal onClose={onClose} open={open} title="Start Boost">
      <div className="start-boost">
        <p className="lede">A friction reducer for the next start. Choose one small support; no pressure loops.</p>
        <section className="boost-task-context" aria-labelledby="boost-task-title">
          <h3 id="boost-task-title">{task.title}</h3>
          <p>
            <strong>Minimum:</strong> {task.minimumVersion}
          </p>
          <div className="support-grid" aria-label="Small activation options">
            {activationOptions.map((option) => (
              <button
                aria-pressed={selectedActivation === option}
                className="support-option"
                key={option}
                onClick={() => setSelectedActivation(option)}
                type="button"
              >
                <strong>{option}</strong>
                <span>Mock only. Nothing is saved.</span>
              </button>
            ))}
          </div>
          {selectedActivation ? (
            <p className="boost-activation-feedback" role="status">
              {selectedActivation} is enough to begin.
            </p>
          ) : null}
        </section>
        <section>
          <h3>What is blocking the start?</h3>
          <div className="boost-grid">
            {task.startBarriers.map((barrier) => (
              <button
                aria-pressed={selectedBarrier === barrier}
                className="boost-option"
                key={barrier}
                onClick={() => chooseBarrier(barrier)}
                type="button"
              >
                {barrier}
              </button>
            ))}
          </div>
        </section>
        {selectedBarrier ? (
          <section aria-live="polite" className="boost-supports">
            <h3>Choose one support</h3>
            <div className="support-grid">
              {task.boostSupports[selectedBarrier].map((support) => (
                <button
                  aria-pressed={selectedSupportId === support.id}
                  className="support-option"
                  key={support.id}
                  onClick={() => setSelectedSupportId(support.id)}
                  type="button"
                >
                  <strong>{support.label}</strong>
                  <span>{support.detail}</span>
                </button>
              ))}
            </div>
            {selectedSupportId ? (
              <div className="boost-feedback">
                <h3>Did that reduce friction?</h3>
                <div className="feedback-row">
                  {feedbackOptions.map((option) => (
                    <button key={option} type="button">
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
