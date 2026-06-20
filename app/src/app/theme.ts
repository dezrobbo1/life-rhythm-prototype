export const themes = ['exhale', 'clear', 'grounded'] as const;

export type ThemeName = (typeof themes)[number];

export const visualThemes = ['paper', 'tide', 'clay', 'night'] as const;

export type VisualThemeName = (typeof visualThemes)[number];

export const legacyThemeAliases: Record<ThemeName, VisualThemeName> = {
  exhale: 'paper',
  clear: 'tide',
  grounded: 'clay',
};

export const visualThemeLabels: Record<VisualThemeName, string> = {
  paper: 'Paper',
  tide: 'Tide',
  clay: 'Clay',
  night: 'Night',
};

export const visualThemeDescriptions: Record<VisualThemeName, string> = {
  paper: 'Warm, clear, and paper-adjacent without extra texture.',
  tide: 'Cool blue-green calm with clear separation.',
  clay: 'Grounded earth warmth without productivity colour cues.',
  night: 'Low-light calm with readable contrast.',
};

export const themeLabels: Record<ThemeName, string> = {
  exhale: visualThemeLabels.paper,
  clear: visualThemeLabels.tide,
  grounded: visualThemeLabels.clay,
};

export const themeDescriptions: Record<ThemeName, string> = {
  exhale: visualThemeDescriptions.paper,
  clear: visualThemeDescriptions.tide,
  grounded: visualThemeDescriptions.clay,
};

export const visualThemeBackgrounds: Record<VisualThemeName, string> = {
  paper: '#f7f2e8',
  tide: '#f4f8fa',
  clay: '#f3eadf',
  night: '#141b20',
};

export const themeBackgrounds: Record<ThemeName, string> = {
  exhale: visualThemeBackgrounds.paper,
  clear: visualThemeBackgrounds.tide,
  grounded: visualThemeBackgrounds.clay,
};

export function resolveVisualThemeName(theme: ThemeName | VisualThemeName): VisualThemeName {
  if (theme === 'exhale' || theme === 'clear' || theme === 'grounded') {
    return legacyThemeAliases[theme];
  }

  return theme;
}
