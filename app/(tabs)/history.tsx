/**
 * Transaction History Screen
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { TransactionList } from '@/components/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';

export default function HistoryScreen() {
  const colors = useColors();
  const { payments, isLoadingPayments, refreshPayments } = useWalletStore();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" color={colors.text.primary}>
            Transaction History
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary}>
            {payments.length} transactions
          </Text>
        </View>

        {/* Transactions */}
        <View style={styles.listContainer}>
          <TransactionList
            transactions={payments}
            onRefresh={refreshPayments}
            isLoading={isLoadingPayments}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xxs,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.tabBarHeight,
  },
});

