/**
 * Text Component
 * 
 * Typography component with preset styles.
 */

import React from 'react';
import { Text as RNText, TextStyle, StyleSheet, StyleProp } from 'react-native';
import { typography } from '@/theme';
import { useColors } from '@/contexts';
import { formatAmount, formatFiat } from '@/utils/format';
import { useWalletStore } from '@/stores/walletStore';
import type { BitcoinUnit } from '@/types/wallet';

type TextVariant = keyof typeof typography;

interface TextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export const Text: React.FC<TextProps> = ({
  children,
  variant = 'bodyMedium',
  color,
  align = 'left',
  style,
  numberOfLines,
}) => {
  const colors = useColors();
  const textColor = color || colors.text.primary;
  const variantStyle = typography[variant];

  return (
    <RNText
      style={[
        variantStyle,
        { color: textColor, textAlign: align },
        style,
      ]}
      numberOfLines={numberOfLines}
    >
      {children}
    </RNText>
  );
};

// Amount display component
interface AmountProps {
  sats: bigint;
  size?: 'sm' | 'md' | 'lg';
  showUnit?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  currency?: BitcoinUnit;
}

export const Amount: React.FC<AmountProps> = ({
  sats,
  size = 'md',
  showUnit = true,
  color,
  style,
  currency,
}) => {
  const colors = useColors();
  const storeBitcoinUnit = useWalletStore((state) => state.settings.bitcoinUnit);
  const displayCurrency = currency ?? storeBitcoinUnit;
  const formatted = formatAmount(sats, displayCurrency);
  const amountColor = color || colors.text.primary;

  const getVariant = (): TextVariant => {
    switch (size) {
      case 'sm': return 'amountSmall';
      case 'lg': return 'amountLarge';
      default: return 'amountMedium';
    }
  };

  return (
    <RNText style={[typography[getVariant()], { color: amountColor }, style]}>
      {formatted.value}
      {showUnit && (
        <RNText style={[styles.unit, { color: colors.text.secondary }]}>
          {' '}{formatted.unit}
        </RNText>
      )}
    </RNText>
  );
};

// Fiat equivalent display component
interface FiatAmountProps {
  sats: bigint;
  style?: StyleProp<TextStyle>;
  color?: string;
}

export const FiatAmount: React.FC<FiatAmountProps> = ({ sats, style, color }) => {
  const colors = useColors();
  const btcFiatPrice = useWalletStore((s) => s.btcFiatPrice);
  const fiatCurrency = useWalletStore((s) => s.settings.fiatCurrency);
  if (btcFiatPrice == null) return null;
  const formatted = formatFiat(sats, btcFiatPrice, fiatCurrency);
  return (
    <RNText style={[typography.bodySmall, { color: color || colors.text.muted, alignSelf: 'stretch' }, style]}>
      {formatted}
    </RNText>
  );
};

const styles = StyleSheet.create({
  unit: {
    fontSize: 14,
    fontWeight: '400',
  },
});
