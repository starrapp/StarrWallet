/**
 * Core wallet types for Starr
 */

// Wallet state
export interface WalletState {
  isInitialized: boolean;
  isUnlocked: boolean;
  isConnected: boolean;
  hasBackup: boolean;
}

// Balance information
export interface Balance {
  // Lightning balance in satoshis
  lightning: number;
  // On-chain balance in satoshis (if applicable)
  onchain: number;
  // Pending incoming in satoshis
  pendingIncoming: number;
  // Pending outgoing in satoshis
  pendingOutgoing: number;
  // Last updated timestamp
  lastUpdated: Date;
}

// Transaction types
export type TransactionType = 'send' | 'receive';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'expired';

// Lightning payment
export interface LightningPayment {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amountSats: number;
  feeSats?: number;
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
  amountSats?: number;
  description?: string;
  expiresAt: Date;
  createdAt: Date;
}

// LSP (Liquidity Service Provider) information
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

// Channel information
export interface Channel {
  id: string;
  state: 'pending' | 'active' | 'inactive' | 'closing' | 'closed';
  localBalance: number;
  remoteBalance: number;
  capacity: number;
  remotePubkey: string;
  shortChannelId?: string;
  isUsable: boolean;
}

// Node information
export interface NodeInfo {
  id: string;
  alias?: string;
  color?: string;
  pubkey: string;
  network: 'bitcoin' | 'testnet' | 'signet' | 'regtest';
  blockHeight: number;
  channelsCount: number;
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
export type ParsedInputType =
  | 'bolt11_invoice'
  | 'bitcoin_address'
  | 'spark_address'
  | 'spark_invoice'
  | 'lnurl_pay'
  | 'lnurl_withdraw'
  | 'unknown';

export interface ParsedBolt11 {
  type: 'bolt11_invoice';
  bolt11: string;
  paymentHash: string;
  amountMsat?: number;
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
  amount?: number;
  tokenIdentifier?: string;
  description?: string;
  expiryTime?: number;
  senderPublicKey?: string;
}

export interface ParsedLnurlPay {
  type: 'lnurl_pay';
  minSendable: number;
  maxSendable: number;
}

export interface ParsedLnurlWithdraw {
  type: 'lnurl_withdraw';
  minWithdrawable: number;
  maxWithdrawable: number;
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
export type SendPaymentMethodType = 'lightning' | 'spark_transfer' | 'onchain';

export interface PrepareSendResult {
  paymentMethod: SendPaymentMethodType;
  amountSats: number;
  /** Lightning network fee (sats) */
  lightningFeeSats?: number;
  /** Spark transfer fee (sats), when invoice supports both */
  sparkTransferFeeSats?: number;
  /** On-chain fee estimate (sats), for Bitcoin/Spark address */
  onchainFeeSats?: number;
  /** Description or recipient from request */
  description?: string;
}

// --- List payments request (filters + pagination)
export interface ListPaymentsFilter {
  typeFilter?: ('send' | 'receive')[];
  statusFilter?: ('pending' | 'completed' | 'failed' | 'expired')[];
  fromTimestamp?: number;
  toTimestamp?: number;
  offset?: number;
  limit?: number;
  sortAscending?: boolean;
}

// --- Unclaimed deposit (on-chain claim)
export interface UnclaimedDeposit {
  txid: string;
  vout: number;
  amountSats: number;
  requiredFeeSats: number;
  claimError?: string;
}

// Error types
export interface WalletError {
  code: string;
  message: string;
  details?: unknown;
}

// Currency types
export type BitcoinUnit = 'BTC' | 'SATS';
export type FiatCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'INR' | 'MXN' | 'BRL' | 'KRW';
export type Currency = BitcoinUnit | FiatCurrency;

// Settings
export interface WalletSettings {
  // Display
  currency: Currency;
  theme: 'dark' | 'light' | 'system';
  
  // Security
  biometricEnabled: boolean;
  pinEnabled: boolean;
  autoLockMinutes: number;
  
  // Network
  preferredLSP?: string;
  
  // Backup
  autoBackupEnabled: boolean;
  backupProvider?: 'icloud' | 'google' | 'local';
}

