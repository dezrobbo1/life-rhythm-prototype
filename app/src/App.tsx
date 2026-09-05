import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { AppShell, type ScreenId } from './components/AppShell/AppShell';
import { BrandMark, Button } from './components';
import { TodayScreen } from './screens/TodayScreen';
import { PersonalPlanScreen } from './screens/PersonalPlanScreen';
import { PoolScreen } from './screens/PoolScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { ResetScreen } from './screens/ResetScreen';
import { SetupScreen } from './screens/SetupScreen';
import { CalendarSourceControl } from './features/plan/CalendarSourceControl';
import type { ThemeName } from './app/theme';
import { AppSnapshotProvider } from './data/AppSnapshotProvider';
import {
  loadSettingsResult,
  resetSettingsToDefaults,
  saveSettings,
  type Settings,
  type SettingsLoadResult,
  type SettingsWriteInput,
  type SettingsWriteResult,
} from './data/settingsRepository';
import type { LegacySettingsConflict } from './data/dayProfileMigration';
import { exportSettingsBackup, type SettingsBackupExport } from './data/settingsExport';
import { exportSoftPlacementBackup, type SoftPlacementBackupExport } from './data/softPlacementBackup';
import { exportTaskPoolBackup, type TaskPoolBackupExport } from './data/taskPoolBackup';
import {
  emptyAppSnapshot,
  normalDayWithOneTaskSnapshot,
  type AppDataSnapshot,
} from './viewModels';

type JsonBackupExport = Pick<SettingsBackupExport | SoftPlacementBackupExport | TaskPoolBackupExport, 'fileName' | 'json'>;

type ExamplePreviewProps = {
  onReturnToPersonalTrial: () => void;
  theme: ThemeName;
};

const legacyConflictFieldLabels: Record<string, string> = {
  bedTime: 'Sleep time',
  breakfastTime: 'Breakfast anchor',
  dinnerTime: 'Dinner anchor',
  lunchTime: 'Lunch anchor',
  wakeTime: 'Wake time',
  workDays: 'Work days',
  workEnd: 'Work end',
  workStart: 'Work start',
};

function conflictFieldLabel(field: string) {
  return legacyConflictFieldLabels[field] ?? field;
}

