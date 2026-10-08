/**
 * Lightning Address Screen
 *
 * Claim, change or remove the Lightning Address of this wallet.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ContentColumn } from '@/components';
import { Button, Text, Input, Card } from '@/components/ui';
import { BreezService, formatSdkError } from '@/services/breez';
import { useWalletStore } from '@/stores/walletStore';
import { BREEZ_CONFIG, RESERVED_LIGHTNING_USERNAMES } from '@/config';
import { useColors } from '@/contexts';
import { spacing } from '@/theme';

type Availability = 'idle' | 'current' | 'checking' | 'available' | 'unavailable' | 'error';

interface CheckResult {
  name: string;
  available?: boolean;
  error?: string;
}

// The SDK recommends a check when the user stops typing, not on each keystroke.
const CHECK_DELAY_MS = 500;

export default function LightningAddressScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    lightningAddress,
    isLoadingLightningAddress,
    loadLightningAddress,
    registerLightningAddress,
    deleteLightningAddress,
  } = useWalletStore();
  const [isChanging, setIsChanging] = useState(false);
  const [username, setUsername] = useState('');
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The same normalization as sanitize_username in the SDK.
  const name = username.trim().toLowerCase();
  const isReserved = RESERVED_LIGHTNING_USERNAMES.has(name);
  // Registering the current name again uses one of the registrations per day.
  const isCurrent = name === lightningAddress?.username;

  const availability: Availability =
    !name ? 'idle'
      : isCurrent ? 'current'
        : isReserved ? 'unavailable'
          : checkResult?.name !== name ? 'checking'
            : checkResult.error ? 'error'
              : checkResult.available ? 'available' : 'unavailable';

  useEffect(() => {
    if (!name || isCurrent || isReserved) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const available = await BreezService.checkLightningAddressAvailable(name);
        if (!cancelled) setCheckResult({ name, available });
      } catch (err) {
        if (!cancelled) setCheckResult({ name, error: formatSdkError(err) });
      }
    }, CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, isCurrent, isReserved]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        safeArea: { flex: 1 },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
        },
        scrollContent: { padding: spacing.lg, gap: spacing.lg },
        addressCard: { alignItems: 'center', gap: spacing.sm },
        unknownState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
        actions: { gap: spacing.md },
      }),
    [colors]
  );

  const handleClaim = async () => {
    setIsSubmitting(true);
    try {
      await registerLightningAddress(name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not claim address', formatSdkError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = () => {
    if (!lightningAddress) return;
    Alert.alert(
      'Remove address',
      `Payments to ${lightningAddress.address} will stop. The name stays reserved for this wallet, so you can claim it again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await deleteLightningAddress();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Could not remove address', formatSdkError(err));
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelChange = () => {
    setIsChanging(false);
    setUsername('');
  };

  const statusError =
    availability === 'unavailable' ? 'Not available'
      : availability === 'error' ? checkResult?.error
        : undefined;
  const statusHint =
    availability === 'current' ? 'This is your current name'
      : availability === 'checking' ? 'Checking...'
        : availability === 'available' ? 'Available'
          : undefined;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Button title="Close" variant="ghost" size="sm" onPress={() => router.back()} />
          <Text variant="titleLarge" color={colors.text.primary}>
            Lightning Address
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ContentColumn style={{ flex: 1 }}>
          <KeyboardAwareScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={20}
          >
            {lightningAddress === undefined ? (
              // Without the current address a claim could replace it unseen.
              <View style={styles.unknownState}>
                {isLoadingLightningAddress ? (
                  <ActivityIndicator size="large" color={colors.gold.pure} />
                ) : (
                  <>
                    <Text variant="bodyMedium" color={colors.text.secondary} align="center">
                      Could not load your Lightning Address.
                    </Text>
                    <Button title="Retry" variant="secondary" size="md" onPress={loadLightningAddress} />
                  </>
                )}
              </View>
            ) : lightningAddress && !isChanging ? (
              <>
                <Card variant="outlined" style={styles.addressCard}>
                  <Ionicons name="at-circle" size={48} color={colors.gold.pure} />
                  <Text variant="titleLarge" color={colors.text.primary} align="center">
                    {lightningAddress.address}
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary} align="center">
                    Anyone can send you Bitcoin to this address.
                  </Text>
                </Card>
                <View style={styles.actions}>
                  <Button
                    title="Change"
                    variant="secondary"
                    size="md"
                    onPress={() => setIsChanging(true)}
                    disabled={isSubmitting}
                  />
                  <Button
                    title="Remove"
                    variant="danger"
                    size="md"
                    onPress={handleRemove}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  />
                </View>
              </>
            ) : (
              <>
                <Text variant="bodyMedium" color={colors.text.secondary}>
                  {lightningAddress
                    ? `A new name replaces ${lightningAddress.address}. The old name stays reserved for this wallet.`
                    : 'Choose a name. Anyone can send you Bitcoin to this address.'}
                </Text>
                <Input
                  label="Name"
                  placeholder="satoshi"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  rightIcon={
                    <Text variant="bodyLarge" color={colors.text.muted}>
                      @{BREEZ_CONFIG.LNURL_DOMAIN}
                    </Text>
                  }
                  error={statusError}
                  hint={statusHint}
                />
                <View style={styles.actions}>
                  <Button
                    title="Claim"
                    variant="primary"
                    size="lg"
                    onPress={handleClaim}
                    loading={isSubmitting}
                    disabled={availability !== 'available' || isSubmitting}
                  />
                  {isChanging && (
                    <Button title="Cancel" variant="ghost" size="md" onPress={handleCancelChange} />
                  )}
                </View>
              </>
            )}
          </KeyboardAwareScrollView>
        </ContentColumn>
      </SafeAreaView>
    </View>
  );
}
