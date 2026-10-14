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
  Linking,
} from 'react-native';
import { useRouter, useRoute } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ContentColumn } from '@/components';
import { Button, Text, Input, AmountInput, Card, FiatAmount } from '@/components/ui';
import { useWalletStore } from '@/stores/walletStore';
import { BreezService, formatSdkError } from '@/services/breez';
import { captureException } from '@/services/logging';
import { useColors } from '@/contexts';
import { spacing } from '@/theme';
import { useResponsive } from '@/hooks';
import { formatAmountStr, formatSats, msatToSatCeil } from '@/utils/format';
import { beginPayment, endPayment, hasPendingSend } from '@/stores/sendStore';
import { safeReturnUrl } from '@/utils/deepLink';
import type { ParsedInput, PrepareSendResult, ParsedBolt11, ParsedLnurlPay, SendRequest } from '@/types/wallet';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  bolt11_invoice: 'Lightning invoice',
  bitcoin_address: 'Bitcoin address',
  spark_address: 'Spark address',
  spark_invoice: 'Spark invoice',
  lnurl_pay: 'LNURL-Pay',
  unknown: 'Unknown',
};

// The destination that the payment goes to. For a BIP 21 URI it can differ from
// the text in the field, so the user must see it before the payment.
function recipientOf(parsed: ParsedInput | null): string | undefined {
  switch (parsed?.type) {
    case 'bitcoin_address':
    case 'spark_address':
      return parsed.address;
    case 'spark_invoice':
      return parsed.invoice;
    case 'bolt11_invoice':
      return parsed.payee;
    case 'lnurl_pay':
      return parsed.address ?? parsed.domain;
  }
  return undefined;
}

