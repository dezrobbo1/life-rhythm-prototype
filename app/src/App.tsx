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
import type { ThemeName } from './app/theme';
import { AppSnapshotProvider } from './data/AppSnapshotProvider';
import {
  createDefaultSettings,
  loadSettings,
  resetSettingsToDefaults,
  saveSettings,
  type Settings,
  type SettingsWriteInput,
  type SettingsWriteResult,
} from './data/settingsRepository';
import { exportSettingsBackup, type SettingsBackupExport } from './data/settingsExport';
import { exportSoftPlacementBackup, type SoftPlacementBackupExport } from './data/softPlacementBackup';
import {
  emptyAppSnapshot,
  normalDayWithOneTaskSnapshot,
  type AppDataSnapshot,
} from './viewModels';

type JsonBackupExport = Pick<SettingsBackupExport | SoftPlacementBackupExport, 'fileName' | 'json'>;

type ExamplePreviewProps = {
  onReturnToPersonalTrial: () => void;
  theme: ThemeName;
};

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
  const [settings, setSettings] = useState<Settings>(() => createDefaultSettings());
  const [exampleOpen, setExampleOpen] = useState(false);

  useEffect(() => {
    let active = true;

    loadSettings().then((loadedSettings) => {
      if (!active) return;

      setSettings(loadedSettings);
      setTheme(loadedSettings.theme);
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
    }

    return result;
  }

  async function handleResetSettings(): Promise<Settings> {
    const resetSettings = await resetSettingsToDefaults();

    setSettings(resetSettings);
    setTheme(resetSettings.theme);

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

  const appSnapshot = useMemo<AppDataSnapshot>(
    () => ({
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
    plan: <PersonalPlanScreen />,
    pool: <PoolScreen />,
    library: <LibraryScreen />,
    reset: <ResetScreen />,
    setup: (
      <SetupScreen
        onExportSettingsBackup={handleExportSettingsBackup}
        onExportSoftPlacementBackup={handleExportSoftPlacementBackup}
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
      <AppShell
        activeScreen={activeScreen}
        onScreenChange={setActiveScreen}
        onShowExample={() => setExampleOpen(true)}
        theme={theme}
      >
        {screens[activeScreen]}
      </AppShell>
    </AppSnapshotProvider>
  );
}
