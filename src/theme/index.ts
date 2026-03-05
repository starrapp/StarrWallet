import { colors } from './colors';
import { fonts, typography } from './typography';
import { spacing, layout, shadows } from './spacing';

export { colors, fonts, typography, spacing, layout, shadows };

export const theme = {
  colors,
  fonts,
  typography,
  spacing,
  layout,
  shadows,
} as const;

export type Theme = typeof theme;

