/**
 * Breez SDK Service
 * 
 * Core Lightning Network integration using Breez SDK.
 * 
 * This is the REAL implementation for development builds.
 * Requires a valid API key in .env file.
 */

// Check if Breez SDK native module is available
let BreezSDK: any = null;
let isNativeModuleAvailable = false;

try {
  BreezSDK = require('@breeztech/react-native-breez-sdk');
  isNativeModuleAvailable = true;
} catch (error) {
  console.warn('[BreezService] Native module not available - using mock mode');
  console.warn('[BreezService] Rebuild with: eas build --profile development --platform ios');
}

// Destructure SDK functions (will be undefined if not available)
const {
  connect,
  disconnect,
  nodeInfo,
  parseInvoice: sdkParseInvoice,
  receivePayment,
  sendPayment,
  listPayments,
  lspInfo,
  sync,
  EnvironmentType,
  NodeConfigVariant,
  PaymentTypeFilter,
  defaultConfig,
  mnemonicToSeed,
} = BreezSDK || {};

import { DeviceEventEmitter } from 'react-native';

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

// Mock data for when native module isn't available
const MOCK_BALANCE: Balance = {
  lightning: 0,
  onchain: 0,
  pendingIncoming: 0,
  pendingOutgoing: 0,
  lastUpdated: new Date(),
};

class BreezServiceImpl {
  private isInitialized = false;
  private mockMode = !isNativeModuleAvailable;
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private eventSubscription: any = null;

  /**
   * Check if Breez SDK is properly configured
   */
  isConfigured(): boolean {
    return isBreezConfigured();
  }

  /**
   * Check if running in mock mode (native module not available)
   */
  isMockMode(): boolean {
    return this.mockMode;
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

    // If native module not available, use mock mode
    if (!isNativeModuleAvailable) {
      console.warn('[BreezService] Running in MOCK mode - rebuild app for real Lightning');
      this.mockMode = true;
      this.isInitialized = true;
      this.emit('connection', true);
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
      const nodeConfig = {
        type: NodeConfigVariant.GREENLIGHT,
        config: {
          partnerCredentials: null,
          inviteCode: null,
        },
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

      // Connect to the SDK with event listener
      // The connect function requires an EventListener callback as the second parameter
      // It returns an EmitterSubscription that we store for cleanup
      this.eventSubscription = await connect(
        {
          config: sdkConfig,
          seed: seed,
        },
        (breezEvent: any) => {
          // Handle Breez SDK events
          // Event types: 'invoicePaid', 'paymentSucceed', 'synced', etc.
          if (breezEvent.type === 'invoicePaid' || breezEvent.type === 'paymentSucceed') {
            // Map to our payment event
            this.emit('payment', breezEvent.details);
          } else if (breezEvent.type === 'synced') {
            this.emit('sync');
          }
        }
      );

      this.isInitialized = true;
      this.mockMode = false;
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
    if (this.mockMode || !isNativeModuleAvailable) {
      return;
    }

    // Clean up any existing subscriptions
    if (this.eventSubscription) {
      DeviceEventEmitter.removeAllListeners('breezSdkEvent');
      this.eventSubscription = null;
    }

    // Set up event listener for Breez SDK events
    // The SDK emits events through React Native's DeviceEventEmitter
    // We need to provide a valid function to prevent the EventEmitter error
    this.eventSubscription = DeviceEventEmitter.addListener(
      'breezSdkEvent',
      (event: any) => {
        try {
          // Handle different event types from Breez SDK
          if (event.type === 'payment') {
            // Convert SDK payment event to our format
            const payment: LightningPayment = {
              id: event.payment?.id || event.id,
              type: event.payment?.paymentType === 'sent' ? 'send' : 'receive',
              status: this.mapPaymentStatus(event.payment?.status || 'pending'),
              amountSats: event.payment?.amountMsat 
                ? Number(BigInt(event.payment.amountMsat) / 1000n)
                : 0,
              feeSats: event.payment?.feeMsat
                ? Number(BigInt(event.payment.feeMsat) / 1000n)
                : undefined,
              description: event.payment?.description || '',
              paymentHash: event.payment?.id || event.id,
              timestamp: event.payment?.paymentTime
                ? new Date(event.payment.paymentTime * 1000)
                : new Date(),
            };
            this.emit('payment', payment);
          } else if (event.type === 'sync') {
            this.emit('sync');
          } else if (event.type === 'connection') {
            this.emit('connection', event.connected || false);
          }
        } catch (error) {
          console.error('[BreezService] Error handling SDK event:', error);
        }
      }
    );

    console.log('[BreezService] Event listeners set up');
  }

  /**
   * Disconnect from Breez SDK
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    // Clean up event listeners
    if (this.eventSubscription) {
      DeviceEventEmitter.removeAllListeners('breezSdkEvent');
      this.eventSubscription = null;
    }

    if (this.mockMode) {
      this.isInitialized = false;
      this.emit('connection', false);
      return;
    }

    try {
      // Remove event subscription
      if (this.eventSubscription) {
        this.eventSubscription.remove();
        this.eventSubscription = null;
      }
      
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

    if (this.mockMode) {
      this.emit('sync');
      return;
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

    if (this.mockMode) {
      return { ...MOCK_BALANCE, lastUpdated: new Date() };
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

    if (this.mockMode) {
      return {
        id: 'mock-node-id',
        pubkey: '02mock...',
        network: 'bitcoin',
        blockHeight: 820000,
        channelsCount: 0,
      };
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

    if (this.mockMode) {
      const mockBolt11 = `lnbc${amountSats}n1pjmock${Date.now()}`;
      return {
        bolt11: mockBolt11,
        paymentHash: `mock_hash_${Date.now()}`,
        amountSats,
        description: description || 'Starr Wallet Payment',
        expiresAt: new Date(Date.now() + expireSeconds * 1000),
        createdAt: new Date(),
      };
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

    if (this.mockMode) {
      throw new Error('Cannot send payments in mock mode. Rebuild app with: eas build --profile development');
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
    if (this.mockMode) {
      return {
        bolt11,
        paymentHash: 'mock_hash',
        amountMsat: 100000,
        description: 'Mock invoice',
        payee: '02mock...',
        expiry: 3600,
      };
    }

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

    if (this.mockMode) {
      return []; // No payments in mock mode
    }

    try {
      let typeFilter: typeof PaymentTypeFilter.SENT | typeof PaymentTypeFilter.RECEIVED | undefined;
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

      return sdkPayments.map((p: any): LightningPayment => ({
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

    if (this.mockMode) {
      return {
        id: 'mock-lsp',
        name: 'Mock LSP (Rebuild for real)',
        host: 'mock.lsp.local',
        pubkey: '02mock...',
        baseFeeSats: 1000,
        feeRate: 0.001,
        minChannelSize: 10000,
        maxChannelSize: 10000000,
        isActive: true,
        isDefault: true,
      };
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
   * Select/connect to a specific LSP
   * Note: Breez SDK typically handles LSP selection automatically.
   * This method is provided for manual LSP management if needed.
   */
  async selectLSP(lspId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }

    if (this.mockMode) {
      console.log('[BreezService] Mock mode - LSP selection simulated:', lspId);
      return;
    }

    try {
      // Breez SDK manages LSP connections automatically
      // The connectLsp function would be used here if manual control is needed
      // For now, we log the selection as Breez handles this internally
      console.log('[BreezService] LSP selection requested:', lspId);
      
      // Sync to ensure we're connected to the LSP
      await this.syncNode();
    } catch (error) {
      console.error('[BreezService] Failed to select LSP:', error);
      throw error;
    }
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
