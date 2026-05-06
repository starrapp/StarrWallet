import { colors } from './colors';
import { fonts, typography } from './typography';
import { spacing, layout, shadows } from './spacing';
import { breakpoints, contentMaxWidth } from './breakpoints';

export { colors, fonts, typography, spacing, layout, shadows, breakpoints, contentMaxWidth };

export const theme = {
  colors,
  fonts,
  typography,
  spacing,
  layout,
  shadows,
  breakpoints,
  contentMaxWidth,
} as const;

export type Theme = typeof theme;

