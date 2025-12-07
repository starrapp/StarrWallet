/**
 * LDK Service
 * 
 * Lightning Development Kit (LDK) integration using LDK Node.
 * 
 * This service provides Lightning Network functionality using LDK.
 * It supports two modes:
 * 1. REST API mode: Connect to an LDK Node running as a separate service
 * 2. Native mode: Use embedded LDK Node (requires native modules)
 * 
 * For now, we implement REST API mode. Native mode will require:
 * - iOS: Swift bindings to LDK's Rust core
 * - Android: Kotlin/Java bindings to LDK's Rust core
 * 
 * LDK Node REST API documentation:
 * https://github.com/lightningdevkit/ldk-node
 */

import { Buffer } from 'buffer';
import { LDK_CONFIG, isLDKConfigured, isLDKRestMode, isLDKNativeMode } from '@/config/ldk';
import type { Balance, Invoice, LightningPayment, LSPInfo, NodeInfo } from '@/types/wallet';

// LDK Node REST API response types
interface LDKNodeInfoResponse {
  node_id: string;
  listening_addresses?: string[];
  alias?: string;
  color?: string;
  block_height?: number;
  network?: string;
}

interface LDKBalanceResponse {
  total: number;
  confirmed: number;
  unconfirmed: number;
  lightning: number;
  pending_incoming?: number;
  pending_outgoing?: number;
}

interface LDKInvoiceResponse {
  invoice: string;
  payment_hash: string;
  amount_msat?: number;
  description?: string;
  expires_at?: number;
}

interface LDKPaymentResponse {
  payment_hash: string;
  preimage?: string;
  amount_msat: number;
  fee_msat?: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: number;
  completed_at?: number;
}

interface LDKPaymentListResponse {
  payments: LDKPaymentResponse[];
}

interface LDKChannelResponse {
  channel_id: string;
  counterparty_node_id: string;
  funding_txo?: {
    txid: string;
    index: number;
  };
  channel_value_sats: number;
  unspendable_punishment_reserve?: number;
  user_channel_id: number;
  balance_msat: number;
  outbound_capacity_msat: number;
  inbound_capacity_msat: number;
  confirmations_required?: number;
  confirmations?: number;
  is_outbound: boolean;
  is_channel_ready: boolean;
  is_usable: boolean;
  is_public: boolean;
  cltv_expiry_delta?: number;
}

class LDKServiceImpl {
  private config = LDK_CONFIG;
  private isInitialized = false;
  private nodeId: string | null = null;

