import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Card, FiatAmount, Text } from '@/components/ui';
import { useColors } from '@/contexts';
import { spacing } from '@/theme';
import { formatSignedAmountStr, formatAmountStr } from '@/utils/format';
import type { BitcoinUnit, LightningPayment } from '@/types/wallet';

interface PaymentDetailsContentProps {
  payment: LightningPayment;
  bitcoinUnit: BitcoinUnit;
  contentContainerStyle?: object;
}

export function PaymentDetailsContent({
  payment,
  bitcoinUnit,
  contentContainerStyle,
}: PaymentDetailsContentProps) {
  const colors = useColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flex: 1 },
        scrollContent: { padding: spacing.lg, gap: spacing.lg },
        iconLarge: {
          width: 80,
          height: 80,
          borderRadius: 40,
          alignItems: 'center',
          justifyContent: 'center',
        },
        card: { padding: spacing.md, gap: spacing.sm },
        row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        label: { marginBottom: spacing.xxs },
        mono: { fontFamily: 'monospace', fontSize: 12 },
      }),
    []
  );

  const isReceive = payment.type === 'receive';
  const statusColor =
    payment.status === 'failed'
      ? colors.status.error
      : payment.status === 'pending'
        ? colors.status.warning
        : isReceive
          ? colors.status.success
          : colors.text.primary;
  const formattedAmount = formatSignedAmountStr(payment.amountSats, isReceive ? '+' : '-', bitcoinUnit);
  const formattedFee = payment.feeSats != null ? formatAmountStr(payment.feeSats, bitcoinUnit) : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      <Card variant="default" style={styles.card}>
        <View style={[styles.iconLarge, { backgroundColor: statusColor + '20' }]}>
          <Ionicons
            name={isReceive ? 'arrow-down' : 'arrow-up'}
            size={40}
            color={statusColor}
          />
        </View>
        <Text variant="headlineMedium" color={colors.text.primary}>
          {formattedAmount}
        </Text>
        <FiatAmount sats={payment.amountSats} style={{ textAlign: 'center' }} />
        <Text variant="bodyMedium" color={colors.text.secondary}>
          {payment.description ?? (isReceive ? 'Received' : 'Sent')}
        </Text>
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          <Text variant="labelMedium" color={colors.text.muted}>
            Status
          </Text>
          <Text variant="labelMedium" color={statusColor} style={{ textTransform: 'capitalize' }}>
            {payment.status}
          </Text>
        </View>
      </Card>

      <Card variant="outlined" style={styles.card}>
        <Text variant="labelMedium" color={colors.text.muted} style={styles.label}>
          Date
        </Text>
        <Text variant="bodyMedium" color={colors.text.primary}>
          {format(new Date(payment.timestamp), 'PPp')}
        </Text>
        {payment.completedAt && (
          <>
            <Text variant="labelMedium" color={colors.text.muted} style={[styles.label, { marginTop: spacing.sm }]}>
              Completed
            </Text>
            <Text variant="bodyMedium" color={colors.text.primary}>
              {format(new Date(payment.completedAt), 'PPp')}
            </Text>
          </>
        )}
        {payment.feeSats != null && payment.feeSats > 0n && (
          <>
            <Text variant="labelMedium" color={colors.text.muted} style={[styles.label, { marginTop: spacing.sm }]}>
              Fee
            </Text>
            <Text variant="bodyMedium" color={colors.text.primary}>
              {formattedFee}
            </Text>
            <FiatAmount sats={payment.feeSats} />
          </>
        )}
        <Text variant="labelMedium" color={colors.text.muted} style={[styles.label, { marginTop: spacing.sm }]}>
          Payment hash
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary} style={styles.mono} numberOfLines={1}>
          {payment.paymentHash || '—'}
        </Text>
        {payment.invoice && (
          <>
            <Text variant="labelMedium" color={colors.text.muted} style={[styles.label, { marginTop: spacing.sm }]}>
              Invoice
            </Text>
            <Text variant="bodySmall" color={colors.text.secondary} style={styles.mono} numberOfLines={2}>
              {payment.invoice}
            </Text>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

