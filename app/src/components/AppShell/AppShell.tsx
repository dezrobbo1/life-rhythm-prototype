import type { ReactNode } from 'react';
import { themeLabels, themes, type ThemeName } from '../../app/theme';

export type ScreenId = 'today' | 'plan' | 'library' | 'reset' | 'setup';

const navItems: Array<{ id: ScreenId; icon: string; label: string }> = [
  { id: 'today', icon: 'T', label: 'Today' },
  { id: 'plan', icon: 'P', label: 'Plan' },
  { id: 'library', icon: 'L', label: 'Library' },
  { id: 'reset', icon: 'R', label: 'Reset' },
  { id: 'setup', icon: 'S', label: 'Setup' },
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
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <div className="brand-copy">
            <p className="eyebrow">Personal trial</p>
            <h1>Life Rhythm</h1>
            <p>Start small. Keep rhythm.</p>
          </div>
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
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="bottom-nav__label">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
