/**
 * Starr Wallet Color System
 * 
 * A clean, modern aesthetic focusing on simplicity and readability.
 * Primary color is Bitcoin Orange (#F7931A).
 */

// Dark theme - Modern Clean Dark
export const darkColors = {
  // Core palette
  background: {
    primary: '#000000',      // Pure black for OLED
    secondary: '#1C1C1E',    // Elevated surfaces (System Gray 6 Dark)
    tertiary: '#2C2C2E',     // Cards and modals (System Gray 5 Dark)
    elevated: '#3A3A3C',     // Hover states
  },

  // Primary Brand Color (Bitcoin Orange) - Mapping 'gold' to this for compatibility
  gold: {
    pure: '#F7931A',         // Bitcoin Orange
    bright: '#FFA040',       // Lighter Orange
    muted: '#B36200',        // Darker Orange
    glow: 'rgba(247, 147, 26, 0.2)', // Orange Glow
  },

  // Accents
  accent: {
    cyan: '#0A84FF',         // System Blue
    purple: '#BF5AF2',       // System Purple
    pink: '#FF375F',         // System Pink
    green: '#30D158',        // System Green
  },

  // Text hierarchy
  text: {
    primary: '#FFFFFF',      // White
    secondary: '#EBEBF5',    // Light Gray (60%)
    muted: '#8E8E93',        // Gray
    inverse: '#000000',      // On light backgrounds
  },

  // Status colors
  status: {
    success: '#30D158',
    warning: '#FFD60A',
    error: '#FF453A',
    info: '#0A84FF',
  },

  // Gradients (Simplified/Removed in favor of solid colors, keeping structure for types)
  gradients: {
    gold: ['#F7931A', '#F7931A', '#F7931A'], // Solid Orange
    cosmic: ['#0A84FF', '#0A84FF'], // Solid Blue
    starfield: ['#000000', '#1C1C1E', '#1C1C1E'],
    aurora: ['#30D158', '#0A84FF', '#BF5AF2'],
  },

  // Transparency layers
  overlay: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    heavy: 'rgba(0, 0, 0, 0.7)',
    gold: 'rgba(247, 147, 26, 0.15)',
  },

  // Border colors
  border: {
    subtle: '#38383A',
    medium: '#48484A',
    accent: '#F7931A',
  },
} as const;

// Light theme - Clean White
export const lightColors = {
  // Core palette
  background: {
    primary: '#FFFFFF',      // Pure white
    secondary: '#F2F2F7',    // System Gray 6
    tertiary: '#FFFFFF',     // Cards (White on Gray)
    elevated: '#E5E5EA',     // System Gray 5
  },

  // Primary Brand Color
  gold: {
    pure: '#F7931A',         // Bitcoin Orange
    bright: '#F7931A',       // Same for light mode (maybe slightly darker if needed)
    muted: '#B36200',
    glow: 'rgba(247, 147, 26, 0.1)',
  },

  // Accents
  accent: {
    cyan: '#007AFF',
    purple: '#AF52DE',
    pink: '#FF2D55',
    green: '#34C759',
  },

  // Text hierarchy
  text: {
    primary: '#000000',      // Black
    secondary: '#3C3C43',    // Dark Gray (60%)
    muted: '#8E8E93',        // Gray
    inverse: '#FFFFFF',      // On dark backgrounds
  },

  // Status colors
  status: {
    success: '#34C759',
    warning: '#FFCC00',
    error: '#FF3B30',
    info: '#007AFF',
  },

  // Gradients (Solid for clean look)
  gradients: {
    gold: ['#F7931A', '#F7931A', '#F7931A'],
    cosmic: ['#007AFF', '#007AFF'],
    starfield: ['#FFFFFF', '#F2F2F7', '#F2F2F7'],
    aurora: ['#34C759', '#007AFF', '#AF52DE'],
  },

  // Transparency layers
  overlay: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.1)',
    heavy: 'rgba(0, 0, 0, 0.5)',
    gold: 'rgba(247, 147, 26, 0.1)',
  },

  // Border colors
  border: {
    subtle: '#E5E5EA',
    medium: '#D1D1D6',
    accent: '#F7931A',
  },
} as const;

// Default export
export const colors = darkColors;

export type ColorTheme = typeof darkColors | typeof lightColors;
