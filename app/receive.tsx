/**
 * Receive Payment Screen
 *
 * Create Lightning invoices and claim unclaimed on-chain deposits.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Input, AmountInput, Card } from '@/components/ui';
import { QRDisplay } from '@/components/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import { formatSats } from '@/utils/format';
import type { Invoice, UnclaimedDeposit } from '@/types/wallet';

function expiryCopy(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const minutes = Math.ceil(ms / 60000);
  return minutes === 1 ? 'Expires in 1 minute' : `Expires in ${minutes} minutes`;
}

export default function ReceiveScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    createInvoice,
    currentInvoice,
    isCreatingInvoice,
    unclaimedDeposits,
    isLoadingUnclaimed,
    fetchUnclaimedDeposits,
    claimDeposit,
  } = useWalletStore();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimingTxid, setClaimingTxid] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchUnclaimedDeposits();
    }, [fetchUnclaimedDeposits])
  );

  const handleClaimDeposit = useCallback(
    (d: UnclaimedDeposit) => {
      const netSats = d.amountSats - d.requiredFeeSats;
      Alert.alert(
        'Claim deposit',
        `Amount: ${d.amountSats.toLocaleString()} sats\nFee: ${d.requiredFeeSats.toLocaleString()} sats\nYou will receive: ${netSats.toLocaleString()} sats`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Claim',
            onPress: async () => {
              setClaimingTxid(d.txid);
              try {
                await claimDeposit(d.txid, d.vout, d.requiredFeeSats);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Deposit claimed', 'The funds have been added to your balance.');
              } catch (err) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(
                  'Claim failed',
                  err instanceof Error ? err.message : 'Could not claim deposit. Try again later.'
                );
              } finally {
                setClaimingTxid(null);
              }
            },
          },
        ]
      );
    },
    [claimDeposit]
  );

  const handleCreateInvoice = async () => {
    if (!amount.trim()) {
      setError('Please enter a valid amount');
      return;
    }

    let amountSats: bigint;
    try {
      amountSats = BigInt(amount);
    } catch {
      setError('Please enter a valid amount');
      return;
    }

    if (amountSats <= 0n) {
      setError('Please enter a valid amount');
      return;
    }

    setError(null);
    try {
      const newInvoice = await createInvoice(amountSats, description || undefined);
      setInvoice(newInvoice);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    }
  };

  const handleNewInvoice = () => {
    setInvoice(null);
    setAmount('');
    setDescription('');
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
        scrollContent: {
          padding: spacing.lg,
          gap: spacing.lg,
          alignItems: 'center',
        },
        iconContainer: { marginVertical: spacing.lg },
        successHeader: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
        successIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.status.success + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        amountContainer: {
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: spacing.sm,
        },
        expiryInfo: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.sm,
        },
        unclaimedSection: {
          width: '100%',
          marginTop: spacing.xl,
          paddingTop: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
          gap: spacing.md,
        },
        unclaimedCard: {
          padding: spacing.md,
          gap: spacing.sm,
        },
        unclaimedRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        unclaimedActions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: spacing.xs,
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
              title="Close"
              variant="ghost"
              size="sm"
              onPress={() => router.back()}
            />
            <Text variant="titleLarge" color={colors.text.primary}>
              Receive Payment
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {!invoice ? (
              // Invoice creation form
              <>
                <View style={styles.iconContainer}>
                  <Ionicons name="arrow-down-circle" size={64} color={colors.status.success} />
                </View>

                <Text variant="bodyMedium" color={colors.text.secondary} align="center">
                  Create a Lightning invoice to receive Bitcoin
                </Text>

                <AmountInput
                  value={amount}
                  onChangeValue={setAmount}
                  label="Amount to receive"
                  error={error || undefined}
                />

                <Input
                  label="Description (optional)"
                  placeholder="What's this payment for?"
                  value={description}
                  onChangeText={setDescription}
                />

                <Button
                  title={isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                  variant="primary"
                  size="lg"
                  onPress={handleCreateInvoice}
                  loading={isCreatingInvoice}
                  disabled={!amount || isCreatingInvoice}
                />
              </>
            ) : (
              // Invoice display
              <>
                <View style={styles.successHeader}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark" size={32} color={colors.status.success} />
                  </View>
                  <Text variant="titleLarge" color={colors.text.primary}>
                    Invoice Created
                  </Text>
                </View>

                {/* Amount */}
                <View style={styles.amountContainer}>
                  <Text variant="amountLarge" color={colors.gold.pure}>
                    {invoice.amountSats != null ? formatSats(invoice.amountSats) : '0'}
                  </Text>
                  <Text variant="titleMedium" color={colors.text.secondary}>
                    sats
                  </Text>
                </View>

                {/* QR Code */}
                <QRDisplay
                  value={invoice.bolt11}
                  label="Scan to pay"
                />

                {/* Expiry info */}
                <View style={styles.expiryInfo}>
                  <Ionicons name="time" size={16} color={colors.text.muted} />
                  <Text variant="bodySmall" color={colors.text.muted}>
                    {expiryCopy(invoice.expiresAt)}
                  </Text>
                </View>

                {/* Actions */}
                <Button
                  title="Create New Invoice"
                  variant="secondary"
                  size="md"
                  onPress={handleNewInvoice}
                />
              </>
            )}

            {/* Unclaimed on-chain deposits */}
            <View style={styles.unclaimedSection}>
              <Text variant="labelMedium" color={colors.text.muted}>
                Unclaimed on-chain deposits
              </Text>
              {isLoadingUnclaimed ? (
                <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.gold.pure} />
                </View>
              ) : unclaimedDeposits.length === 0 ? (
                <Text variant="bodySmall" color={colors.text.muted}>
                  No unclaimed deposits. When you receive Bitcoin to your on-chain address and auto-claim fails (e.g. low fee), they will appear here so you can claim manually.
                </Text>
              ) : (
                unclaimedDeposits.map((d) => (
                  <Card key={`${d.txid}-${d.vout}`} variant="outlined" style={styles.unclaimedCard}>
                    <View style={styles.unclaimedRow}>
                      <Text variant="labelMedium" color={colors.text.muted}>
                        Amount
                      </Text>
                      <Text variant="titleSmall" color={colors.text.primary}>
                        {d.amountSats.toLocaleString()} sats
                      </Text>
                    </View>
                    <View style={styles.unclaimedRow}>
                      <Text variant="labelMedium" color={colors.text.muted}>
                        Claim fee
                      </Text>
                      <Text variant="bodyMedium" color={colors.text.secondary}>
                        {d.requiredFeeSats.toLocaleString()} sats
                      </Text>
                    </View>
                    {d.claimError && (
                      <Text variant="bodySmall" color={colors.status.error}>
                        {d.claimError}
                      </Text>
                    )}
                    <View style={styles.unclaimedActions}>
                      <Button
                        title={claimingTxid === d.txid ? 'Claiming...' : 'Claim'}
                        variant="primary"
                        size="sm"
                        onPress={() => handleClaimDeposit(d)}
                        disabled={claimingTxid != null}
                        loading={claimingTxid === d.txid}
                      />
                    </View>
                  </Card>
                ))
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
