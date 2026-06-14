export const themes = ['exhale', 'clear', 'grounded'] as const;

export type ThemeName = (typeof themes)[number];

export const themeLabels: Record<ThemeName, string> = {
  exhale: 'Exhale',
  clear: 'Clear',
  grounded: 'Grounded',
};

export const themeBackgrounds: Record<ThemeName, string> = {
  exhale: '#f7f2e8',
  clear: '#f4f8fa',
  grounded: '#f3eadf',
};