function conflictValueLabel(value: unknown) {
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/**
 * The day-profile contract requires duplicated legacy settings fields to be
 * surfaced for review rather than silently resolved.
 */
function LegacySettingsConflictNotice({ conflicts }: { conflicts: LegacySettingsConflict[] }) {
  return (
    <section aria-labelledby="settings-conflict-title" role="status">
      <h2 id="settings-conflict-title">Two saved values to check</h2>
      <p>
        Your earlier settings kept some values in two places, and they do not match. Nothing was changed and
        nothing was scheduled. Open Setup to confirm the value you want; saving Setup keeps the Life Shape
        value shown there.
      </p>
      <ul>
        {conflicts.map((conflict) => (
          <li key={conflict.field}>
            {conflictFieldLabel(conflict.field)}: earlier value {conflictValueLabel(conflict.legacyRootValue)},
            Life Shape value {conflictValueLabel(conflict.lifeShapeValue)}.
          </li>
        ))}
      </ul>
    </section>
  );
}

function downloadJsonBackup(backup: JsonBackupExport) {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  const blob = new Blob([backup.json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = backup.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function ExamplePreview({ onReturnToPersonalTrial, theme }: ExamplePreviewProps) {
  const exampleTask = normalDayWithOneTaskSnapshot.activeTasks?.[0];
  const examplePlanBlock = normalDayWithOneTaskSnapshot.planBlocks?.[0];
  const exampleRhythms = normalDayWithOneTaskSnapshot.rhythmTemplates?.slice(0, 2) ?? [];

  return (
    <div className="trial-example" data-theme={theme}>
      <main className="trial-example__main" aria-labelledby="trial-example-title">
        <header className="trial-example__header">
          <div className="trial-example__brand">
            <BrandMark />
            <div>
              <p className="eyebrow">Read-only example</p>
              <h1 id="trial-example-title">A calm day in Life Rhythm</h1>
            </div>
          </div>
          <Button onClick={onReturnToPersonalTrial} variant="primary">
            Use my personal trial
          </Button>
        </header>

        <p className="trial-example__boundary">
          This example is separate from your personal trial. Nothing here is saved, scheduled, or mixed with your local data.
        </p>

        <section className="trial-example__primary" aria-labelledby="trial-example-today-title">
          <p className="section-label">Today</p>
          <h2 id="trial-example-today-title">{exampleTask?.title ?? 'One useful next action'}</h2>
          <p>{exampleTask?.purpose ?? 'Keep one useful action visible and let the rest stay light.'}</p>
          <div className="trial-example__minimum">
            <span>Minimum version</span>
            <strong>{exampleTask?.minimum?.label ?? 'Do the smallest useful version.'}</strong>
          </div>
        </section>

        <div className="trial-example__grid">
          <section aria-labelledby="trial-example-pool-title">
            <p className="section-label">Holding Tray</p>
            <h2 id="trial-example-pool-title">Pool</h2>
            <p>Capture something without turning it into an immediate demand.</p>
            <p className="trial-example__quiet">Safely held · No schedule created</p>
          </section>

          <section aria-labelledby="trial-example-plan-title">
            <p className="section-label">Soft day shape</p>
            <h2 id="trial-example-plan-title">{examplePlanBlock?.label ?? 'Plan'}</h2>
            <p>{examplePlanBlock?.summary ?? 'Broad bands protect the shape of the day without owning every minute.'}</p>
            <p className="trial-example__quiet">Protected time stays protected.</p>
          </section>
        </div>

        {exampleRhythms.length > 0 ? (
          <section className="trial-example__rhythms" aria-labelledby="trial-example-rhythms-title">
            <p className="section-label">Reusable support</p>
            <h2 id="trial-example-rhythms-title">Library rhythms</h2>
            <ul>
              {exampleRhythms.map((rhythm) => (
                <li key={rhythm.id}>
                  <strong>{rhythm.title}</strong>
                  <span>{rhythm.minimum?.label ?? 'Minimum version not set.'}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="trial-example__footer">
          <p>Your personal trial starts empty and only shows data you create on this device.</p>
          <Button onClick={onReturnToPersonalTrial} variant="primary">
            Return to personal trial
          </Button>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('today');
  const [theme, setTheme] = useState<ThemeName>('exhale');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsLoadStatus, setSettingsLoadStatus] = useState<SettingsLoadResult['status'] | 'loading'>('loading');
  const [settingsConflicts, setSettingsConflicts] = useState<LegacySettingsConflict[]>([]);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [preferredPlanPlacementDate, setPreferredPlanPlacementDate] = useState<string | null>(null);
  const [preferredPlanTaskId, setPreferredPlanTaskId] = useState<string | null>(null);
  const [planRevision, setPlanRevision] = useState(0);

  useEffect(() => {
    let active = true;

    loadSettingsResult()
      .then((result) => {
        if (!active) return;

        setSettingsLoadStatus(result.status);
        setSettingsConflicts(result.conflicts);

        if (
          result.status === 'defaulted' ||
          result.status === 'loaded' ||
          result.status === 'migrated' ||
          result.status === 'migrationPersistenceFailed'
        ) {
          setSettings(result.settings);
          setTheme(result.settings.theme);
          return;
        }

        setSettings(null);
      })
      .catch(() => {
        if (!active) return;

        setSettings(null);
        setSettingsConflicts([]);
        setSettingsLoadStatus('readFailed');
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSaveSettings(input: SettingsWriteInput): Promise<SettingsWriteResult> {
    const result = await saveSettings(input);

    if (result.ok) {
      setSettings(result.settings);
      setTheme(result.settings.theme);
      setSettingsConflicts([]);
      setSettingsLoadStatus('loaded');
    }

    return result;
  }

  async function handleResetSettings(): Promise<Settings> {
    const resetSettings = await resetSettingsToDefaults();

    setSettings(resetSettings);
    setTheme(resetSettings.theme);
    setSettingsConflicts([]);
    setSettingsLoadStatus('loaded');

    return resetSettings;
  }

  async function handleExportSettingsBackup(): Promise<SettingsBackupExport> {
    const backup = await exportSettingsBackup();

    downloadJsonBackup(backup);

    return backup;
  }

  async function handleExportSoftPlacementBackup(): Promise<SoftPlacementBackupExport | null> {
    const backup = await exportSoftPlacementBackup();

    if (backup) {
      downloadJsonBackup(backup);
    }

    return backup;
  }

  async function handleExportTaskPoolBackup(): Promise<TaskPoolBackupExport | null> {
    const backup = await exportTaskPoolBackup();

    if (backup) {
      downloadJsonBackup(backup);
    }

    return backup;
  }

  function handleScreenChange(screen: ScreenId) {
    setPreferredPlanPlacementDate(null);
    setPreferredPlanTaskId(null);
    setActiveScreen(screen);
  }

  function openPlanForTask(taskId: string, placementDate?: string) {
    setPreferredPlanPlacementDate(placementDate ?? null);
    setPreferredPlanTaskId(taskId);
    setActiveScreen('plan');
  }

  const appSnapshot = useMemo<AppDataSnapshot>(
    () => settings === null
      ? emptyAppSnapshot
      : ({
          ...emptyAppSnapshot,
          futureModules: [],
          settings: {
            ...emptyAppSnapshot.settings,
            lifeShape: settings.lifeShape,
            startBoostSafety: settings.startBoostSafety,
            theme: settings.theme,
          },
        }),
    [settings],
  );

  if (settingsLoadStatus === 'loading') {
    return (
      <main aria-busy="true">
        <p role="status">Loading your saved Life Rhythm settings...</p>
      </main>
    );
  }

  if (settings === null || settingsLoadStatus === 'invalid' || settingsLoadStatus === 'readFailed') {
    return (
      <main>
        <section aria-labelledby="settings-load-error-title" role="alert">
          <h1 id="settings-load-error-title">Saved settings could not be loaded.</h1>
          <p>Nothing stored on this device was changed.</p>
          <p>Life Rhythm has not replaced the saved settings with defaults.</p>
        </section>
      </main>
    );
  }

  if (exampleOpen) {
    return (
      <ExamplePreview
        onReturnToPersonalTrial={() => setExampleOpen(false)}
        theme={theme}
      />
    );
  }

  const screens: Record<ScreenId, ReactElement> = {
    today: <TodayScreen />,
    plan: (
      <>
        <PersonalPlanScreen
          key={`personal-plan-${planRevision}`}
          preferredPlacementDate={preferredPlanPlacementDate}
          preferredTaskId={preferredPlanTaskId}
        />
        <CalendarSourceControl
          onPlanRepaired={() => setPlanRevision((revision) => revision + 1)}
        />
      </>
    ),
    pool: <PoolScreen onOpenPlan={openPlanForTask} />,
    library: <LibraryScreen />,
    reset: <ResetScreen />,
    setup: (
      <SetupScreen
        onExportSettingsBackup={handleExportSettingsBackup}
        onExportSoftPlacementBackup={handleExportSoftPlacementBackup}
        onExportTaskPoolBackup={handleExportTaskPoolBackup}
        onResetSettings={handleResetSettings}
        onSaveSettings={handleSaveSettings}
        onThemeChange={setTheme}
        settings={settings}
        theme={theme}
      />
    ),
  };

  return (
    <AppSnapshotProvider snapshot={appSnapshot} source="personal">
      {settingsConflicts.length > 0 ? (
        <LegacySettingsConflictNotice conflicts={settingsConflicts} />
      ) : null}
      {settingsLoadStatus === 'migrationPersistenceFailed' ? (
        <p role="status">
          Your settings were loaded for this session, but the updated settings foundation could not be saved. Nothing already stored on this device was changed. The migration will need to be retried.
        </p>
      ) : null}
      <AppShell
        activeScreen={activeScreen}
        onScreenChange={handleScreenChange}
        onShowExample={() => setExampleOpen(true)}
        onThemeChange={setTheme}
        theme={theme}
      >
        {screens[activeScreen]}
      </AppShell>
    </AppSnapshotProvider>
  );
}
