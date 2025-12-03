/**
 * Import Wallet Screen
 * 
 * Allows users to import an existing wallet via recovery phrase.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { colors, spacing, layout, typography } from '@/theme';

export default function ImportWalletScreen() {
  const router = useRouter();
  const [words, setWords] = useState<string[]>(Array(24).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value.toLowerCase().trim();
    setWords(newWords);
    setError(null);
  };

  const handlePaste = async (index: number, text: string) => {
    // Check if pasted text contains multiple words
    const pastedWords = text.trim().toLowerCase().split(/\s+/);
    
    if (pastedWords.length > 1) {
      // Populate multiple fields
      const newWords = [...words];
      pastedWords.forEach((word, i) => {
        if (index + i < 24) {
          newWords[index + i] = word;
        }
      });
      setWords(newWords);
    } else {
      handleWordChange(index, text);
    }
  };

  const handleImport = async () => {
    const mnemonic = words.join(' ').trim();
    
    // Validate
    if (words.some((w) => !w)) {
      setError('Please fill in all 24 words');
      return;
    }

    if (!KeychainService.validateSeedPhrase(mnemonic)) {
      setError('Invalid recovery phrase. Please check your words and try again.');
      return;
    }

    setIsLoading(true);
    try {
      await KeychainService.storeSeedPhrase(mnemonic);
      router.push('/onboarding/security');
    } catch (err) {
      setError('Failed to import wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            
            <View style={styles.iconContainer}>
              <Ionicons name="download" size={32} color={colors.gold.pure} />
            </View>
            <Text variant="headlineMedium" color={colors.text.primary} align="center">
              Import Wallet
            </Text>
            <Text variant="bodyMedium" color={colors.text.secondary} align="center">
              Enter your 24-word recovery phrase to restore your wallet
            </Text>
          </View>

          {/* Word inputs */}
          <View style={styles.wordsContainer}>
            {words.map((word, index) => (
              <View key={index} style={styles.wordInput}>
                <Text variant="labelSmall" color={colors.text.muted} style={styles.wordNumber}>
                  {index + 1}
                </Text>
                <TextInput
                  style={styles.input}
                  value={word}
                  onChangeText={(text) => handleWordChange(index, text)}
                  onBlur={() => {}}
                  placeholder="..."
                  placeholderTextColor={colors.text.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType={index < 23 ? 'next' : 'done'}
                  onSubmitEditing={() => {
                    // Focus next input
                  }}
                />
              </View>
            ))}
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={colors.status.error} />
              <Text variant="bodySmall" color={colors.status.error}>
                {error}
              </Text>
            </View>
          )}

          {/* Tip */}
          <View style={styles.tipContainer}>
            <Ionicons name="information-circle" size={20} color={colors.accent.cyan} />
            <Text variant="bodySmall" color={colors.text.secondary}>
              Tip: You can paste your entire recovery phrase and it will automatically fill in all fields
            </Text>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Import Wallet"
            onPress={handleImport}
            variant="primary"
            size="lg"
            loading={isLoading}
            disabled={words.some((w) => !w)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardView: {
    flex: 1,
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
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: spacing.sm,
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
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  wordInput: {
    width: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  wordNumber: {
    width: 20,
  },
  input: {
    flex: 1,
    ...typography.titleSmall,
    color: colors.text.primary,
    padding: spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: `${colors.status.error}15`,
    borderRadius: layout.radius.md,
    marginBottom: spacing.md,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.overlay.light,
    borderRadius: layout.radius.md,
  },
  actions: {
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
  },
});

