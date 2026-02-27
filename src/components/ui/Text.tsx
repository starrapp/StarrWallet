/**
 * Text Component
 * 
 * Typography component with preset styles.
 */

import React from 'react';
import { Text as RNText, TextStyle, StyleSheet, StyleProp } from 'react-native';
import { typography } from '@/theme';
import { useColors } from '@/contexts';
import { formatSats } from '@/utils/format';

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
}

export const Amount: React.FC<AmountProps> = ({
  sats,
  size = 'md',
  showUnit = true,
  color,
  style,
}) => {
  const colors = useColors();
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
      {formatSats(sats)}
      {showUnit && (
        <RNText style={[styles.unit, { color: colors.text.secondary }]}>
          {' '}sats
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
