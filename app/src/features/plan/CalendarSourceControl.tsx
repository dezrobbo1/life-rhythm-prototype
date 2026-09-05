import { useEffect, useState, type ChangeEvent } from 'react';
import { Button, Card } from '../../components';
import {
  importIcsCalendarSource,
  loadCalendarSource,
  removeCalendarSource,
} from '../../data/calendarSourceRepository';
import { repairCurrentPrivatePlan } from '../../data/schedulerPlanCoordinator';

type CalendarSourceControlProps = {
  onPlanRepaired?: () => void;
};

type SavedCalendarSummary = {
  importedAt: string;
  label: string;
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

export function CalendarSourceControl({ onPlanRepaired }: CalendarSourceControlProps) {
  const [savedCalendar, setSavedCalendar] = useState<SavedCalendarSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    loadCalendarSource().then((result) => {
      if (!active) return;

      if (result.status === 'ok') {
        setSavedCalendar({
          importedAt: result.record.importedAt,
          label: result.record.label,
        });
        return;
      }

      if (result.status === 'invalid' || result.status === 'error') {
        setStatus('Saved calendar data could not be read safely. The flexible plan will not use it.');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function repairAfterCalendarChange(reason: string) {
    const repaired = await repairCurrentPrivatePlan({
      trigger: 'calendarChanged',
      reason,
    });

    if (!repaired.ok) {
      setStatus('Calendar change was saved, but the flexible private plan could not be repaired. Open Plan again after checking the saved data.');
      return false;
    }

    onPlanRepaired?.();
    return true;
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
      const imported = await importIcsCalendarSource({
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

      setSavedCalendar({
        importedAt: imported.record.importedAt,
        label: imported.record.label,
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

    const removed = await removeCalendarSource();
    if (!removed.ok) {
      setStatus(removed.errors[0] ?? 'Saved calendar could not be removed.');
      setBusy(false);
      return;
    }

    setSavedCalendar(null);
    const repaired = await repairAfterCalendarChange('Read-only calendar source removed.');
    if (repaired) {
      setStatus('Read-only calendar removed from this device. The flexible private plan was repaired without it.');
    }
    setBusy(false);
  }

  return (
    <Card>
      <section aria-labelledby="calendar-source-title" className="library-backup-checker">
        <div className="library-subheading">
          <h2 id="calendar-source-title">Read-only calendar</h2>
          <p>
            Import an iCalendar (.ics) file to let Life Rhythm plan around real commitments. The file stays in this local data namespace.
          </p>
          <p>
            Life Rhythm reads this source only. It does not create, move, cancel, or write external calendar events.
          </p>
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
          Recurring calendar rules are not accepted yet. Life Rhythm rejects those imports rather than silently treating later recurring commitments as free time.
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
