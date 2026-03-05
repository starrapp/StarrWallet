/**
 * Keychain Service
 *
 * Secure key management using platform-native secure storage.
 * - iOS: Keychain Services with Secure Enclave
 * - Android: Keystore with hardware-backed security
 *
 * The mnemonic is stored with `requireAuthentication: true` — every read
 * triggers a native OS biometric / device-passcode prompt.
 *
 * CRITICAL SECURITY NOTES:
 * - The mnemonic is the ONLY way to recover funds
 * - Never log, transmit, or store mnemonics in plain text
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as bip39 from 'bip39';

// Storage keys
const KEYS = {
  MNEMONIC: 'starr_mnemonic',
  WALLET_CREATED: 'starr_wallet_created',
} as const;

// Base options for non-sensitive flags.
const BASE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Auth-guarded options — native biometric / device-passcode on every read.
const AUTH_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
  authenticationPrompt: 'Authenticate to access your wallet',
};

class KeychainServiceImpl {
  /**
   * Check if wallet has been initialized.
   */
  async isWalletCreated(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(KEYS.WALLET_CREATED, BASE_OPTIONS);
    return value === 'true';
  }

  /**
   * Generate a new BIP39 mnemonic.
   * Uses 256 bits of entropy for 24 words.
   */
  async generateMnemonic(): Promise<string> {
    const entropy = await Crypto.getRandomBytesAsync(32);
    return bip39.entropyToMnemonic(Buffer.from(entropy));
  }

  /**
   * Validate a BIP39 mnemonic.
   */
  validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Store the mnemonic securely.
   * The key is stored with `requireAuthentication` — on iOS auth is only
   * required on read; on Android it is required on both read and write.
   *
   * CRITICAL: This is the most sensitive operation in the wallet.
   */
  async storeMnemonic(mnemonic: string): Promise<void> {
    if (!this.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    await SecureStore.setItemAsync(KEYS.MNEMONIC, mnemonic, AUTH_OPTIONS);
    await SecureStore.setItemAsync(KEYS.WALLET_CREATED, 'true', BASE_OPTIONS);

    console.log('[KeychainService] Mnemonic stored securely');
  }

  /**
   * Retrieve the mnemonic. Triggers native biometric / device-passcode prompt.
   */
  async getMnemonic(promptMessage?: string): Promise<string> {
    const options: SecureStore.SecureStoreOptions = promptMessage
      ? { ...AUTH_OPTIONS, authenticationPrompt: promptMessage }
      : AUTH_OPTIONS;

    const mnemonic = await SecureStore.getItemAsync(KEYS.MNEMONIC, options);
    if (!mnemonic) {
      throw new Error('No mnemonic found');
    }
    return mnemonic;
  }

  /**
   * Authenticate user via biometric or device passcode.
   */
  async authenticateUser(promptMessage?: string): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Authenticate to continue',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    return result.success;
  }

  /**
   * Clear all wallet data.
   * DANGER: This will delete the mnemonic and all wallet data.
   */
  async clearAllData(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.MNEMONIC, AUTH_OPTIONS),
      SecureStore.deleteItemAsync(KEYS.WALLET_CREATED, BASE_OPTIONS),
    ]);

    console.log('[KeychainService] All wallet data cleared');
  }
}

// Singleton instance
export const KeychainService = new KeychainServiceImpl();
