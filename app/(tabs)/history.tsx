/**
 * Transaction History Screen
 *
 * List payments with filters (type, status) and pagination (load more).
 */

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { TransactionList } from '@/components/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import type { LightningPayment } from '@/types/wallet';
import type { ListPaymentsFilter } from '@/types/wallet';

const TYPE_OPTIONS: { value: 'all' | 'send' | 'receive'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'send', label: 'Sent' },
  { value: 'receive', label: 'Received' },
];

const STATUS_OPTIONS: { value: 'all' | 'completed' | 'pending' | 'failed' | 'expired'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

const DATE_OPTIONS: { value: 'all' | '7' | '30'; label: string; fromTimestamp?: number }[] = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days', fromTimestamp: Math.floor(Date.now() / 1000) - 7 * 24 * 3600 },
  { value: '30', label: 'Last 30 days', fromTimestamp: Math.floor(Date.now() / 1000) - 30 * 24 * 3600 },
];

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    payments,
    isLoadingPayments,
    isLoadingMorePayments,
    hasMorePayments,
    paymentFilter,
    listPayments,
  } = useWalletStore();

  useFocusEffect(
    useCallback(() => {
      listPayments();
    }, [listPayments])
  );

  const handleTransactionPress = useCallback(
    (tx: LightningPayment) => {
      router.push(`/payment/${tx.id}`);
    },
    [router]
  );

  const buildFilter = useCallback(
    (
      type: 'all' | 'send' | 'receive',
      status: 'all' | 'completed' | 'pending' | 'failed' | 'expired',
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
    const now = Math.floor(Date.now() / 1000);
    const sevenAgo = now - 7 * 24 * 3600;
    const thirtyAgo = now - 30 * 24 * 3600;
    if (from >= sevenAgo - 86400) return '7';
    if (from >= thirtyAgo - 86400) return '30';
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
    (value: 'all' | 'completed' | 'pending' | 'failed' | 'expired') => {
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
          paddingHorizontal: spacing.lg,
          paddingBottom: layout.tabBarHeight,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text variant="headlineMedium" color={colors.text.primary}>
            Transaction history
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary}>
            {payments.length} transaction{payments.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Filters */}
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
      </SafeAreaView>
    </View>
  );
}
