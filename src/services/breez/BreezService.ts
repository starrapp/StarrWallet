/**
 * Breez SDK Service — Stub Implementation
 *
 * Stub that matches the Breez SDK API surface. Replace this with a real
 * implementation (e.g. @breeztech/react-native-breez-sdk) when integrating
 * the actual Breez SDK.
 */

import type {
  Balance,
  LightningPayment,
  Invoice,
  LSPInfo,
  NodeInfo,
  TransactionStatus,
  ParsedInput,
  PrepareSendResult,
  ListPaymentsFilter,
  UnclaimedDeposit,
} from '@/types/wallet';

import { isBreezConfigured } from '@/config/breez';

export type PaymentEventHandler = (payment: LightningPayment) => void;
export type SyncEventHandler = () => void;
export type ConnectionEventHandler = (connected: boolean) => void;

export interface BreezServiceConfig {
  apiKey: string;
  workingDir?: string;
  network: 'bitcoin' | 'testnet';
}

/** Alias for compatibility with consumers that import BreezConfig */
export type BreezConfig = BreezServiceConfig;

const STUB_BALANCE: Balance = {
  lightning: 0,
  onchain: 0,
  pendingIncoming: 0,
  pendingOutgoing: 0,
  lastUpdated: new Date(),
};

const STUB_LSP: LSPInfo = {
  id: 'stub-lsp',
  name: 'Stub LSP (no SDK)',
  host: 'stub.local',
  pubkey: '02stub...',
  baseFeeSats: 0,
  feeRate: 0,
  minChannelSize: 0,
  maxChannelSize: 0,
  isActive: false,
  isDefault: true,
};

class BreezServiceStub {
  private isInitialized = false;
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  isConfigured(): boolean {
    return isBreezConfigured();
  }

  isMockMode(): boolean {
    return true;
  }

