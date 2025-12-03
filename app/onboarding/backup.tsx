/**
 * Backup Verification Screen
 * 
 * Verifies the user has written down their recovery phrase.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Card } from '@/components/ui';
import { colors, spacing, layout } from '@/theme';

export default function BackupVerificationScreen() {
  const router = useRouter();
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndices, setCorrectIndices] = useState<number[]>([]);
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mock mnemonic - in production, get from secure storage
  const mockMnemonic = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent',
    'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
    'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire',
    'across', 'act', 'action', 'actor', 'actress', 'actual',
  ];

  useEffect(() => {
    // Select 3 random indices to verify
    const indices: number[] = [];
    while (indices.length < 3) {
      const idx = Math.floor(Math.random() * 24);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }
    indices.sort((a, b) => a - b);
    setCorrectIndices(indices);
    
    const correct = indices.map((i) => mockMnemonic[i]);
    setCorrectWords(correct);

    // Generate options: include correct words + random decoys
    const allOptions = new Set<string>(correct);
    
    // Add more words from the mnemonic as decoys (more realistic)
    const otherWords = mockMnemonic.filter((_, i) => !indices.includes(i));
    while (allOptions.size < 9 && otherWords.length > 0) {
      const randomIdx = Math.floor(Math.random() * otherWords.length);
      allOptions.add(otherWords[randomIdx]);
      otherWords.splice(randomIdx, 1);
    }
    
    // Shuffle the options
    const shuffled = [...allOptions].sort(() => Math.random() - 0.5);
    setOptions(shuffled);
  }, []);

  const handleWordSelect = (word: string) => {
    if (selectedWords.includes(word)) {
      // Deselect the word
      setSelectedWords(selectedWords.filter((w) => w !== word));
    } else if (selectedWords.length < 3) {
      // Select the word
      setSelectedWords([...selectedWords, word]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setError(null);
  };

  const handleVerify = () => {
    // Check if selected words match in order
    const isCorrect = selectedWords.length === 3 && 
      selectedWords.every((word, i) => word === correctWords[i]);
    
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/onboarding/security');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Incorrect words or wrong order. Please check your recovery phrase and try again.');
      setSelectedWords([]);
    }
  };

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
            SELECT THESE WORDS IN ORDER:
          </Text>
          {correctIndices.map((index, i) => (
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
            CHOOSE FROM THESE WORDS:
          </Text>
          <View style={styles.optionsContainer}>
            {options.map((word) => {
              const isSelected = selectedWords.includes(word);
              const selectionOrder = selectedWords.indexOf(word) + 1;
              return (
                <TouchableOpacity
                  key={word}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleWordSelect(word)}
                  activeOpacity={0.7}
                >
                  <Text
                    variant="titleSmall"
                    color={isSelected ? colors.gold.pure : colors.text.primary}
                  >
                    {word}
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
          disabled={selectedWords.length < 3}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
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
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  promptsContainer: {
    marginBottom: spacing.lg,
  },
  promptItem: {
    marginBottom: spacing.sm,
  },
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
  optionsSection: {
    marginBottom: spacing.lg,
  },
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
  errorCard: {
    marginBottom: spacing.md,
    borderColor: colors.status.error,
  },
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
});
