/**
 * Create Wallet Screen
 * 
 * Generates and displays the recovery phrase.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, Card } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { colors, spacing, layout } from '@/theme';

export default function CreateWalletScreen() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    generateMnemonic();
  }, []);

  const generateMnemonic = async () => {
    try {
      const phrase = await KeychainService.generateSeedPhrase();
      setMnemonic(phrase.split(' '));
    } catch (error) {
      console.error('Failed to generate mnemonic:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!revealed) {
      setRevealed(true);
      return;
    }

    try {
      // Store the seed phrase
      await KeychainService.storeSeedPhrase(mnemonic.join(' '));
      // Continue to backup verification - pass mnemonic for verification
      router.push({
        pathname: '/onboarding/backup',
        params: { mnemonic: mnemonic.join(',') }
      });
    } catch (error) {
      console.error('Failed to store seed:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.gold.pure} />
        <Text variant="bodyMedium" color={colors.text.secondary}>
          Generating your wallet...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="key" size={32} color={colors.gold.pure} />
          </View>
          <Text variant="headlineMedium" color={colors.text.primary} align="center">
            Your Recovery Phrase
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary} align="center">
            Write down these 24 words in order. This is the ONLY way to recover your wallet.
          </Text>
        </View>

        {/* Warning */}
        <Card variant="outlined" style={styles.warningCard}>
          <View style={styles.warningContent}>
            <Ionicons name="warning" size={24} color={colors.status.warning} />
            <View style={styles.warningText}>
              <Text variant="titleSmall" color={colors.status.warning}>
                Important Security Warning
              </Text>
              <Text variant="bodySmall" color={colors.text.secondary}>
                Never share your recovery phrase. Anyone with these words can steal your Bitcoin.
              </Text>
            </View>
          </View>
        </Card>

        {/* Mnemonic grid */}
        <View style={styles.mnemonicContainer}>
          {!revealed ? (
            <View style={styles.blurOverlay}>
              <Ionicons name="eye-off" size={48} color={colors.text.muted} />
              <Text variant="titleMedium" color={colors.text.secondary} align="center">
                Tap "Reveal" to show your recovery phrase
              </Text>
              <Text variant="bodySmall" color={colors.text.muted} align="center">
                Make sure no one is watching your screen
              </Text>
            </View>
          ) : (
            <View style={styles.mnemonicGrid}>
              {mnemonic.map((word, index) => (
                <View key={index} style={styles.wordItem}>
                  <Text variant="labelSmall" color={colors.text.muted}>
                    {index + 1}
                  </Text>
                  <Text variant="titleSmall" color={colors.text.primary}>
                    {word}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Checkboxes */}
        {revealed && (
          <View style={styles.checkboxContainer}>
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
              <Text variant="bodySmall" color={colors.text.secondary}>
                I understand that if I lose this phrase, I lose access to my Bitcoin
              </Text>
            </View>
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
              <Text variant="bodySmall" color={colors.text.secondary}>
                I will store this phrase securely and never share it
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={revealed ? "I've Written It Down" : "Reveal Recovery Phrase"}
          onPress={handleContinue}
          variant="primary"
          size="lg"
        />
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="ghost"
          size="md"
        />
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
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  warningCard: {
    marginBottom: spacing.lg,
    borderColor: colors.status.warning,
  },
  warningContent: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    gap: spacing.xxs,
  },
  mnemonicContainer: {
    minHeight: 320,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  blurOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  wordItem: {
    width: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: layout.radius.sm,
  },
  checkboxContainer: {
    gap: spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background.primary,
  },
});

