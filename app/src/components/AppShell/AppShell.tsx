import type { ReactNode } from 'react';
import { themeLabels, themes, type ThemeName } from '../../app/theme';
import { AppIcon, type AppIconName } from '../AppIcon/AppIcon';
import { BrandMark } from '../BrandMark/BrandMark';

export type ScreenId = 'today' | 'plan' | 'pool' | 'library' | 'reset' | 'setup';

const navItems: Array<{ id: ScreenId; icon: AppIconName; label: string }> = [
  { id: 'today', icon: 'today', label: 'Today' },
  { id: 'plan', icon: 'plan', label: 'Plan' },
  { id: 'pool', icon: 'pool', label: 'Pool' },
  { id: 'library', icon: 'library', label: 'Library' },
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
        <div className="app-header__actions">
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
          <nav className="secondary-nav" aria-label="Secondary">
            <button
              aria-current={activeScreen === 'reset' ? 'page' : undefined}
              onClick={() => onScreenChange('reset')}
              type="button"
            >
              <AppIcon name="reset" size={15} />
              <span>Reset</span>
            </button>
            <button
              aria-current={activeScreen === 'setup' ? 'page' : undefined}
              onClick={() => onScreenChange('setup')}
              type="button"
            >
              <AppIcon name="setup" size={15} />
              <span>Settings</span>
            </button>
          </nav>
        </div>
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
