/**
 * Starr Wallet Typography System
 * 
 * Using a combination of:
 * - Outfit: Modern geometric sans-serif for headlines
 * - JetBrains Mono: Technical precision for amounts and addresses
 */

import { Platform } from 'react-native';

// Font families (loaded via expo-font or native config)
export const fonts = {
  // Primary display font
  display: Platform.select({
    ios: 'Outfit-Bold',
    android: 'Outfit-Bold',
    default: 'Outfit-Bold',
  }),
  
  // Headings
  heading: Platform.select({
    ios: 'Outfit-SemiBold',
    android: 'Outfit-SemiBold',
    default: 'Outfit-SemiBold',
  }),
  
  // Body text
  body: Platform.select({
    ios: 'Outfit-Regular',
    android: 'Outfit-Regular',
    default: 'System',
  }),
  
  // Medium weight
  medium: Platform.select({
    ios: 'Outfit-Medium',
    android: 'Outfit-Medium',
    default: 'System',
  }),
  
  // Monospace for amounts and addresses
  mono: Platform.select({
    ios: 'JetBrainsMono-Regular',
    android: 'JetBrainsMono-Regular',
    default: 'monospace',
  }),
  
  monoBold: Platform.select({
    ios: 'JetBrainsMono-Bold',
    android: 'JetBrainsMono-Bold',
    default: 'monospace',
  }),
} as const;

// Type scale using a 1.25 ratio
export const typography = {
  // Display - Hero amounts
  displayLarge: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -1.5,
  },
  
  displayMedium: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1,
  },
  
  displaySmall: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  
  // Headlines
  headlineLarge: {
    fontFamily: fonts.heading,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
  },
  
  headlineMedium: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
  },
  
  headlineSmall: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0,
  },
  
  // Titles
  titleLarge: {
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  
  titleMedium: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.15,
  },
  
  titleSmall: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  
  // Body text
  bodyLarge: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.25,
  },
  
  bodyMedium: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  
  bodySmall: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  
  // Labels
  labelLarge: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  
  labelMedium: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  
  labelSmall: {
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  
  // Monospace variants for amounts
  amountLarge: {
    fontFamily: fonts.monoBold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1,
  },
  
  amountMedium: {
    fontFamily: fonts.monoBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  
  amountSmall: {
    fontFamily: fonts.mono,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0,
  },
  
  // Address display
  address: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
} as const;

export type Typography = typeof typography;

