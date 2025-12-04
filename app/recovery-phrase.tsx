/**
 * Recovery Phrase View Screen
 * 
 * Allows users to view their recovery phrase after authentication.
 * CRITICAL: Requires biometric authentication before revealing.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Card } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { colors, spacing, layout } from '@/theme';

export default function RecoveryPhraseScreen() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authenticateAndLoad();
  }, []);

  const authenticateAndLoad = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Require biometric authentication
      const authenticated = await KeychainService.authenticateBiometric(
        'Authenticate to view recovery phrase'
      );
      
      if (!authenticated) {
        setError('Authentication required to view recovery phrase');
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);
      
      // Get the mnemonic (already authenticated above)
      const phrase = await KeychainService.getMnemonicForBackup(false);
      setMnemonic(phrase.split(' '));
      
    } catch (err) {
      console.error('Failed to load mnemonic:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recovery phrase');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReveal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRevealed(true);
  };

  const handleHide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRevealed(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.gold.pure} />
        <Text variant="bodyMedium" color={colors.text.secondary}>
          Authenticating...
        </Text>
      </View>
    );
  }

  if (error || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color={colors.status.error} />
          </View>
          <Text variant="headlineSmall" color={colors.text.primary} align="center">
            Authentication Required
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary} align="center">
            {error || 'You must authenticate to view your recovery phrase.'}
          </Text>
          <View style={styles.errorActions}>
            <Button
              title="Try Again"
              onPress={authenticateAndLoad}
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
        </View>
      </SafeAreaView>
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
            Recovery Phrase
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary} align="center">
            These 24 words are the ONLY way to recover your wallet. Keep them safe and never share them.
          </Text>
        </View>

        {/* Critical Warning */}
        <Card variant="outlined" style={styles.warningCard}>
          <View style={styles.warningContent}>
            <Ionicons name="warning" size={24} color={colors.status.error} />
            <View style={styles.warningText}>
              <Text variant="titleSmall" color={colors.status.error}>
                Security Warning
              </Text>
              <Text variant="bodySmall" color={colors.text.secondary}>
                Never share your recovery phrase with anyone. Never enter it on any website. Starr will never ask for your recovery phrase.
              </Text>
            </View>
          </View>
        </Card>

        {/* Mnemonic Display */}
        <View style={styles.mnemonicContainer}>
          {!revealed ? (
            <View style={styles.blurOverlay}>
              <Ionicons name="eye-off" size={48} color={colors.text.muted} />
              <Text variant="titleMedium" color={colors.text.secondary} align="center">
                Recovery phrase is hidden
              </Text>
              <Text variant="bodySmall" color={colors.text.muted} align="center">
                Make sure no one is watching your screen before revealing
              </Text>
              <Button
                title="Reveal Phrase"
                onPress={handleReveal}
                variant="secondary"
                size="md"
                icon={<Ionicons name="eye" size={18} color={colors.gold.pure} />}
              />
            </View>
          ) : (
            <View style={styles.revealedContent}>
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
              <Button
                title="Hide Phrase"
                onPress={handleHide}
                variant="ghost"
                size="sm"
                icon={<Ionicons name="eye-off" size={16} color={colors.text.secondary} />}
              />
            </View>
          )}
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text variant="labelMedium" color={colors.text.muted} style={styles.tipsLabel}>
            BACKUP TIPS
          </Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
            <Text variant="bodySmall" color={colors.text.secondary}>
              Write down on paper and store in a secure location
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
            <Text variant="bodySmall" color={colors.text.secondary}>
              Consider using a metal backup plate for fire/water protection
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="close-circle" size={18} color={colors.status.error} />
            <Text variant="bodySmall" color={colors.text.secondary}>
              Never store digitally (screenshots, cloud, notes apps)
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="close-circle" size={18} color={colors.status.error} />
            <Text variant="bodySmall" color={colors.text.secondary}>
              Never share with anyone, including support staff
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Done"
          onPress={() => router.back()}
          variant="primary"
          size="lg"
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorActions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.lg,
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
    borderColor: colors.status.error,
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
    paddingVertical: spacing.xl,
  },
  revealedContent: {
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
  tipsContainer: {
    gap: spacing.sm,
  },
  tipsLabel: {
    marginBottom: spacing.xs,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});

