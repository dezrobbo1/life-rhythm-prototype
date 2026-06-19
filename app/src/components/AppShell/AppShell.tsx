import type { ReactNode } from 'react';
import { themeLabels, themes, type ThemeName } from '../../app/theme';
import { AppIcon, type AppIconName } from '../AppIcon/AppIcon';
import { BrandMark } from '../BrandMark/BrandMark';

export type ScreenId = 'today' | 'plan' | 'library' | 'reset' | 'setup';

const navItems: Array<{ id: ScreenId; icon: AppIconName; label: string }> = [
  { id: 'today', icon: 'today', label: 'Today' },
  { id: 'plan', icon: 'plan', label: 'Plan' },
  { id: 'library', icon: 'library', label: 'Library' },
  { id: 'reset', icon: 'reset', label: 'Reset' },
  { id: 'setup', icon: 'setup', label: 'Setup' },
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
          <BrandMark />
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
              <AppIcon name={item.icon} size={18} />
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
