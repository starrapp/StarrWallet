/**
 * Text Component
 * 
 * Typography component with preset styles.
 */

import React from 'react';
import { Text as RNText, TextStyle, StyleSheet } from 'react-native';
import { typography } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';

type TextVariant = keyof typeof typography;

interface TextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: TextStyle;
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
  const themeColors = useColors();
  const textColor = color || themeColors.text.primary;
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
  sats: number;
  size?: 'sm' | 'md' | 'lg';
  showUnit?: boolean;
  color?: string;
  style?: TextStyle;
}

export const Amount: React.FC<AmountProps> = ({
  sats,
  size = 'md',
  showUnit = true,
  color,
  style,
}) => {
  const themeColors = useColors();
  const textColor = color || themeColors.text.primary;

  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('en-US');
  };

  const getVariant = (): TextVariant => {
    switch (size) {
      case 'sm': return 'amountSmall';
      case 'lg': return 'amountLarge';
      default: return 'amountMedium';
    }
  };

  return (
    <RNText style={[typography[getVariant()], { color: textColor }, style]}>
      {formatAmount(sats)}
      {showUnit && (
        <RNText style={[styles.unit, { color: themeColors.text.secondary }]}>
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
