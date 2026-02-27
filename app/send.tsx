/**
 * Send Payment Screen
 *
 * Supports: BOLT11 invoice, Bitcoin address, Spark address (stub).
 * Flow: parse input → show type & details → prepare (fees) → confirm → send.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Input, AmountInput, Card } from '@/components/ui';
import { useWalletStore } from '@/stores/walletStore';
import { BreezService } from '@/services/breez';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import { formatSats, msatToSatCeil } from '@/utils/format';
import type { ParsedInput, PrepareSendResult, ParsedBolt11 } from '@/types/wallet';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  bolt11_invoice: 'Lightning invoice',
  bitcoin_address: 'Bitcoin address',
  spark_address: 'Spark address',
  spark_invoice: 'Spark invoice',
  lnurl_pay: 'LNURL-Pay',
  lnurl_withdraw: 'LNURL-Withdraw',
  unknown: 'Unknown',
};

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ invoice?: string }>();
  const colors = useColors();
  const { balance, payInvoice, sendToAddress } = useWalletStore();
  const [invoice, setInvoice] = useState('');
  const [amount, setAmount] = useState('');
  const [parsed, setParsed] = useState<ParsedInput | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [prepareResult, setPrepareResult] = useState<PrepareSendResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial invoice from scan / deep link
  useEffect(() => {
    const initial = params.invoice?.trim();
    if (initial) {
      setInvoice(initial);
    }
  }, [params.invoice]);

  // Parse when input changes (debounced)
  useEffect(() => {
    if (!invoice.trim()) {
      setParsed(null);
      return;
    }
    let cancelled = false;
    setIsParsing(true);
    const t = setTimeout(async () => {
      try {
        const result = await BreezService.parse(invoice.trim());
        if (!cancelled) {
          setParsed(result);
        }
      } catch {
        if (!cancelled) setParsed({ type: 'unknown', raw: invoice });
      } finally {
        if (!cancelled) setIsParsing(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [invoice]);

  const handleInvoiceChange = useCallback((text: string) => {
    setInvoice(text);
    setError(null);
    setPrepareResult(null);
    setShowConfirm(false);
  }, []);

  const getAmountSats = useCallback((): bigint | undefined => {
    if (amount.trim().length > 0) {
      try {
        const value = BigInt(amount);
        if (value > 0n) return value;
      } catch {
        // Ignore invalid bigint input.
      }
    }
    return undefined;
  }, [amount]);

  const handlePrepareAndConfirm = async () => {
    if (!invoice.trim()) {
      setError('Please enter an invoice or address');
      return;
    }
    const isFixedBolt11 = parsed?.type === 'bolt11_invoice' && parsed.amountMsat != null;
    const amountSats = isFixedBolt11 ? undefined : getAmountSats();
    if (parsed?.type === 'bolt11_invoice' && parsed.amountMsat == null && amountSats == null) {
      setError('Please enter an amount (this invoice has no amount)');
      return;
    }
    if (parsed?.type !== 'bolt11_invoice' && parsed?.type !== 'bitcoin_address' && parsed?.type !== 'spark_address') {
      setError('Only Lightning invoices and Bitcoin/Spark addresses are supported for sending right now.');
      return;
    }
    if (balance && amountSats != null && amountSats > balance.lightning) {
      setError('Insufficient balance');
      return;
    }

    setError(null);
    try {
      const result = await BreezService.prepareSendPayment(invoice.trim(), amountSats);
      setPrepareResult(result);
      setShowConfirm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare payment');
    }
  };

  const handleSend = async () => {
    if (!prepareResult || !invoice.trim()) return;
    const isFixedBolt11 = parsed?.type === 'bolt11_invoice' && parsed.amountMsat != null;
    const requestedAmountSats = isFixedBolt11 ? undefined : getAmountSats();
    const amountSats = requestedAmountSats ?? prepareResult.amountSats;
    if (amountSats <= 0n) {
      setError('Please enter an amount');
      return;
    }
    setIsLoading(true);
    try {
      if (prepareResult.paymentMethod === 'lightning') {
        await payInvoice(invoice.trim(), requestedAmountSats);
      } else if (prepareResult.paymentMethod === 'onchain' && parsed?.type === 'bitcoin_address') {
        await sendToAddress(parsed.address, amountSats, 'bitcoin');
      } else if (prepareResult.paymentMethod === 'spark_transfer' && parsed?.type === 'spark_address') {
        await sendToAddress(parsed.address, amountSats, 'spark');
      } else {
        setError('Unsupported payment type for send');
        setIsLoading(false);
        return;
      }
      setShowConfirm(false);
      setPrepareResult(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Payment sent', `Successfully sent ${formatSats(amountSats)} sats`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        safeArea: { flex: 1 },
        keyboardView: { flex: 1 },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
        },
        scrollView: { flex: 1 },
        scrollContent: { padding: spacing.lg, gap: spacing.md },
        scanButton: { marginTop: spacing.sm },
        invoiceCard: { padding: spacing.md, gap: spacing.sm },
        invoiceRow: { gap: spacing.xxs },
        amountDisplay: { alignItems: 'center', padding: spacing.lg, gap: spacing.xs },
        amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
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
        parsedRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        confirmCard: { padding: spacing.md, gap: spacing.sm },
        confirmTitle: { marginBottom: spacing.xs },
        confirmActions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
      }),
    [colors]
  );

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
            {/* Payment request input */}
            <Input
              label="Payment request"
              placeholder="Lightning invoice, Bitcoin or Spark address..."
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

            {/* Parsed type + details */}
            {isParsing && (
              <View style={styles.parsedRow}>
                <ActivityIndicator size="small" color={colors.gold.pure} />
                <Text variant="bodySmall" color={colors.text.muted}>Detecting type...</Text>
              </View>
            )}
            {parsed && !isParsing && (
              <Card variant="default" style={styles.invoiceCard}>
                <View style={styles.invoiceRow}>
                  <Text variant="labelMedium" color={colors.text.muted}>
                    Type
                  </Text>
                  <Text variant="bodyMedium" color={colors.text.primary}>
                    {PAYMENT_TYPE_LABELS[parsed.type] ?? parsed.type}
                  </Text>
                </View>
                {parsed.type === 'bolt11_invoice' && (
                  <>
                    {(parsed as ParsedBolt11).payee && (
                      <View style={styles.invoiceRow}>
                        <Text variant="labelMedium" color={colors.text.muted}>To</Text>
                        <Text variant="address" color={colors.text.secondary} numberOfLines={1}>
                          {(parsed as ParsedBolt11).payee!.substring(0, 24)}...
                        </Text>
                      </View>
                    )}
                    {(parsed as ParsedBolt11).description && (
                      <View style={styles.invoiceRow}>
                        <Text variant="labelMedium" color={colors.text.muted}>Description</Text>
                        <Text variant="bodyMedium" color={colors.text.primary}>
                          {(parsed as ParsedBolt11).description}
                        </Text>
                      </View>
                    )}
                    {(parsed as ParsedBolt11).amountMsat != null && (
                      <View style={styles.invoiceRow}>
                        <Text variant="labelMedium" color={colors.text.muted}>Amount</Text>
                        <Text variant="bodyMedium" color={colors.text.primary}>
                          {formatSats(msatToSatCeil((parsed as ParsedBolt11).amountMsat!))} sats
                        </Text>
                      </View>
                    )}
                    {(parsed as ParsedBolt11).expiry != null && (
                      <View style={styles.invoiceRow}>
                        <Text variant="labelMedium" color={colors.text.muted}>Expiry</Text>
                        <Text variant="bodySmall" color={colors.text.secondary}>
                          {(parsed as ParsedBolt11).expiry! / 60} min
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* Amount input (only for amountless invoices and addresses) */}
            {(parsed?.type === 'bitcoin_address'
              || parsed?.type === 'spark_address'
              || (parsed?.type === 'bolt11_invoice' && parsed.amountMsat == null)) && (
              <AmountInput
                value={amount}
                onChangeValue={setAmount}
                label="Amount to send"
                maxAmount={balance?.lightning}
              />
            )}

            {/* Fee confirmation step */}
            {showConfirm && prepareResult && (
              <Card variant="outlined" style={styles.confirmCard}>
                <Text variant="labelMedium" color={colors.text.muted} style={styles.confirmTitle}>
                  Confirm payment
                </Text>
                <View style={styles.invoiceRow}>
                  <Text variant="bodyMedium" color={colors.text.secondary}>Amount</Text>
                  <Text variant="titleSmall" color={colors.text.primary}>
                    {formatSats(prepareResult.amountSats)} sats
                  </Text>
                </View>
                {prepareResult.lightningFeeSats != null && prepareResult.lightningFeeSats > 0n && (
                  <View style={styles.invoiceRow}>
                    <Text variant="bodyMedium" color={colors.text.secondary}>Network fee</Text>
                    <Text variant="bodyMedium" color={colors.text.primary}>
                      {formatSats(prepareResult.lightningFeeSats)} sats
                    </Text>
                  </View>
                )}
                {prepareResult.sparkTransferFeeSats != null && prepareResult.sparkTransferFeeSats > 0n && (
                  <View style={styles.invoiceRow}>
                    <Text variant="bodyMedium" color={colors.text.secondary}>Spark fee</Text>
                    <Text variant="bodyMedium" color={colors.text.primary}>
                      {formatSats(prepareResult.sparkTransferFeeSats)} sats
                    </Text>
                  </View>
                )}
                {prepareResult.onchainFeeSats != null && (
                  <View style={styles.invoiceRow}>
                    <Text variant="bodyMedium" color={colors.text.secondary}>On-chain fee</Text>
                    <Text variant="bodyMedium" color={colors.text.primary}>
                      ~{formatSats(prepareResult.onchainFeeSats)} sats
                    </Text>
                  </View>
                )}
                <View style={styles.confirmActions}>
                  <Button title="Back" variant="ghost" size="md" onPress={() => { setShowConfirm(false); setPrepareResult(null); }} />
                  <Button title={isLoading ? 'Sending...' : 'Send'} variant="primary" size="md" onPress={handleSend} loading={isLoading} disabled={isLoading} />
                </View>
              </Card>
            )}

            {/* Balance info */}
            <View style={styles.balanceInfo}>
              <Ionicons name="wallet" size={16} color={colors.text.muted} />
              <Text variant="bodySmall" color={colors.text.muted}>
                Available: {balance ? formatSats(balance.lightning) : '0'} sats
              </Text>
            </View>
          </ScrollView>

          {/* Primary action: Prepare or Send */}
          <View style={styles.footer}>
            {!showConfirm ? (
              <Button
                title={parsed ? 'Continue' : 'Enter payment request'}
                variant="primary"
                size="lg"
                onPress={handlePrepareAndConfirm}
                disabled={!invoice.trim() || isParsing}
              />
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
