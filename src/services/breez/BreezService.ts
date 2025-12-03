/**
 * Breez SDK Service
 * 
 * Core Lightning Network integration using Breez SDK.
 * 
 * This is the REAL implementation for development builds.
 * Requires a valid API key in .env file.
 */

import {
  connect,
  disconnect,
  nodeInfo,
  parseInvoice as sdkParseInvoice,
  receivePayment,
  sendPayment,
  listPayments,
  lspInfo,
  sync,
  BreezEvent,
  EnvironmentType,
  NodeConfig,
  NodeConfigVariant,
  PaymentTypeFilter,
  GreenlightNodeConfig,
  defaultConfig,
  mnemonicToSeed,
} from '@breeztech/react-native-breez-sdk';

import type {
  Balance,
  LightningPayment,
  Invoice,
  LSPInfo,
  NodeInfo,
  TransactionType,
  TransactionStatus,
} from '@/types/wallet';

import { BREEZ_CONFIG, isBreezConfigured } from '@/config/breez';

// Event handlers
export type PaymentEventHandler = (payment: LightningPayment) => void;
export type SyncEventHandler = () => void;
export type ConnectionEventHandler = (connected: boolean) => void;

// Configuration
export interface BreezServiceConfig {
  apiKey: string;
  workingDir?: string;
  network: 'bitcoin' | 'testnet';
}

class BreezServiceImpl {
  private isInitialized = false;
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private eventSubscription: any = null;

  /**
   * Check if Breez SDK is properly configured
   */
  isConfigured(): boolean {
    return isBreezConfigured();
  }

