/**
 * Backup Service
 *
 * Tracks backup state and last backup time for UI. Breez SDK manages its own state.
 * Optional local/cloud backup of metadata is supported when auto-backup is enabled.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeychainService } from '../keychain';
import type { BackupState, BackupType } from '@/types/wallet';

// Storage keys
const BACKUP_KEYS = {
  STATE: 'starr_backup_state',
  AUTO_ENABLED: 'starr_backup_auto',
  PROVIDER: 'starr_backup_provider',
  LAST_HASH: 'starr_backup_hash',
} as const;

interface BackupData {
  version: number;
  timestamp: string;
  checksum: string;
}

interface BackupResult {
  success: boolean;
  timestamp: Date;
  location: BackupType;
  hash: string;
  error?: string;
}

class BackupServiceImpl {
  private autoBackupEnabled = false;
  private backupInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  /**
   * Initialize the backup service
   * Sets up automatic backups if enabled
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const autoEnabled = await AsyncStorage.getItem(BACKUP_KEYS.AUTO_ENABLED);
    this.autoBackupEnabled = autoEnabled === 'true';

    if (this.autoBackupEnabled) {
      this.startAutoBackup();
    }

    this.isInitialized = true;
    console.log('[BackupService] Initialized, auto-backup:', this.autoBackupEnabled);
  }

  /**
   * Get current backup state
   */
  async getBackupState(): Promise<BackupState> {
    const stateJson = await AsyncStorage.getItem(BACKUP_KEYS.STATE);
    const state: Partial<BackupState> = stateJson ? JSON.parse(stateJson) : {};

    return {
      lastBackup: state.lastBackup ? new Date(state.lastBackup) : undefined,
      backupType: state.backupType as BackupType | undefined,
      isAutoBackupEnabled: this.autoBackupEnabled,
    };
  }

  /**
   * Enable automatic backups
   */
  async enableAutoBackup(provider: 'icloud' | 'google' | 'local' = 'local'): Promise<void> {
    await AsyncStorage.setItem(BACKUP_KEYS.AUTO_ENABLED, 'true');
    await AsyncStorage.setItem(BACKUP_KEYS.PROVIDER, provider);
    this.autoBackupEnabled = true;
    this.startAutoBackup();
    console.log('[BackupService] Auto-backup enabled with provider:', provider);
  }

  /**
   * Disable automatic backups
   */
  async disableAutoBackup(): Promise<void> {
    await AsyncStorage.setItem(BACKUP_KEYS.AUTO_ENABLED, 'false');
    this.autoBackupEnabled = false;
    this.stopAutoBackup();
    console.log('[BackupService] Auto-backup disabled');
  }

  /**
   * Perform a manual backup
   */
  async performBackup(type: BackupType = 'local'): Promise<BackupResult> {
    try {
      console.log('[BackupService] Starting backup, type:', type);

      const timestamp = new Date();
      const backupData: BackupData = {
        version: 1,
        timestamp: timestamp.toISOString(),
        checksum: '',
      };

      // Calculate checksum
      const checksum = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        JSON.stringify(backupData)
      );
      backupData.checksum = checksum;

      // Perform backup based on type
      let success = false;
      let error: string | undefined;

      switch (type) {
        case 'local':
          success = await this.saveLocalBackup(backupData);
          break;
        case 'cloud':
          success = await this.saveCloudBackup(backupData);
          break;
        case 'manual':
          success = true; // Manual is just export, handled separately
          break;
        default:
          error = 'Unknown backup type';
      }

      if (success) {
        const state: Partial<BackupState> = {
          lastBackup: timestamp,
          backupType: type,
          isAutoBackupEnabled: this.autoBackupEnabled,
        };
        await AsyncStorage.setItem(BACKUP_KEYS.STATE, JSON.stringify(state));
        await AsyncStorage.setItem(BACKUP_KEYS.LAST_HASH, checksum);
        await KeychainService.recordBackup();
      }

      return {
        success,
        timestamp,
        location: type,
        hash: checksum,
        error,
      };
    } catch (err) {
      console.error('[BackupService] Backup failed:', err);
      return {
        success: false,
        timestamp: new Date(),
        location: type,
        hash: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Save backup to local storage
   */
  private async saveLocalBackup(data: BackupData): Promise<boolean> {
    try {
      const backupDir = `${FileSystem.documentDirectory}backups/`;
      
      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(backupDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
      }

      // Create filename with timestamp
      const filename = `starr_backup_${Date.now()}.json`;
      const filepath = `${backupDir}${filename}`;

      // Write backup file
      await FileSystem.writeAsStringAsync(filepath, JSON.stringify(data), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log('[BackupService] Local backup saved:', filepath);

      // Keep only last 5 backups
      await this.cleanupOldBackups(backupDir, 5);

      return true;
    } catch (error) {
      console.error('[BackupService] Local backup failed:', error);
      return false;
    }
  }

  /**
   * Save backup to cloud storage. Falls back to local for now.
   */
  private async saveCloudBackup(data: BackupData): Promise<boolean> {
    const provider = await AsyncStorage.getItem(BACKUP_KEYS.PROVIDER);
    console.log('[BackupService] Cloud backup to:', provider);
    return this.saveLocalBackup(data);
  }

  /**
   * Clean up old backup files
   */
  private async cleanupOldBackups(directory: string, keepCount: number): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(directory);
      const backupFiles = files
        .filter((f) => f.startsWith('starr_backup_'))
        .sort()
        .reverse();

      // Delete old backups
      for (let i = keepCount; i < backupFiles.length; i++) {
        await FileSystem.deleteAsync(`${directory}${backupFiles[i]}`, {
          idempotent: true,
        });
      }
    } catch (error) {
      console.error('[BackupService] Cleanup failed:', error);
    }
  }

  /**
   * Start automatic backup interval
   */
  private startAutoBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }

    // Backup every 5 minutes when active
    this.backupInterval = setInterval(
      () => {
        this.performBackup('local').catch(console.error);
      },
      5 * 60 * 1000
    );

    // Perform immediate backup
    this.performBackup('local').catch(console.error);
  }

  /**
   * Stop automatic backup interval
   */
  private stopAutoBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }
}

// Singleton instance
export const BackupService = new BackupServiceImpl();
