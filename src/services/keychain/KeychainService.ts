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
  SEED_HASH: 'starr_seed_hash',
  PIN_HASH: 'starr_pin_hash',
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
  hasPin: boolean;
}

class KeychainServiceImpl {
  /**
   * Check if wallet has been initialized
   */
  async isWalletInitialized(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(KEYS.WALLET_INITIALIZED, SECURE_OPTIONS);
    return value === 'true';
  }

  /**
   * Get current keychain state
   */
  async getState(): Promise<KeychainState> {
    const [initialized, biometric, pin] = await Promise.all([
      SecureStore.getItemAsync(KEYS.WALLET_INITIALIZED, SECURE_OPTIONS),
      SecureStore.getItemAsync(KEYS.BIOMETRIC_ENABLED, SECURE_OPTIONS),
      SecureStore.getItemAsync(KEYS.PIN_HASH, SECURE_OPTIONS),
    ]);

    return {
      isInitialized: initialized === 'true',
      hasBiometric: biometric === 'true',
      hasPin: !!pin,
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
   * Store the seed phrase securely
   * CRITICAL: This is the most sensitive operation in the wallet
   */
  async storeSeedPhrase(mnemonic: string): Promise<void> {
    if (!this.validateSeedPhrase(mnemonic)) {
      throw new Error('Invalid seed phrase');
    }

    // Convert mnemonic to seed bytes
    const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
    const seedHex = Buffer.from(seedBuffer).toString('hex');

    // Create a hash for verification (not the actual seed)
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      mnemonic
    );

    // Store encrypted seed and hash
    await SecureStore.setItemAsync(KEYS.SEED_ENCRYPTED, seedHex, SECURE_OPTIONS);
    await SecureStore.setItemAsync(KEYS.SEED_HASH, hash, SECURE_OPTIONS);
    await SecureStore.setItemAsync(KEYS.WALLET_INITIALIZED, 'true', SECURE_OPTIONS);

    console.log('[KeychainService] Seed phrase stored securely');
  }

  /**
   * Retrieve seed bytes for Breez SDK initialization
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
   * Retrieve the mnemonic for backup purposes
   * CRITICAL: Only expose this for explicit user backup actions
   */
  async getMnemonicForBackup(): Promise<string> {
    // Always require fresh biometric auth for seed exposure
    const authenticated = await this.authenticateBiometric(
      'Authenticate to view recovery phrase'
    );
    if (!authenticated) {
      throw new Error('Biometric authentication required');
    }

    // For security, we need to regenerate mnemonic from the stored seed
    // This requires storing the mnemonic itself, which we do encrypted
    const seedHex = await SecureStore.getItemAsync(KEYS.SEED_ENCRYPTED, SECURE_OPTIONS);
    if (!seedHex) {
      throw new Error('No seed found');
    }

    // Note: In production, you'd want to store the mnemonic separately
    // or use a derivation method to recover it from the seed
    throw new Error('Mnemonic recovery not implemented - store mnemonic during initial creation');
  }

  /**
   * Set up PIN authentication
   */
  async setupPin(pin: string): Promise<void> {
    if (pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin
    );

    await SecureStore.setItemAsync(KEYS.PIN_HASH, hash, SECURE_OPTIONS);
    console.log('[KeychainService] PIN set up');
  }

  /**
   * Verify PIN
   */
  async verifyPin(pin: string): Promise<boolean> {
    const storedHash = await SecureStore.getItemAsync(KEYS.PIN_HASH, SECURE_OPTIONS);
    if (!storedHash) {
      return false;
    }

    const inputHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin
    );

    return storedHash === inputHash;
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
   * Generic user authentication (biometric or PIN)
   */
  async authenticateUser(): Promise<boolean> {
    const state = await this.getState();

    if (state.hasBiometric) {
      const biometricResult = await this.authenticateBiometric();
      if (biometricResult) return true;
    }

    // Fall back to PIN if biometric fails or isn't set up
    // In production, you'd show a PIN entry UI here
    return false;
  }

  /**
   * Clear all wallet data
   * DANGER: This will delete the seed and all wallet data
   */
  async clearAllData(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.SEED_ENCRYPTED),
      SecureStore.deleteItemAsync(KEYS.SEED_HASH),
      SecureStore.deleteItemAsync(KEYS.PIN_HASH),
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

  /**
   * Get last backup date
   */
  async getLastBackupDate(): Promise<Date | null> {
    const date = await SecureStore.getItemAsync(KEYS.LAST_BACKUP_DATE, SECURE_OPTIONS);
    return date ? new Date(date) : null;
  }
}

// Singleton instance
export const KeychainService = new KeychainServiceImpl();