export default function SendScreen() {
  const router = useRouter();
  // Not useLocalSearchParams: it decodes the params a second time, which changes
  // a percent-encoded URI (expo/expo#48421).
  const request = useRoute().params as Partial<SendRequest> | undefined;
  const colors = useColors();
  const { isTabletWidth } = useResponsive();
  const { balance, sendPayment, settings, isInitialized } = useWalletStore();
  const [invoice, setInvoice] = useState(() => request?.invoice?.trim() ?? '');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [parsed, setParsed] = useState<ParsedInput | null>(null);
  // The input text `parsed` belongs to. Differs from the current input while a parse is pending.
  const [parsedInput, setParsedInput] = useState('');
  // The prepare result and the inputs it was made for.
  const [prepared, setPrepared] = useState<{
    result: PrepareSendResult;
    input: string;
    amount: string;
    comment: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedInvoice = invoice.trim();
  const isParsing = trimmedInvoice !== '' && parsedInput !== trimmedInvoice;
  // App that deep-linked us here and wants to be reopened once we've paid
  // (e.g. a Nostr client waiting to confirm a zap). Validated, never trusted.
  // Only for its own request: another payment typed here is not one it waits for.
  const returnUrl = trimmedInvoice === request?.invoice?.trim() ? safeReturnUrl(request.returnUrl) : null;

  if (trimmedInvoice === '' && parsed !== null) {
    setParsed(null);
    setParsedInput('');
  }

  // Parse when input changes (debounced). A cold-start deep link opens Send
  // before the unlock starts the SDK, so wait for it.
  useEffect(() => {
    const trimmed = invoice.trim();
    if (!trimmed || !isInitialized) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const result = await BreezService.parse(trimmed);
        if (!cancelled) {
          setParsed(result);
          // The amount a BIP 21 URI asks for.
          if ('amountSats' in result && result.amountSats != null) setAmount(result.amountSats.toString());
        }
      } catch {
        if (!cancelled) setParsed({ type: 'unknown', raw: trimmed });
      } finally {
        if (!cancelled) setParsedInput(trimmed);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [invoice, isInitialized]);

  const handleInvoiceChange = useCallback((text: string) => {
    setInvoice(text);
    setError(null);
    setComment('');
    setPrepared(null);
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

  const typeLabel = parsed?.type === 'lnurl_pay' && parsed.address
    ? 'Lightning address'
    : parsed && (PAYMENT_TYPE_LABELS[parsed.type] ?? parsed.type);

  const commentAllowed = parsed?.type === 'lnurl_pay' ? parsed.commentAllowed : 0;
  const sentComment = commentAllowed > 0 ? comment : '';
  // The SDK limits the comment in UTF-8 bytes, not in characters.
  const commentTooLong = new TextEncoder().encode(sentComment).length > commentAllowed;

  // A confirmation is valid only for the inputs it was prepared for. A late
  // response, or a new recipient from the scanner, never pays the wrong request.
  const prepareResult =
    prepared
    && prepared.input === trimmedInvoice
    && prepared.amount === amount
    && prepared.comment === sentComment
      ? prepared.result
      : null;
  const showConfirm = prepareResult != null;

  const needsAmount =
    parsed?.type === 'bitcoin_address'
    || parsed?.type === 'spark_address'
    || parsed?.type === 'lnurl_pay'
    || (parsed?.type === 'spark_invoice' && parsed.amount == null)
    || (parsed?.type === 'bolt11_invoice' && parsed.amountMsat == null);

  const handlePrepareAndConfirm = async () => {
    if (isPreparing) return;
    if (!invoice.trim()) {
      setError('Please enter an invoice or address');
      return;
    }
    if (parsed?.type === 'unknown') {
      setError('Unrecognized payment request');
      return;
    }
    const amountSats = needsAmount ? getAmountSats() : undefined;
    if (needsAmount && amountSats == null) {
      setError('Please enter an amount');
      return;
    }
    if (balance && amountSats != null && amountSats > balance.lightning) {
      setError('Insufficient balance');
      return;
    }
    if (commentTooLong) {
      setError('Comment is too long');
      return;
    }

    setError(null);
    setIsPreparing(true);
    try {
      const request = { input: trimmedInvoice, amount, comment: sentComment };
      const result = await BreezService.prepareSendPayment(request.input, amountSats, request.comment || undefined);
      const totalDebit = result.amountSats + result.feeSats;
      if (balance && totalDebit > balance.lightning) {
        setError('Insufficient balance to cover amount and network fee');
        return;
      }
      setPrepared({ result, ...request });
    } catch (err) {
      console.error('[Send] Failed to prepare payment:', err);
      setError(formatSdkError(err));
    } finally {
      setIsPreparing(false);
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
    if (!prepareResult) return;
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
    beginPayment();
    try {
      const payment = await sendPayment(prepareResult);
      setPrepared(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const sentAmount = formatAmountStr(amountSats, settings.bitcoinUnit);
      const successAction = payment.successAction;
      const successUrl = successAction?.url;
      Alert.alert(
        'Payment sent',
        (successAction
          ? `Successfully sent ${sentAmount}\n\n${successAction.text}${successUrl ? `\n${successUrl}` : ''}`
          : `Successfully sent ${sentAmount}`)
          // The button text hides the destination, so show it.
          + (returnUrl ? `\n\nBack to app opens:\n${returnUrl}` : ''),
        [
          ...(successUrl
            ? [{
              text: 'Open link',
              onPress: () => {
                Linking.openURL(successUrl).catch((err) => {
                  console.error('[Send] Failed to open success action URL:', err);
                });
                if (!endPayment()) handleCancel();
              },
            }]
            : []),
          {
            text: returnUrl ? 'Back to app' : 'OK',
            onPress: () => {
              if (!endPayment()) handleCancel();
              if (returnUrl) {
                Linking.openURL(returnUrl).catch((err) => {
                  console.error('[Send] Failed to open return URL:', err);
                });
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error('[Send] Failed to send payment:', err);
      captureException(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = formatSdkError(err);
      setError(message);
      // A waiting request closes this screen, so the user must see the failure first.
      if (hasPendingSend()) {
        Alert.alert('Payment failed', message, [{ text: 'OK', onPress: endPayment }]);
      } else {
        endPayment();
      }
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

        <ContentColumn style={{ flex: 1 }} maxWidth={isTabletWidth ? 900 : undefined}>
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
                    {typeLabel}
                  </Text>
                </View>
                {(parsed.type === 'bitcoin_address' || parsed.type === 'spark_address' || parsed.type === 'spark_invoice') && (
                  <View style={styles.invoiceRow}>
                    <Text variant="labelMedium" color={colors.text.muted}>To</Text>
                    <Text variant="address" color={colors.text.secondary}>
                      {recipientOf(parsed)}
                    </Text>
                  </View>
                )}
                {parsed.type === 'bolt11_invoice' && (
                  <>
                    {(parsed as ParsedBolt11).payee && (
                      <View style={styles.invoiceRow}>
                        <Text variant="labelMedium" color={colors.text.muted}>To</Text>
                        <Text variant="address" color={colors.text.secondary}>
                          {(parsed as ParsedBolt11).payee}
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
                    {(parsed as ParsedLnurlPay).description && (
                      <View style={styles.invoiceRow}>
                        <Text variant="labelMedium" color={colors.text.muted}>Description</Text>
                        <Text variant="bodyMedium" color={colors.text.primary}>
                          {(parsed as ParsedLnurlPay).description}
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
                error={commentTooLong ? 'Comment is too long' : undefined}
              />
            )}

            {/* Fee confirmation step */}
            {showConfirm && prepareResult && (
              <Card variant="outlined" style={styles.confirmCard}>
                <Text variant="labelMedium" color={colors.text.muted} style={styles.confirmTitle}>
                  Confirm payment
                </Text>
                <View style={styles.invoiceRow}>
                  <Text variant="bodyMedium" color={colors.text.secondary}>Method</Text>
                  <Text variant="bodyMedium" color={colors.text.primary}>{typeLabel}</Text>
                </View>
                {recipientOf(parsed) && (
                  <View style={styles.invoiceRow}>
                    <Text variant="bodyMedium" color={colors.text.secondary}>To</Text>
                    <Text variant="address" color={colors.text.primary}>
                      {recipientOf(parsed)}
                    </Text>
                  </View>
                )}
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
                  <Button title="Back" variant="ghost" size="md" onPress={() => setPrepared(null)} />
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
                  loading={isPreparing}
                  disabled={!invoice.trim() || isParsing || commentTooLong || isPreparing}
                />
              </View>
            ) : null}
          </KeyboardAwareScrollView>
        </ContentColumn>
      </SafeAreaView>
    </View>
  );
}
