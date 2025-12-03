/**
 * Breez SDK Service
 * 
 * Core Lightning Network integration using Breez SDK.
 * Handles all Lightning operations including payments, invoices, and channel management.
 * 
 * Architecture notes:
 * - Breez SDK runs an embedded Lightning node (Greenlight)
 * - Provides automatic channel management via LSP
 * - Handles submarine swaps for on-chain <-> Lightning
 */

import {
  connect,
  disconnect,
  nodeInfo,
  listPayments,
  sendPayment,
  receivePayment,
  parseInvoice,
  lspInfo,
  listLsps,
  connectLsp,
  sync,
  backup,
  backupStatus,
  BreezEvent,
  EventListener,
  NodeState,
  Payment,
  LspInformation,
  ReceivePaymentRequest,
  SendPaymentRequest,
  GreenlightCredentials,
  PaymentTypeFilter,
} from '@breeztech/react-native-breez-sdk';

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

class BreezServiceImpl {
  private isInitialized = false;
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private nodeState: NodeState | null = null;

  /**
   * Initialize the Breez SDK
   * Must be called before any other operations
   */
  async initialize(
    config: BreezConfig,
    seed: Uint8Array,
    credentials?: GreenlightCredentials
  ): Promise<void> {
    if (this.isInitialized) {
      console.log('[BreezService] Already initialized');
      return;
    }

    try {
      console.log('[BreezService] Initializing Breez SDK...');

      // Create event listener
      const eventListener: EventListener = {
        onEvent: (event: BreezEvent) => {
          this.handleEvent(event);
        },
      };

      // Connect to Breez SDK
      // Note: In production, you'll need to register for API keys at https://breez.technology/sdk/
      await connect(
        {
          apiKey: config.apiKey,
          workingDir: config.workingDir,
          network: config.network === 'bitcoin' ? 'bitcoin' : 'testnet',
        },
        seed,
        eventListener
      );

      // Get initial node state
      await this.syncNode();

      this.isInitialized = true;
      console.log('[BreezService] Initialization complete');
    } catch (error) {
      console.error('[BreezService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Breez SDK
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await disconnect();
      this.isInitialized = false;
      this.nodeState = null;
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
    try {
      await sync();
      const info = await nodeInfo();
      this.nodeState = info;
      this.emit('sync');
    } catch (error) {
      console.error('[BreezService] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<Balance> {
    const info = await nodeInfo();
    this.nodeState = info;

    return {
      lightning: info.channelsBalanceMsat / 1000, // Convert msat to sats
      onchain: info.onchainBalanceMsat / 1000,
      pendingIncoming: info.pendingReceiveMsat / 1000,
      pendingOutgoing: info.pendingSendMsat / 1000,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get node information
   */
  async getNodeInfo(): Promise<NodeInfo> {
    const info = await nodeInfo();
    this.nodeState = info;

    return {
      id: info.id,
      pubkey: info.id,
      network: 'bitcoin', // From config
      blockHeight: info.blockHeight,
      channelsCount: info.connectedPeers.length,
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
    const request: ReceivePaymentRequest = {
      amountMsat: amountSats * 1000, // Convert to millisats
      description: description || 'Starr Wallet Payment',
      expiry: expireSeconds,
    };

    const response = await receivePayment(request);

    return {
      bolt11: response.lnInvoice.bolt11,
      paymentHash: response.lnInvoice.paymentHash,
      amountSats: amountSats,
      description: description,
      expiresAt: new Date(Date.now() + expireSeconds * 1000),
      createdAt: new Date(),
    };
  }

  /**
   * Pay a Lightning invoice
   */
  async payInvoice(bolt11: string, amountSats?: number): Promise<LightningPayment> {
    // Parse invoice first to validate
    const parsed = await parseInvoice(bolt11);

    const request: SendPaymentRequest = {
      bolt11,
      // Only set amount if invoice doesn't have one (zero-amount invoice)
      amountMsat: amountSats ? amountSats * 1000 : undefined,
    };

    const response = await sendPayment(request);

    return this.mapPaymentToLightningPayment(response.payment);
  }

  /**
   * Parse a Lightning invoice without paying
   */
  async parseInvoice(bolt11: string) {
    return parseInvoice(bolt11);
  }

  /**
   * Get payment history
   */
  async getPayments(
    filter?: 'all' | 'sent' | 'received',
    limit?: number,
    offset?: number
  ): Promise<LightningPayment[]> {
    let typeFilter: PaymentTypeFilter | undefined;
    
    switch (filter) {
      case 'sent':
        typeFilter = PaymentTypeFilter.SENT;
        break;
      case 'received':
        typeFilter = PaymentTypeFilter.RECEIVED;
        break;
      default:
        typeFilter = undefined;
    }

    const payments = await listPayments({
      filter: typeFilter,
      fromTimestamp: undefined,
      toTimestamp: undefined,
      includeFailures: true,
      limit,
      offset,
    });

    return payments.map(this.mapPaymentToLightningPayment);
  }

  /**
   * Get available LSPs
   */
  async getAvailableLSPs(): Promise<LSPInfo[]> {
    const lsps = await listLsps();
    return lsps.map(this.mapLspToLSPInfo);
  }

  /**
   * Get current LSP info
   */
  async getCurrentLSP(): Promise<LSPInfo | null> {
    try {
      const info = await lspInfo();
      if (!info) return null;
      return this.mapLspToLSPInfo(info);
    } catch {
      return null;
    }
  }

  /**
   * Connect to a specific LSP
   */
  async selectLSP(lspId: string): Promise<void> {
    await connectLsp(lspId);
    console.log(`[BreezService] Connected to LSP: ${lspId}`);
  }

  /**
   * Trigger a backup
   */
  async triggerBackup(): Promise<void> {
    await backup();
    console.log('[BreezService] Backup triggered');
  }

  /**
   * Get backup status
   */
  async getBackupStatus(): Promise<{ synced: boolean; lastBackup?: Date }> {
    const status = await backupStatus();
    return {
      synced: status.backedUp,
      lastBackup: status.lastBackupTime ? new Date(status.lastBackupTime * 1000) : undefined,
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

  private handleEvent(event: BreezEvent): void {
    console.log('[BreezService] Event received:', event.type);

    switch (event.type) {
      case 'invoicePaid':
        if (event.details?.payment) {
          const payment = this.mapPaymentToLightningPayment(event.details.payment);
          this.emit('payment', payment);
        }
        break;
      case 'paymentSucceed':
        if (event.details?.payment) {
          const payment = this.mapPaymentToLightningPayment(event.details.payment);
          this.emit('payment', payment);
        }
        break;
      case 'synced':
        this.emit('sync');
        break;
      default:
        console.log('[BreezService] Unhandled event:', event.type);
    }
  }

  // Mappers
  private mapPaymentToLightningPayment = (payment: Payment): LightningPayment => {
    const type: TransactionType = payment.paymentType === 'received' ? 'receive' : 'send';
    
    let status: TransactionStatus = 'completed';
    if (payment.status === 'pending') status = 'pending';
    if (payment.status === 'failed') status = 'failed';

    return {
      id: payment.id,
      type,
      status,
      amountSats: payment.amountMsat / 1000,
      feeSats: payment.feeMsat ? payment.feeMsat / 1000 : undefined,
      description: payment.description,
      paymentHash: payment.paymentHash,
      preimage: payment.preimage,
      timestamp: new Date(payment.paymentTime * 1000),
    };
  };

  private mapLspToLSPInfo = (lsp: LspInformation): LSPInfo => {
    return {
      id: lsp.id,
      name: lsp.name,
      host: lsp.host,
      pubkey: lsp.pubkey,
      baseFeeSats: lsp.baseFeeMsat / 1000,
      feeRate: lsp.feeRate,
      minChannelSize: lsp.minHtlcMsat / 1000,
      maxChannelSize: lsp.channelCapacity,
      isActive: true,
      isDefault: false,
    };
  };
}

// Singleton instance
export const BreezService = new BreezServiceImpl();

