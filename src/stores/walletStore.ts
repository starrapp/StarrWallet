/**
 * Wallet Store
 * 
 * Central state management for the Starr wallet.
 * Uses Zustand for lightweight, performant state management.
 */

import { create } from 'zustand';
import { LNDService } from '@/services/lnd';
import { TorService } from '@/services/tor';
import { KeychainService } from '@/services/keychain';
import { BackupService } from '@/services/backup';
import { LSPManager } from '@/services/lsp';
import { isLNDConfigured } from '@/config/lnd';
import { isOnionAddress } from '@/utils/tor';
import type {
  Balance,
  LightningPayment,
  Invoice,
  NodeInfo,
  LSPInfo,
  WalletSettings,
  BackupState,
} from '@/types/wallet';

// Wallet state interface
interface WalletState {
  // Initialization
  isInitializing: boolean;
  isInitialized: boolean;
  isUnlocked: boolean;
  initError: string | null;

  // Balance
  balance: Balance | null;
  isLoadingBalance: boolean;

  // Payments
  payments: LightningPayment[];
  isLoadingPayments: boolean;
  pendingPayment: LightningPayment | null;

  // Invoices
  currentInvoice: Invoice | null;
  isCreatingInvoice: boolean;

  // Node info
  nodeInfo: NodeInfo | null;

  // LSP
  currentLSP: LSPInfo | null;
  availableLSPs: LSPInfo[];

  // Backup
  backupState: BackupState | null;

  // Settings
  settings: WalletSettings;

  // Actions
  initializeWallet: (mnemonic?: string) => Promise<void>;
  unlockWallet: () => Promise<boolean>;
  lockWallet: () => void;
  
  refreshBalance: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  
  createInvoice: (amountSats: number, description?: string) => Promise<Invoice>;
  payInvoice: (bolt11: string, amountSats?: number) => Promise<LightningPayment>;
  
  updateSettings: (settings: Partial<WalletSettings>) => void;
  
  syncNode: () => Promise<void>;
  performBackup: () => Promise<void>;
}

