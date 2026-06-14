import { useState } from 'react';
import { Button, Modal } from '../../components';
import type { MockTask, StartBarrier } from './mockTodayData';

const feedbackOptions = ['Yes', 'A bit', 'No', 'Made it harder', 'Skip'];

type StartBoostProps = {
  onClose: () => void;
  open: boolean;
  task: MockTask;
};

export function StartBoost({ onClose, open, task }: StartBoostProps) {
  const [selectedBarrier, setSelectedBarrier] = useState<StartBarrier | null>(null);

  return (
    <Modal open={open} title="Start Boost">
      <div className="start-boost">
        <p className="lede">A friction reducer for the next start. No rewards or pressure loops.</p>
        <section>
          <h3>What is blocking the start?</h3>
          <div className="boost-grid" role="list">
            {task.startBarriers.map((barrier) => (
              <button
                aria-pressed={selectedBarrier === barrier}
                className="boost-option"
                key={barrier}
                onClick={() => setSelectedBarrier(barrier)}
                type="button"
              >
                {barrier}
              </button>
            ))}
          </div>
        </section>
        {selectedBarrier ? (
          <section aria-live="polite" className="boost-supports">
            <h3>Try one support</h3>
            <ul>
              {task.boostSupports[selectedBarrier].map((support) => (
                <li key={support}>{support}</li>
              ))}
            </ul>
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
          </section>
        ) : null}
        <div className="modal-actions">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
