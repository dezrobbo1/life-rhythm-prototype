import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card } from '../../components';
import {
  applyDurationLearningControls,
  deriveDurationLearningEvidence,
  readDurationLearningEventsResult,
  type DurationLearningEvidence,
  type DurationLearningEventReadResult,
} from '../../data/durationLearning';
import {
  commitDurationLearningControlDelete,
  commitDurationLearningControlUpsert,
  durationLearningControlExpectation,
} from '../../data/durationLearningControlMutationCoordinator';
import {
  loadDurationLearningControlsResult,
  type DurationLearningControlsLoadResult,
} from '../../data/durationLearningControlRepository';
import {
  loadDurationLearningTemplateCatalogue,
  type DurationLearningTemplateCatalogueResult,
  type DurationLearningTemplateOption,
} from '../../data/durationLearningTemplateCatalogue';
import { getCurrentLifeRhythmDatabase } from '../../data/localDataNamespace';
import { ensureCurrentPrivatePlan } from '../../data/schedulerPlanCoordinator';

type DurationLearningPanelProps = {
  onPlanChanged?: () => void;
};

type DurationLearningViewItem = {
  templateId: string;
  title: string;
  savedNormalMinutes?: number;
  evidence?: DurationLearningEvidence;
};

function formatMinutes(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function DurationLearningPanel({
  onPlanChanged,
}: DurationLearningPanelProps) {
  const [eventsResult, setEventsResult] = useState<DurationLearningEventReadResult | null>(null);
  const [controlsResult, setControlsResult] = useState<DurationLearningControlsLoadResult>({
    status: 'missing',
    controls: [],
  });
  const [catalogueResult, setCatalogueResult] =
    useState<DurationLearningTemplateCatalogueResult | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const refresh = useCallback(async () => {
    const database = getCurrentLifeRhythmDatabase();
    const [events, controls, catalogue] = await Promise.all([
      readDurationLearningEventsResult(database),
      loadDurationLearningControlsResult(),
      loadDurationLearningTemplateCatalogue(database),
    ]);
    setEventsResult(events);
    setControlsResult(controls);
    setCatalogueResult(catalogue);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const evidence = useMemo(
    () => eventsResult && eventsResult.status !== 'readFailed'
      ? deriveDurationLearningEvidence(eventsResult.events)
      : [],
    [eventsResult],
  );
  const controls = controlsResult.status === 'ok' ? controlsResult.controls : [];
  const controlsHealthy = controlsResult.status === 'missing' || controlsResult.status === 'ok';
  const templates = catalogueResult?.status === 'ok' ? catalogueResult.templates : [];

  const items = useMemo((): DurationLearningViewItem[] => {
    const templateById = new Map(templates.map((template) => [template.templateId, template]));
    const evidenceById = new Map(evidence.map((item) => [item.templateId, item]));
    const ids = [...new Set([
      ...evidence.map((item) => item.templateId),
      ...controls.map((control) => control.templateId),
    ])].sort();

    return ids.map((templateId) => {
      const template: DurationLearningTemplateOption | undefined = templateById.get(templateId);
      return {
        templateId,
        title: template?.title ?? 'Saved template no longer available',
        ...(template ? { savedNormalMinutes: template.savedNormalMinutes } : {}),
        ...(evidenceById.get(templateId)
          ? { evidence: evidenceById.get(templateId) }
          : {}),
      };
    });
  }, [controls, evidence, templates]);

  const applied = useMemo(
    () => controlsHealthy
      ? applyDurationLearningControls(
          eventsResult?.status === 'ok' ? evidence : [],
          controls,
        )
      : [],
    [controls, controlsHealthy, evidence, eventsResult?.status],
  );
  const appliedById = useMemo(
    () => new Map(applied.map((item) => [item.templateId, item])),
    [applied],
  );

  async function reconcilePlan(successCopy: string) {
    const plan = await ensureCurrentPrivatePlan();
    if (plan.ok) {
      onPlanChanged?.();
      setStatus(successCopy);
      return;
    }
    setStatus(
      `${successCopy.replace(/\.$/, '')}, but the flexible plan still needs updating. ${plan.errors[0] ?? ''}`.trim(),
    );
  }

  async function saveControl(
    item: DurationLearningViewItem,
    mode: 'disabled' | 'override',
  ) {
    const expectation = durationLearningControlExpectation(controlsResult, item.templateId);
    if (!expectation) {
      setStatus('Duration controls need attention before this change can be saved.');
      return;
    }

    let overrideMinutes: number | undefined;
    if (mode === 'override') {
      const currentControl = controls.find(
        (candidate) => candidate.templateId === item.templateId,
      );
      overrideMinutes = Number(
        corrections[item.templateId] ??
        (currentControl?.mode === 'override'
          ? currentControl.overrideMinutes
          : item.savedNormalMinutes ?? ''),
      );
      if (!Number.isInteger(overrideMinutes) || overrideMinutes <= 0) {
        setStatus('Enter a whole number of minutes greater than zero.');
        return;
      }
    }

    setBusyTemplateId(item.templateId);
    try {
      const result = await commitDurationLearningControlUpsert({
        templateId: item.templateId,
        mode,
        ...(overrideMinutes !== undefined ? { overrideMinutes } : {}),
      }, expectation);
      if (!result.ok) {
        setStatus(result.errors.join(' '));
        await refresh();
        return;
      }
      await refresh();
      await reconcilePlan(
        mode === 'disabled'
          ? 'Saved duration is now authoritative for this template and the flexible plan is up to date.'
          : 'Your corrected duration is now authoritative for this template and the flexible plan is up to date.',
      );
    } catch {
      setStatus('Duration control was not saved. Nothing else changed.');
    } finally {
      setBusyTemplateId(null);
    }
  }

  async function resetControl(item: DurationLearningViewItem) {
    const expectation = durationLearningControlExpectation(controlsResult, item.templateId);
    if (!expectation) {
      setStatus('Duration controls need attention before this change can be reset.');
      return;
    }

    setBusyTemplateId(item.templateId);
    try {
      const result = await commitDurationLearningControlDelete(
        item.templateId,
        expectation,
      );
      if (!result.ok) {
        setStatus(result.errors.join(' '));
        await refresh();
        return;
      }
      await refresh();
      await reconcilePlan(
        'This template can use duration learning again and the flexible plan is up to date.',
      );
    } catch {
      setStatus('Duration control was not reset. Nothing else changed.');
    } finally {
      setBusyTemplateId(null);
    }
  }

  const eventWarning = eventsResult?.status === 'readFailed'
    ? eventsResult.errors.join(' ')
    : eventsResult?.status === 'partial'
      ? `Duration learning is paused because ${eventsResult.invalidRecordCount} behaviour record${eventsResult.invalidRecordCount === 1 ? ' is' : 's are'} malformed. Valid observations are shown descriptively but are not used automatically.`
      : null;
  const controlWarning = controlsResult.status === 'invalid' || controlsResult.status === 'readFailed'
    ? controlsResult.errors.join(' ')
    : null;
  const catalogueWarning = catalogueResult?.status === 'readFailed'
    ? catalogueResult.errors.join(' ')
    : catalogueResult?.warnings[0] ?? null;

  return (
    <Card>
      <div className="setup-section-heading">
        <h2>Duration learning</h2>
        <p>
          Life Rhythm can reserve more realistic time after repeated completed instances.
          Saved Minimum, Normal, and Full definitions are not rewritten.
        </p>
      </div>

      {eventWarning ? <p role="status">{eventWarning}</p> : null}
      {catalogueWarning ? <p role="status">{catalogueWarning}</p> : null}
      {controlWarning ? (
        <div className="setup-validation-summary" role="alert">
          <strong>Saved duration controls need attention.</strong>
          <p>{controlWarning} Learning controls were not replaced.</p>
        </div>
      ) : null}

      {eventsResult === null || catalogueResult === null ? (
        <p className="setup-note">Reading duration evidence…</p>
      ) : items.length === 0 ? (
        <p className="setup-note">
          No repeated template-linked completion durations are available yet.
        </p>
      ) : (
        <ul className="soft-placements__list" aria-label="Duration learning">
          {items.map((item) => {
            const control = controls.find((candidate) => candidate.templateId === item.templateId);
            const current = appliedById.get(item.templateId);
            const busy = busyTemplateId === item.templateId;
            return (
              <li key={item.templateId}>
                <div className="soft-placements__item-copy">
                  <strong>{item.title}</strong>
                  {item.savedNormalMinutes !== undefined ? (
                    <p>Saved Normal duration: {item.savedNormalMinutes} minutes.</p>
                  ) : null}
                  {item.evidence ? (
                    <p>
                      {item.evidence.sampleCount} trusted completed {item.evidence.sampleCount === 1 ? 'instance' : 'instances'}.
                      {' '}Median {formatMinutes(item.evidence.medianActualMinutes)} minutes;
                      conservative observed estimate {item.evidence.upperQuartileActualMinutes} minutes.
                    </p>
                  ) : (
                    <p>No trusted positive completion samples are currently available.</p>
                  )}
                  {control?.mode === 'disabled' ? (
                    <p>Learning is disabled for this template; the saved duration is used.</p>
                  ) : control?.mode === 'override' ? (
                    <p>Your corrected duration is {control.overrideMinutes} minutes.</p>
                  ) : item.evidence?.confidence === 'insufficient' ? (
                    <p>At least 3 positive completed instances are needed before automatic adaptation.</p>
                  ) : current?.source === 'learned' ? (
                    <p>
                      Life Rhythm currently reserves {current.schedulerMinutes} minutes
                      with {current.confidence} confidence.
                    </p>
                  ) : null}
                </div>

                <div className="setup-action-row">
                  <Button
                    disabled={busy || !controlsHealthy || item.savedNormalMinutes === undefined}
                    onClick={() => void saveControl(item, 'disabled')}
                  >
                    Use saved duration
                  </Button>
                  <label>
                    <span>Corrected minutes for {item.title}</span>
                    <input
                      aria-label={`Corrected minutes for ${item.title}`}
                      min="1"
                      onChange={(event) => setCorrections((values) => ({
                        ...values,
                        [item.templateId]: event.target.value,
                      }))}
                      step="1"
                      type="number"
                      value={corrections[item.templateId] ?? String(
                        control?.mode === 'override'
                          ? control.overrideMinutes
                          : item.savedNormalMinutes ?? '',
                      )}
                    />
                  </label>
                  <Button
                    disabled={busy || !controlsHealthy}
                    onClick={() => void saveControl(item, 'override')}
                  >
                    Use corrected duration
                  </Button>
                  {control ? (
                    <Button
                      disabled={busy || !controlsHealthy}
                      onClick={() => void resetControl(item)}
                    >
                      Use learning again
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="setup-note setup-note--quiet">
        Duration learning is local, template-scoped, and based only on trusted positive completion durations.
        It does not infer why a task took that long.
      </p>
      {status ? <p role="status">{status}</p> : null}
    </Card>
  );
}
