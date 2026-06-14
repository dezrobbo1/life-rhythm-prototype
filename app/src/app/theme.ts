export const themes = ['exhale', 'clear', 'grounded'] as const;

export type ThemeName = (typeof themes)[number];

export const themeLabels: Record<ThemeName, string> = {
  exhale: 'Exhale',
  clear: 'Clear',
  grounded: 'Grounded',
};

