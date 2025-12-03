/**
 * Starr Wallet Color System
 * 
 * A cosmic, premium aesthetic inspired by starlight and deep space.
 * Uses a rich dark palette with luminous gold and electric accents.
 */

export const colors = {
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

export type ColorTheme = typeof colors;