  /**
   * Initialize LDK service
   * For now, only REST API mode is supported
   */
  async initialize(mnemonic?: string): Promise<void> {
    if (this.isInitialized) {
      console.log('[LDKService] Already initialized');
      return;
    }

    if (!isLDKConfigured()) {
      throw new Error(
        'LDK not configured. Set EXPO_PUBLIC_LDK_REST_URL or EXPO_PUBLIC_LDK_DATA_DIR in .env file.'
      );
    }

    if (isLDKRestMode()) {
      // REST API mode - verify connection
      try {
        const info = await this.getInfo();
        this.nodeId = info.pubkey;
        this.isInitialized = true;
        console.log('[LDKService] Initialized successfully (REST API mode)');
      } catch (error) {
        console.error('[LDKService] Initialization failed:', error);
        throw new Error(
          `Failed to connect to LDK Node: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'Make sure LDK Node is running and accessible at the configured REST URL.'
        );
      }
    } else if (isLDKNativeMode()) {
      // Native mode - TODO: Implement native module integration
      throw new Error(
        'Native LDK mode not yet implemented. ' +
        'This requires creating native modules for iOS and Android. ' +
        'For now, please use REST API mode by setting EXPO_PUBLIC_LDK_REST_URL.'
      );
    } else {
      throw new Error('LDK configuration incomplete');
    }
  }

  /**
   * Make a request to LDK Node REST API
   */
  private async ldkRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!isLDKRestMode() || !this.config.restUrl) {
      throw new Error('LDK REST API not configured');
    }

    const url = `${this.config.restUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add API key if configured
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LDK API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        throw new Error(
          `Network error: Unable to reach LDK Node at ${this.config.restUrl}. ` +
          'Check that LDK Node is running and the URL is correct.'
        );
      }
      throw error;
    }
  }

  /**
   * Get node information
   */
  async getInfo(): Promise<NodeInfo> {
    const info = await this.ldkRequest<LDKNodeInfoResponse>('/node');

    return {
      id: info.node_id,
      pubkey: info.node_id,
      alias: info.alias,
      color: info.color,
      network: (info.network || 'testnet') as 'bitcoin' | 'testnet' | 'signet' | 'regtest',
      blockHeight: info.block_height || 0,
      channelsCount: 0, // Will be updated when we fetch channels
    };
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<Balance> {
    const balance = await this.ldkRequest<LDKBalanceResponse>('/balance');

    return {
      lightning: Math.floor((balance.lightning || 0) / 1000), // Convert msat to sat
      onchain: balance.confirmed || 0,
      pendingIncoming: Math.floor((balance.pending_incoming || 0) / 1000),
      pendingOutgoing: Math.floor((balance.pending_outgoing || 0) / 1000),
      lastUpdated: new Date(),
    };
  }

  /**
   * Create a Lightning invoice
   */
  async createInvoice(
    amountSats: number,
    description?: string,
    expireSeconds: number = 3600
  ): Promise<Invoice> {
    const invoice = await this.ldkRequest<LDKInvoiceResponse>('/invoice', {
      method: 'POST',
      body: JSON.stringify({
        amount_msat: amountSats * 1000, // Convert sat to msat
        description: description || 'Starr Wallet Payment',
        expiry_secs: expireSeconds,
      }),
    });

    const expiresAt = invoice.expires_at
      ? new Date(invoice.expires_at * 1000)
      : new Date(Date.now() + expireSeconds * 1000);

    return {
      bolt11: invoice.invoice,
      paymentHash: invoice.payment_hash,
      amountSats,
      description: invoice.description || description,
      expiresAt,
      createdAt: new Date(),
    };
  }

  /**
   * Pay a Lightning invoice
   */
  async payInvoice(bolt11: string, amountSats?: number): Promise<LightningPayment> {
    const payment = await this.ldkRequest<LDKPaymentResponse>('/payment', {
      method: 'POST',
      body: JSON.stringify({
        invoice: bolt11,
        amount_msat: amountSats ? amountSats * 1000 : undefined,
      }),
    });

    if (payment.status === 'failed') {
      throw new Error('Payment failed');
    }

    return {
      id: payment.payment_hash,
      type: 'send',
      status: payment.status === 'completed' ? 'completed' : 'pending',
      amountSats: Math.floor(payment.amount_msat / 1000),
      feeSats: payment.fee_msat ? Math.floor(payment.fee_msat / 1000) : 0,
      invoice: bolt11,
      paymentHash: payment.payment_hash,
      preimage: payment.preimage,
      timestamp: new Date(payment.created_at * 1000),
      completedAt: payment.completed_at ? new Date(payment.completed_at * 1000) : undefined,
    };
  }

  /**
   * List payments
   */
  async listPayments(): Promise<LightningPayment[]> {
    const response = await this.ldkRequest<LDKPaymentListResponse>('/payments');

    return response.payments.map((p) => ({
      id: p.payment_hash,
      type: 'send',
      status: p.status === 'completed' ? 'completed' : p.status === 'failed' ? 'failed' : 'pending',
      amountSats: Math.floor(p.amount_msat / 1000),
      feeSats: p.fee_msat ? Math.floor(p.fee_msat / 1000) : 0,
      paymentHash: p.payment_hash,
      preimage: p.preimage,
      timestamp: new Date(p.created_at * 1000),
      completedAt: p.completed_at ? new Date(p.completed_at * 1000) : undefined,
    }));
  }

  /**
   * Get current LSP info
   * LDK Node manages LSP connections internally
   */
  async getCurrentLSP(): Promise<LSPInfo | null> {
    // LDK Node handles LSP internally, so we return a generic LSP info
    // In a real implementation, you'd query LDK Node for LSP details
    const info = await this.getInfo();
    
    return {
      id: info.pubkey,
      name: 'LDK Node LSP',
      host: this.config.restUrl?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || '',
      pubkey: info.pubkey,
      baseFeeSats: 1000,
      feeRate: 0.001,
      minChannelSize: 10000,
      maxChannelSize: 16777215,
      isActive: true,
      isDefault: true,
    };
  }

  /**
   * Parse a BOLT11 invoice
   */
  async parseInvoice(bolt11: string): Promise<{
    paymentHash: string;
    amountMsat?: number;
    description?: string;
    expiresAt?: Date;
  }> {
    // LDK Node should have an endpoint to decode invoices
    // For now, we'll make a basic parse attempt
    // In production, use LDK Node's decode invoice endpoint
    try {
      const response = await this.ldkRequest<{
        payment_hash: string;
        amount_msat?: number;
        description?: string;
        expiry?: number;
      }>('/invoice/decode', {
        method: 'POST',
        body: JSON.stringify({ invoice: bolt11 }),
      });

      return {
        paymentHash: response.payment_hash,
        amountMsat: response.amount_msat,
        description: response.description,
        expiresAt: response.expiry ? new Date(response.expiry * 1000) : undefined,
      };
    } catch (error) {
      // Fallback: basic parsing without full decode
      console.warn('[LDKService] Invoice decode failed, using fallback:', error);
      return {
        paymentHash: '', // Would need proper parsing
        amountMsat: undefined,
        description: undefined,
      };
    }
  }

  /**
   * Sync node with network
   */
  async syncNode(): Promise<void> {
    // LDK Node handles syncing internally
    // This endpoint might trigger a sync if available
    try {
      await this.ldkRequest('/sync', { method: 'POST' });
    } catch (error) {
      // Sync endpoint might not exist, that's okay
      console.log('[LDKService] Sync endpoint not available (LDK Node handles this internally)');
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    this.isInitialized = false;
    this.nodeId = null;
    console.log('[LDKService] Shutdown complete');
  }
}

// Singleton instance
export const LDKService = new LDKServiceImpl();
