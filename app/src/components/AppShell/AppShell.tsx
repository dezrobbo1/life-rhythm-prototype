import type { ReactNode } from 'react';
import { themeLabels, themes, type ThemeName } from '../../app/theme';
import { AppIcon, type AppIconName } from '../AppIcon/AppIcon';
import { BrandMark } from '../BrandMark/BrandMark';

export type ScreenId = 'today' | 'plan' | 'pool' | 'library' | 'reset' | 'setup';

const navItems: Array<{ id: ScreenId; icon: AppIconName; label: string }> = [
  { id: 'today', icon: 'today', label: 'Today' },
  { id: 'plan', icon: 'plan', label: 'Plan' },
  { id: 'pool', icon: 'pool', label: 'Held' },
  { id: 'library', icon: 'library', label: 'Library' },
];

const captureScreenIds = new Set<ScreenId>(['today', 'plan', 'pool', 'library']);

type AppShellProps = {
  activeScreen: ScreenId;
  children: ReactNode;
  onScreenChange: (screen: ScreenId) => void;
  onCapture?: () => void;
  captureFeedback?: { kind: 'error' | 'success'; message: string } | null;
  onShowExample?: () => void;
  onThemeChange?: (theme: ThemeName) => void;
  theme: ThemeName;
};

export function AppShell({
  activeScreen,
  captureFeedback,
  children,
  onCapture,
  onScreenChange,
  onShowExample,
  onThemeChange,
  theme,
}: AppShellProps) {
  return (
    <div className="app-shell" data-theme={theme} data-trial-mode="personal">
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
          {onCapture && captureScreenIds.has(activeScreen) ? (
            <button className="shell-capture-action" onClick={onCapture} type="button">
              <AppIcon name="add" size={16} />
              <span>Capture</span>
            </button>
          ) : null}
          {activeScreen === 'setup' && onThemeChange ? (
            <label className="theme-control theme-control--settings">
              <span>Theme</span>
              <select value={theme} onChange={(event) => onThemeChange(event.target.value as ThemeName)}>
                {themes.map((item) => (
                  <option key={item} value={item}>
                    {themeLabels[item]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <nav className="secondary-nav" aria-label="Secondary">
            {onShowExample ? (
              <button className="secondary-nav__example" onClick={onShowExample} type="button">
                <AppIcon name="info" size={15} />
                <span>Example day</span>
              </button>
            ) : null}
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
      {captureFeedback ? (
        <p
          className={`shell-capture-feedback shell-capture-feedback--${captureFeedback.kind}`}
          role={captureFeedback.kind === 'error' ? 'alert' : 'status'}
        >
          {captureFeedback.message}
        </p>
      ) : null}
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
