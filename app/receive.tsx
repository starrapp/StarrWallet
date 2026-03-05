/**
 * Receive Payment Screen
 *
 * Create Lightning invoices and claim unclaimed on-chain deposits.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Button, Text, Input, AmountInput, Card } from '@/components/ui';
import { QRDisplay } from '@/components/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing } from '@/theme';
import { formatSats } from '@/utils/format';
import type { Invoice, UnclaimedDeposit } from '@/types/wallet';

type ReceiveMode = 'lightning' | 'onchain' | 'spark';

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
    getOnchainReceiveAddress,
    getSparkReceiveAddress,
    unclaimedDeposits,
    isLoadingUnclaimed,
    fetchUnclaimedDeposits,
    claimDeposit,
  } = useWalletStore();
  const [receiveMode, setReceiveMode] = useState<ReceiveMode>('lightning');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimingTxid, setClaimingTxid] = useState<string | null>(null);
  const [onchainAddress, setOnchainAddress] = useState<string | null>(null);
  const [isLoadingOnchain, setIsLoadingOnchain] = useState(false);
  const [onchainError, setOnchainError] = useState<string | null>(null);
  const [sparkAddress, setSparkAddress] = useState<string | null>(null);
  const [isLoadingSpark, setIsLoadingSpark] = useState(false);
  const [sparkError, setSparkError] = useState<string | null>(null);

  const fetchOnchainAddress = useCallback(async () => {
    setIsLoadingOnchain(true);
    setOnchainError(null);
    try {
      const addr = await getOnchainReceiveAddress();
      setOnchainAddress(addr);
    } catch (err) {
      setOnchainError(err instanceof Error ? err.message : 'Failed to get address');
      setOnchainAddress(null);
    } finally {
      setIsLoadingOnchain(false);
    }
  }, [getOnchainReceiveAddress]);

  const fetchSparkAddress = useCallback(async () => {
    setIsLoadingSpark(true);
    setSparkError(null);
    try {
      const addr = await getSparkReceiveAddress();
      setSparkAddress(addr);
    } catch (err) {
      setSparkError(err instanceof Error ? err.message : 'Failed to get Spark address');
      setSparkAddress(null);
    } finally {
      setIsLoadingSpark(false);
    }
  }, [getSparkReceiveAddress]);

  useEffect(() => {
    if (receiveMode === 'onchain') {
      fetchOnchainAddress();
    } else {
      setOnchainAddress(null);
      setOnchainError(null);
    }
  }, [receiveMode, fetchOnchainAddress]);

  useEffect(() => {
    if (receiveMode === 'spark') {
      fetchSparkAddress();
    } else {
      setSparkAddress(null);
      setSparkError(null);
    }
  }, [receiveMode, fetchSparkAddress]);

  const handleCopyOnchainAddress = useCallback(async () => {
    if (!onchainAddress) return;
    await Clipboard.setStringAsync(onchainAddress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Address copied to clipboard.');
  }, [onchainAddress]);

  const handleCopySparkAddress = useCallback(async () => {
    if (!sparkAddress) return;
    await Clipboard.setStringAsync(sparkAddress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Spark address copied to clipboard.');
  }, [sparkAddress]);

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
        segmentRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
          width: '100%',
          maxWidth: 320,
          alignSelf: 'center',
        },
        segmentButton: {
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: layout.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        segmentButtonActive: {
          backgroundColor: colors.gold.glow,
          borderWidth: 1.5,
          borderColor: colors.gold.pure,
        },
        segmentButtonInactive: {
          backgroundColor: colors.background.secondary,
          borderWidth: 1.5,
          borderColor: 'transparent',
        },
        onchainSection: {
          width: '100%',
          alignItems: 'center',
          gap: spacing.lg,
          paddingVertical: spacing.lg,
        },
        addressText: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.background.secondary,
          borderRadius: layout.radius.md,
          width: '100%',
          maxWidth: 320,
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
            {/* Lightning / On-chain switch */}
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  receiveMode === 'lightning' ? styles.segmentButtonActive : styles.segmentButtonInactive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setReceiveMode('lightning');
                }}
              >
                <Ionicons
                  name="flash"
                  size={18}
                  color={receiveMode === 'lightning' ? colors.gold.pure : colors.text.secondary}
                />
                <Text
                  variant="labelLarge"
                  color={receiveMode === 'lightning' ? colors.gold.pure : colors.text.secondary}
                >
                  Lightning
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  receiveMode === 'onchain' ? styles.segmentButtonActive : styles.segmentButtonInactive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setReceiveMode('onchain');
                }}
              >
                <Ionicons
                  name="link"
                  size={18}
                  color={receiveMode === 'onchain' ? colors.gold.pure : colors.text.secondary}
                />
                <Text
                  variant="labelLarge"
                  color={receiveMode === 'onchain' ? colors.gold.pure : colors.text.secondary}
                >
                  On-chain
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  receiveMode === 'spark' ? styles.segmentButtonActive : styles.segmentButtonInactive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setReceiveMode('spark');
                }}
              >
                <Ionicons
                  name="flash-outline"
                  size={18}
                  color={receiveMode === 'spark' ? colors.gold.pure : colors.text.secondary}
                />
                <Text
                  variant="labelLarge"
                  color={receiveMode === 'spark' ? colors.gold.pure : colors.text.secondary}
                >
                  Spark
                </Text>
              </TouchableOpacity>
            </View>

            {receiveMode === 'onchain' ? (
              /* On-chain address */
              <View style={styles.onchainSection}>
                <Text variant="bodyMedium" color={colors.text.secondary} align="center">
                  Receive Bitcoin to your on-chain address. Funds may take time to confirm and will appear after confirmation.
                </Text>
                {isLoadingOnchain ? (
                  <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.gold.pure} />
                    <Text variant="bodySmall" color={colors.text.muted} style={{ marginTop: spacing.sm }}>
                      Getting address...
                    </Text>
                  </View>
                ) : onchainError ? (
                  <View style={{ alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="bodyMedium" color={colors.status.error}>
                      {onchainError}
                    </Text>
                    <Button title="Retry" variant="secondary" size="sm" onPress={fetchOnchainAddress} />
                  </View>
                ) : onchainAddress ? (
                  <>
                    <QRDisplay value={onchainAddress} label="Scan to send Bitcoin" />
                    <View style={styles.addressText}>
                      <Text variant="bodySmall" color={colors.text.secondary} style={{ fontFamily: 'monospace' }}>
                        {onchainAddress}
                      </Text>
                    </View>
                    <Button
                      title="Copy address"
                      variant="secondary"
                      size="md"
                      onPress={handleCopyOnchainAddress}
                      icon={<Ionicons name="copy-outline" size={18} color={colors.gold.pure} />}
                    />
                  </>
                ) : null}
              </View>
            ) : receiveMode === 'spark' ? (
              /* Spark address */
              <View style={styles.onchainSection}>
                <Text variant="bodyMedium" color={colors.text.secondary} align="center">
                  Receive from other Spark users. Your Spark address is static and can be shared.
                </Text>
                {isLoadingSpark ? (
                  <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.gold.pure} />
                    <Text variant="bodySmall" color={colors.text.muted} style={{ marginTop: spacing.sm }}>
                      Getting Spark address...
                    </Text>
                  </View>
                ) : sparkError ? (
                  <View style={{ alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="bodyMedium" color={colors.status.error}>
                      {sparkError}
                    </Text>
                    <Button title="Retry" variant="secondary" size="sm" onPress={fetchSparkAddress} />
                  </View>
                ) : sparkAddress ? (
                  <>
                    <QRDisplay value={sparkAddress} label="Scan to send via Spark" />
                    <View style={styles.addressText}>
                      <Text variant="bodySmall" color={colors.text.secondary} style={{ fontFamily: 'monospace' }}>
                        {sparkAddress}
                      </Text>
                    </View>
                    <Button
                      title="Copy Spark address"
                      variant="secondary"
                      size="md"
                      onPress={handleCopySparkAddress}
                      icon={<Ionicons name="copy-outline" size={18} color={colors.gold.pure} />}
                    />
                  </>
                ) : null}
              </View>
            ) : !invoice ? (
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
