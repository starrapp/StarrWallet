import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, FiatAmount } from '@/components/ui';
import { useColors } from '@/contexts';
import { spacing } from '@/theme';
import { formatAmount } from '@/utils/format';
import type { BitcoinUnit, LightningPayment } from '@/types/wallet';
import type { ColorTheme } from '@/theme/colors';

interface IncomingPaymentOverlayProps {
  payment: LightningPayment | null;
  currency: BitcoinUnit;
  onDismiss: () => void;
}

const createStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay.heavy,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: colors.background.secondary,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    icon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.status.success + '20',
    },
  });

export const IncomingPaymentOverlay: React.FC<IncomingPaymentOverlayProps> = ({
  payment,
  currency,
  onDismiss,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!payment) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const timer = setTimeout(() => onDismissRef.current(), 3500);
    return () => clearTimeout(timer);
  }, [payment]);

  if (!payment) return null;

  const amount = formatAmount(payment.amountSats, currency);

  return (
    <TouchableOpacity
      style={styles.backdrop}
      onPress={onDismiss}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel="Dismiss payment received message"
    >
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="checkmark" size={42} color={colors.status.success} />
        </View>
        <Text variant="headlineSmall" color={colors.text.primary}>
          Payment received
        </Text>
        <Text variant="amountMedium" color={colors.status.success}>
          +{amount.value}
        </Text>
        <Text variant="titleSmall" color={colors.text.secondary}>
          {amount.unit}
        </Text>
        <FiatAmount sats={payment.amountSats} style={{ textAlign: 'center' }} />
        <Text variant="bodySmall" color={colors.text.muted}>
          Tap anywhere to dismiss
        </Text>
      </View>
    </TouchableOpacity>
  );
};
