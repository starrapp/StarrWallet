/**
 * Entry Point
 * 
 * Handles initial routing based on wallet state.
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { KeychainService } from '@/services/keychain';
import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

export default function EntryScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkWalletState();
  }, []);

  const checkWalletState = async () => {
    try {
      const isInitialized = await KeychainService.isWalletInitialized();

      // Add a small delay for a smooth transition
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (isInitialized) {
        // Wallet exists, go to main app (will require unlock)
        router.replace('/(tabs)');
      } else {
        // New user, go to onboarding
        router.replace('/onboarding');
      }
    } catch (error) {
      console.error('Failed to check wallet state:', error);
      // Default to onboarding on error
      router.replace('/onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={styles.gradient}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="star" size={48} color={colors.gold.pure} />
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
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
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
    backgroundColor: colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gold.pure,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
    gap: spacing.sm,
  },
});

