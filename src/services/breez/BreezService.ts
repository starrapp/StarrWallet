/**
 * Breez SDK Service
 * 
 * Core Lightning Network integration using Breez SDK.
 * 
 * NOTE: This is a MOCK implementation for Expo Go development.
 * The real Breez SDK requires a development build with native code.
 * Run `eas build --profile development` for full Lightning functionality.
 */

// Check if we're in Expo Go (no native modules available)
const isExpoGo = (() => {
  try {
    // This will throw in Expo Go since native module isn't linked
    require('@breeztech/react-native-breez-sdk');
    return false;
  } catch {
    return true;
  }
})();

import type {
  Balance,
  LightningPayment,
  Invoice,
  LSPInfo,
  NodeInfo,
  TransactionStatus,
  TransactionType,
} from '@/types/wallet';

// Configuration
export interface BreezConfig {
  apiKey: string;
  workingDir: string;
  network: 'bitcoin' | 'testnet';
}

// Event handlers
export type PaymentEventHandler = (payment: LightningPayment) => void;
export type SyncEventHandler = () => void;
export type ConnectionEventHandler = (connected: boolean) => void;

// Mock data for Expo Go development
const MOCK_BALANCE: Balance = {
  lightning: 150000,
  onchain: 50000,
  pendingIncoming: 5000,
  pendingOutgoing: 0,
  lastUpdated: new Date(),
};

const MOCK_PAYMENTS: LightningPayment[] = [
  {
    id: '1',
    type: 'receive',
    status: 'completed',
    amountSats: 50000,
    description: 'Coffee payment',
    paymentHash: 'abc123...',
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: '2',
    type: 'send',
    status: 'completed',
    amountSats: 25000,
    feeSats: 10,
    description: 'Paid for lunch',
    paymentHash: 'def456...',
    timestamp: new Date(Date.now() - 7200000),
  },
  {
    id: '3',
    type: 'receive',
    status: 'completed',
    amountSats: 100000,
    description: 'Salary',
    paymentHash: 'ghi789...',
    timestamp: new Date(Date.now() - 86400000),
  },
];

const MOCK_LSPS: LSPInfo[] = [
  {
    id: 'lsp1',
    name: 'Breez LSP',
    host: 'lsp.breez.technology',
    pubkey: '031015a7839468a3c266d662d5bb21ea4cea24226936e2864a7ca4f2c3939836e0',
    baseFeeSats: 1000,
    feeRate: 1000, // 0.1%
    minChannelSize: 10000,
    maxChannelSize: 10000000,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'lsp2',
    name: 'Olympus LSP',
    host: 'lsp.olympus.io',
    pubkey: '02f1a8c87607f415c8f22c00593002775941dea48869ce23096af27b0cfdcc0b69',
    baseFeeSats: 500,
    feeRate: 1500,
    minChannelSize: 20000,
    maxChannelSize: 5000000,
    isActive: true,
    isDefault: false,
  },
];

class BreezServiceImpl {
  private isInitialized = false;
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  /**
   * Initialize the Breez SDK (mock in Expo Go)
   */
  async initialize(
    config: BreezConfig,
    seed: Uint8Array,
    credentials?: any
  ): Promise<void> {
    if (isExpoGo) {
      console.log('[BreezService] Running in MOCK mode (Expo Go)');
      console.log('[BreezService] For real Lightning, create a development build');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate init
      this.isInitialized = true;
      return;
    }

    // Real implementation would go here for development builds
    console.log('[BreezService] Initializing with real Breez SDK...');
    this.isInitialized = true;
  }

  /**
   * Disconnect from Breez SDK
   */
  async shutdown(): Promise<void> {
    this.isInitialized = false;
    console.log('[BreezService] Shutdown complete');
  }

