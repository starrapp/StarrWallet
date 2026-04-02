/**
 * Create Wallet Screen
 * 
 * Generates and displays the recovery phrase.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, Card } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { setMnemonic as setOnboardingMnemonic } from '@/stores/onboardingStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';

export default function CreateWalletScreen() {
  const router = useRouter();
  const colors = useColors();
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [hasAcknowledgedLoss, setHasAcknowledgedLoss] = useState(false);
  const [hasAcknowledgedStorage, setHasAcknowledgedStorage] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        loadingContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          backgroundColor: colors.background.primary,
        },
        scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
        header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
        iconContainer: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.gold.glow,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        },
        warningCard: { marginBottom: spacing.lg, borderColor: colors.status.warning },
        warningContent: {
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
        },
        warningText: { flex: 1, gap: spacing.xxs },
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
        checkboxContainer: { gap: spacing.sm },
        checkItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.background.secondary,
          borderRadius: layout.radius.md,
          padding: spacing.sm,
        },
        actions: {
          padding: spacing.lg,
          gap: spacing.md,
          backgroundColor: colors.background.primary,
        },
      }),
    [colors]
  );

  useEffect(() => {
    generateMnemonic();
  }, []);

  const generateMnemonic = async () => {
    try {
      const phrase = await KeychainService.generateMnemonic();
      setMnemonic(phrase.split(' '));
    } catch (error) {
      console.error('Failed to generate mnemonic:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    if (!hasAcknowledgedLoss || !hasAcknowledgedStorage) return;

    setOnboardingMnemonic(mnemonic);
    router.push('/onboarding/backup');
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
                Tap &quot;Reveal&quot; to show your recovery phrase
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
            <TouchableOpacity
              style={styles.checkItem}
              onPress={() => setHasAcknowledgedLoss((current) => !current)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasAcknowledgedLoss }}
            >
              <Ionicons
                name={hasAcknowledgedLoss ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={hasAcknowledgedLoss ? colors.status.success : colors.text.muted}
              />
              <Text variant="bodySmall" color={colors.text.secondary}>
                I understand that if I lose this phrase, I lose access to my Bitcoin
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.checkItem}
              onPress={() => setHasAcknowledgedStorage((current) => !current)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasAcknowledgedStorage }}
            >
              <Ionicons
                name={hasAcknowledgedStorage ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={hasAcknowledgedStorage ? colors.status.success : colors.text.muted}
              />
              <Text variant="bodySmall" color={colors.text.secondary}>
                I will store this phrase securely and never share it
              </Text>
            </TouchableOpacity>
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
          disabled={revealed && (!hasAcknowledgedLoss || !hasAcknowledgedStorage)}
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

