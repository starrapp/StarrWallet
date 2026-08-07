/**
 * Payment Detail Screen
 *
 * Shows a single payment (getPayment by id). Opened from History when tapping a transaction.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/components/ui';
import { ContentColumn } from '@/components';
import { PaymentDetailsContent } from '@/components/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing } from '@/theme';
import { useResponsive } from '@/hooks';
import type { LightningPayment } from '@/types/wallet';

export default function PaymentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { isTabletWidth } = useResponsive();
  const getPayment = useWalletStore((s) => s.getPayment);
  const bitcoinUnit = useWalletStore((s) => s.settings.bitcoinUnit);
  const [payment, setPayment] = useState<LightningPayment | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const id = params.id;
  // Loading until the fetch for the current id settles.
  const loading = !!id && loadedId !== id;
  const error = id ? fetchError : 'Missing payment id';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getPayment(id)
      .then((p) => {
        if (!cancelled) {
          setPayment(p ?? null);
          setFetchError(p ? null : 'Payment not found');
        }
      })
      .catch((err) => {
        console.error('[Payment] Failed to load payment:', err);
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load payment');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedId(id);
      });
    return () => {
      cancelled = true;
    };
  }, [id, getPayment]);

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
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
      }),
    [colors]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.center]}>
          <ActivityIndicator size="large" color={colors.gold.pure} />
          <Text variant="bodyMedium" color={colors.text.secondary}>
            Loading payment...
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !payment) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Button title="Back" variant="ghost" size="sm" onPress={() => router.back()} />
            <Text variant="titleLarge" color={colors.text.primary}>
              Payment
            </Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.center}>
            <Ionicons name="alert-circle" size={48} color={colors.status.error} />
            <Text variant="bodyMedium" color={colors.text.secondary}>
              {error ?? 'Payment not found'}
            </Text>
            <Button title="Back to History" variant="secondary" onPress={() => router.back()} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Button title={isTabletWidth ? 'History' : 'Back'} variant="ghost" size="sm" onPress={() => router.back()} />
          <Text variant="titleLarge" color={colors.text.primary}>
            Payment details
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <ContentColumn style={{ flex: 1 }}>
          <PaymentDetailsContent payment={payment} bitcoinUnit={bitcoinUnit} contentContainerStyle={{ paddingHorizontal: 0 }} />
        </ContentColumn>
      </SafeAreaView>
    </View>
  );
}
