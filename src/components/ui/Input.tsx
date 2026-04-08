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
import { useColors } from '@/contexts';
import { formatFiat, satsToBtc, formatAmount } from '@/utils/format';
import { useWalletStore } from '@/stores/walletStore';

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
  maxAmount?: bigint;
  editable?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChangeValue,
  label = 'Amount',
  error,
  maxAmount,
  editable = true,
}) => {
  const colors = useColors();
  const btcFiatPrice = useWalletStore((s) => s.btcFiatPrice);
  const fiatCurrency = useWalletStore((s) => s.settings.fiatCurrency);
  const bitcoinUnit = useWalletStore((s) => s.settings.bitcoinUnit);
  const isBtc = bitcoinUnit === 'BTC';

  // Local display value for BTC mode (decimal string the user edits)
  const [btcDisplay, setBtcDisplay] = useState('');

  // Sync btcDisplay when value (sats) changes externally (e.g. reset to '')
  const satsValue = BigInt(value || '0');
  const prevSatsRef = React.useRef(satsValue);
  if (satsValue !== prevSatsRef.current) {
    prevSatsRef.current = satsValue;
    if (isBtc) {
      const expected = satsValue === 0n ? '' : satsToBtc(satsValue);
      // Only update if the external sats don't match what user typed
      const currentSats = btcDisplayToSats(btcDisplay);
      if (currentSats !== satsValue) {
        setBtcDisplay(expected);
      }
    }
  }

  const handleChangeSats = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    onChangeValue(numericValue);
  };

  const handleChangeBtc = (text: string) => {
    // Allow digits and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    // Prevent multiple dots
    const parts = cleaned.split('.');
    const sanitized = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    // Limit to 8 decimal places
    const [whole, frac] = sanitized.split('.');
    const limited = frac !== undefined
      ? whole + '.' + frac.slice(0, 8)
      : sanitized;

    setBtcDisplay(limited);
    const sats = btcDisplayToSats(limited);
    onChangeValue(sats === 0n ? '' : sats.toString());
  };

  const displayValue = isBtc ? btcDisplay : value;
  const unitLabel = isBtc ? 'BTC' : 'sats';

  const fiatText = btcFiatPrice != null && satsValue > 0n
    ? formatFiat(satsValue, btcFiatPrice, fiatCurrency)
    : null;

  const maxFormatted = maxAmount !== undefined
    ? formatAmount(maxAmount, bitcoinUnit)
    : null;

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
            { color: editable ? colors.text.primary : colors.text.muted }
          ]}
          value={displayValue}
          onChangeText={isBtc ? handleChangeBtc : handleChangeSats}
          keyboardType={isBtc ? 'decimal-pad' : 'numeric'}
          placeholder="0"
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.gold.pure}
          editable={editable}
        />
        <Text variant="titleLarge" color={colors.text.secondary}>
          {unitLabel}
        </Text>
      </View>

      {fiatText && (
        <Text variant="bodySmall" color={colors.text.muted} style={styles.fiatHint}>
          {fiatText}
        </Text>
      )}

      {maxFormatted && (
        <Text variant="bodySmall" color={colors.text.muted} style={styles.hint}>
          Max: {maxFormatted.value} {maxFormatted.unit}
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

function btcDisplayToSats(btcStr: string): bigint {
  if (!btcStr || btcStr === '.' || btcStr === '0.') return 0n;
  const num = parseFloat(btcStr);
  if (Number.isNaN(num) || num <= 0) return 0n;
  return BigInt(Math.round(num * 100_000_000));
}

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
  fiatHint: {
    textAlign: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.xs,
  },
});
