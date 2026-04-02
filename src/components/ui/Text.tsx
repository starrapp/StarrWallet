/**
 * Text Component
 * 
 * Typography component with preset styles.
 */

import React from 'react';
import { Text as RNText, TextStyle, StyleSheet, StyleProp } from 'react-native';
import { typography } from '@/theme';
import { useColors } from '@/contexts';
import { formatByCurrency } from '@/utils/format';
import { useWalletStore } from '@/stores/walletStore';
import type { Currency } from '@/types/wallet';

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
  currency?: Currency;
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
  const selectedCurrency = useWalletStore((state) => state.settings.currency);
  const displayCurrency = currency ?? selectedCurrency;
  const formatted = formatByCurrency(sats, displayCurrency);
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

const styles = StyleSheet.create({
  unit: {
    fontSize: 14,
    fontWeight: '400',
  },
});
