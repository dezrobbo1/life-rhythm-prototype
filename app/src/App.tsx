import { useState } from 'react';
import type { ReactElement } from 'react';
import { AppShell, type ScreenId } from './components/AppShell/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { PlanScreen } from './screens/PlanScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { ResetScreen } from './screens/ResetScreen';
import { SetupScreen } from './screens/SetupScreen';
import type { ThemeName } from './app/theme';
import { AppSnapshotProvider } from './data/AppSnapshotProvider';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('today');
  const [theme, setTheme] = useState<ThemeName>('exhale');
  const screens: Record<ScreenId, ReactElement> = {
    today: <TodayScreen />,
    plan: <PlanScreen />,
    library: <LibraryScreen />,
    reset: <ResetScreen />,
    setup: <SetupScreen theme={theme} onThemeChange={setTheme} />,
  };

  return (
    <AppSnapshotProvider>
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
