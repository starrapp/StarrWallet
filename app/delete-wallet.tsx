/**
 * Delete Wallet Screen
 * 
 * Allows users to permanently delete their wallet.
 * CRITICAL: This action is irreversible and will delete all wallet data.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Card } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { BreezService } from '@/services/breez';
import { colors, spacing, layout } from '@/theme';

const CONFIRMATION_TEXT = 'DELETE';

export default function DeleteWalletScreen() {
  const router = useRouter();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [step, setStep] = useState<'warning' | 'confirm'>('warning');

  const handleProceedToConfirm = async () => {
    // Require biometric authentication first
    const authenticated = await KeychainService.authenticateBiometric(
      'Authenticate to delete wallet'
    );
    
    if (!authenticated) {
      Alert.alert('Authentication Failed', 'You must authenticate to delete your wallet.');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('confirm');
  };

  const handleDeleteWallet = async () => {
    if (confirmationInput !== CONFIRMATION_TEXT) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Incorrect', `Please type "${CONFIRMATION_TEXT}" to confirm deletion.`);
      return;
    }

    try {
      setIsDeleting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Shutdown Breez SDK first
      try {
        await BreezService.shutdown();
      } catch (err) {
        console.log('[DeleteWallet] Breez shutdown (may already be stopped):', err);
      }

      // Clear all keychain data
      await KeychainService.clearAllData();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate to onboarding
      router.replace('/onboarding');
      
    } catch (error) {
      console.error('Failed to delete wallet:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Deletion Failed',
        'Failed to delete wallet data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDeleting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.status.error} />
        <Text variant="bodyMedium" color={colors.text.secondary}>
          Deleting wallet...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="trash" size={32} color={colors.status.error} />
          </View>
          <Text variant="headlineMedium" color={colors.status.error} align="center">
            Delete Wallet
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary} align="center">
            This action is permanent and cannot be undone.
          </Text>
        </View>

        {step === 'warning' ? (
          <>
            {/* Warning Cards */}
            <Card variant="outlined" style={styles.dangerCard}>
              <View style={styles.cardContent}>
                <Ionicons name="warning" size={24} color={colors.status.error} />
                <View style={styles.cardText}>
                  <Text variant="titleSmall" color={colors.status.error}>
                    You Will Lose Access Forever
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary}>
                    If you haven't backed up your recovery phrase, all your Bitcoin will be permanently lost.
                  </Text>
                </View>
              </View>
            </Card>

            <Card variant="outlined" style={styles.warningCard}>
              <View style={styles.cardContent}>
                <Ionicons name="key" size={24} color={colors.status.warning} />
                <View style={styles.cardText}>
                  <Text variant="titleSmall" color={colors.status.warning}>
                    Check Your Backup First
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary}>
                    Before deleting, make sure you have your 24-word recovery phrase written down and stored safely.
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.checklist}>
              <Text variant="labelMedium" color={colors.text.muted} style={styles.checklistLabel}>
                BEFORE YOU CONTINUE:
              </Text>
              <View style={styles.checkItem}>
                <Ionicons name="checkbox-outline" size={20} color={colors.text.secondary} />
                <Text variant="bodySmall" color={colors.text.secondary}>
                  I have backed up my recovery phrase
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="checkbox-outline" size={20} color={colors.text.secondary} />
                <Text variant="bodySmall" color={colors.text.secondary}>
                  I understand this action is irreversible
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="checkbox-outline" size={20} color={colors.text.secondary} />
                <Text variant="bodySmall" color={colors.text.secondary}>
                  I know I can restore my wallet using my recovery phrase
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Confirmation Step */}
            <Card variant="outlined" style={styles.dangerCard}>
              <View style={styles.cardContent}>
                <Ionicons name="alert-circle" size={24} color={colors.status.error} />
                <View style={styles.cardText}>
                  <Text variant="titleSmall" color={colors.status.error}>
                    Final Warning
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary}>
                    Type "{CONFIRMATION_TEXT}" below to confirm you want to permanently delete your wallet.
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.inputContainer}>
              <Text variant="labelMedium" color={colors.text.muted} style={styles.inputLabel}>
                TYPE "{CONFIRMATION_TEXT}" TO CONFIRM:
              </Text>
              <TextInput
                style={styles.input}
                value={confirmationInput}
                onChangeText={setConfirmationInput}
                placeholder={CONFIRMATION_TEXT}
                placeholderTextColor={colors.text.muted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        {step === 'warning' ? (
          <>
            <Button
              title="I Understand, Continue"
              onPress={handleProceedToConfirm}
              variant="primary"
              size="lg"
              style={styles.dangerButton}
            />
            <Button
              title="Cancel"
              onPress={() => router.back()}
              variant="ghost"
              size="md"
            />
          </>
        ) : (
          <>
            <Button
              title="Delete Wallet Permanently"
              onPress={handleDeleteWallet}
              variant="primary"
              size="lg"
              disabled={confirmationInput !== CONFIRMATION_TEXT}
              style={styles.dangerButton}
            />
            <Button
              title="Go Back"
              onPress={() => setStep('warning')}
              variant="ghost"
              size="md"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.status.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dangerCard: {
    marginBottom: spacing.md,
    borderColor: colors.status.error,
  },
  warningCard: {
    marginBottom: spacing.lg,
    borderColor: colors.status.warning,
  },
  cardContent: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  cardText: {
    flex: 1,
    gap: spacing.xxs,
  },
  checklist: {
    gap: spacing.sm,
  },
  checklistLabel: {
    marginBottom: spacing.xs,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputContainer: {
    gap: spacing.sm,
  },
  inputLabel: {
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.md,
    borderWidth: 1.5,
    borderColor: colors.status.error,
    padding: spacing.md,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  dangerButton: {
    backgroundColor: colors.status.error,
  },
});

