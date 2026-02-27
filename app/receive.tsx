/**
 * Receive Payment Screen
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Input, AmountInput } from '@/components/ui';
import { QRDisplay } from '@/components/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import { formatSats } from '@/utils/format';
import type { Invoice } from '@/types/wallet';

function expiryCopy(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const minutes = Math.ceil(ms / 60000);
  return minutes === 1 ? 'Expires in 1 minute' : `Expires in ${minutes} minutes`;
}

export default function ReceiveScreen() {
  const router = useRouter();
  const colors = useColors();
  const { createInvoice, currentInvoice, isCreatingInvoice } = useWalletStore();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
