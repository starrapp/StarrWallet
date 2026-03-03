/**
 * Keychain Service
 *
 * Secure key management using platform-native secure storage.
 * - iOS: Keychain Services with Secure Enclave
 * - Android: Keystore with hardware-backed security
 *
 * CRITICAL SECURITY NOTES:
 * - Seed phrases are the ONLY way to recover funds
 * - Never log, transmit, or store seeds in plain text
 * - All seed access should require biometric authentication
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as bip39 from 'bip39';
import { Buffer } from 'buffer';

// Storage keys
const KEYS = {
  SEED_ENCRYPTED: 'starr_seed_encrypted',
  MNEMONIC_ENCRYPTED: 'starr_mnemonic_encrypted',
  SEED_HASH: 'starr_seed_hash',
  WALLET_INITIALIZED: 'starr_wallet_initialized',
  BIOMETRIC_ENABLED: 'starr_biometric_enabled',
  LAST_BACKUP_DATE: 'starr_last_backup',
} as const;

// Security options for secure store
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

interface KeychainState {
  isInitialized: boolean;
  hasBiometric: boolean;
}

class KeychainServiceImpl {
  /**
   * Check if wallet has been initialized
   */
  async isWalletInitialized(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(KEYS.WALLET_INITIALIZED, SECURE_OPTIONS);
    if (value !== 'true') {
      return false;
    }

    // Verify that mnemonic actually exists (data consistency check)
    try {
      const mnemonic = await SecureStore.getItemAsync(KEYS.MNEMONIC_ENCRYPTED, SECURE_OPTIONS);
      if (!mnemonic) {
        // Flag is set but mnemonic is missing - clear the flag
        console.warn('[KeychainService] Wallet flag set but mnemonic missing, clearing inconsistent state');
        await SecureStore.deleteItemAsync(KEYS.WALLET_INITIALIZED, SECURE_OPTIONS);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current keychain state
   */
  async getState(): Promise<KeychainState> {
    const [initialized, biometric] = await Promise.all([
      SecureStore.getItemAsync(KEYS.WALLET_INITIALIZED, SECURE_OPTIONS),
      SecureStore.getItemAsync(KEYS.BIOMETRIC_ENABLED, SECURE_OPTIONS),
    ]);

    return {
      isInitialized: initialized === 'true',
      hasBiometric: biometric === 'true',
    };
  }

  /**
   * Generate a new BIP39 mnemonic seed phrase
   * Uses 256 bits of entropy for 24 words
   */
  async generateSeedPhrase(): Promise<string> {
    // Generate 256 bits of entropy for 24-word mnemonic
    const entropy = await Crypto.getRandomBytesAsync(32);
    const entropyHex = Array.from(entropy)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const mnemonic = bip39.entropyToMnemonic(entropyHex);
    return mnemonic;
  }

  /**
   * Validate a mnemonic seed phrase
   */
  validateSeedPhrase(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Validate the seed phrase. We do not persist the mnemonic; the user is
   * responsible for backing it up. The wallet is initialized in-session only.
   */
  async storeSeedPhrase(mnemonic: string): Promise<void> {
    if (!this.validateSeedPhrase(mnemonic)) {
      throw new Error('Invalid seed phrase');
    }
    // No persistence: mnemonic is passed through onboarding and used to
    // initialize the wallet in-session. App will show onboarding on next launch.
  }

  /**
   * Retrieve seed bytes for Lightning Network initialization
   * Requires authentication
   */
  async getSeedBytes(requireAuth: boolean = true): Promise<Uint8Array> {
    if (requireAuth) {
      const authenticated = await this.authenticateUser();
      if (!authenticated) {
        throw new Error('Authentication failed');
      }
    }

    const seedHex = await SecureStore.getItemAsync(KEYS.SEED_ENCRYPTED, SECURE_OPTIONS);
    if (!seedHex) {
      throw new Error('No seed found');
    }

    // Convert hex string to Uint8Array
    const bytes = new Uint8Array(seedHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(seedHex.substr(i * 2, 2), 16);
    }

    return bytes;
  }

  /**
   * Retrieve the mnemonic for Lightning Network initialization
   * Requires authentication
   */
  async getMnemonicForBackup(requireAuth: boolean = true): Promise<string> {
    if (requireAuth) {
      // Require fresh biometric auth for seed exposure
      const authenticated = await this.authenticateBiometric(
        'Authenticate to access wallet'
      );
      if (!authenticated) {
        throw new Error('Biometric authentication required');
      }
    }

    const mnemonic = await SecureStore.getItemAsync(KEYS.MNEMONIC_ENCRYPTED, SECURE_OPTIONS);
    if (!mnemonic) {
      throw new Error('No mnemonic found');
    }

    return mnemonic;
  }

  /**
   * Enable biometric authentication
   */
  async enableBiometric(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      console.log('[KeychainService] Biometric not available');
      return false;
    }

    // Test biometric authentication
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable biometric authentication for Starr',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      await SecureStore.setItemAsync(KEYS.BIOMETRIC_ENABLED, 'true', SECURE_OPTIONS);
      console.log('[KeychainService] Biometric enabled');
      return true;
    }

    return false;
  }

  /**
   * Check if biometric is available
   */
  async isBiometricAvailable(): Promise<{ available: boolean; type: string }> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let type = 'none';
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      type = 'face';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      type = 'fingerprint';
    }

    return {
      available: hasHardware && isEnrolled,
      type,
    };
  }

  /**
   * Authenticate user with biometric
   */
  async authenticateBiometric(promptMessage?: string): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Authenticate to continue',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    return result.success;
  }

  /**
   * Authenticate user with biometrics only.
   */
  async authenticateUser(): Promise<boolean> {
    const state = await this.getState();
    if (!state.hasBiometric) return false;
    return this.authenticateBiometric();
  }

  /**
   * Clear all wallet data
   * DANGER: This will delete the seed and all wallet data
   */
  async clearAllData(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.SEED_ENCRYPTED),
      SecureStore.deleteItemAsync(KEYS.MNEMONIC_ENCRYPTED),
      SecureStore.deleteItemAsync(KEYS.SEED_HASH),
      SecureStore.deleteItemAsync(KEYS.WALLET_INITIALIZED),
      SecureStore.deleteItemAsync(KEYS.BIOMETRIC_ENABLED),
      SecureStore.deleteItemAsync(KEYS.LAST_BACKUP_DATE),
    ]);

    console.log('[KeychainService] All wallet data cleared');
  }

  /**
   * Record last backup date
   */
  async recordBackup(): Promise<void> {
    await SecureStore.setItemAsync(
      KEYS.LAST_BACKUP_DATE,
      new Date().toISOString(),
      SECURE_OPTIONS
    );
  }
}

// Singleton instance
export const KeychainService = new KeychainServiceImpl();

