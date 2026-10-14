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
import { openSend, takePendingSend } from '@/stores/sendStore';

export default function EntryScreen() {
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    // Without a wallet, drop the link: there is nothing to pay from.
    const request = takePendingSend();
    KeychainService.isWalletCreated().then(
      (isCreated) => {
        router.replace(isCreated ? '/(tabs)' : '/onboarding');
        if (isCreated && request) openSend(request);
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
