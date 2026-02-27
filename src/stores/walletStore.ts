/**
 * Wallet Store
 *
 * Central state management for the Starr wallet.
 * Uses Zustand for lightweight, performant state management.
 */

import { create } from 'zustand';
import { BreezService } from '@/services/breez';
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
  ListPaymentsFilter,
} from '@/types/wallet';

const DEFAULT_PAYMENT_FILTER: ListPaymentsFilter = {
  limit: 20,
  sortAscending: false,
};

let paymentListener: ((payment: LightningPayment) => void) | null = null;

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
  recentPayments: LightningPayment[];
  isLoadingRecentPayments: boolean;
  payments: LightningPayment[];
  isLoadingPayments: boolean;
  isLoadingMorePayments: boolean;
  hasMorePayments: boolean;
  paymentFilter: ListPaymentsFilter;

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
  refreshRecentPayments: () => Promise<void>;
  listPayments: (options?: { filter?: ListPaymentsFilter; append?: boolean }) => Promise<void>;
  getPayment: (paymentId: string) => Promise<LightningPayment | null>;

  createInvoice: (amountSats: bigint, description?: string) => Promise<Invoice>;
  payInvoice: (bolt11: string, amountSats?: bigint) => Promise<LightningPayment>;
  sendToAddress: (address: string, amountSats: bigint, type: 'bitcoin' | 'spark') => Promise<LightningPayment>;

  updateSettings: (settings: Partial<WalletSettings>) => void;

  syncNode: () => Promise<void>;
  performBackup: () => Promise<void>;
}

// Default settings
const defaultSettings: WalletSettings = {
  currency: 'SATS',
  biometricEnabled: false,
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

  recentPayments: [],
  isLoadingRecentPayments: false,
  payments: [],
  isLoadingPayments: false,
  isLoadingMorePayments: false,
  hasMorePayments: false,
  paymentFilter: DEFAULT_PAYMENT_FILTER,

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

      await BreezService.initialize(mnemonicPhrase, {
        apiKey: BREEZ_CONFIG.API_KEY,
        workingDir: BREEZ_CONFIG.WORKING_DIR,
        network: BREEZ_CONFIG.NETWORK,
        syncIntervalSecs: BREEZ_CONFIG.SYNC_INTERVAL_SECS,
      });

      await BackupService.initialize();

      const [balance, nodeInfo, currentLSP, backupState, recentPayments] = await Promise.all([
        BreezService.getBalance(),
        BreezService.getNodeInfo(),
        BreezService.getCurrentLSP(),
        BackupService.getBackupState(),
        BreezService.listPayments({
          limit: 5,
          offset: 0,
          sortAscending: false,
        }),
      ]);

      if (paymentListener) {
        BreezService.off('payment', paymentListener);
      }
      paymentListener = (payment) => {
        set((state) => {
          const existingIndex = state.recentPayments.findIndex((p) => p.id === payment.id);
          const recentPayments = [...state.recentPayments];
          if (existingIndex >= 0) {
            recentPayments[existingIndex] = payment;
          } else {
            recentPayments.unshift(payment);
          }
          recentPayments.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          return {
            recentPayments: recentPayments.slice(0, 5),
          };
        });
        get().refreshBalance();
      };
      BreezService.on('payment', paymentListener);

      set({
        isInitializing: false,
        isInitialized: true,
        isUnlocked: true,
        balance,
        nodeInfo,
        currentLSP,
        backupState,
        recentPayments: recentPayments.slice(0, 5),
      });

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

  refreshRecentPayments: async () => {
    set({ isLoadingRecentPayments: true });
    try {
      const recentPayments = await BreezService.listPayments({
        limit: 5,
        offset: 0,
        sortAscending: false,
      });
      recentPayments.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      set({
        recentPayments: recentPayments.slice(0, 5),
        isLoadingRecentPayments: false,
      });
    } catch (error) {
      console.error('[WalletStore] Failed to refresh recent payments:', error);
      set({ isLoadingRecentPayments: false });
    }
  },

  listPayments: async (options) => {
    const append = options?.append === true;
    const {
      payments,
      paymentFilter,
      hasMorePayments,
      isLoadingPayments,
      isLoadingMorePayments,
    } = get();

    if (append) {
      if (hasMorePayments === false || isLoadingPayments || isLoadingMorePayments) return;
      set({ isLoadingMorePayments: true });
    } else {
      if (isLoadingPayments || isLoadingMorePayments) return;
      set({ isLoadingPayments: true });
    }

    try {
      const baseFilter = options?.filter
        ? { ...DEFAULT_PAYMENT_FILTER, ...options.filter }
        : { ...DEFAULT_PAYMENT_FILTER, ...paymentFilter };
      const limit = baseFilter.limit ?? DEFAULT_PAYMENT_FILTER.limit ?? 20;
      const requestFilter: ListPaymentsFilter = {
        ...baseFilter,
        offset: append ? payments.length : 0,
      };
      const page = await BreezService.listPayments(requestFilter);

      set((state) => {
        const nextPayments = append ? [...state.payments] : [];
        for (const payment of page) {
          const existingIndex = nextPayments.findIndex((p) => p.id === payment.id);
          if (existingIndex >= 0) {
            nextPayments[existingIndex] = payment;
          } else {
            nextPayments.push(payment);
          }
        }
        return {
          payments: nextPayments,
          hasMorePayments: page.length === limit,
          paymentFilter: {
            ...baseFilter,
            offset: 0,
          },
          isLoadingPayments: false,
          isLoadingMorePayments: false,
        };
      });
    } catch (error) {
      console.error('[WalletStore] Failed to list payments:', error);
      set({ isLoadingPayments: false, isLoadingMorePayments: false });
    }
  },

  getPayment: async (paymentId: string) => {
    try {
      return await BreezService.getPayment(paymentId);
    } catch (error) {
      console.error('[WalletStore] Failed to get payment:', error);
      return null;
    }
  },

  createInvoice: async (amountSats: bigint, description?: string) => {
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

  payInvoice: async (bolt11: string, amountSats?: bigint) => {
    const payment = await BreezService.payInvoice(bolt11, amountSats);
    get().refreshBalance();
    return payment;
  },

  sendToAddress: async (address: string, amountSats: bigint, type: 'bitcoin' | 'spark') => {
    const payment = await BreezService.sendToAddress(address, amountSats, type);
    get().refreshBalance();
    return payment;
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
