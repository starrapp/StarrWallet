/**
 * Starr Wallet Color System
 * 
 * A cosmic, premium aesthetic inspired by starlight and deep space.
 * Supports both dark and light themes.
 */

// Dark theme - Deep space foundation (default)
export const darkColors = {
  // Core palette - Deep space foundation
  background: {
    primary: '#0A0A0F',      // Near black with subtle blue
    secondary: '#12121A',    // Elevated surfaces
    tertiary: '#1A1A24',     // Cards and modals
    elevated: '#22222E',     // Hover states
  },

  // Starlight gold - Primary accent
  gold: {
    pure: '#F7C948',         // Pure starlight
    bright: '#FFD93D',       // Bright star
    muted: '#C9A227',        // Dimmed gold
    glow: 'rgba(247, 201, 72, 0.15)', // Glow effect
  },

  // Electric accents
  accent: {
    cyan: '#00D4FF',         // Lightning bolt
    purple: '#9D4EDD',       // Cosmic purple
    pink: '#FF6B9D',         // Error/danger accent
    green: '#00F5A0',        // Success states
  },

  // Text hierarchy
  text: {
    primary: '#FFFFFF',      // Headlines
    secondary: '#A0A0B0',    // Body text
    muted: '#606070',        // Captions
    inverse: '#0A0A0F',      // On light backgrounds
  },

  // Status colors
  status: {
    success: '#00F5A0',
    warning: '#FFB800',
    error: '#FF4757',
    info: '#00D4FF',
  },

  // Gradients
  gradients: {
    gold: ['#F7C948', '#FFD93D', '#C9A227'],
    cosmic: ['#9D4EDD', '#00D4FF'],
    starfield: ['#0A0A0F', '#12121A', '#1A1A24'],
    aurora: ['#00F5A0', '#00D4FF', '#9D4EDD'],
  },

  // Transparency layers
  overlay: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.1)',
    heavy: 'rgba(0, 0, 0, 0.6)',
    gold: 'rgba(247, 201, 72, 0.1)',
  },

  // Border colors
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    medium: 'rgba(255, 255, 255, 0.12)',
    accent: 'rgba(247, 201, 72, 0.3)',
  },
} as const;

// Light theme - Clean and bright
export const lightColors = {
  // Core palette - Light foundation
  background: {
    primary: '#FFFFFF',      // Pure white
    secondary: '#F5F5F7',    // Elevated surfaces
    tertiary: '#EAEAEF',     // Cards and modals
    elevated: '#E0E0E8',     // Hover states
  },

  // Starlight gold - Primary accent (adjusted for light)
  gold: {
    pure: '#D4A017',         // Rich gold
    bright: '#E8B800',       // Bright gold
    muted: '#A07D14',        // Dimmed gold
    glow: 'rgba(212, 160, 23, 0.12)', // Glow effect
  },

  // Electric accents (adjusted for light backgrounds)
  accent: {
    cyan: '#0096CC',         // Lightning bolt
    purple: '#7B2CBF',       // Cosmic purple
    pink: '#D63B6B',         // Error/danger accent
    green: '#00A86B',        // Success states
  },

  // Text hierarchy
  text: {
    primary: '#1A1A24',      // Headlines
    secondary: '#5A5A6E',    // Body text
    muted: '#8E8E9E',        // Captions
    inverse: '#FFFFFF',      // On dark backgrounds
  },

  // Status colors (adjusted for light)
  status: {
    success: '#00A86B',
    warning: '#E6A000',
    error: '#E53E4F',
    info: '#0096CC',
  },

  // Gradients
  gradients: {
    gold: ['#D4A017', '#E8B800', '#A07D14'],
    cosmic: ['#7B2CBF', '#0096CC'],
    starfield: ['#FFFFFF', '#F5F5F7', '#EAEAEF'],
    aurora: ['#00A86B', '#0096CC', '#7B2CBF'],
  },

  // Transparency layers
  overlay: {
    light: 'rgba(0, 0, 0, 0.03)',
    medium: 'rgba(0, 0, 0, 0.06)',
    heavy: 'rgba(0, 0, 0, 0.4)',
    gold: 'rgba(212, 160, 23, 0.08)',
  },

  // Border colors
  border: {
    subtle: 'rgba(0, 0, 0, 0.06)',
    medium: 'rgba(0, 0, 0, 0.1)',
    accent: 'rgba(212, 160, 23, 0.3)',
  },
} as const;

// Default export (dark theme for backwards compatibility)
export const colors = darkColors;

export type ColorTheme = typeof darkColors;
