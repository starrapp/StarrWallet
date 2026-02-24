/**
 * Security Setup Screen
 * 
 * Configure biometric authentication and backup settings.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Text, Card } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { BackupService } from '@/services/backup';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';

export default function SecuritySetupScreen() {
  const router = useRouter();
  const colors = useColors();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const { available, type } = await KeychainService.isBiometricAvailable();
    setBiometricAvailable(available);
    setBiometricType(type);
  };

  const handleBiometricToggle = async () => {
    if (biometricEnabled) {
      setBiometricEnabled(false);
      return;
    }

    const success = await KeychainService.enableBiometric();
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBiometricEnabled(true);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Enable auto-backup if selected
      if (autoBackupEnabled) {
        await BackupService.enableAutoBackup('local');
      }

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Setup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getBiometricIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (biometricType) {
      case 'face':
        return 'scan';
      case 'fingerprint':
        return 'finger-print';
      default:
        return 'lock-closed';
    }
  };

  const getBiometricLabel = (): string => {
    switch (biometricType) {
      case 'face':
        return 'Face ID';
      case 'fingerprint':
        return 'Touch ID / Fingerprint';
      default:
        return 'Biometric Authentication';
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        content: { flex: 1, padding: spacing.lg },
        header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
        iconContainer: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.gold.glow,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        },
        optionsContainer: { gap: spacing.md, marginBottom: spacing.xl },
        optionCard: { padding: spacing.md },
        optionContent: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        optionIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.overlay.light,
          alignItems: 'center',
          justifyContent: 'center',
        },
        optionText: { flex: 1, gap: spacing.xxs },
        recommendedContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.sm,
        },
        infoCard: { padding: spacing.md },
        infoContent: {
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
        },
        infoText: { flex: 1, gap: spacing.xs },
        actions: { padding: spacing.lg, gap: spacing.md },
      }),
    [colors]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={32} color={colors.gold.pure} />
          </View>
          <Text variant="headlineMedium" color={colors.text.primary} align="center">
            Secure Your Wallet
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary} align="center">
            Add extra layers of security to protect your funds
          </Text>
        </View>

        {/* Security options */}
        <View style={styles.optionsContainer}>
          {/* Biometric */}
          {biometricAvailable && (
            <Card variant="default" style={styles.optionCard}>
              <View style={styles.optionContent}>
                <View style={styles.optionIcon}>
                  <Ionicons
                    name={getBiometricIcon()}
                    size={24}
                    color={colors.gold.pure}
                  />
                </View>
                <View style={styles.optionText}>
                  <Text variant="titleSmall" color={colors.text.primary}>
                    {getBiometricLabel()}
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary}>
                    Use biometrics to unlock your wallet and authorize payments
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{
                    false: colors.background.tertiary,
                    true: colors.gold.muted,
                  }}
                  thumbColor={biometricEnabled ? colors.gold.pure : colors.text.muted}
                />
              </View>
            </Card>
          )}

          {/* Auto backup */}
          <Card variant="default" style={styles.optionCard}>
            <View style={styles.optionContent}>
              <View style={styles.optionIcon}>
                <Ionicons name="cloud-upload" size={24} color={colors.accent.cyan} />
              </View>
              <View style={styles.optionText}>
                <Text variant="titleSmall" color={colors.text.primary}>
                  Automatic Backups
                </Text>
                <Text variant="bodySmall" color={colors.text.secondary}>
                  Keep your channel state backed up automatically
                </Text>
              </View>
              <Switch
                value={autoBackupEnabled}
                onValueChange={setAutoBackupEnabled}
                trackColor={{
                  false: colors.background.tertiary,
                  true: colors.accent.cyan + '80',
                }}
                thumbColor={autoBackupEnabled ? colors.accent.cyan : colors.text.muted}
              />
            </View>
          </Card>

          {/* Recommended badge */}
          <View style={styles.recommendedContainer}>
            <Ionicons name="star" size={16} color={colors.gold.pure} />
            <Text variant="labelMedium" color={colors.gold.pure}>
              Recommended settings enabled
            </Text>
          </View>
        </View>

        {/* Info card */}
        <Card variant="outlined" style={styles.infoCard}>
          <View style={styles.infoContent}>
            <Ionicons name="information-circle" size={24} color={colors.accent.cyan} />
            <View style={styles.infoText}>
              <Text variant="titleSmall" color={colors.text.primary}>
                Why are backups critical?
              </Text>
              <Text variant="bodySmall" color={colors.text.secondary}>
                Lightning channels require up-to-date state backups. Without them, 
                you could lose funds if your device is lost or damaged. Starr 
                automatically backs up your channel state to keep your funds safe.
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Complete Setup"
          onPress={handleComplete}
          variant="primary"
          size="lg"
          loading={isLoading}
        />
        <Button
          title="Skip for Now"
          onPress={handleComplete}
          variant="ghost"
          size="md"
        />
      </View>
    </SafeAreaView>
  );
}

