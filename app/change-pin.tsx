/**
 * Change PIN Screen
 * 
 * Allows users to set up or change their wallet PIN.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, Button } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';

type Step = 'current' | 'new' | 'confirm';

const PIN_LENGTH = 6;

export default function ChangePINScreen() {
  const router = useRouter();
  const colors = useColors();
  const [step, setStep] = useState<Step>('current');
  const [currentPIN, setCurrentPIN] = useState('');
  const [newPIN, setNewPIN] = useState('');
  const [confirmPIN, setConfirmPIN] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasExistingPIN, setHasExistingPIN] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    checkExistingPIN();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        hiddenInput: { position: 'absolute', opacity: 0, height: 0 },
        content: { flex: 1, paddingHorizontal: spacing.lg },
        header: {
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.xl,
          marginBottom: spacing.xl,
        },
        backButton: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.overlay.light,
          alignItems: 'center',
          justifyContent: 'center',
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
        pinContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing.md,
          marginBottom: spacing.lg,
        },
        pinDot: {
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: colors.background.tertiary,
          borderWidth: 2,
          borderColor: colors.border.subtle,
        },
        pinDotFilled: {
          backgroundColor: colors.gold.pure,
          borderColor: colors.gold.pure,
        },
        pinDotError: { borderColor: colors.status.error },
        errorContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          marginBottom: spacing.md,
        },
        stepIndicator: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          marginBottom: spacing.xl,
        },
        stepDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.background.tertiary,
        },
        stepDotActive: { backgroundColor: colors.gold.pure },
        stepLine: {
          width: 32,
          height: 2,
          backgroundColor: colors.background.tertiary,
        },
        stepLineActive: { backgroundColor: colors.gold.pure },
        numpad: {
          flex: 1,
          justifyContent: 'center',
          maxHeight: 320,
        },
        numpadRow: { flexDirection: 'row', justifyContent: 'center' },
        numpadKey: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          margin: spacing.sm,
        },
        numpadKeyEmpty: { width: 72, height: 72, margin: spacing.sm },
      }),
    [colors]
  );

  const checkExistingPIN = async () => {
    const state = await KeychainService.getState();
    setHasExistingPIN(state.hasPin);
    // If no existing PIN, skip to 'new' step
    if (!state.hasPin) {
      setStep('new');
    }
  };

  const getCurrentPIN = () => {
    switch (step) {
      case 'current': return currentPIN;
      case 'new': return newPIN;
      case 'confirm': return confirmPIN;
    }
  };

  const setCurrentPINValue = (value: string) => {
    switch (step) {
      case 'current': setCurrentPIN(value); break;
      case 'new': setNewPIN(value); break;
      case 'confirm': setConfirmPIN(value); break;
    }
  };

  const handlePINChange = async (value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setCurrentPINValue(digitsOnly);
    setError(null);

    // Auto-submit when PIN is complete
    if (digitsOnly.length === PIN_LENGTH) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await handlePINComplete(digitsOnly);
    }
  };

  const handlePINComplete = async (pin: string) => {
    switch (step) {
      case 'current':
        // Verify current PIN
        const isValid = await KeychainService.verifyPin(pin);
        if (isValid) {
          setStep('new');
          setCurrentPIN('');
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError('Incorrect PIN. Please try again.');
          setCurrentPIN('');
        }
        break;

      case 'new':
        // Move to confirm step
        setStep('confirm');
        break;

      case 'confirm':
        // Verify PINs match
        if (pin === newPIN) {
          await savePIN(pin);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError('PINs do not match. Please try again.');
          setNewPIN('');
          setConfirmPIN('');
          setStep('new');
        }
        break;
    }
  };

  const savePIN = async (pin: string) => {
    try {
      await KeychainService.setupPin(pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'PIN Updated',
        hasExistingPIN ? 'Your PIN has been changed successfully.' : 'Your PIN has been set successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      console.error('Failed to save PIN:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save PIN. Please try again.');
    }
  };

  const handleKeyPress = (digit: string) => {
    const current = getCurrentPIN();
    if (current.length < PIN_LENGTH) {
      handlePINChange(current + digit);
    }
  };

  const handleBackspace = () => {
    const current = getCurrentPIN();
    if (current.length > 0) {
      setCurrentPINValue(current.slice(0, -1));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'current': return 'Enter Current PIN';
      case 'new': return hasExistingPIN ? 'Enter New PIN' : 'Create PIN';
      case 'confirm': return 'Confirm PIN';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'current': return 'Enter your current PIN to continue';
      case 'new': return 'Choose a 6-digit PIN to protect your wallet';
      case 'confirm': return 'Enter your new PIN again to confirm';
    }
  };

  const pinValue = getCurrentPIN();

  return (
    <SafeAreaView style={styles.container}>
      {/* Hidden input for keyboard */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={pinValue}
        onChangeText={handlePINChange}
        keyboardType="number-pad"
        maxLength={PIN_LENGTH}
        autoFocus
      />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={32} color={colors.gold.pure} />
          </View>
          <Text variant="headlineMedium" color={colors.text.primary} align="center">
            {getStepTitle()}
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary} align="center">
            {getStepSubtitle()}
          </Text>
        </View>

        {/* PIN Display */}
        <TouchableOpacity 
          style={styles.pinContainer}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={1}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                index < pinValue.length && styles.pinDotFilled,
                error && styles.pinDotError,
              ]}
            />
          ))}
        </TouchableOpacity>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.status.error} />
            <Text variant="bodySmall" color={colors.status.error}>
              {error}
            </Text>
          </View>
        )}

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step !== 'current' && styles.stepDotActive]} />
          <View style={[styles.stepLine, step === 'confirm' && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
        </View>

        {/* Numpad */}
        <View style={styles.numpad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.numpadRow}>
              {row.map((key) => {
                if (key === '') {
                  return <View key={key} style={styles.numpadKeyEmpty} />;
                }
                if (key === 'delete') {
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.numpadKey}
                      onPress={handleBackspace}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="backspace" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.numpadKey}
                    onPress={() => handleKeyPress(key)}
                    activeOpacity={0.7}
                  >
                    <Text variant="headlineMedium" color={colors.text.primary}>
                      {key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

