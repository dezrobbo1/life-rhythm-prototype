import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { AppShell, type ScreenId } from './components/AppShell/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { PlanScreen } from './screens/PlanScreen';
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
import { normalDayWithOneTaskSnapshot, type AppDataSnapshot } from './viewModels';

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
    library: <LibraryScreen />,
    reset: <ResetScreen />,
    setup: (
      <SetupScreen
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
