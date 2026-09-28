import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../components';
import {
  checkPortableProfileForRestore,
  exportPortableProfile,
  REPLACE_LOCAL_PROFILE_CONFIRMATION,
  restorePortableProfile,
} from '../../data/portableProfileBackup';

export function PortableProfileRecovery({ onReload = () => window.location.reload() }: { onReload?: () => void }) {
  const [source, setSource] = useState('');
  const revision = useRef(0);
  const [checkedSource, setCheckedSource] = useState('');
  const [checked, setChecked] = useState<Awaited<ReturnType<typeof checkPortableProfileForRestore>> | null>(null);
  const [confirmed, setConfirmed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function changeSource(value: string) {
    revision.current += 1;
    setSource(value);
    setChecked(null);
    setCheckedSource('');
    setConfirmed('');
    setMessage('');
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    changeSource('');
    const atRevision = revision.current;
    try {
      const content = await file.text();
      if (atRevision === revision.current) changeSource(content);
    } catch {
      if (atRevision === revision.current) { changeSource(''); setMessage('Backup file could not be read. Nothing changed.'); }
    }
  }

  async function exportBackup() {
    setBusy(true);
    try {
      const backup = await exportPortableProfile();
      const url = URL.createObjectURL(new Blob([backup.json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.fileName;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Portable backup created. Keep the file somewhere private.');
    } catch { setMessage('Portable backup could not be created. Check saved data before trying again.'); }
    finally { setBusy(false); }
  }

  async function check() {
    const atRevision = ++revision.current;
    const candidate = source;
    setBusy(true);
    try {
      const result = await checkPortableProfileForRestore(candidate);
      if (atRevision !== revision.current) return;
      setChecked(result);
      setCheckedSource(result.ok ? candidate : '');
      setConfirmed('');
      setMessage(result.ok ? 'Backup checked. No local data changed.' : result.errors.join(' '));
    } catch { if (atRevision === revision.current) { setChecked(null); setMessage('Backup could not be checked. Nothing changed.'); } }
    finally { setBusy(false); }
  }

  async function restore() {
    if (!checked?.ok || !('expectation' in checked)) return;
    setBusy(true);
    const result = await restorePortableProfile(checkedSource, checked.expectation, confirmed);
    if (result.ok) {
      setMessage('Restore complete. Reloading this local profile.');
      onReload();
    } else {
      setChecked(null);
      setConfirmed('');
      setMessage(result.errors.join(' '));
    }
    setBusy(false);
  }

  return (
    <section className="setup-backup-panel" aria-labelledby="portable-profile-title">
      <h3 id="portable-profile-title">Portable backup</h3>
      <p>Keeps your current Life Rhythm profile in a file you control. You can restore it in another browser or device.</p>
      <p>The file may contain tasks, routines, settings, behavioural history and calendar information. Keep it private. Sign-in does not upload or sync this data.</p>
      <Button onClick={exportBackup} disabled={busy}>Export portable backup</Button>
      <label className="setup-backup-checker">
        <span>Select portable backup file</span>
        <input type="file" accept=".json,application/json" onChange={readFile} disabled={busy} />
      </label>
      <label className="setup-backup-checker">
        <span>Or paste portable backup text</span>
        <textarea value={source} onChange={(event) => changeSource(event.target.value)} rows={4} disabled={busy} />
      </label>
      <Button onClick={check} disabled={busy || !source.trim()}>Check backup</Button>
      {checked?.ok && 'expectation' in checked ? <div aria-label="Portable backup preview">
        <p>Exported {checked.preview.exportedAt}. Current local profile: {checked.hasData ? 'contains data' : 'appears empty'}.</p>
        <dl className="setup-about-list">
          {Object.entries({ Settings: checked.preview.settingsPresent ? 'Present' : 'Absent',
            'Held items': checked.preview.pool, 'Today tasks': checked.preview.today,
            'Configured rhythms': checked.preview.rhythms, 'Rhythm instances': checked.preview.instances,
            'Soft placements': checked.preview.placements, 'Explicit preferences': checked.preview.preferences,
            'Duration controls': checked.preview.durationControls, 'Behaviour events': checked.preview.behaviourEvents,
            'Calendar source': checked.preview.calendarPresent ? 'Present' : 'Absent',
          }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <p>Restore replaces this local profile; it does not merge or use timestamps to choose changes. It does not change another device or upload anything. Your backup file remains unchanged.</p>
        {checked.hasData ? <label>
          <span>Type {REPLACE_LOCAL_PROFILE_CONFIRMATION} to replace this local profile</span>
          <input value={confirmed} onChange={(event) => setConfirmed(event.target.value)} autoComplete="off" />
        </label> : null}
        <Button onClick={restore} disabled={busy || (checked.hasData && confirmed !== REPLACE_LOCAL_PROFILE_CONFIRMATION)}>
          Restore backup
        </Button>
      </div> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
