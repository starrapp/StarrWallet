/**
 * Root Layout
 * 
 * Main app layout with navigation structure.
 */

// Polyfills must be imported first
import '@/polyfills';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { View, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from '@/contexts';
import { colors } from '@/theme';

// Keep splash screen visible while we load resources
SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const { colors: themeColors, isDark } = useTheme();

  useEffect(() => {
    // Hide splash screen after a short delay
    const hideSplash = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.background.primary },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen 
          name="onboarding" 
          options={{ animation: 'slide_from_bottom' }} 
        />
        <Stack.Screen 
          name="send" 
          options={{ 
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="receive" 
          options={{ 
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="scan" 
          options={{ 
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }} 
        />
        <Stack.Screen 
          name="recovery-phrase" 
          options={{ 
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="delete-wallet" 
          options={{ 
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="change-pin" 
          options={{ 
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }} 
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});

