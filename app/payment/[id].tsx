/**
 * Payment Detail Screen
 *
 * Shows a single payment (getPayment by id). Opened from History when tapping a transaction.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Button, Text, Card } from '@/components/ui';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import { formatSats, formatSignedSats } from '@/utils/format';
import type { LightningPayment } from '@/types/wallet';

export default function PaymentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const getPayment = useWalletStore((s) => s.getPayment);
  const [payment, setPayment] = useState<LightningPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id;
    if (!id) {
      setError('Missing payment id');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPayment(id)
      .then((p) => {
        if (!cancelled) {
          setPayment(p ?? null);
          if (!p) setError('Payment not found');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load payment');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, getPayment]);

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
        scroll: { flex: 1 },
        scrollContent: { padding: spacing.lg, gap: spacing.lg },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
        iconLarge: {
          width: 80,
          height: 80,
          borderRadius: 40,
          alignItems: 'center',
          justifyContent: 'center',
        },
        card: { padding: spacing.md, gap: spacing.sm },
        row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        label: { marginBottom: spacing.xxs },
        mono: { fontFamily: 'monospace', fontSize: 12 },
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

  const isReceive = payment.type === 'receive';
  const statusColor =
    payment.status === 'failed'
      ? colors.status.error
      : payment.status === 'pending'
        ? colors.status.warning
        : isReceive
          ? colors.status.success
          : colors.text.primary;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Button title="Back" variant="ghost" size="sm" onPress={() => router.back()} />
          <Text variant="titleLarge" color={colors.text.primary}>
            Payment details
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Amount card */}
          <Card variant="default" style={styles.card}>
            <View style={[styles.iconLarge, { backgroundColor: statusColor + '20' }]}>
              <Ionicons
                name={isReceive ? 'arrow-down' : 'arrow-up'}
                size={40}
                color={statusColor}
              />
            </View>
            <Text variant="headlineMedium" color={colors.text.primary} align="center">
              {formatSignedSats(payment.amountSats, isReceive ? '+' : '-')} sats
            </Text>
            <Text variant="bodyMedium" color={colors.text.secondary} align="center">
              {payment.description ?? (isReceive ? 'Received' : 'Sent')}
            </Text>
            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <Text variant="labelMedium" color={colors.text.muted}>
                Status
              </Text>
              <Text variant="labelMedium" color={statusColor} style={{ textTransform: 'capitalize' }}>
                {payment.status}
              </Text>
            </View>
          </Card>

          {/* Details */}
          <Card variant="outlined" style={styles.card}>
            <Text variant="labelMedium" color={colors.text.muted} style={styles.label}>
              Date
            </Text>
            <Text variant="bodyMedium" color={colors.text.primary}>
              {format(new Date(payment.timestamp), 'PPp')}
            </Text>
            {payment.completedAt && (
              <>
                <Text variant="labelMedium" color={colors.text.muted} style={[styles.label, { marginTop: spacing.sm }]}>
                  Completed
                </Text>
                <Text variant="bodyMedium" color={colors.text.primary}>
                  {format(new Date(payment.completedAt), 'PPp')}
                </Text>
              </>
            )}
            {payment.feeSats != null && payment.feeSats > 0n && (
              <>
                <Text variant="labelMedium" color={colors.text.muted} style={[styles.label, { marginTop: spacing.sm }]}>
                  Fee
                </Text>
                <Text variant="bodyMedium" color={colors.text.primary}>
                  {formatSats(payment.feeSats)} sats
                </Text>
              </>
            )}
            <Text variant="labelMedium" color={colors.text.muted} style={[styles.label, { marginTop: spacing.sm }]}>
              Payment hash
            </Text>
            <Text variant="bodySmall" color={colors.text.secondary} style={styles.mono} numberOfLines={1}>
              {payment.paymentHash || '—'}
            </Text>
            {payment.invoice && (
              <>
                <Text variant="labelMedium" color={colors.text.muted} style={[styles.label, { marginTop: spacing.sm }]}>
                  Invoice
                </Text>
                <Text variant="bodySmall" color={colors.text.secondary} style={styles.mono} numberOfLines={2}>
                  {payment.invoice}
                </Text>
              </>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
