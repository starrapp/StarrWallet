/**
 * Backup Verification Screen
 * 
 * Verifies the user has written down their recovery phrase.
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Card } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { useWalletStore } from '@/stores/walletStore';
import { consumeMnemonic } from '@/stores/onboardingStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BackupVerificationScreen() {
  const router = useRouter();
  const colors = useColors();
  const [mnemonic] = useState<string[]>(() => consumeMnemonic() ?? []);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [puzzle] = useState(() => {
    if (mnemonic.length !== 24) return null;
    const shuffled = shuffle(mnemonic.map((_, i) => i));
    const indices = shuffled.slice(0, 3).sort((a, b) => a - b);
    const options = shuffle(
      shuffled.slice(0, 9).map((i) => ({ id: i, word: mnemonic[i] })),
    );
    return { indices, options };
  });

  const handleOptionSelect = (optionId: number) => {
    if (selectedOptionIds.includes(optionId)) {
      setSelectedOptionIds(selectedOptionIds.filter((id) => id !== optionId));
    } else if (selectedOptionIds.length < 3) {
      setSelectedOptionIds([...selectedOptionIds, optionId]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setError(null);
  };

  const selectedWords = selectedOptionIds.map((id) => puzzle!.options.find((o) => o.id === id)?.word ?? '');

  const handleVerify = async () => {
    const isCorrect = selectedWords.length === 3 &&
      selectedWords.every((word, i) => word === mnemonic[puzzle!.indices[i]]);

    if (isCorrect) {
      try {
        const phrase = mnemonic.join(' ');
        await KeychainService.storeMnemonic(phrase);
        await useWalletStore.getState().initializeWallet(phrase);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } catch {
        setError('Failed to save wallet. Please try again.');
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Incorrect words or wrong order. Please check your recovery phrase and try again.');
      setSelectedOptionIds([]);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        scrollView: { flex: 1 },
        scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl },
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
        sectionLabel: { marginBottom: spacing.sm },
        promptsContainer: { marginBottom: spacing.lg },
        promptItem: { marginBottom: spacing.sm },
        promptRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        promptNumber: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.gold.glow,
          alignItems: 'center',
          justifyContent: 'center',
        },
        promptSlot: {
          flex: 1,
          height: 48,
          backgroundColor: colors.background.secondary,
          borderRadius: layout.radius.md,
          borderWidth: 1.5,
          borderColor: colors.border.subtle,
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
        },
        promptSlotFilled: {
          borderColor: colors.gold.pure,
          borderStyle: 'solid',
          backgroundColor: colors.gold.glow,
        },
        optionsSection: { marginBottom: spacing.lg },
        optionsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        optionButton: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.background.secondary,
          borderRadius: layout.radius.md,
          borderWidth: 1.5,
          borderColor: colors.border.subtle,
          position: 'relative',
          minWidth: 80,
          alignItems: 'center',
        },
        optionButtonSelected: {
          borderColor: colors.gold.pure,
          backgroundColor: colors.gold.glow,
        },
        selectedBadge: {
          position: 'absolute',
          top: -10,
          right: -10,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.gold.pure,
          alignItems: 'center',
          justifyContent: 'center',
        },
        errorCard: { marginBottom: spacing.md, borderColor: colors.status.error },
        errorContent: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        hintContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.md,
        },
        actions: {
          padding: spacing.lg,
          paddingTop: spacing.md,
          gap: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
          backgroundColor: colors.background.primary,
        },
      }),
    [colors]
  );

  if (!puzzle) {
    router.back();
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={32} color={colors.gold.pure} />
          </View>
          <Text variant="headlineMedium" color={colors.text.primary} align="center">
            Verify Your Backup
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary} align="center">
            Select the correct words in the order shown to verify you've saved your recovery phrase
          </Text>
        </View>

        {/* Word prompts - what we're asking for */}
        <View style={styles.promptsContainer}>
          <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
            Select these words in order:
          </Text>
          {puzzle.indices.map((index, i) => (
            <View key={index} style={styles.promptItem}>
              <View style={styles.promptRow}>
                <View style={styles.promptNumber}>
                  <Text variant="titleSmall" color={colors.gold.pure}>
                    #{index + 1}
                  </Text>
                </View>
                <View style={[
                  styles.promptSlot,
                  selectedWords[i] && styles.promptSlotFilled,
                ]}>
                  {selectedWords[i] ? (
                    <Text variant="titleMedium" color={colors.gold.pure}>
                      {selectedWords[i]}
                    </Text>
                  ) : (
                    <Text variant="bodyMedium" color={colors.text.muted}>
                      Tap a word below...
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Word options to choose from */}
        <View style={styles.optionsSection}>
          <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
            Choose from these words:
          </Text>
          <View style={styles.optionsContainer}>
            {puzzle.options.map((option) => {
              const isSelected = selectedOptionIds.includes(option.id);
              const selectionOrder = selectedOptionIds.indexOf(option.id) + 1;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleOptionSelect(option.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    variant="titleSmall"
                    color={isSelected ? colors.gold.pure : colors.text.primary}
                  >
                    {option.word}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Text variant="labelSmall" color={colors.background.primary}>
                        {selectionOrder}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Error */}
        {error && (
          <Card variant="outlined" style={styles.errorCard}>
            <View style={styles.errorContent}>
              <Ionicons name="alert-circle" size={20} color={colors.status.error} />
              <Text variant="bodySmall" color={colors.status.error}>
                {error}
              </Text>
            </View>
          </Card>
        )}

        {/* Hint */}
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle" size={16} color={colors.text.muted} />
          <Text variant="bodySmall" color={colors.text.muted}>
            Tap words in the correct order. Tap again to deselect.
          </Text>
        </View>
      </ScrollView>

      {/* Actions - Fixed at bottom */}
      <View style={styles.actions}>
        <Button
          title="Verify & Continue"
          onPress={handleVerify}
          variant="primary"
          size="lg"
          disabled={selectedOptionIds.length < 3}
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
