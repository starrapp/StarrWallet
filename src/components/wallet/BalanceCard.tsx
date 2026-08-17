/**
 * Balance Card Component
 * 
 * Displays the wallet balance with a clean, modern design.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Amount, FiatAmount } from '@/components/ui';
import { layout, spacing } from '@/theme';
import { useColors } from '@/contexts';
import type { Balance } from '@/types/wallet';
import { formatAmountStr } from '@/utils/format';
import { useWalletStore } from '@/stores/walletStore';

const REFRESH_ICON_SIZE = 18;

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
  const bitcoinUnit = useWalletStore((state) => state.settings.bitcoinUnit);
  const lightning = balance?.lightning ?? 0n;
  const totalBalance = lightning;
  const formattedLightning = formatAmountStr(lightning, bitcoinUnit);

  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isLoading) {
      spin.stopAnimation(() => spin.setValue(0));
      return;
    }
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [isLoading, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Balance label */}
      <View style={styles.labelRow}>
        <Text variant="labelMedium" color={colors.text.secondary}>
          Total Balance
        </Text>
        {onRefresh && (
          <TouchableOpacity onPress={onRefresh} disabled={isLoading} hitSlop={12}>
            <Animated.View style={[styles.refreshIcon, { transform: [{ rotate }] }]}>
              <Ionicons
                name="sync"
                size={REFRESH_ICON_SIZE}
                color={colors.text.secondary}
                style={styles.refreshGlyph}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {/* Main balance */}
      <View style={styles.balanceContainer}>
        <Amount sats={totalBalance} size="lg" color={colors.text.primary} />
        <FiatAmount sats={totalBalance} />
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
              {formattedLightning}
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
  // A square box that hugs the glyph, so rotation happens around its centre.
  refreshIcon: {
    width: REFRESH_ICON_SIZE,
    height: REFRESH_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Font metrics add leading above and below the glyph and push it off centre.
  refreshGlyph: {
    lineHeight: REFRESH_ICON_SIZE,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
