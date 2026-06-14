import type { ReactNode } from 'react';
import { themeLabels, themes, type ThemeName } from '../../app/theme';

export type ScreenId = 'today' | 'plan' | 'library' | 'reset' | 'setup';

const navItems: Array<{ id: ScreenId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'library', label: 'Library' },
  { id: 'reset', label: 'Reset' },
  { id: 'setup', label: 'Setup' },
];

type AppShellProps = {
  activeScreen: ScreenId;
  children: ReactNode;
  onScreenChange: (screen: ScreenId) => void;
  onThemeChange: (theme: ThemeName) => void;
  theme: ThemeName;
};

export function AppShell({
  activeScreen,
  children,
  onScreenChange,
  onThemeChange,
  theme,
}: AppShellProps) {
  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Architecture scaffold</p>
          <h1>Life Rhythm</h1>
        </div>
        <label className="theme-control">
          <span>Theme</span>
          <select value={theme} onChange={(event) => onThemeChange(event.target.value as ThemeName)}>
            {themes.map((item) => (
              <option key={item} value={item}>
                {themeLabels[item]}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main className="app-main">{children}</main>
      <nav className="bottom-nav" aria-label="Primary">
        {navItems.map((item) => (
          <button
            aria-current={activeScreen === item.id ? 'page' : undefined}
            className="bottom-nav__button"
            key={item.id}
            onClick={() => onScreenChange(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

