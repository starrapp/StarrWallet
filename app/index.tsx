/**
 * Entry Point
 * 
 * Handles initial routing based on wallet state.
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { KeychainService } from '@/services/keychain';
import { useColors } from '@/contexts';

export default function EntryScreen() {
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    KeychainService.isWalletCreated().then(
      (isCreated) => {
        router.replace(isCreated ? '/(tabs)' : '/onboarding');
        SplashScreen.hideAsync();
      },
      () => {
        router.replace('/onboarding');
        SplashScreen.hideAsync();
      },
    );
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
