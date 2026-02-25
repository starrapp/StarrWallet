/**
 * Home Screen
 * 
 * Main wallet view with balance and quick actions.
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui';
import { BalanceCard } from '@/components/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import type { ColorTheme } from '@/theme/colors';

// Styles function - defined before component to ensure it's available
const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: layout.tabBarHeight + spacing.xl,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  actionGradient: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: layout.radius.lg,
    gap: spacing.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSection: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  transactionsList: {
    gap: spacing.sm,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.lg,
    gap: spacing.md,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: layout.radius.md,
    borderWidth: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    balance,
    payments,
    isLoadingBalance,
    isLoadingPayments,
    isInitializing,
    initError,
    refreshBalance,
    refreshPayments,
    initializeWallet,
    isInitialized,
  } = useWalletStore();

  useEffect(() => {
    if (!isInitialized && !isInitializing && !initError) {
      // Initialize wallet on mount
      initializeWallet().catch((error) => {
        console.error('[HomeScreen] Wallet initialization failed:', error);
      });
    }
  }, [isInitialized, isInitializing, initError]);

  const handleRefresh = async () => {
    await Promise.all([refreshBalance(), refreshPayments()]);
  };

  const handleSend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/send');
  };

  const handleReceive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/receive');
  };

  const recentTransactions = payments.slice(0, 5);

  const styles = getStyles(colors);
  
  // Show error state if initialization failed
  if (initError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={64} color={colors.status.error} />
            <Text variant="headlineSmall" color={colors.text.primary} align="center">
              Failed to Initialize Wallet
            </Text>
            <Text variant="bodyMedium" color={colors.text.secondary} align="center">
              {initError}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.gold.glow, borderColor: colors.gold.pure }]}
              onPress={() => {
                initializeWallet().catch((error) => {
                  console.error('[HomeScreen] Wallet retry failed:', error);
                  // If wallet data is corrupted, redirect to onboarding
                  if (error instanceof Error && error.message.includes('corrupted')) {
                    router.replace('/onboarding');
                  }
                });
              }}
            >
              <Text variant="titleSmall" color={colors.gold.pure}>
                Retry
              </Text>
            </TouchableOpacity>
            {initError?.includes('corrupted') && (
              <TouchableOpacity
                style={[styles.retryButton, { marginTop: spacing.sm }]}
                onPress={() => router.replace('/onboarding')}
              >
                <Text variant="titleSmall" color={colors.text.secondary}>
                  Create New Wallet
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Show loading state during initialization
  if (isInitializing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Ionicons name="logo-bitcoin" size={48} color={colors.gold.pure} />
            <Text variant="titleMedium" color={colors.text.primary}>
              Connecting to Lightning Network...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="logo-bitcoin" size={28} color={colors.gold.pure} />
            <Text variant="headlineSmall" color={colors.text.primary}>
              Starr
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.notificationButton, { backgroundColor: colors.background.secondary }]}
            onPress={() => {}}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingBalance || isLoadingPayments}
              onRefresh={handleRefresh}
              tintColor={colors.gold.pure}
            />
          }
        >
          {/* Balance Card */}
          <BalanceCard
            balance={balance}
            onRefresh={refreshBalance}
            isLoading={isLoadingBalance}
          />

          {/* Quick Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSend}>
              <View style={[styles.actionCard, { backgroundColor: colors.background.secondary }]}>
                <View style={[styles.actionIcon, { backgroundColor: colors.background.tertiary }]}>
                  <Ionicons name="arrow-up" size={24} color={colors.text.primary} />
                </View>
                <Text variant="titleMedium" color={colors.text.primary}>
                  Send
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleReceive}>
              <View style={[styles.actionCard, { backgroundColor: colors.gold.pure }]}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Ionicons name="arrow-down" size={24} color="#FFFFFF" />
                </View>
                <Text variant="titleMedium" color="#FFFFFF">
                  Receive
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Recent Activity */}
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" color={colors.text.primary}>
                Recent Activity
              </Text>
              {payments.length > 5 && (
                <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                  <Text variant="labelMedium" color={colors.gold.pure}>
                    See All
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {recentTransactions.length > 0 ? (
              <View style={styles.transactionsList}>
                {recentTransactions.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} colors={colors} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="flash-outline" size={48} color={colors.text.muted} />
                <Text variant="bodyMedium" color={colors.text.secondary} align="center">
                  No transactions yet
                </Text>
                <Text variant="bodySmall" color={colors.text.muted} align="center">
                  Send or receive your first Lightning payment
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const TransactionItem: React.FC<{ transaction: LightningPayment }> = ({ transaction }) => {
  const colors = useColors();
  const isReceive = transaction.type === 'receive';
  const styles = getStyles(colors);

  return (
    <View style={[styles.txItem, { backgroundColor: colors.background.secondary }]}>
      <View style={[
        styles.txIcon,
        { backgroundColor: isReceive ? colors.status.success + '20' : colors.text.muted + '20' },
      ]}>
        <Ionicons
          name={isReceive ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={isReceive ? colors.status.success : colors.text.primary}
        />
      </View>
      <View style={styles.txDetails}>
        <Text variant="titleSmall" numberOfLines={1} color={colors.text.primary}>
          {transaction.description || (isReceive ? 'Received' : 'Sent')}
        </Text>
        <Text variant="bodySmall" color={colors.text.muted}>
          {formatDistanceToNow(transaction.timestamp, { addSuffix: true })}
        </Text>
      </View>
      <Text
        variant="titleSmall"
        color={isReceive ? colors.status.success : colors.text.primary}
      >
        {isReceive ? '+' : '-'}{transaction.amountSats.toLocaleString()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: layout.tabBarHeight + spacing.xl,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  actionCard: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: layout.radius.xl,
    gap: spacing.sm,
    height: 120,
    justifyContent: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSection: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  transactionsList: {
    gap: spacing.sm,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: layout.radius.lg,
    gap: spacing.md,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: layout.radius.md,
    borderWidth: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
