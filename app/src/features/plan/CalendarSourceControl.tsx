import { useEffect, useState, type ChangeEvent } from 'react';
import { Button, Card } from '../../components';
import {
  loadCalendarSource,
} from '../../data/calendarSourceRepository';
import {
  commitCalendarSourceImport,
  commitCalendarSourceRemoval,
  commitCalendarSourceBuffers,
} from '../../data/calendarSourceMutationCoordinator';
import { repairCurrentPrivatePlan } from '../../data/schedulerPlanCoordinator';
import {
  CALENDAR_REPAIR_PENDING_MESSAGE,
} from '../../data/schedulerPlanStateRepository';

type CalendarSourceControlProps = {
  onReadIssueChange?: (message: string | null) => void;
  onRepairIssueChange?: (message: string | null) => void;
  onPlanRepaired?: () => void;
};

type SavedCalendarSummary = {
  importedAt: string;
  label: string;
  beforeBusyMinutes: number;
  afterBusyMinutes: number;
};

function localDateInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear().toString().padStart(4, '0')}-${(next.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${next.getUTCDate().toString().padStart(2, '0')}`;
}

function browserCalendarWindow() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const start = localDateInTimezone(new Date(), timezone);
  return {
    timezone,
    start,
    end: addDays(start, 30),
  };
}

export function CalendarSourceControl({
  onPlanRepaired,
  onReadIssueChange,
  onRepairIssueChange,
}: CalendarSourceControlProps) {
  const [savedCalendar, setSavedCalendar] = useState<SavedCalendarSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [beforeBusyMinutes, setBeforeBusyMinutes] = useState(0);
  const [afterBusyMinutes, setAfterBusyMinutes] = useState(0);

  useEffect(() => {
    let active = true;

    loadCalendarSource().then((result) => {
      if (!active) return;

      if (result.status === 'ok') {
        onReadIssueChange?.(null);
        setSavedCalendar({
          importedAt: result.record.importedAt,
          label: result.record.label,
          beforeBusyMinutes: result.record.beforeBusyMinutes,
          afterBusyMinutes: result.record.afterBusyMinutes,
        });
        setBeforeBusyMinutes(result.record.beforeBusyMinutes);
        setAfterBusyMinutes(result.record.afterBusyMinutes);
        return;
      }

      if (result.status === 'invalid' || result.status === 'error') {
        const message = 'Saved calendar data could not be read safely. The flexible plan will not use it.';
        setStatus(message);
        onReadIssueChange?.(message);
        return;
      }

      onReadIssueChange?.(null);
    }).catch(() => {
      if (!active) return;
      const message = 'Saved calendar data could not be read. The flexible plan will not use it.';
      setStatus(message);
      onReadIssueChange?.(message);
    });

    return () => {
      active = false;
    };
  }, [onReadIssueChange]);

  async function repairAfterCalendarChange(reason: string) {
    try {
      const repaired = await repairCurrentPrivatePlan({
        trigger: 'calendarChanged',
        reason,
      });

      if (!repaired.ok) {
        onRepairIssueChange?.(CALENDAR_REPAIR_PENDING_MESSAGE);
        return false;
      }

      onRepairIssueChange?.(null);
      onPlanRepaired?.();
      return true;
    } catch {
      onRepairIssueChange?.(CALENDAR_REPAIR_PENDING_MESSAGE);
      return false;
    }
  }

  async function importCalendarFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus('');
    setWarnings([]);

    try {
      const source = await file.text();
      const window = browserCalendarWindow();
      const imported = await commitCalendarSourceImport({
        label: file.name,
        source,
        options: {
          targetTimezone: window.timezone,
          windowStartDate: window.start,
          windowEndDate: window.end,
        },
      });

      if (!imported.ok) {
        setStatus(imported.errors[0] ?? 'Calendar file could not be imported. Nothing was replaced.');
        setWarnings(imported.warnings);
        return;
      }

      onReadIssueChange?.(null);
      setSavedCalendar({
        importedAt: imported.record.importedAt,
        label: imported.record.label,
        beforeBusyMinutes: imported.record.beforeBusyMinutes,
        afterBusyMinutes: imported.record.afterBusyMinutes,
      });
      setWarnings(imported.warnings);

      const repaired = await repairAfterCalendarChange('Read-only calendar import changed.');
      if (repaired) {
        setStatus(
          `Calendar saved on this device. ${imported.busyEventCount} busy event${imported.busyEventCount === 1 ? '' : 's'} found in the next 31 days; the flexible private plan was repaired.`,
        );
      }
    } catch {
      setStatus('Calendar file could not be read. Nothing was replaced.');
    } finally {
      input.value = '';
      setBusy(false);
    }
  }

  async function removeSavedCalendar() {
    setBusy(true);
    setStatus('');
    setWarnings([]);

    const removed = await commitCalendarSourceRemoval();
    if (!removed.ok) {
      setStatus(removed.errors[0] ?? 'Saved calendar could not be removed.');
      setBusy(false);
      return;
    }

    onReadIssueChange?.(null);
    setSavedCalendar(null);
    const repaired = await repairAfterCalendarChange('Read-only calendar source removed.');
    if (repaired) {
      setStatus('Read-only calendar removed from this device. The flexible private plan was repaired without it.');
    }
    setBusy(false);
  }

  async function saveBuffers() {
    setBusy(true);
    const result = await commitCalendarSourceBuffers(beforeBusyMinutes, afterBusyMinutes);
    if (!result.ok) setStatus(result.errors[0] ?? 'Calendar spacing could not be saved.');
    else {
      setSavedCalendar((current) => current ? { ...current, beforeBusyMinutes, afterBusyMinutes } : null);
      const repaired = await repairAfterCalendarChange('Calendar spacing changed.');
      setStatus(repaired ? 'Calendar spacing saved. The private plan was refreshed.' : CALENDAR_REPAIR_PENDING_MESSAGE);
    }
    setBusy(false);
  }

  return (
    <Card className="plan-calendar-surface">
      <section aria-labelledby="calendar-source-title" className="library-backup-checker">
        <div className="library-subheading">
          <h2 id="calendar-source-title">Read-only calendar</h2>
          <p>
            Import an iCalendar (.ics) file to let Life Rhythm plan around real commitments. The file stays in this local data namespace.
          </p>
          <p>
            Life Rhythm reads this source only. It does not create, move, cancel, or write external calendar events.
          </p>
          <p>This file is a static snapshot. If your calendar changes, re-import the file. Common recurring events and exceptions are read inside the planning horizon.</p>
        </div>

        {savedCalendar ? (
          <dl aria-label="Saved read-only calendar" className="library-backup-preview">
            <div>
              <dt>Source</dt>
              <dd>{savedCalendar.label}</dd>
            </div>
            <div>
              <dt>Imported</dt>
              <dd>{savedCalendar.importedAt}</dd>
            </div>
          </dl>
        ) : (
          <p>No read-only calendar source is saved on this device.</p>
        )}

        {savedCalendar ? <div className="life-shape-inline">
          <label><span>Minutes before busy events</span><input type="number" min="0" max="180" value={beforeBusyMinutes}
            onChange={(event) => setBeforeBusyMinutes(Number(event.target.value))} /></label>
          <label><span>Minutes after busy events</span><input type="number" min="0" max="180" value={afterBusyMinutes}
            onChange={(event) => setAfterBusyMinutes(Number(event.target.value))} /></label>
          <Button disabled={busy || (beforeBusyMinutes === savedCalendar.beforeBusyMinutes && afterBusyMinutes === savedCalendar.afterBusyMinutes)} onClick={saveBuffers}>Save event spacing</Button>
        </div> : null}

        <div className="library-backup-actions">
          <label className="library-file-picker">
            <span>{savedCalendar ? 'Replace calendar file' : 'Select calendar file'}</span>
            <input
              accept="text/calendar,.ics"
              aria-label="Select read-only calendar file"
              disabled={busy}
              onChange={importCalendarFile}
              type="file"
            />
          </label>
          {savedCalendar ? (
            <Button disabled={busy} onClick={removeSavedCalendar}>
              Remove calendar
            </Button>
          ) : null}
        </div>

        <p className="reentry-review__support">
          Calendar changes repair only reversible private placements. External commitments remain untouched.
        </p>
        <p className="reentry-review__support">
          Unsupported busy recurrence is rejected so later commitments cannot silently disappear. Imported calendars are never synced automatically.
        </p>

        {warnings.length > 0 ? (
          <div className="library-validation-summary" role="status">
            <strong>Calendar import notes</strong>
            <ul aria-label="Calendar import warnings" className="library-validation-list">
              {warnings.slice(0, 5).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {status ? <p className="today-feedback" role="status">{status}</p> : null}
      </section>
    </Card>
  );
}
