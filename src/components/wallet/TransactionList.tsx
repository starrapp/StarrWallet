/**
 * Transaction List Component
 * 
 * Displays payment history with clean, modern styling.
 */

import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { Text } from '@/components/ui';
import { layout, spacing } from '@/theme';
import { useColors } from '@/contexts';
import type { LightningPayment } from '@/types/wallet';
import { formatSignedSats } from '@/utils/format';

interface TransactionListProps {
  transactions: LightningPayment[];
  onTransactionPress?: (tx: LightningPayment) => void;
  onRefresh?: () => void;
  onEndReached?: () => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onTransactionPress,
  onRefresh,
  onEndReached,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
}) => {
  const colors = useColors();

  const renderFooter = () => {
    if (!hasMore || !onEndReached) return null;
    if (isLoadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.gold.pure} />
          <Text variant="bodySmall" color={colors.text.muted}>Loading more...</Text>
        </View>
      );
    }
    return null;
  };

  const renderTransaction = ({ item }: { item: LightningPayment }) => (
    <TransactionItem
      transaction={item}
      onPress={() => onTransactionPress?.(item)}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.background.secondary }]}>
        <Ionicons name="flash-outline" size={48} color={colors.text.muted} />
      </View>
      <Text variant="titleMedium" color={colors.text.secondary} align="center">
        No transactions yet
      </Text>
      <Text variant="bodyMedium" color={colors.text.muted} align="center">
        Your Lightning payments will appear here
      </Text>
    </View>
  );

  return (
    <FlatList
      data={transactions}
      renderItem={renderTransaction}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.gold.pure}
            colors={[colors.gold.pure]}
          />
        ) : undefined
      }
      contentContainerStyle={
        transactions.length === 0 ? styles.emptyList : styles.list
      }
      ListFooterComponent={renderFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      showsVerticalScrollIndicator={false}
    />
  );
};

// Individual transaction item
interface TransactionItemProps {
  transaction: LightningPayment;
  onPress?: () => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onPress,
}) => {
  const colors = useColors();
  const isReceive = transaction.type === 'receive';
  const isPending = transaction.status === 'pending';
  const isFailed = transaction.status === 'failed';

  const getStatusColor = (): string => {
    if (isFailed) return colors.status.error;
    if (isPending) return colors.status.warning;
    return isReceive ? colors.status.success : colors.text.primary;
  };

  const getIcon = (): keyof typeof Ionicons.glyphMap => {
    if (isFailed) return 'close-circle';
    if (isPending) return 'time';
    return isReceive ? 'arrow-down' : 'arrow-up';
  };

  const formatTime = (date: Date): string => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  // Helper for opacity since colors are hex
  const withOpacity = (color: string, opacity: string) => {
    return `${color}${opacity}`; // hex + hex alpha
  };

  return (
    <TouchableOpacity
      style={[styles.transactionItem, { backgroundColor: colors.background.secondary }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[
        styles.iconContainer, 
        { backgroundColor: withOpacity(getStatusColor(), '15') }
      ]}>
        <Ionicons name={getIcon()} size={20} color={getStatusColor()} />
      </View>

      {/* Details */}
      <View style={styles.transactionDetails}>
        <Text variant="titleSmall" numberOfLines={1} color={colors.text.primary}>
          {transaction.description || (isReceive ? 'Received' : 'Sent')}
        </Text>
        <View style={styles.transactionMeta}>
          <Text variant="bodySmall" color={colors.text.muted}>
            {formatTime(transaction.timestamp)}
          </Text>
          {isPending && (
            <View style={[styles.statusBadge, { backgroundColor: withOpacity(colors.status.warning, '20') }]}>
              <Text variant="labelSmall" color={colors.status.warning}>
                Pending
              </Text>
            </View>
          )}
          {isFailed && (
            <View style={[styles.statusBadge, { backgroundColor: withOpacity(colors.status.error, '20') }]}>
              <Text variant="labelSmall" color={colors.status.error}>
                Failed
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Amount */}
      <View style={styles.amountContainer}>
        <Text
          variant="titleSmall"
          color={isReceive ? colors.status.success : colors.text.primary}
        >
          {formatSignedSats(transaction.amountSats, isReceive ? '+' : '-')}
        </Text>
        <Text variant="labelSmall" color={colors.text.muted}>
          sats
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xxl,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: layout.radius.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    flex: 1,
    gap: spacing.xxs,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: layout.radius.xs,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
});