  /**
   * Sync node state with the network
   */
  async syncNode(): Promise<void> {
    if (isExpoGo) {
      await new Promise(resolve => setTimeout(resolve, 300));
      this.emit('sync');
      return;
    }
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<Balance> {
    if (isExpoGo) {
      return { ...MOCK_BALANCE, lastUpdated: new Date() };
    }
    throw new Error('Not implemented');
  }

  /**
   * Get node information
   */
  async getNodeInfo(): Promise<NodeInfo> {
    return {
      id: 'mock-node-id',
      pubkey: '02mock...',
      network: 'bitcoin',
      blockHeight: 820000,
      channelsCount: 2,
    };
  }

  /**
   * Create a Lightning invoice for receiving payments
   */
  async createInvoice(
    amountSats: number,
    description?: string,
    expireSeconds: number = 3600
  ): Promise<Invoice> {
    if (isExpoGo) {
      const mockBolt11 = `lnbc${amountSats}n1pj9npnppp5mock${Date.now()}sp5mockdescqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq`;
      return {
        bolt11: mockBolt11,
        paymentHash: `mock_hash_${Date.now()}`,
        amountSats,
        description: description || 'Starr Wallet Payment',
        expiresAt: new Date(Date.now() + expireSeconds * 1000),
        createdAt: new Date(),
      };
    }
    throw new Error('Not implemented');
  }

  /**
   * Pay a Lightning invoice
   */
  async payInvoice(bolt11: string, amountSats?: number): Promise<LightningPayment> {
    if (isExpoGo) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate payment
      const payment: LightningPayment = {
        id: `payment_${Date.now()}`,
        type: 'send',
        status: 'completed',
        amountSats: amountSats || 1000,
        feeSats: 1,
        description: 'Mock payment',
        paymentHash: `hash_${Date.now()}`,
        timestamp: new Date(),
      };
      this.emit('payment', payment);
      return payment;
    }
    throw new Error('Not implemented');
  }

  /**
   * Parse a Lightning invoice without paying
   */
  async parseInvoice(bolt11: string) {
    if (isExpoGo) {
      return {
        bolt11,
        paymentHash: 'mock_hash',
        amountMsat: 100000000, // 100k sats
        description: 'Mock invoice',
        payee: '02mock...',
      };
    }
    throw new Error('Not implemented');
  }

  /**
   * Get payment history
   */
  async getPayments(
    filter?: 'all' | 'sent' | 'received',
    limit?: number,
    offset?: number
  ): Promise<LightningPayment[]> {
    if (isExpoGo) {
      let payments = [...MOCK_PAYMENTS];
      if (filter === 'sent') {
        payments = payments.filter(p => p.type === 'send');
      } else if (filter === 'received') {
        payments = payments.filter(p => p.type === 'receive');
      }
      return payments.slice(offset || 0, limit ? (offset || 0) + limit : undefined);
    }
    throw new Error('Not implemented');
  }

  /**
   * Get available LSPs
   */
  async getAvailableLSPs(): Promise<LSPInfo[]> {
    return MOCK_LSPS;
  }

  /**
   * Get current LSP info
   */
  async getCurrentLSP(): Promise<LSPInfo | null> {
    return MOCK_LSPS[0];
  }

  /**
   * Connect to a specific LSP
   */
  async selectLSP(lspId: string): Promise<void> {
    console.log(`[BreezService] Mock: Connected to LSP: ${lspId}`);
  }

  /**
   * Trigger a backup
   */
  async triggerBackup(): Promise<void> {
    console.log('[BreezService] Mock: Backup triggered');
  }

  /**
   * Get backup status
   */
  async getBackupStatus(): Promise<{ synced: boolean; lastBackup?: Date }> {
    return {
      synced: true,
      lastBackup: new Date(),
    };
  }

  // Event handling
  on(event: 'payment', handler: PaymentEventHandler): void;
  on(event: 'sync', handler: SyncEventHandler): void;
  on(event: 'connection', handler: ConnectionEventHandler): void;
  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach((handler) => handler(...args));
  }
}

// Singleton instance
export const BreezService = new BreezServiceImpl();
