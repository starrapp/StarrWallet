/**
 * Balance Card Component
 * 
 * Displays the wallet balance with a clean, modern design.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Amount } from '@/components/ui';
import { layout, spacing } from '@/theme';
import { useColors } from '@/contexts';
import type { Balance } from '@/types/wallet';
import { formatSats } from '@/utils/format';

interface BalanceCardProps {
  balance: Balance | null;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  onRefresh,
  isLoading = false,
}) => {
  const colors = useColors();
  const lightning = balance?.lightning ?? 0n;
  const onchain = balance?.onchain ?? 0n;
  const totalBalance = lightning + onchain;

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Balance label */}
      <View style={styles.labelRow}>
        <Text variant="labelMedium" color={colors.text.secondary}>
          Total Balance
        </Text>
        {onRefresh && (
          <TouchableOpacity onPress={onRefresh} disabled={isLoading}>
            <Ionicons
              name="refresh"
              size={18}
              color={colors.text.secondary}
              style={isLoading ? styles.spinning : undefined}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Main balance */}
      <View style={styles.balanceContainer}>
        <Amount sats={totalBalance} size="lg" color={colors.text.primary} />
      </View>

      {/* Breakdown */}
      <View style={[styles.breakdown, { borderTopColor: colors.border.subtle }]}>
        <View style={styles.breakdownItem}>
          <View style={[styles.iconContainer, { backgroundColor: colors.background.tertiary }]}>
            <Ionicons name="flash" size={16} color={colors.gold.pure} />
          </View>
          <View>
            <Text variant="labelSmall" color={colors.text.muted}>
              Lightning
            </Text>
            <Text variant="titleSmall" color={colors.text.primary}>
              {formatSats(lightning)} sats
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

        <View style={styles.breakdownItem}>
          <View style={[styles.iconContainer, { backgroundColor: colors.background.tertiary }]}>
            <Ionicons name="link" size={16} color={colors.text.secondary} />
          </View>
          <View>
            <Text variant="labelSmall" color={colors.text.muted}>
              On-chain
            </Text>
            <Text variant="titleSmall" color={colors.text.primary}>
              {formatSats(onchain)} sats
            </Text>
          </View>
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: layout.radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  balanceContainer: {
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  breakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  breakdownItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: spacing.md,
  },
  spinning: {
    opacity: 0.5,
  },
});