  async initialize(
    _mnemonic: string,
    _config?: Partial<BreezServiceConfig>
  ): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.emit('connection', true);
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    this.isInitialized = false;
    this.emit('connection', false);
  }

  async syncNode(): Promise<void> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    this.emit('sync');
  }

  async getBalance(): Promise<Balance> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    return { ...STUB_BALANCE, lastUpdated: new Date() };
  }

  async getNodeInfo(): Promise<NodeInfo> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    return {
      id: 'stub-node-id',
      pubkey: '02stub...',
      network: 'bitcoin',
      blockHeight: 0,
      channelsCount: 0,
    };
  }

  async createInvoice(
    amountSats: number,
    description?: string,
    expireSeconds: number = 3600
  ): Promise<Invoice> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    const now = Date.now();
    return {
      bolt11: `lnbc${amountSats}n1pjmock${now}`,
      paymentHash: `stub_hash_${now}`,
      amountSats,
      description: description ?? 'Starr Wallet Payment',
      expiresAt: new Date(now + expireSeconds * 1000),
      createdAt: new Date(now),
    };
  }

  async payInvoice(_bolt11: string, _amountSats?: number): Promise<LightningPayment> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    throw new Error(
      'Cannot send payments: Breez SDK is not integrated. Replace this stub with the real SDK.'
    );
  }

  /**
   * Send to a Bitcoin on-chain address or Spark address.
   * Stub: throws until real SDK is integrated.
   */
  async sendToAddress(
    _address: string,
    _amountSats: number,
    _type: 'bitcoin' | 'spark'
  ): Promise<LightningPayment> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    throw new Error(
      `Sending to ${_type} address is not yet integrated. Replace this stub with the real SDK.`
    );
  }

  async parseInvoice(bolt11: string): Promise<{
    bolt11: string;
    paymentHash: string;
    amountMsat?: number;
    description: string;
    payee: string;
    expiry: number;
  }> {
    return {
      bolt11,
      paymentHash: 'stub_hash',
      amountMsat: undefined,
      description: 'Stub invoice',
      payee: '02stub...',
      expiry: 3600,
    };
  }

  /**
   * Parse any payment input (BOLT11, Bitcoin address, Spark, LNURL, etc.).
   * Stub: heuristics only; real SDK returns full typed result.
   */
  async parse(input: string): Promise<ParsedInput> {
    const raw = input.trim();
    if (!raw) return { type: 'unknown', raw: '' };

    const lower = raw.toLowerCase();

    if (lower.startsWith('lnbc') || lower.startsWith('lnbt') || lower.startsWith('lntb')) {
      const amountMatch = raw.match(/lnb[crt](\d+)/i);
      const amountMsat = amountMatch ? parseInt(amountMatch[1], 10) * 1000 : undefined;
      return {
        type: 'bolt11_invoice',
        bolt11: raw,
        paymentHash: 'stub_hash',
        amountMsat,
        description: 'Stub invoice',
        payee: '02stub...',
        expiry: 3600,
      } as ParsedInput;
    }

    if (lower.startsWith('bitcoin:')) {
      const address = raw.replace(/^bitcoin:/i, '').split('?')[0].trim();
      if (address.length >= 26 && address.length <= 62) {
        return { type: 'bitcoin_address', address };
      }
    }

    if (lower.startsWith('spark:') || /^[a-z0-9]{40,80}$/i.test(raw)) {
      const address = lower.startsWith('spark:') ? raw.slice(6).trim() : raw;
      return { type: 'spark_address', address };
    }

    if (lower.startsWith('lnurl') || (raw.startsWith('https://') && raw.includes('lnurl'))) {
      if (lower.includes('withdraw')) {
        return {
          type: 'lnurl_withdraw',
          minWithdrawable: 1000,
          maxWithdrawable: 1_000_000,
        };
      }
      return {
        type: 'lnurl_pay',
        minSendable: 1000,
        maxSendable: 10_000_000,
      };
    }

    return { type: 'unknown', raw };
  }

  /**
   * Prepare a send: validate and return amount + fees for confirmation.
   * Stub: returns stub fees; real SDK returns actual fees.
   */
  async prepareSendPayment(
    paymentRequest: string,
    amountSats?: number
  ): Promise<PrepareSendResult> {
    const parsed = await this.parse(paymentRequest);
    if (parsed.type === 'bolt11_invoice') {
      const amount = amountSats ?? (parsed.amountMsat != null ? Math.ceil(parsed.amountMsat / 1000) : 0);
      return {
        paymentMethod: 'lightning',
        amountSats: amount,
        lightningFeeSats: Math.max(1, Math.ceil(amount * 0.001)),
        sparkTransferFeeSats: 0,
        description: parsed.description,
      };
    }
    if (parsed.type === 'bitcoin_address') {
      return {
        paymentMethod: 'onchain',
        amountSats: amountSats ?? 0,
        onchainFeeSats: 500,
      };
    }
    if (parsed.type === 'spark_address') {
      return {
        paymentMethod: 'spark_transfer',
        amountSats: amountSats ?? 0,
        sparkTransferFeeSats: 1,
      };
    }
    throw new Error('Unsupported payment request type');
  }

  async getPayments(
    _filter?: 'all' | 'sent' | 'received',
    _limit?: number,
    _offset?: number
  ): Promise<LightningPayment[]> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    return [];
  }

  /**
   * List payments with filters and pagination (Breez SDK list_payments).
   */
  async listPayments(_filter?: ListPaymentsFilter): Promise<LightningPayment[]> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    return [];
  }

  /**
   * Get a single payment by id (Breez SDK get_payment).
   */
  async getPayment(_paymentId: string): Promise<LightningPayment | null> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    return null;
  }

  /**
   * Unclaimed on-chain deposits (when auto-claim failed).
   */
  async getUnclaimedDeposits(): Promise<UnclaimedDeposit[]> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    return [];
  }

  /**
   * Manually claim an on-chain deposit after user approves fee.
   */
  async claimDeposit(
    _txid: string,
    _vout: number,
    _maxFeeSats: number
  ): Promise<void> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    throw new Error('On-chain claim not integrated. Replace stub with real SDK.');
  }

  async getCurrentLSP(): Promise<LSPInfo | null> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    return STUB_LSP;
  }

  async getAvailableLSPs(): Promise<LSPInfo[]> {
    const current = await this.getCurrentLSP();
    return current ? [current] : [];
  }

  async selectLSP(_lspId: string): Promise<void> {
    if (!this.isInitialized) throw new Error('Breez SDK not initialized');
    // No-op in stub
  }

  async triggerBackup(): Promise<void> {
    // No-op in stub
  }

  async getBackupStatus(): Promise<{ synced: boolean; lastBackup?: Date }> {
    return { synced: true, lastBackup: new Date() };
  }

  on(event: 'payment', handler: PaymentEventHandler): void;
  on(event: 'sync', handler: SyncEventHandler): void;
  on(event: 'connection', handler: ConnectionEventHandler): void;
  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((handler) => handler(...args));
  }
}

export const BreezService = new BreezServiceStub();
