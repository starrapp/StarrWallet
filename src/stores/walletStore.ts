/**
 * Wallet Store
 * 
 * Central state management for the Starr wallet.
 * Uses Zustand for lightweight, performant state management.
 */

import { create } from 'zustand';
import { BreezService } from '@/services/breez';
import { TorService } from '@/services/tor';
import { KeychainService } from '@/services/keychain';
import { BackupService } from '@/services/backup';
import { BREEZ_CONFIG } from '@/config';
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
  torEnabled: false,
  torAutoStart: false,
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

  // Initialize wallet with Breez SDK
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

      // Initialize Tor service only if enabled in settings
      const settings = get().settings;
      if (settings.torEnabled) {
        try {
          await TorService.initialize();
          console.log('[WalletStore] Tor service initialized (not started yet)');
        } catch (error) {
          console.error('[WalletStore] Tor initialization failed:', error);
          // Continue without Tor
        }
      } else {
        try {
          if (TorService.isTorRunning()) {
            await TorService.stopTor();
            console.log('[WalletStore] Tor stopped (disabled in settings)');
          }
        } catch (error) {
          console.warn('[WalletStore] Error stopping Tor:', error);
        }
      }

      await BreezService.initialize(mnemonicPhrase, {
        workingDir: BREEZ_CONFIG.WORKING_DIR,
        network: BREEZ_CONFIG.NETWORK,
      });

      await BackupService.initialize();

      const [balance, nodeInfo, currentLSP, backupState] = await Promise.all([
        BreezService.getBalance(),
        BreezService.getNodeInfo(),
        BreezService.getCurrentLSP(),
        BackupService.getBackupState(),
      ]);

      // Subscribe to payment events
      BreezService.on('payment', (payment) => {
        set((state) => ({
          payments: [payment, ...state.payments],
          pendingPayment: null,
        }));
        // Refresh balance after payment
        get().refreshBalance();
      });

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
      const balance = await BreezService.getBalance();
      set({ balance, isLoadingBalance: false });
    } catch (error) {
      console.error('[WalletStore] Failed to refresh balance:', error);
      set({ isLoadingBalance: false });
    }
  },

  refreshPayments: async () => {
    set({ isLoadingPayments: true });
    try {
      const payments = await BreezService.getPayments('all', 50);
      set({ payments, isLoadingPayments: false });
    } catch (error) {
      console.error('[WalletStore] Failed to refresh payments:', error);
      set({ isLoadingPayments: false });
    }
  },

  createInvoice: async (amountSats: number, description?: string) => {
    set({ isCreatingInvoice: true });
    try {
      const invoice = await BreezService.createInvoice(amountSats, description);
      set({ currentInvoice: invoice, isCreatingInvoice: false });
      return invoice;
    } catch (error) {
      set({ isCreatingInvoice: false });
      throw error;
    }
  },

  payInvoice: async (bolt11: string, amountSats?: number) => {
    try {
      const parsed = await BreezService.parseInvoice(bolt11);
      set({
        pendingPayment: {
          id: 'pending',
          type: 'send',
          status: 'pending',
          amountSats: amountSats ?? (parsed.amountMsat ? parsed.amountMsat / 1000 : 0),
          paymentHash: parsed.paymentHash,
          description: parsed.description,
          timestamp: new Date(),
        },
      });

      const payment = await BreezService.payInvoice(bolt11, amountSats);
      set((state) => ({
        payments: [payment, ...state.payments],
        pendingPayment: null,
      }));
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
      await BreezService.syncNode();
      const balance = await BreezService.getBalance();
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