// Default settings
const defaultSettings: WalletSettings = {
  currency: 'SATS',
  theme: 'dark',
  biometricEnabled: false,
  pinEnabled: false,
  autoLockMinutes: 5,
  torEnabled: true,
  torAutoStart: true,
  autoBackupEnabled: true,
};

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  isInitializing: false,
  isInitialized: false,
  isUnlocked: false,
  initError: null,

  balance: null,
  isLoadingBalance: false,

  payments: [],
  isLoadingPayments: false,
  pendingPayment: null,

  currentInvoice: null,
  isCreatingInvoice: false,

  nodeInfo: null,

  currentLSP: null,
  availableLSPs: [],

  backupState: null,

  settings: defaultSettings,

  // Initialize wallet - requires LND or new Lightning implementation
  initializeWallet: async (mnemonic?: string) => {
    set({ isInitializing: true, initError: null });

    try {
      // Check if wallet exists
      const isExisting = await KeychainService.isWalletInitialized();

      let mnemonicPhrase: string;

      if (mnemonic) {
        // New wallet with provided mnemonic
        mnemonicPhrase = mnemonic;
      } else if (isExisting) {
        // Existing wallet - get mnemonic from keychain
        // Skip auth on auto-init - device unlock provides security
        // Sensitive operations (backup view, large sends) require separate auth
        mnemonicPhrase = await KeychainService.getMnemonicForBackup(false);
      } else {
        throw new Error('No wallet found. Please create or import a wallet.');
      }

      // Initialize Tor service if enabled
      const settings = get().settings;
      if (settings.torEnabled) {
        try {
          await TorService.initialize();
          console.log('[WalletStore] Tor service initialized');
          
          // Auto-start Tor if enabled and LND uses .onion address
          if (settings.torAutoStart && isLNDConfigured()) {
            const lndRestUrl = process.env.EXPO_PUBLIC_LND_REST_URL || '';
            if (isOnionAddress(lndRestUrl)) {
              try {
                await TorService.startTor();
                console.log('[WalletStore] Tor auto-started for .onion LND connection');
              } catch (error) {
                console.warn('[WalletStore] Tor auto-start failed:', error);
                // Continue without Tor - user can start manually
              }
            }
          }
        } catch (error) {
          console.error('[WalletStore] Tor initialization failed:', error);
          // Continue without Tor
        }
      }

      // Initialize LND service if configured
      if (isLNDConfigured()) {
        try {
          await LNDService.initialize();
          console.log('[WalletStore] LND service initialized');
        } catch (error) {
          console.error('[WalletStore] LND initialization failed:', error);
          throw new Error('Failed to initialize LND service. Please check your configuration.');
        }
      } else {
        // TODO: Initialize new Lightning implementation when ready
        throw new Error('No Lightning Network service configured. Please configure LND or wait for new implementation.');
      }

      // Initialize backup service
      await BackupService.initialize();

      // Initialize LSP manager
      await LSPManager.initialize();

      // Get initial data from LND
      if (!LNDService.isInitialized()) {
        throw new Error('LND service not initialized');
      }

      const [balance, nodeInfo, currentLSP, backupState] = await Promise.all([
        LNDService.getBalance(),
        LNDService.getInfo(),
        LSPManager.getCurrentLSP(),
        BackupService.getBackupState(),
      ]);

      // TODO: Subscribe to payment events from new Lightning implementation
      // Payment events will be handled by the Lightning service

      set({
        isInitializing: false,
        isInitialized: true,
        isUnlocked: true,
        balance,
        nodeInfo,
        currentLSP,
        backupState,
      });

      // Load payments in background
      get().refreshPayments();
    } catch (error) {
      console.error('[WalletStore] Initialization failed:', error);
      set({
        isInitializing: false,
        initError: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },

  // Unlock wallet with authentication
  unlockWallet: async () => {
    try {
      const authenticated = await KeychainService.authenticateUser();
      if (authenticated) {
        set({ isUnlocked: true });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // Lock wallet
  lockWallet: () => {
    set({ isUnlocked: false });
  },

  // Refresh balance
  refreshBalance: async () => {
    set({ isLoadingBalance: true });
    try {
      if (!LNDService.isInitialized()) {
        throw new Error('LND service not initialized');
      }
      const balance = await LNDService.getBalance();
      set({ balance, isLoadingBalance: false });
    } catch (error) {
      console.error('[WalletStore] Failed to refresh balance:', error);
      set({ isLoadingBalance: false });
    }
  },

  // Refresh payment history
  refreshPayments: async () => {
    set({ isLoadingPayments: true });
    try {
      if (!LNDService.isInitialized()) {
        throw new Error('LND service not initialized');
      }
      const payments = await LNDService.listPayments();
      set({ payments, isLoadingPayments: false });
    } catch (error) {
      console.error('[WalletStore] Failed to refresh payments:', error);
      set({ isLoadingPayments: false });
    }
  },

  // Create invoice for receiving
  createInvoice: async (amountSats: number, description?: string) => {
    set({ isCreatingInvoice: true });
    try {
      if (!LNDService.isInitialized()) {
        throw new Error('LND service not initialized');
      }
      const invoice = await LNDService.createInvoice(amountSats, description);
      set({ currentInvoice: invoice, isCreatingInvoice: false });
      return invoice;
    } catch (error) {
      set({ isCreatingInvoice: false });
      throw error;
    }
  },

  // Pay invoice
  payInvoice: async (bolt11: string, amountSats?: number) => {
    try {
      if (!LNDService.isInitialized()) {
        throw new Error('LND service not initialized');
      }

      // TODO: Parse invoice for validation - implement with new Lightning service or use LND's decode
      // For now, set pending payment with basic info
      set({
        pendingPayment: {
          id: 'pending',
          type: 'send',
          status: 'pending',
          amountSats: amountSats || 0,
          paymentHash: '',
          description: '',
          timestamp: new Date(),
        },
      });

      const payment = await LNDService.payInvoice(bolt11, amountSats);
      
      set((state) => ({
        payments: [payment, ...state.payments],
        pendingPayment: null,
      }));

      // Refresh balance
      get().refreshBalance();

      return payment;
    } catch (error) {
      set({ pendingPayment: null });
      throw error;
    }
  },

  // Update settings
  updateSettings: (newSettings: Partial<WalletSettings>) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },

  // Sync node with network
  syncNode: async () => {
    try {
      if (!LNDService.isInitialized()) {
        throw new Error('LND service not initialized');
      }
      // LND doesn't have explicit sync, just refresh balance
      const balance = await LNDService.getBalance();
      set({ balance });
    } catch (error) {
      console.error('[WalletStore] Sync failed:', error);
    }
  },

  // Perform backup
  performBackup: async () => {
    try {
      await BackupService.performBackup('local');
      const backupState = await BackupService.getBackupState();
      set({ backupState });
    } catch (error) {
      console.error('[WalletStore] Backup failed:', error);
      throw error;
    }
  },
}));
