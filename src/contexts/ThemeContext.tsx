/**
 * Theme Context
 * 
 * Provides theme state and toggle functionality throughout the app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ColorTheme } from '@/theme/colors';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'starr_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedMode && ['dark', 'light', 'system'].includes(savedMode)) {
        setModeState(savedMode as ThemeMode);
      }
    } catch (error) {
      console.error('[ThemeContext] Failed to load theme:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setMode = useCallback(async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
      setModeState(newMode);
    } catch (error) {
      console.error('[ThemeContext] Failed to save theme:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  }, [mode, setMode]);

  // Determine if we should use dark theme
  const isDark = mode === 'system' 
    ? systemColorScheme !== 'light' 
    : mode === 'dark';

  // Get the appropriate color palette
  const colors = isDark ? darkColors : lightColors;

  const value: ThemeContextType = {
    mode,
    isDark,
    colors,
    setMode,
    toggleTheme,
  };

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook for components that just need colors (with fallback for non-context usage)
export function useColors(): ColorTheme {
  try {
    const context = useContext(ThemeContext);
    // Return colors from context if available, otherwise fallback to darkColors
    if (context && context.colors) {
      return context.colors;
    }
    return darkColors;
  } catch (error) {
    // If context is not available (e.g., outside ThemeProvider), return darkColors
    console.warn('[useColors] ThemeContext not available, using darkColors fallback');
    return darkColors;
  }
}

