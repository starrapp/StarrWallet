/**
 * Core wallet types for Starr
 */

// Balance information
export interface Balance {
  // Lightning balance in satoshis
  lightning: bigint;
  // TODO(starr): Spark getInfo() does not expose on-chain balance yet.
  // Keep for existing Balance UI; remove/hide On-chain section when UI is updated.
  onchain: bigint;
  // TODO(starr): remove after Pending balances UI is removed.
  // Spark SDK does not expose pending incoming/outgoing balances.
  pendingIncoming: bigint;
  pendingOutgoing: bigint;
  // Last updated timestamp
  lastUpdated: Date;
}

// Transaction types
// TODO(starr): `expired` is kept for History UI filter compatibility.
// Spark listPayments exposes only completed/pending/failed.
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'expired';

// Lightning payment
export interface LightningPayment {
  id: string;
  type: 'send' | 'receive';
  status: TransactionStatus;
  amountSats: bigint;
  feeSats?: bigint;
  description?: string;
  invoice?: string;
  paymentHash: string;
  preimage?: string;
  timestamp: Date;
  completedAt?: Date;
}

// Invoice for receiving payments
export interface Invoice {
  bolt11: string;
  paymentHash: string;
  amountSats?: bigint;
  description?: string;
  expiresAt: Date;
  createdAt: Date;
}

// LSP (Liquidity Service Provider) information
// TODO(starr): Spark SDK has no LSP management API. Remove this type after Channels UI removal.
export interface LSPInfo {
  id: string;
  name: string;
  host: string;
  pubkey: string;
  baseFeeSats: number;
  feeRate: number; // PPM (parts per million)
  minChannelSize: number;
  maxChannelSize: number;
  isActive: boolean;
  isDefault: boolean;
}

// Node information
export interface NodeInfo {
  id: string;
  pubkey: string;
}

// Backup types
export type BackupType = 'cloud' | 'local' | 'manual';

export interface BackupState {
  lastBackup?: Date;
  backupType?: BackupType;
  channelStateHash?: string;
  isAutoBackupEnabled: boolean;
}

// --- Parsed input (Breez SDK parse)
export interface ParsedBolt11 {
  type: 'bolt11_invoice';
  bolt11: string;
  paymentHash: string;
  amountMsat?: bigint;
  description?: string;
  payee?: string;
  expiry?: number; // seconds from creation
}

export interface ParsedBitcoinAddress {
  type: 'bitcoin_address';
  address: string;
}

export interface ParsedSparkAddress {
  type: 'spark_address';
  address: string;
}

export interface ParsedSparkInvoice {
  type: 'spark_invoice';
  amount?: bigint;
  tokenIdentifier?: string;
  description?: string;
  expiryTime?: bigint;
  senderPublicKey?: string;
}

export interface ParsedLnurlPay {
  type: 'lnurl_pay';
  minSendable: bigint;
  maxSendable: bigint;
}

export interface ParsedLnurlWithdraw {
  type: 'lnurl_withdraw';
  minWithdrawable: bigint;
  maxWithdrawable: bigint;
}

export type ParsedInput =
  | ParsedBolt11
  | ParsedBitcoinAddress
  | ParsedSparkAddress
  | ParsedSparkInvoice
  | ParsedLnurlPay
  | ParsedLnurlWithdraw
  | { type: 'unknown'; raw: string };

// --- Prepare send payment (Breez SDK prepareSendPayment)
export interface PrepareSendResult {
  paymentMethod: 'lightning' | 'spark_transfer' | 'onchain';
  amountSats: bigint;
  /** Lightning network fee (sats) */
  lightningFeeSats?: bigint;
  /** Spark transfer fee (sats), when invoice supports both */
  sparkTransferFeeSats?: bigint;
  /** On-chain fee estimate (sats), for Bitcoin/Spark address */
  onchainFeeSats?: bigint;
  /** Description or recipient from request */
  description?: string;
}

// --- List payments request (filters + pagination)
export interface ListPaymentsFilter {
  typeFilter?: ('send' | 'receive')[];
  // TODO(starr): `expired` exists only for current History UI filter.
  // Spark SDK listPayments does not return `expired`.
  statusFilter?: ('pending' | 'completed' | 'failed' | 'expired')[];
  fromTimestamp?: number;
  toTimestamp?: number;
  offset?: number;
  limit?: number;
  sortAscending?: boolean;
}

// Currency types
export type Currency =
  | 'BTC'
  | 'SATS'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CAD'
  | 'AUD'
  | 'CHF'
  | 'CNY'
  | 'INR'
  | 'MXN'
  | 'BRL'
  | 'KRW';

// Settings
export interface WalletSettings {
  // Display
  currency: Currency;

  // Security
  biometricEnabled: boolean;

  // Backup
  autoBackupEnabled: boolean;
}
