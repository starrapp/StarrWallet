/**
 * LND Service
 * 
 * Direct connection to LND (Lightning Network Daemon) nodes.
 * Supports both regular HTTPS and Tor .onion addresses.
 * 
 * This service allows users to connect to their own LND nodes
 * (e.g., running on Start9 Embassy, Umbrel, or self-hosted).
 * 
 * Note: For .onion addresses, Tor proxy support is required.
 * The actual Tor routing depends on system configuration or VPN.
 */

import { Buffer } from 'buffer';
import { getLNDConfig, getLNDConnectURL, isLNDConfigured } from '@/config/lnd';
import { ConfigService } from '@/services/config';
import { parseLndConnectUrl } from '@/utils/lndConnect';
import { isOnionAddress, prepareTorRequest } from '@/utils/tor';
import { TorService } from '@/services/tor';
import { TOR_CONFIG } from '@/config/tor';
import type { Balance, Invoice, LightningPayment, LSPInfo, NodeInfo } from '@/types/wallet';

interface LNDConfig {
  restUrl: string;
  macaroon: string;
  cert?: string;
}

interface LNDGetInfoResponse {
  identity_pubkey: string;
  alias?: string;
  color?: string;
  num_pending_channels: number;
  num_active_channels: number;
  num_peers: number;
  block_height: number;
  block_hash: string;
  synced_to_chain: boolean;
  testnet: boolean;
  chains: Array<{ chain: string; network: string }>;
  uris: string[];
  best_header_timestamp: string;
  version?: string;
}

interface LNDChannelBalanceResponse {
  balance: string;
  pending_open_balance: string;
}

interface LNDWalletBalanceResponse {
  total_balance: string;
  confirmed_balance: string;
  unconfirmed_balance: string;
}

interface LNDListChannelsResponse {
  channels: Array<{
    active: boolean;
    remote_pubkey: string;
    channel_point: string;
    chan_id: string;
    capacity: string;
    local_balance: string;
    remote_balance: string;
    unsettled_balance: string;
    total_satoshis_sent: string;
    total_satoshis_received: string;
    num_updates: string;
    pending_htlcs: any[];
    csv_delay: number;
    private: boolean;
    initiator: boolean;
    chan_status_flags: string;
    local_chan_reserve_sat: string;
    remote_chan_reserve_sat: string;
    static_remote_key: boolean;
    commitment_type: string;
    lifetime: string;
    uptime: string;
    close_address?: string;
    push_amount_sat: string;
    thaw_height: number;
    local_constraints: any;
    remote_constraints: any;
  }>;
}

interface LNDAddInvoiceResponse {
  r_hash: string;
  payment_request: string;
  add_index: string;
}

interface LNDSendPaymentResponse {
  payment_error: string;
  payment_preimage: string;
  payment_route?: {
    total_time_lock: number;
    total_fees: string;
    total_amt: string;
    hops: any[];
  };
  payment_hash: string;
}

class LNDServiceImpl {
  private config: LNDConfig | null = null;
  private _isInitialized = false;

