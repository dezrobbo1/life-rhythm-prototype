import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { AppShell, type ScreenId } from './components/AppShell/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { PlanScreen } from './screens/PlanScreen';
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
import { normalDayWithOneTaskSnapshot, type AppDataSnapshot } from './viewModels';

type JsonBackupExport = Pick<SettingsBackupExport | SoftPlacementBackupExport, 'fileName' | 'json'>;

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

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('today');
  const [theme, setTheme] = useState<ThemeName>('exhale');
  const [settings, setSettings] = useState<Settings>(() => createDefaultSettings());

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
      ...normalDayWithOneTaskSnapshot,
      settings: {
        ...normalDayWithOneTaskSnapshot.settings,
        lifeShape: settings.lifeShape,
        startBoostSafety: settings.startBoostSafety,
        theme: settings.theme,
      },
    }),
    [settings],
  );

  const screens: Record<ScreenId, ReactElement> = {
    today: <TodayScreen />,
    plan: <PlanScreen />,
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
    <AppSnapshotProvider snapshot={appSnapshot}>
      <AppShell
        activeScreen={activeScreen}
        onScreenChange={setActiveScreen}
        theme={theme}
        onThemeChange={setTheme}
      >
        {screens[activeScreen]}
      </AppShell>
    </AppSnapshotProvider>
  );
}
