/**
 * Entry Point
 * 
 * Handles initial routing based on wallet state.
 */

import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KeychainService } from '@/services/keychain';
import { Text } from '@/components/ui';
import { layout, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';

export default function EntryScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(true);
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Wait for all interactions to complete and router to be ready
    const task = InteractionManager.runAfterInteractions(() => {
      // Additional small delay to ensure router is ready
      setTimeout(() => {
        checkWalletState();
      }, 100);
    });

    return () => task.cancel();
  }, []);

  const checkWalletState = async () => {
    if (hasNavigated.current) return;
    
    try {
      const isInitialized = await KeychainService.isWalletInitialized();

      // Add a small delay for a smooth transition
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (hasNavigated.current) return;
      hasNavigated.current = true;

      if (isInitialized) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    } catch (error) {
      console.error('Failed to check wallet state:', error);
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        setTimeout(() => {
          router.replace('/onboarding');
        }, 100);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: colors.gold.glow, borderColor: colors.gold.pure }]}>
            <Ionicons name="logo-bitcoin" size={48} color={colors.gold.pure} />
          </View>
          <Text variant="displaySmall" color={colors.text.primary}>
            Starr
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary}>
            Lightning Wallet
          </Text>
        </View>

        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.gold.pure} />
            <Text variant="bodySmall" color={colors.text.muted}>
              Loading wallet...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
    gap: spacing.sm,
  },
});
