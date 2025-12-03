/**
 * Backup Verification Screen
 * 
 * Verifies the user has written down their recovery phrase.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
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
    setCorrectWords(indices.map((i) => mockMnemonic[i]));

    // Generate options with correct answers plus decoys
    const allOptions = new Set<string>();
    indices.forEach((i) => allOptions.add(mockMnemonic[i]));
    
    // Add random decoys
    const decoys = [
      'apple', 'banana', 'cherry', 'dragon', 'eagle', 'falcon',
      'grape', 'honey', 'island', 'jungle', 'karma', 'lemon',
    ];
    while (allOptions.size < 9) {
      const decoy = decoys[Math.floor(Math.random() * decoys.length)];
      allOptions.add(decoy);
    }
    
    setOptions([...allOptions].sort(() => Math.random() - 0.5));
  }, []);

  const handleWordSelect = (word: string) => {
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter((w) => w !== word));
    } else if (selectedWords.length < 3) {
      setSelectedWords([...selectedWords, word]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setError(null);
  };

  const handleVerify = () => {
    // Check if selected words match in order
    const isCorrect = selectedWords.every((word, i) => word === correctWords[i]);
    
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/onboarding/security');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Incorrect words. Please check your recovery phrase and try again.');
      setSelectedWords([]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={32} color={colors.gold.pure} />
          </View>
          <Text variant="headlineMedium" color={colors.text.primary} align="center">
            Verify Your Backup
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary} align="center">
            Select the correct words in order to verify you've saved your recovery phrase
          </Text>
        </View>

        {/* Word prompts */}
        <View style={styles.promptsContainer}>
          {correctIndices.map((index, i) => (
            <View key={index} style={styles.promptItem}>
              <View style={styles.promptNumber}>
                <Text variant="labelMedium" color={colors.text.muted}>
                  Word #{index + 1}
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
                    Select word...
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Word options */}
        <View style={styles.optionsContainer}>
          {options.map((word) => {
            const isSelected = selectedWords.includes(word);
            return (
              <TouchableOpacity
                key={word}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionButtonSelected,
                ]}
                onPress={() => handleWordSelect(word)}
                disabled={selectedWords.length >= 3 && !isSelected}
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
                      {selectedWords.indexOf(word) + 1}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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
      </View>

      {/* Actions */}
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
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
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
  promptsContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  promptItem: {
    gap: spacing.xs,
  },
  promptNumber: {},
  promptSlot: {
    height: 52,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.md,
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: colors.border.subtle,
    position: 'relative',
  },
  optionButtonSelected: {
    borderColor: colors.gold.pure,
    backgroundColor: colors.gold.glow,
  },
  selectedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold.pure,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    marginTop: spacing.lg,
    borderColor: colors.status.error,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
  },
});