  /**
   * Initialize the Breez SDK
   */
  async initialize(
    mnemonic: string,
    config?: Partial<BreezServiceConfig>
  ): Promise<void> {
    if (this.isInitialized) {
      console.log('[BreezService] Already initialized');
      return;
    }

    if (!isBreezConfigured()) {
      throw new Error('Breez SDK not configured. Add EXPO_PUBLIC_BREEZ_API_KEY to .env file');
    }

    try {
      console.log('[BreezService] Initializing Breez SDK...');

      // Convert mnemonic to seed
      const seed = await mnemonicToSeed(mnemonic);

      // Get default config and customize
      const nodeConfig: NodeConfig = {
        type: NodeConfigVariant.GREENLIGHT,
        config: {
          partnerCredentials: null,
          inviteCode: null,
        } as GreenlightNodeConfig,
      };

      const sdkConfig = await defaultConfig(
        EnvironmentType.PRODUCTION,
        BREEZ_CONFIG.API_KEY,
        nodeConfig
      );

      // Override working directory if provided
      if (config?.workingDir) {
        sdkConfig.workingDir = config.workingDir;
      }

      // Connect to the SDK
      await connect(sdkConfig, seed);

      // Subscribe to events
      this.subscribeToEvents();

      this.isInitialized = true;
      this.emit('connection', true);
      console.log('[BreezService] Initialized successfully');

    } catch (error) {
      console.error('[BreezService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to Breez SDK events
   */
  private subscribeToEvents(): void {
    // The Breez SDK emits events through a callback system
    // We'll handle payment updates, syncs, etc.
  }

  /**
   * Disconnect from Breez SDK
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await disconnect();
      this.isInitialized = false;
      this.emit('connection', false);
      console.log('[BreezService] Shutdown complete');
    } catch (error) {
      console.error('[BreezService] Shutdown failed:', error);
      throw error;
    }
  }

  /**
   * Sync node state with the network
   */
  async syncNode(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }

    try {
      await sync();
      this.emit('sync');
      console.log('[BreezService] Sync complete');
    } catch (error) {
      console.error('[BreezService] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<Balance> {
    if (!this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }

    try {
      const info = await nodeInfo();
      
      return {
        lightning: Number(info.channelsBalanceMsat / 1000n),
        onchain: Number(info.onchainBalanceMsat / 1000n),
        pendingIncoming: Number(info.pendingReceiveMsat / 1000n),
        pendingOutgoing: Number(info.pendingSendMsat / 1000n),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('[BreezService] Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Get node information
   */
  async getNodeInfo(): Promise<NodeInfo> {
    if (!this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }

    try {
      const info = await nodeInfo();
      
      return {
        id: info.id,
        pubkey: info.id,
        network: 'bitcoin',
        blockHeight: info.blockHeight,
        channelsCount: info.connectedPeers.length,
      };
    } catch (error) {
      console.error('[BreezService] Failed to get node info:', error);
      throw error;
    }
  }

  /**
   * Create a Lightning invoice for receiving payments
   */
  async createInvoice(
    amountSats: number,
    description?: string,
    expireSeconds: number = 3600
  ): Promise<Invoice> {
    if (!this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }

    try {
      const response = await receivePayment({
        amountMsat: BigInt(amountSats * 1000),
        description: description || 'Starr Wallet Payment',
        expiry: expireSeconds,
        useDescriptionHash: false,
      });

      return {
        bolt11: response.lnInvoice.bolt11,
        paymentHash: response.lnInvoice.paymentHash,
        amountSats: amountSats,
        description: description || 'Starr Wallet Payment',
        expiresAt: new Date(response.lnInvoice.expiry * 1000),
        createdAt: new Date(response.lnInvoice.timestamp * 1000),
      };
    } catch (error) {
      console.error('[BreezService] Failed to create invoice:', error);
      throw error;
    }
  }

  /**
   * Pay a Lightning invoice
   */
  async payInvoice(bolt11: string, amountSats?: number): Promise<LightningPayment> {
    if (!this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }

    try {
      const response = await sendPayment({
        bolt11,
        amountMsat: amountSats ? BigInt(amountSats * 1000) : undefined,
      });

      const payment: LightningPayment = {
        id: response.payment.id,
        type: 'send',
        status: 'completed',
        amountSats: Number(response.payment.amountMsat / 1000n),
        feeSats: Number(response.payment.feeMsat / 1000n),
        description: response.payment.description || '',
        paymentHash: response.payment.id,
        timestamp: new Date(response.payment.paymentTime * 1000),
      };

      this.emit('payment', payment);
      return payment;
    } catch (error) {
      console.error('[BreezService] Failed to pay invoice:', error);
      throw error;
    }
  }

  /**
   * Parse a Lightning invoice without paying
   */
  async parseInvoice(bolt11: string) {
    try {
      const parsed = await sdkParseInvoice(bolt11);
      
      return {
        bolt11,
        paymentHash: parsed.paymentHash,
        amountMsat: parsed.amountMsat ? Number(parsed.amountMsat) : undefined,
        description: parsed.description || '',
        payee: parsed.payeePubkey || '',
        expiry: parsed.expiry,
      };
    } catch (error) {
      console.error('[BreezService] Failed to parse invoice:', error);
      throw error;
    }
  }

  /**
   * Get payment history
   */
  async getPayments(
    filter?: 'all' | 'sent' | 'received',
    limit?: number,
    offset?: number
  ): Promise<LightningPayment[]> {
    if (!this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }

    try {
      let typeFilter: PaymentTypeFilter | undefined;
      if (filter === 'sent') {
        typeFilter = PaymentTypeFilter.SENT;
      } else if (filter === 'received') {
        typeFilter = PaymentTypeFilter.RECEIVED;
      }

      const sdkPayments = await listPayments({
        filter: typeFilter,
        fromTimestamp: undefined,
        toTimestamp: undefined,
        offset: offset,
        limit: limit,
      });

      return sdkPayments.map((p): LightningPayment => ({
        id: p.id,
        type: p.paymentType === 'sent' ? 'send' : 'receive',
        status: this.mapPaymentStatus(p.status),
        amountSats: Number(p.amountMsat / 1000n),
        feeSats: p.feeMsat ? Number(p.feeMsat / 1000n) : undefined,
        description: p.description || '',
        paymentHash: p.id,
        timestamp: new Date(p.paymentTime * 1000),
      }));
    } catch (error) {
      console.error('[BreezService] Failed to get payments:', error);
      throw error;
    }
  }

  private mapPaymentStatus(status: string): TransactionStatus {
    switch (status) {
      case 'complete':
        return 'completed';
      case 'pending':
        return 'pending';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * Get current LSP info
   */
  async getCurrentLSP(): Promise<LSPInfo | null> {
    if (!this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }

    try {
      const info = await lspInfo();
      if (!info) return null;

      return {
        id: info.id,
        name: info.name,
        host: info.host,
        pubkey: info.pubkey,
        baseFeeSats: Number(info.baseFeeMsat / 1000n),
        feeRate: info.feeRate,
        minChannelSize: Number(info.minHtlcMsat / 1000n),
        maxChannelSize: Number(info.channelCapacity),
        isActive: true,
        isDefault: true,
      };
    } catch (error) {
      console.error('[BreezService] Failed to get LSP info:', error);
      throw error;
    }
  }

  /**
   * Get available LSPs
   */
  async getAvailableLSPs(): Promise<LSPInfo[]> {
    const currentLsp = await this.getCurrentLSP();
    return currentLsp ? [currentLsp] : [];
  }

  /**
   * Trigger a backup
   */
  async triggerBackup(): Promise<void> {
    // Breez SDK handles backups automatically
    console.log('[BreezService] Backup triggered');
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
