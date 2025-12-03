/**
 * Balance Card Component
 * 
 * Displays the wallet balance with a beautiful cosmic design.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text, Amount } from '@/components/ui';
import { colors, spacing, layout } from '@/theme';
import type { Balance } from '@/types/wallet';

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
  const totalBalance = balance ? balance.lightning + balance.onchain : 0;
  const hasPending = balance && (balance.pendingIncoming > 0 || balance.pendingOutgoing > 0);

  return (
    <View style={styles.container}>
      {/* Background glow effect */}
      <View style={styles.glowContainer}>
        <LinearGradient
          colors={['rgba(247, 201, 72, 0.15)', 'transparent']}
          style={styles.glow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* Star decoration */}
      <View style={styles.starContainer}>
        <Ionicons name="star" size={16} color={colors.gold.pure} style={styles.star} />
        <Ionicons name="star" size={10} color={colors.gold.muted} style={[styles.star, styles.starSmall]} />
        <Ionicons name="star" size={8} color={colors.gold.pure} style={[styles.star, styles.starTiny]} />
      </View>

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
      <View style={styles.breakdown}>
        <View style={styles.breakdownItem}>
          <View style={styles.iconContainer}>
            <Ionicons name="flash" size={16} color={colors.accent.cyan} />
          </View>
          <View>
            <Text variant="labelSmall" color={colors.text.muted}>
              Lightning
            </Text>
            <Text variant="titleSmall" color={colors.text.primary}>
              {(balance?.lightning || 0).toLocaleString()} sats
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.breakdownItem}>
          <View style={styles.iconContainer}>
            <Ionicons name="link" size={16} color={colors.accent.purple} />
          </View>
          <View>
            <Text variant="labelSmall" color={colors.text.muted}>
              On-chain
            </Text>
            <Text variant="titleSmall" color={colors.text.primary}>
              {(balance?.onchain || 0).toLocaleString()} sats
            </Text>
          </View>
        </View>
      </View>

      {/* Pending indicator */}
      {hasPending && (
        <View style={styles.pendingContainer}>
          {balance.pendingIncoming > 0 && (
            <View style={styles.pendingItem}>
              <Ionicons name="arrow-down" size={12} color={colors.status.success} />
              <Text variant="labelSmall" color={colors.status.success}>
                +{balance.pendingIncoming.toLocaleString()} incoming
              </Text>
            </View>
          )}
          {balance.pendingOutgoing > 0 && (
            <View style={styles.pendingItem}>
              <Ionicons name="arrow-up" size={12} color={colors.status.warning} />
              <Text variant="labelSmall" color={colors.status.warning}>
                -{balance.pendingOutgoing.toLocaleString()} outgoing
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.xl,
    padding: spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  glow: {
    flex: 1,
  },
  starContainer: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginLeft: 4,
  },
  starSmall: {
    marginTop: -8,
  },
  starTiny: {
    marginTop: 4,
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
    borderTopColor: colors.border.subtle,
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
    backgroundColor: colors.overlay.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.subtle,
    marginHorizontal: spacing.md,
  },
  pendingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  spinning: {
    opacity: 0.5,
  },
});

