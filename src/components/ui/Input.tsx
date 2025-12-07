/**
 * Input Component
 * 
 * Text input with consistent styling.
 */

import React, { useState } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { layout, spacing, typography } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  ...props
}) => {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = (): string => {
    if (error) return colors.status.error;
    if (isFocused) return colors.gold.pure;
    return colors.border.subtle;
  };

  const getBackgroundColor = (): string => {
     return colors.background.secondary;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text variant="labelMedium" color={colors.text.secondary} style={styles.label}>
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          { 
            borderColor: getBorderColor(),
            backgroundColor: getBackgroundColor(),
          },
          isFocused && { backgroundColor: colors.background.tertiary },
        ]}
      >
        {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
        
        <TextInput
          style={[
            styles.input,
            typography.bodyLarge,
            { color: colors.text.primary },
            style,
          ]}
          placeholderTextColor={colors.text.muted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={colors.gold.pure}
          {...props}
        />
        
        {rightIcon && <View style={styles.icon}>{rightIcon}</View>}
      </View>
      
      {error && (
        <Text variant="bodySmall" color={colors.status.error} style={styles.hint}>
          {error}
        </Text>
      )}
      
      {hint && !error && (
        <Text variant="bodySmall" color={colors.text.muted} style={styles.hint}>
          {hint}
        </Text>
      )}
    </View>
  );
};

// Amount input specifically for sats
interface AmountInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  label?: string;
  error?: string;
  maxAmount?: number;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChangeValue,
  label = 'Amount',
  error,
  maxAmount,
}) => {
  const colors = useColors();

  const handleChange = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    onChangeValue(numericValue);
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="labelMedium" color={colors.text.secondary} style={styles.label}>
          {label}
        </Text>
      )}
      
      <View style={styles.amountContainer}>
        <TextInput
          style={[
            styles.amountInput, 
            typography.amountMedium, 
            { color: colors.text.primary }
          ]}
          value={value}
          onChangeText={handleChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.gold.pure}
        />
        <Text variant="titleLarge" color={colors.text.secondary}>
          sats
        </Text>
      </View>
      
      {maxAmount !== undefined && (
        <Text variant="bodySmall" color={colors.text.muted} style={styles.hint}>
          Max: {maxAmount.toLocaleString()} sats
        </Text>
      )}
      
      {error && (
        <Text variant="bodySmall" color={colors.status.error} style={styles.hint}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.inputHeight,
    borderRadius: layout.radius.lg, // More rounded
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
  },
  icon: {
    marginRight: spacing.sm,
  },
  hint: {
    marginTop: spacing.xs,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  amountInput: {
    textAlign: 'right',
    minWidth: 80,
    marginRight: spacing.sm,
  },
});
