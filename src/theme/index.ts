export { colors } from './colors';
export { fonts, typography } from './typography';
export { spacing, layout, shadows } from './spacing';

// Convenience re-export of the full theme
export const theme = {
  colors: require('./colors').colors,
  fonts: require('./typography').fonts,
  typography: require('./typography').typography,
  spacing: require('./spacing').spacing,
  layout: require('./spacing').layout,
  shadows: require('./spacing').shadows,
} as const;

export type Theme = typeof theme;

