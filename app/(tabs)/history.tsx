/**
 * Transaction History Screen
 *
 * List payments with filters (type, status) and pagination (load more).
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentColumn, SplitLayout } from '@/components';
import { Text, Card } from '@/components/ui';
import { PaymentDetailsContent, TransactionList } from '@/components/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import { useResponsive } from '@/hooks';
import type { LightningPayment, ListPaymentsFilter } from '@/types/wallet';

const TYPE_OPTIONS: { value: 'all' | 'send' | 'receive'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'send', label: 'Sent' },
  { value: 'receive', label: 'Received' },
];

const STATUS_OPTIONS: { value: 'all' | 'completed' | 'pending' | 'failed'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const SEVEN_DAYS_AGO = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
const THIRTY_DAYS_AGO = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;

const DATE_OPTIONS: { value: 'all' | '7' | '30'; label: string; fromTimestamp?: number }[] = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days', fromTimestamp: SEVEN_DAYS_AGO },
  { value: '30', label: 'Last 30 days', fromTimestamp: THIRTY_DAYS_AGO },
];

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isSplitWidth } = useResponsive();
  const {
    payments,
    isLoadingPayments,
    isLoadingMorePayments,
    hasMorePayments,
    paymentFilter,
    listPayments,
    getPayment,
    settings,
  } = useWalletStore();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<LightningPayment | null>(null);
  const [loadedPaymentId, setLoadedPaymentId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // The detail pane is loading until the fetch for the selected payment settles.
  const detailLoading = selectedPaymentId != null && loadedPaymentId !== selectedPaymentId;

  useFocusEffect(
    useCallback(() => {
      listPayments();
    }, [listPayments])
  );

  const handleTransactionPress = useCallback(
    (tx: LightningPayment) => {
      if (isSplitWidth) {
        setSelectedPaymentId(tx.id);
        return;
      }
      router.push(`/payment/${tx.id}`);
    },
    [isSplitWidth, router]
  );

  // Selection is derived from the layout: cleared when the split pane is gone,
  // defaulted to the first payment when it appears.
  if (!isSplitWidth && (selectedPaymentId !== null || selectedPayment !== null || detailError !== null)) {
    setSelectedPaymentId(null);
    setSelectedPayment(null);
    setDetailError(null);
  }
  if (isSplitWidth && !selectedPaymentId && payments.length > 0) {
    setSelectedPaymentId(payments[0].id);
  }

  useEffect(() => {
    if (!isSplitWidth || !selectedPaymentId) return;

    let cancelled = false;
    getPayment(selectedPaymentId)
      .then((payment) => {
        if (!cancelled) {
          setSelectedPayment(payment ?? null);
          setDetailError(payment ? null : 'Payment not found');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : 'Failed to load payment');
          setSelectedPayment(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedPaymentId(selectedPaymentId);
      });

    return () => {
      cancelled = true;
    };
  }, [getPayment, isSplitWidth, selectedPaymentId]);

  const buildFilter = useCallback(
    (
      type: 'all' | 'send' | 'receive',
      status: 'all' | 'completed' | 'pending' | 'failed',
      dateRange: 'all' | '7' | '30'
    ): ListPaymentsFilter => {
      const f: ListPaymentsFilter = {
        limit: 20,
        offset: 0,
        sortAscending: false,
      };
      if (type !== 'all') f.typeFilter = [type];
      if (status !== 'all') f.statusFilter = [status];
      const dateOpt = DATE_OPTIONS.find((o) => o.value === dateRange);
      if (dateOpt?.fromTimestamp != null) f.fromTimestamp = dateOpt.fromTimestamp;
      return f;
    },
    []
  );

  const currentDateRange = useMemo((): 'all' | '7' | '30' => {
    const from = paymentFilter.fromTimestamp;
    if (from == null) return 'all';
    if (from >= SEVEN_DAYS_AGO - 86400) return '7';
    if (from >= THIRTY_DAYS_AGO - 86400) return '30';
    return 'all';
  }, [paymentFilter.fromTimestamp]);

  const currentType = useMemo(() => {
    const t = paymentFilter.typeFilter;
    if (!t || t.length === 0) return 'all';
    if (t.includes('send') && !t.includes('receive')) return 'send';
    if (t.includes('receive') && !t.includes('send')) return 'receive';
    return 'all';
  }, [paymentFilter.typeFilter]);

  const currentStatus = useMemo(() => {
    const s = paymentFilter.statusFilter;
    if (!s || s.length === 0) return 'all';
    if (s.length === 1) return s[0];
    return 'all';
  }, [paymentFilter.statusFilter]);

  const applyType = useCallback(
    (value: 'all' | 'send' | 'receive') => {
      listPayments({ filter: buildFilter(value, currentStatus, currentDateRange) });
    },
    [buildFilter, currentStatus, currentDateRange, listPayments]
  );

  const applyStatus = useCallback(
    (value: 'all' | 'completed' | 'pending' | 'failed') => {
      listPayments({ filter: buildFilter(currentType, value, currentDateRange) });
    },
    [buildFilter, currentType, currentDateRange, listPayments]
  );

  const applyDateRange = useCallback(
    (value: 'all' | '7' | '30') => {
      listPayments({ filter: buildFilter(currentType, currentStatus, value) });
    },
    [buildFilter, currentType, currentStatus, listPayments]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        safeArea: { flex: 1 },
        header: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.xxs,
        },
        filterSection: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
        },
        filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        chip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: layout.radius.full,
          borderWidth: 1,
        },
        chipActive: {},
        listContainer: {
          flex: 1,
          paddingHorizontal: isSplitWidth ? 0 : spacing.lg,
          paddingBottom: layout.tabBarHeight,
        },
        splitSecondary: {
          flex: 1,
          borderRadius: layout.radius.lg,
          backgroundColor: colors.background.secondary,
          overflow: 'hidden',
        },
        splitHeader: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
        },
        splitCenter: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
        },
      }),
    [colors, isSplitWidth]
  );

  const historyContent = (
    <>
      <View style={styles.header}>
        <Text variant="headlineMedium" color={colors.text.primary}>
          Transaction history
        </Text>
        <Text variant="bodyMedium" color={colors.text.secondary}>
          {payments.length} transaction{payments.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.filterSection}>
        <Text variant="labelMedium" color={colors.text.muted}>
          Type
        </Text>
        <View style={styles.filterRow}>
          {TYPE_OPTIONS.map((opt) => {
            const active = currentType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.gold.glow : colors.background.secondary,
                    borderColor: active ? colors.gold.pure : colors.border.subtle,
                  },
                ]}
                onPress={() => applyType(opt.value)}
              >
                <Text
                  variant="labelMedium"
                  color={active ? colors.gold.pure : colors.text.secondary}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text variant="labelMedium" color={colors.text.muted} style={{ marginTop: spacing.xs }}>
          Status
        </Text>
        <View style={styles.filterRow}>
          {STATUS_OPTIONS.map((opt) => {
            const active = currentStatus === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.gold.glow : colors.background.secondary,
                    borderColor: active ? colors.gold.pure : colors.border.subtle,
                  },
                ]}
                onPress={() => applyStatus(opt.value)}
              >
                <Text
                  variant="labelMedium"
                  color={active ? colors.gold.pure : colors.text.secondary}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text variant="labelMedium" color={colors.text.muted} style={{ marginTop: spacing.xs }}>
          Date range
        </Text>
        <View style={styles.filterRow}>
          {DATE_OPTIONS.map((opt) => {
            const active = currentDateRange === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.gold.glow : colors.background.secondary,
                    borderColor: active ? colors.gold.pure : colors.border.subtle,
                  },
                ]}
                onPress={() => applyDateRange(opt.value)}
              >
                <Text
                  variant="labelMedium"
                  color={active ? colors.gold.pure : colors.text.secondary}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.listContainer}>
        <TransactionList
          transactions={payments}
          onTransactionPress={handleTransactionPress}
          onRefresh={() => listPayments()}
          onEndReached={() => listPayments({ append: true })}
          isLoading={isLoadingPayments}
          isLoadingMore={isLoadingMorePayments}
          hasMore={hasMorePayments}
        />
      </View>
    </>
  );

  const paymentPane = (
    <Card variant="outlined" padding="none" style={styles.splitSecondary}>
      <View style={styles.splitHeader}>
        <Text variant="titleLarge" color={colors.text.primary}>
          Payment details
        </Text>
      </View>
      {detailLoading ? (
        <View style={styles.splitCenter}>
          <ActivityIndicator size="small" color={colors.gold.pure} />
          <Text variant="bodyMedium" color={colors.text.secondary}>
            Loading payment...
          </Text>
        </View>
      ) : detailError ? (
        <View style={styles.splitCenter}>
          <Text variant="bodyMedium" color={colors.status.error}>
            {detailError}
          </Text>
        </View>
      ) : selectedPayment ? (
        <PaymentDetailsContent payment={selectedPayment} bitcoinUnit={settings.bitcoinUnit} />
      ) : (
        <View style={styles.splitCenter}>
          <Text variant="bodyMedium" color={colors.text.secondary}>
            Select a transaction to view details.
          </Text>
        </View>
      )}
    </Card>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ContentColumn style={{ flex: 1 }} maxWidth={isSplitWidth ? undefined : 820}>
          <SplitLayout primary={historyContent} secondary={paymentPane} primaryWidth={460} />
        </ContentColumn>
      </SafeAreaView>
    </View>
  );
}
