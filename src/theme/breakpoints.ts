export const breakpoints = {
  compact: 600,
  medium: 900,
  expanded: 1200,
} as const;

export type ResponsiveBreakpoint = keyof typeof breakpoints;

export const contentMaxWidth = {
  compact: 520,
  medium: 760,
  expanded: 980,
} as const;