  /**
   * Initialize LND service with configuration
   */
  async initialize(config?: Partial<LNDConfig>): Promise<void> {
    if (this._isInitialized) {
      console.log('[LNDService] Already initialized');
      return;
    }

    // Use provided config or load from environment
    if (config) {
      this.config = {
        restUrl: config.restUrl || '',
        macaroon: config.macaroon || '',
        cert: config.cert,
      };
    } else {
      await this.loadConfig();
      
      if (!this.config) {
        const configured = await isLNDConfigured();
        if (!configured) {
          throw new Error(
            'LND not configured. Please configure LND Node in the Channels tab.'
          );
        }
      }
    }

    // Ensure config is loaded
    if (!this.config) {
      await this.loadConfig();
    }
    
    if (!this.config || !this.config.restUrl || !this.config.macaroon) {
      throw new Error('LND configuration incomplete: missing restUrl or macaroon');
    }

    // Test connection
    try {
      await this.getInfo();
      this._isInitialized = true;
      console.log('[LNDService] Initialized successfully');
    } catch (error) {
      console.error('[LNDService] Initialization failed:', error);
      throw new Error(
        `Failed to connect to LND node: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Make an authenticated request to LND REST API
   */
  private async lndRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.config) {
      throw new Error('LND service not initialized');
    }

    // Ensure config is loaded
    if (!this.config) {
      await this.loadConfig();
    }
    
    if (!this.config) {
      throw new Error('LND not configured');
    }
    
    const url = `${this.config.restUrl}${endpoint}`;
    
    // Check if this is a .onion address and handle Tor routing
    const torInfo = prepareTorRequest(url);
    
    if (torInfo.requiresTor) {
      // Ensure Tor is available and running
      if (!torInfo.torAvailable) {
        throw new Error(
          'Tor module not available. Rebuild app with development build to enable Tor support.'
        );
      }

      // Auto-start Tor if enabled and not running
      if (!TorService.isTorRunning()) {
        if (TOR_CONFIG.autoStart || TOR_CONFIG.enabled) {
          try {
            console.log('[LNDService] Auto-starting Tor for .onion connection...');
            await TorService.startTor();
          } catch (error) {
            throw new Error(
              `Failed to start Tor for .onion connection: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
              'Please start Tor manually from settings or check your network connection.'
            );
          }
        } else {
          throw new Error(
            'Tor is required for .onion addresses but is not running. ' +
            'Please enable Tor in settings or start it manually.'
          );
        }
      }
    }

    // Decode macaroon (can be base64 or hex)
    let macaroonBytes: string;
    try {
      // Try base64 first
      atob(this.config.macaroon);
      macaroonBytes = this.config.macaroon;
    } catch {
      // If not base64, assume it's already in the right format
      macaroonBytes = this.config.macaroon;
    }

    const headers: HeadersInit = {
      'Grpc-Metadata-macaroon': macaroonBytes,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add TLS cert if provided (for self-signed certs)
    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    // Note: React Native fetch doesn't support custom CA certs directly
    // For self-signed certs, you may need a native module or accept the risk
    // In production, use proper certificates

    try {
      let response: Response;

      // Use Tor service for .onion addresses
      if (torInfo.requiresTor && TorService.isTorRunning()) {
        console.log('[LNDService] Making request through Tor:', url);
        response = await TorService.makeRequest(url, fetchOptions);
      } else {
        // Regular fetch for non-onion addresses
        response = await fetch(url, fetchOptions);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LND API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        if (isOnionAddress(url)) {
          throw new Error(
            'Failed to connect to .onion address. ' +
            'Tor may not be running or connection failed. ' +
            'Please check Tor status in settings.'
          );
        }
        throw new Error(
          `Network error: Unable to reach LND node at ${this.config.restUrl}. ` +
          'Check your connection and node address.'
        );
      }
      throw error;
    }
  }

  /**
   * Get LND node information
   */
  async getInfo(): Promise<NodeInfo> {
    const info = await this.lndRequest<LNDGetInfoResponse>('/v1/getinfo');

    return {
      id: info.identity_pubkey,
      alias: info.alias,
      color: info.color,
      pubkey: info.identity_pubkey,
      network: info.testnet ? 'testnet' : 'bitcoin',
      blockHeight: info.block_height,
      channelsCount: info.num_active_channels,
    };
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<Balance> {
    const [channelBalance, walletBalance, channels] = await Promise.all([
      this.lndRequest<LNDChannelBalanceResponse>('/v1/balance/channels'),
      this.lndRequest<LNDWalletBalanceResponse>('/v1/balance/blockchain'),
      this.lndRequest<LNDListChannelsResponse>('/v1/channels'),
    ]);

    // Calculate pending amounts from channels
    const pendingChannels = channels.channels.filter((ch) => !ch.active);
    const pendingIncoming = pendingChannels.reduce(
      (sum, ch) => sum + parseInt(ch.remote_balance || '0', 10),
      0
    );
    const pendingOutgoing = pendingChannels.reduce(
      (sum, ch) => sum + parseInt(ch.local_balance || '0', 10),
      0
    );

    return {
      lightning: parseInt(channelBalance.balance || '0', 10),
      onchain: parseInt(walletBalance.confirmed_balance || '0', 10),
      pendingIncoming,
      pendingOutgoing,
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
    const invoice = await this.lndRequest<LNDAddInvoiceResponse>('/v1/invoices', {
      method: 'POST',
      body: JSON.stringify({
        value: amountSats.toString(),
        memo: description || 'Starr Wallet Payment',
        expiry: expireSeconds.toString(),
      }),
    });

    return {
      bolt11: invoice.payment_request,
      paymentHash: Buffer.from(invoice.r_hash, 'base64').toString('hex'),
      amountSats,
      description,
      expiresAt: new Date(Date.now() + expireSeconds * 1000),
      createdAt: new Date(),
    };
  }

  /**
   * Pay a Lightning invoice
   */
  async payInvoice(bolt11: string, amountSats?: number): Promise<LightningPayment> {
    const payment = await this.lndRequest<LNDSendPaymentResponse>('/v1/channels/transactions', {
      method: 'POST',
      body: JSON.stringify({
        payment_request: bolt11,
        amt: amountSats?.toString(),
        fee_limit: {
          fixed: '1000', // Max fee in sats
        },
      }),
    });

    if (payment.payment_error) {
      throw new Error(`Payment failed: ${payment.payment_error}`);
    }

    const paymentHash = Buffer.from(payment.payment_hash, 'base64').toString('hex');
    const totalAmt = payment.payment_route
      ? parseInt(payment.payment_route.total_amt || '0', 10)
      : amountSats || 0;
    const feeSats = payment.payment_route
      ? parseInt(payment.payment_route.total_fees || '0', 10)
      : 0;

    return {
      id: paymentHash,
      type: 'send',
      status: 'completed',
      amountSats: totalAmt,
      feeSats,
      invoice: bolt11,
      paymentHash,
      preimage: payment.payment_preimage
        ? Buffer.from(payment.payment_preimage, 'base64').toString('hex')
        : undefined,
      timestamp: new Date(),
      completedAt: new Date(),
    };
  }

  /**
   * List payments
   */
  async listPayments(): Promise<LightningPayment[]> {
    // LND doesn't have a direct list payments endpoint
    // We'd need to track payments or use invoices
    // For now, return empty array
    // In production, you'd implement payment tracking
    return [];
  }

  /**
   * Get current LSP info (for this LND node)
   */
  async getCurrentLSP(): Promise<LSPInfo> {
    const info = await this.getInfo();
    const channels = await this.lndRequest<LNDListChannelsResponse>('/v1/channels');

    // Calculate total capacity
    const totalCapacity = channels.channels.reduce(
      (sum, ch) => sum + parseInt(ch.capacity || '0', 10),
      0
    );

    return {
      id: info.pubkey,
      name: info.alias || 'My LND Node',
      host: this.config!.restUrl.replace(/^https?:\/\//, '').replace(/\/v1.*$/, ''),
      pubkey: info.pubkey,
      baseFeeSats: 1000, // Default, should be configurable
      feeRate: 0.001, // 0.1% default
      minChannelSize: 10000,
      maxChannelSize: 16777215, // Max channel size
      isActive: true,
      isDefault: true,
    };
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    this._isInitialized = false;
    this.config = null;
    console.log('[LNDService] Shutdown complete');
  }
}

// Singleton instance
export const LNDService = new LNDServiceImpl();

