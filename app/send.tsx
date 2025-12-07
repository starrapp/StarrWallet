/**
 * Send Payment Screen
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Input, AmountInput, Card } from '@/components/ui';
import { useWalletStore } from '@/stores/walletStore';
import { colors, spacing, layout } from '@/theme';

export default function SendScreen() {
  const router = useRouter();
  const { balance, payInvoice } = useWalletStore();
  const [invoice, setInvoice] = useState('');
  const [amount, setAmount] = useState('');
  const [parsedInvoice, setParsedInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvoiceChange = async (text: string) => {
    setInvoice(text);
    setError(null);
    setParsedInvoice(null);

    // Parse invoice if it looks valid
    // Actual parsing happens in payInvoice, this is just for UI feedback
    if (text.length > 10 && text.startsWith('lnbc')) {
      setParsedInvoice({ isValid: true });
    }
  };

  const handleSend = async () => {
    if (!invoice) {
      setError('Please enter an invoice');
      return;
    }

    const amountSats = parseInt(amount) || undefined;
    
    if (!amountSats) {
      setError('Please enter an amount');
      return;
    }

    const finalAmount = amountSats;
    
    if (balance && finalAmount > balance.lightning) {
      setError('Insufficient balance');
      return;
    }

    setIsLoading(true);
    try {
      await payInvoice(invoice, amountSats);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Payment Sent!', `Successfully sent ${finalAmount.toLocaleString()} sats`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <Button
              title="Cancel"
              variant="ghost"
              size="sm"
              onPress={() => router.back()}
            />
            <Text variant="titleLarge" color={colors.text.primary}>
              Send Payment
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Invoice input */}
            <Input
              label="Lightning Invoice"
              placeholder="lnbc..."
              value={invoice}
              onChangeText={handleInvoiceChange}
              multiline
              numberOfLines={3}
              leftIcon={<Ionicons name="flash" size={20} color={colors.text.muted} />}
              error={error || undefined}
            />

            {/* Scan button */}
            <Button
              title="Scan QR Code"
              variant="secondary"
              size="md"
              icon={<Ionicons name="scan" size={20} color={colors.gold.pure} />}
              onPress={() => router.push('/scan')}
              style={styles.scanButton}
            />

            {/* Parsed invoice info */}
            {parsedInvoice && (
              <Card variant="default" style={styles.invoiceCard}>
                <View style={styles.invoiceRow}>
                  <Text variant="labelMedium" color={colors.text.muted}>
                    To
                  </Text>
                  <Text variant="address" color={colors.text.secondary} numberOfLines={1}>
                    {parsedInvoice.payee?.substring(0, 20)}...
                  </Text>
                </View>
                {parsedInvoice.description && (
                  <View style={styles.invoiceRow}>
                    <Text variant="labelMedium" color={colors.text.muted}>
                      Description
                    </Text>
                    <Text variant="bodyMedium" color={colors.text.primary}>
                      {parsedInvoice.description}
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {/* Amount input */}
            {parsedInvoice && (
              <AmountInput
                value={amount}
                onChangeValue={setAmount}
                label="Amount to send"
                maxAmount={balance?.lightning}
              />
            )}


            {/* Balance info */}
            <View style={styles.balanceInfo}>
              <Ionicons name="wallet" size={16} color={colors.text.muted} />
              <Text variant="bodySmall" color={colors.text.muted}>
                Available: {balance?.lightning.toLocaleString() || 0} sats
              </Text>
            </View>
          </ScrollView>

          {/* Send button */}
          <View style={styles.footer}>
            <Button
              title={isLoading ? 'Sending...' : 'Send Payment'}
              variant="primary"
              size="lg"
              onPress={handleSend}
              loading={isLoading}
              disabled={!invoice || isLoading}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  scanButton: {
    marginTop: spacing.sm,
  },
  invoiceCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  invoiceRow: {
    gap: spacing.xxs,
  },
  amountDisplay: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});

