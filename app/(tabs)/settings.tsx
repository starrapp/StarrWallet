/**
 * Settings Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Text, Card } from '@/components/ui';
import { KeychainService } from '@/services/keychain';
import { BackupService } from '@/services/backup';
import { useWalletStore } from '@/stores/walletStore';
import { useTheme } from '@/contexts';
import { colors, spacing, layout } from '@/theme';

// Currency options
const BITCOIN_UNITS = [
  { value: 'BTC', label: 'Bitcoin', symbol: '₿', description: 'Display as BTC (0.00100000)' },
  { value: 'SATS', label: 'Satoshis', symbol: 'sats', description: 'Display as sats (100,000)' },
];

const FIAT_CURRENCIES = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { value: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { value: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { value: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { value: 'MXN', label: 'Mexican Peso', symbol: '$' },
  { value: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
  { value: 'KRW', label: 'South Korean Won', symbol: '₩' },
];

// External links - replace these with your actual URLs
const EXTERNAL_LINKS = {
  TERMS: 'https://starr.app/terms',
  PRIVACY: 'https://starr.app/privacy',
  SUPPORT: 'https://starr.app/support',
  GITHUB: 'https://github.com/starr-wallet/starr',
};

// Get app version from expo constants
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings, performBackup, backupState } = useWalletStore();
  const { mode: themeMode, setMode: setThemeMode, isDark } = useTheme();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const { available, type } = await KeychainService.isBiometricAvailable();
    setBiometricAvailable(available);
    setBiometricType(type);
  };

  const handleBiometricToggle = async () => {
    if (settings.biometricEnabled) {
      updateSettings({ biometricEnabled: false });
    } else {
      const success = await KeychainService.enableBiometric();
      if (success) {
        updateSettings({ biometricEnabled: true });
      }
    }
  };

  const handleBackupNow = async () => {
    try {
      await performBackup();
      Alert.alert('Backup Complete', 'Your wallet has been backed up successfully.');
    } catch (error) {
      Alert.alert('Backup Failed', 'Failed to create backup. Please try again.');
    }
  };

  const handleShowRecoveryPhrase = () => {
    Alert.alert(
      'View Recovery Phrase',
      'You will need to authenticate to view your recovery phrase. Never share it with anyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => router.push('/recovery-phrase') },
      ]
    );
  };

  const handleCurrencySelect = (currency: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings({ currency: currency as any });
    setShowCurrencyModal(false);
  };

  const getBiometricIcon = (): keyof typeof Ionicons.glyphMap => {
    return biometricType === 'face' ? 'scan' : 'finger-print';
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Never';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getCurrencyDisplayName = () => {
    const btcUnit = BITCOIN_UNITS.find(u => u.value === settings.currency);
    if (btcUnit) return btcUnit.label;
    const fiat = FIAT_CURRENCIES.find(c => c.value === settings.currency);
    if (fiat) return fiat.label;
    return settings.currency;
  };

  const openExternalLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open this link.');
      }
    } catch (error) {
      console.error('Failed to open link:', error);
      Alert.alert('Error', 'Failed to open link.');
    }
  };

  const handleAbout = () => {
    Alert.alert(
      'About Starr',
      `Version ${APP_VERSION}\n\nStarr is a non-custodial Lightning wallet built for simplicity and security.\n\nPowered by Breez SDK.`,
      [
        { text: 'View on GitHub', onPress: () => openExternalLink(EXTERNAL_LINKS.GITHUB) },
        { text: 'OK' },
      ]
    );
  };

  const handleSupport = () => {
    Alert.alert(
      'Get Support',
      'How would you like to get help?',
      [
        { text: 'Visit Support Page', onPress: () => openExternalLink(EXTERNAL_LINKS.SUPPORT) },
        { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@starr.app') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" color={colors.text.primary}>
            Settings
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Security Section */}
          <View style={styles.section}>
            <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
              SECURITY
            </Text>

            {biometricAvailable && (
              <SettingsItem
                icon={getBiometricIcon()}
                title={biometricType === 'face' ? 'Face ID' : 'Touch ID'}
                subtitle="Use biometrics to unlock wallet"
                trailing={
                  <Switch
                    value={settings.biometricEnabled}
                    onValueChange={handleBiometricToggle}
                    trackColor={{ false: colors.background.tertiary, true: colors.gold.muted }}
                    thumbColor={settings.biometricEnabled ? colors.gold.pure : colors.text.muted}
                  />
                }
              />
            )}

            <SettingsItem
              icon="key"
              title="Recovery Phrase"
              subtitle="View your 24-word backup"
              onPress={handleShowRecoveryPhrase}
            />

            <SettingsItem
              icon="lock-closed"
              title="Change PIN"
              subtitle="Update your wallet PIN"
              onPress={() => router.push('/change-pin')}
            />
          </View>

          {/* Backup Section */}
          <View style={styles.section}>
            <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
              BACKUP
            </Text>

            <SettingsItem
              icon="cloud-upload"
              title="Auto Backup"
              subtitle="Keep channel state backed up"
              trailing={
                <Switch
                  value={settings.autoBackupEnabled}
                  onValueChange={(v) => updateSettings({ autoBackupEnabled: v })}
                  trackColor={{ false: colors.background.tertiary, true: colors.accent.cyan + '80' }}
                  thumbColor={settings.autoBackupEnabled ? colors.accent.cyan : colors.text.muted}
                />
              }
            />

            <SettingsItem
              icon="download"
              title="Backup Now"
              subtitle={`Last backup: ${formatDate(backupState?.lastBackup)}`}
              onPress={handleBackupNow}
            />
          </View>

          {/* Display Section */}
          <View style={styles.section}>
            <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
              DISPLAY
            </Text>

            <SettingsItem
              icon="cash"
              title="Currency"
              subtitle={getCurrencyDisplayName()}
              onPress={() => setShowCurrencyModal(true)}
            />

            <SettingsItem
              icon={isDark ? 'moon' : 'sunny'}
              title="Theme"
              subtitle={themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light'}
              onPress={() => setShowThemeModal(true)}
            />
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
              ABOUT
            </Text>

            <SettingsItem
              icon="information-circle"
              title="About Starr"
              subtitle={`Version ${APP_VERSION}`}
              onPress={handleAbout}
            />

            <SettingsItem
              icon="document-text"
              title="Terms of Service"
              onPress={() => openExternalLink(EXTERNAL_LINKS.TERMS)}
            />

            <SettingsItem
              icon="shield"
              title="Privacy Policy"
              onPress={() => openExternalLink(EXTERNAL_LINKS.PRIVACY)}
            />

            <SettingsItem
              icon="help-circle"
              title="Support"
              subtitle="Get help with Starr"
              onPress={handleSupport}
            />
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <Text variant="labelMedium" color={colors.status.error} style={styles.sectionLabel}>
              DANGER ZONE
            </Text>

            <TouchableOpacity 
              style={styles.dangerButton}
              onPress={() => router.push('/delete-wallet')}
            >
              <Ionicons name="trash" size={20} color={colors.status.error} />
              <Text variant="titleSmall" color={colors.status.error}>
                Delete Wallet
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Currency Selection Modal */}
      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" color={colors.text.primary}>
                Select Currency
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowCurrencyModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Bitcoin Units */}
              <View style={styles.modalSection}>
                <Text variant="labelMedium" color={colors.gold.pure} style={styles.modalSectionLabel}>
                  BITCOIN UNITS
                </Text>
                {BITCOIN_UNITS.map((unit) => (
                  <TouchableOpacity
                    key={unit.value}
                    style={[
                      styles.currencyOption,
                      settings.currency === unit.value && styles.currencyOptionSelected,
                    ]}
                    onPress={() => handleCurrencySelect(unit.value)}
                  >
                    <View style={styles.currencyInfo}>
                      <View style={styles.currencyHeader}>
                        <Text variant="titleMedium" color={colors.text.primary}>
                          {unit.label}
                        </Text>
                        <Text variant="titleSmall" color={colors.gold.pure}>
                          {unit.symbol}
                        </Text>
                      </View>
                      <Text variant="bodySmall" color={colors.text.muted}>
                        {unit.description}
                      </Text>
                    </View>
                    {settings.currency === unit.value && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.gold.pure} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fiat Currencies */}
              <View style={styles.modalSection}>
                <Text variant="labelMedium" color={colors.accent.cyan} style={styles.modalSectionLabel}>
                  FIAT CURRENCIES
                </Text>
                <Text variant="bodySmall" color={colors.text.muted} style={styles.fiatHint}>
                  Show equivalent value in fiat currency
                </Text>
                {FIAT_CURRENCIES.map((currency) => (
                  <TouchableOpacity
                    key={currency.value}
                    style={[
                      styles.currencyOption,
                      settings.currency === currency.value && styles.currencyOptionSelected,
                    ]}
                    onPress={() => handleCurrencySelect(currency.value)}
                  >
                    <View style={styles.currencyInfo}>
                      <View style={styles.currencyHeader}>
                        <Text variant="titleMedium" color={colors.text.primary}>
                          {currency.label}
                        </Text>
                        <Text variant="bodyMedium" color={colors.text.secondary}>
                          {currency.symbol} ({currency.value})
                        </Text>
                      </View>
                    </View>
                    {settings.currency === currency.value && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.accent.cyan} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" color={colors.text.primary}>
                Select Theme
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowThemeModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Theme Options */}
              <View style={styles.modalSection}>
                {[
                  { value: 'dark' as const, label: 'Dark', icon: 'moon' as const, description: 'Deep space dark theme' },
                  { value: 'light' as const, label: 'Light', icon: 'sunny' as const, description: 'Clean and bright theme' },
                  { value: 'system' as const, label: 'System', icon: 'phone-portrait' as const, description: 'Follow device settings' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.currencyOption,
                      themeMode === option.value && styles.currencyOptionSelected,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setThemeMode(option.value);
                      setShowThemeModal(false);
                    }}
                  >
                    <View style={styles.themeOptionIcon}>
                      <Ionicons 
                        name={option.icon} 
                        size={24} 
                        color={themeMode === option.value ? colors.gold.pure : colors.text.secondary} 
                      />
                    </View>
                    <View style={styles.currencyInfo}>
                      <Text variant="titleMedium" color={colors.text.primary}>
                        {option.label}
                      </Text>
                      <Text variant="bodySmall" color={colors.text.muted}>
                        {option.description}
                      </Text>
                    </View>
                    {themeMode === option.value && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.gold.pure} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

// Settings item component
interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
}) => {
  const content = (
    <View style={styles.itemContainer}>
      <View style={styles.itemIcon}>
        <Ionicons name={icon} size={20} color={colors.gold.pure} />
      </View>
      <View style={styles.itemContent}>
        <Text variant="titleSmall" color={colors.text.primary}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" color={colors.text.muted}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing || (onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
      ))}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: layout.tabBarHeight + spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.status.error + '15',
    borderRadius: layout.radius.lg,
    borderWidth: 1,
    borderColor: colors.status.error + '30',
    gap: spacing.sm,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
    padding: spacing.lg,
  },
  modalSection: {
    marginBottom: spacing.xl,
  },
  modalSectionLabel: {
    marginBottom: spacing.md,
  },
  fiatHint: {
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  currencyOptionSelected: {
    borderColor: colors.gold.pure,
    backgroundColor: colors.gold.glow,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
});
