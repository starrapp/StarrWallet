/**
 * Wallet Store
 *
 * Central state management for the Starr wallet.
 * Uses Zustand for lightweight, performant state management.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BreezService } from '@/services/breez';
import { BREEZ_CONFIG } from '@/config';
import type {
  Balance,
  LightningPayment,
  Invoice,
  WalletSettings,
  ListPaymentsFilter,
  UnclaimedDeposit,
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
  initError: string | null;

  // Balance
  balance: Balance | null;
  isLoadingBalance: boolean;

  // Payments
  recentPayments: LightningPayment[];
  incomingPayment: LightningPayment | null;
  lastPresentedIncomingPaymentId: string | null;
  isLoadingRecentPayments: boolean;
  payments: LightningPayment[];
  isLoadingPayments: boolean;
  isLoadingMorePayments: boolean;
  hasMorePayments: boolean;
  paymentFilter: ListPaymentsFilter;

  // Invoices
  isCreatingInvoice: boolean;

  // Unclaimed on-chain deposits
  unclaimedDeposits: UnclaimedDeposit[];
  isLoadingUnclaimed: boolean;

  // Price
  btcFiatPrice: number | null;

  // Settings
  settings: WalletSettings;

  // Actions
  initializeWallet: (mnemonic: string) => Promise<void>;

  refreshBalance: () => Promise<void>;
  refreshRecentPayments: () => Promise<void>;
  listPayments: (options?: { filter?: ListPaymentsFilter; append?: boolean }) => Promise<void>;
  getPayment: (paymentId: string) => Promise<LightningPayment | null>;
  listUnclaimedDeposits: () => Promise<void>;
  claimDeposit: (txid: string, vout: number, maxFeeSats?: bigint) => Promise<void>;

  createInvoice: (amountSats: bigint, description?: string) => Promise<Invoice>;
  getOnchainReceiveAddress: () => Promise<string>;
  getSparkReceiveAddress: () => Promise<string>;
  sendPayment: (input: string, amountSats?: bigint, comment?: string) => Promise<LightningPayment>;
  dismissIncomingPayment: () => void;

  updateSettings: (settings: Partial<WalletSettings>) => void;
  fetchBtcPrice: () => Promise<void>;

  syncNode: () => Promise<void>;
}

// Default settings
const defaultSettings: WalletSettings = {
  bitcoinUnit: 'SATS',
  fiatCurrency: 'USD',
  maxDepositClaimFee: {
    type: 'conservative',
  },
};

export const useWalletStore = create<WalletState>()(persist(
  (set, get) => ({
  // Initial state
    isInitializing: false,
    isInitialized: false,
    initError: null,

    balance: null,
    isLoadingBalance: false,

    recentPayments: [],
    incomingPayment: null,
    lastPresentedIncomingPaymentId: null,
    isLoadingRecentPayments: false,
    payments: [],
    isLoadingPayments: false,
    isLoadingMorePayments: false,
    hasMorePayments: false,
    paymentFilter: DEFAULT_PAYMENT_FILTER,

    isCreatingInvoice: false,

    unclaimedDeposits: [],
    isLoadingUnclaimed: false,

    btcFiatPrice: null,

    settings: defaultSettings,

    // Initialize wallet with Breez SDK
    initializeWallet: async (mnemonic: string) => {
      set({ isInitializing: true, initError: null });

      try {
        await BreezService.initialize(mnemonic, {
          apiKey: BREEZ_CONFIG.API_KEY,
          workingDir: BREEZ_CONFIG.WORKING_DIR,
          network: BREEZ_CONFIG.NETWORK,
          syncIntervalSecs: BREEZ_CONFIG.SYNC_INTERVAL_SECS,
          maxDepositClaimFee: get().settings.maxDepositClaimFee,
        });

        const [balance, recentPayments] = await Promise.all([
          BreezService.getBalance(),
          BreezService.listPayments({
            limit: 5,
            offset: 0,
            sortAscending: false,
          }),
        ]);

        // Fetch BTC price in background (non-blocking)
        get().fetchBtcPrice();

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
            const shouldShowIncoming =
              payment.type === 'receive'
              && payment.status === 'completed'
              && state.lastPresentedIncomingPaymentId !== payment.id
              && state.incomingPayment?.id !== payment.id;
            return {
              recentPayments: recentPayments.slice(0, 5),
              incomingPayment: shouldShowIncoming ? payment : state.incomingPayment,
            };
          });
          get().refreshBalance();
        };
        BreezService.on('payment', paymentListener);

        set({
          isInitializing: false,
          isInitialized: true,
          balance,
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

    listUnclaimedDeposits: async () => {
      set({ isLoadingUnclaimed: true });
      try {
        const list = await BreezService.listUnclaimedDeposits();
        set({ unclaimedDeposits: list, isLoadingUnclaimed: false });
      } catch (error) {
        console.error('[WalletStore] Failed to fetch unclaimed deposits:', error);
        set({ unclaimedDeposits: [], isLoadingUnclaimed: false });
      }
    },

    claimDeposit: async (txid: string, vout: number, maxFeeSats?: bigint) => {
      try {
        await BreezService.claimDeposit(txid, vout, maxFeeSats);
      } finally {
        get().listUnclaimedDeposits();
        get().refreshBalance();
      }
    },

    getOnchainReceiveAddress: async () => {
      return BreezService.getOnchainReceiveAddress();
    },

    getSparkReceiveAddress: async () => {
      return BreezService.getSparkReceiveAddress();
    },

    createInvoice: async (amountSats: bigint, description?: string) => {
      set({ isCreatingInvoice: true });
      try {
        const invoice = await BreezService.createInvoice(amountSats, description);
        set({ isCreatingInvoice: false });
        return invoice;
      } catch (error) {
        set({ isCreatingInvoice: false });
        throw error;
      }
    },

    sendPayment: async (input: string, amountSats?: bigint, comment?: string) => {
      const payment = await BreezService.sendPayment(input, amountSats, comment);
      get().refreshBalance();
      return payment;
    },

    dismissIncomingPayment: () => {
      set((state) => ({
        lastPresentedIncomingPaymentId: state.incomingPayment?.id ?? state.lastPresentedIncomingPaymentId,
        incomingPayment: null,
      }));
    },

    // Update settings
    updateSettings: (newSettings: Partial<WalletSettings>) => {
      const fiatChanged = newSettings.fiatCurrency && newSettings.fiatCurrency !== get().settings.fiatCurrency;
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      }));
      if (fiatChanged) {
        get().fetchBtcPrice();
      }
    },

    fetchBtcPrice: async () => {
      const { fiatCurrency } = get().settings;
      try {
        const response = await fetch(
          `https://price.coin.space/api/v1/public/prices?cryptoIds=bitcoin@bitcoin&fiat=${fiatCurrency.toLowerCase()}`
        );
        if (!response.ok) throw new Error(`Price API ${response.status}`);
        const data = await response.json();
        const price = data?.[0]?.price;
        if (typeof price === 'number' && price > 0) {
          set({ btcFiatPrice: price });
        }
      } catch (error) {
        console.error('[WalletStore] Failed to fetch BTC price:', error);
      }
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
  }),
  {
    name: 'starr-wallet-settings',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state) => ({ settings: state.settings }),
    merge: (persisted, current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...(persisted as Partial<WalletState>)?.settings,
      },
    }),
  },
));
