/**
 * Send Payment Screen
 *
 * Supports: BOLT11 invoice, Bitcoin address, Spark address/invoice,
 * LNURL-Pay, Lightning address.
 * Flow: parse input → show type & details → prepare (fees) → confirm → send.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Input, AmountInput, Card, FiatAmount } from '@/components/ui';
import { useWalletStore } from '@/stores/walletStore';
import { BreezService, formatSdkError } from '@/services/breez';
import { useColors } from '@/contexts';
import { spacing } from '@/theme';
import { formatAmountStr, formatSats, msatToSatCeil } from '@/utils/format';
import type { ParsedInput, PrepareSendResult, ParsedBolt11, ParsedLnurlPay } from '@/types/wallet';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  bolt11_invoice: 'Lightning invoice',
  bitcoin_address: 'Bitcoin address',
  spark_address: 'Spark address',
  spark_invoice: 'Spark invoice',
  lnurl_pay: 'LNURL-Pay',
  unknown: 'Unknown',
};

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ invoice?: string }>();
  const colors = useColors();
  const { balance, sendPayment, settings } = useWalletStore();
  const [invoice, setInvoice] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
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

  const needsAmount =
    parsed?.type === 'bitcoin_address'
    || parsed?.type === 'spark_address'
    || parsed?.type === 'spark_invoice'
    || parsed?.type === 'lnurl_pay'
    || (parsed?.type === 'bolt11_invoice' && parsed.amountMsat == null);

  const handlePrepareAndConfirm = async () => {
    if (!invoice.trim()) {
      setError('Please enter an invoice or address');
      return;
    }
    if (parsed?.type === 'unknown') {
      setError('Unrecognized payment request');
      return;
    }
    const isFixedBolt11 = parsed?.type === 'bolt11_invoice' && parsed.amountMsat != null;
    const amountSats = isFixedBolt11 ? undefined : getAmountSats();
    if (needsAmount && amountSats == null) {
      setError('Please enter an amount');
      return;
    }
    if (balance && amountSats != null && amountSats > balance.lightning) {
      setError('Insufficient balance');
      return;
    }

    setError(null);
    try {
      const result = await BreezService.prepareSendPayment(invoice.trim(), amountSats, comment || undefined);
      const totalDebit = result.amountSats + result.feeSats;
      if (balance && totalDebit > balance.lightning) {
        setError('Insufficient balance to cover amount and network fee');
        return;
      }
      setPrepareResult(result);
      setShowConfirm(true);
    } catch (err) {
      setError(formatSdkError(err));
    }
  };

  const handleCancel = useCallback(() => {
    if (router.canDismiss()) {
      router.dismiss();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  const handleSend = async () => {
    if (!prepareResult || !invoice.trim()) return;
    const amountSats = prepareResult.amountSats;
    const totalDebit = prepareResult.amountSats + prepareResult.feeSats;
    if (amountSats <= 0n) {
      setError('Please enter an amount');
      return;
    }
    if (balance && totalDebit > balance.lightning) {
      setError('Insufficient balance to cover amount and network fee');
      return;
    }
    setIsLoading(true);
    try {
      const isFixedBolt11 = parsed?.type === 'bolt11_invoice' && parsed.amountMsat != null;
      const sendAmountSats = isFixedBolt11 ? undefined : amountSats;
      await sendPayment(invoice.trim(), sendAmountSats, comment || undefined);
      setShowConfirm(false);
      setPrepareResult(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const sentAmount = formatAmountStr(amountSats, settings.bitcoinUnit);
      Alert.alert('Payment sent', `Successfully sent ${sentAmount}`, [
        { text: 'OK', onPress: handleCancel },
      ]);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(formatSdkError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        safeArea: { flex: 1 },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
        },
        headerSide: {
          minWidth: 76,
          alignItems: 'flex-start',
          justifyContent: 'center',
        },
        headerTitle: {
          flex: 1,
          textAlign: 'center',
        },
        scrollView: { flex: 1 },
        scrollContent: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
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
        actionContainer: {
          marginTop: spacing.sm,
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Button title="Cancel" variant="ghost" size="sm" onPress={handleCancel} />
          </View>
          <Text
            variant="titleLarge"
            color={colors.text.primary}
            style={styles.headerTitle}
            numberOfLines={1}
          >
              Send Payment
          </Text>
          <View style={styles.headerSide} />
        </View>

        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={20}
        >
          {/* Payment request input */}
          <Input
            label="Payment request"
            placeholder="Invoice, address, or LNURL..."
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
                  {parsed.type === 'lnurl_pay' && (parsed as ParsedLnurlPay).address
                    ? 'Lightning address'
                    : (PAYMENT_TYPE_LABELS[parsed.type] ?? parsed.type)}
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
              {parsed.type === 'lnurl_pay' && (
                <>
                  {(parsed as ParsedLnurlPay).address && (
                    <View style={styles.invoiceRow}>
                      <Text variant="labelMedium" color={colors.text.muted}>Address</Text>
                      <Text variant="bodyMedium" color={colors.text.primary}>
                        {(parsed as ParsedLnurlPay).address}
                      </Text>
                    </View>
                  )}
                  <View style={styles.invoiceRow}>
                    <Text variant="labelMedium" color={colors.text.muted}>Domain</Text>
                    <Text variant="bodyMedium" color={colors.text.primary}>
                      {(parsed as ParsedLnurlPay).domain}
                    </Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text variant="labelMedium" color={colors.text.muted}>Range</Text>
                    <Text variant="bodySmall" color={colors.text.secondary}>
                      {formatSats(msatToSatCeil((parsed as ParsedLnurlPay).minSendable))} – {formatSats(msatToSatCeil((parsed as ParsedLnurlPay).maxSendable))} sats
                    </Text>
                  </View>
                </>
              )}
            </Card>
          )}

          {/* Amount input (for amountless invoices, addresses, LNURL) */}
          {needsAmount && (
            <AmountInput
              value={amount}
              onChangeValue={setAmount}
              label="Amount to send"
              maxAmount={balance?.lightning}
              editable={!showConfirm}
            />
          )}

          {/* Comment input for LNURL-Pay when supported */}
          {parsed?.type === 'lnurl_pay' && (parsed as ParsedLnurlPay).commentAllowed > 0 && (
            <Input
              label="Comment (optional)"
              placeholder="Add a message..."
              value={comment}
              onChangeText={setComment}
              maxLength={(parsed as ParsedLnurlPay).commentAllowed}
              editable={!showConfirm}
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
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="titleSmall" color={colors.text.primary}>
                    {formatAmountStr(prepareResult.amountSats, settings.bitcoinUnit)}
                  </Text>
                  <FiatAmount sats={prepareResult.amountSats} style={{ textAlign: 'right' }} />
                </View>
              </View>
              {prepareResult.feeSats > 0n && (
                <View style={styles.invoiceRow}>
                  <Text variant="bodyMedium" color={colors.text.secondary}>Fee</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="bodyMedium" color={colors.text.primary}>
                      {prepareResult.paymentMethod === 'onchain' ? '~' : ''}{formatAmountStr(prepareResult.feeSats, settings.bitcoinUnit)}
                    </Text>
                    <FiatAmount sats={prepareResult.feeSats} style={{ textAlign: 'right' }} />
                  </View>
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
                Available: {formatAmountStr(balance?.lightning ?? 0n, settings.bitcoinUnit)}
            </Text>
          </View>

          {!showConfirm ? (
            <View style={styles.actionContainer}>
              <Button
                title={parsed ? 'Continue' : 'Enter payment request'}
                variant="primary"
                size="lg"
                onPress={handlePrepareAndConfirm}
                disabled={!invoice.trim() || isParsing}
              />
            </View>
          ) : null}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}
