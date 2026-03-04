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
export type TransactionStatus = 'pending' | 'completed' | 'failed';

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
  domain: string;
  address?: string; // Lightning address if resolved via LN address
  commentAllowed: number;
  minSendable: bigint; // millisats
  maxSendable: bigint; // millisats
}

export type ParsedInput =
  | ParsedBolt11
  | ParsedBitcoinAddress
  | ParsedSparkAddress
  | ParsedSparkInvoice
  | ParsedLnurlPay
  | { type: 'unknown'; raw: string };

// --- Prepare send payment (Breez SDK prepareSendPayment / prepareLnurlPay)
export interface PrepareSendResult {
  paymentMethod: 'lightning' | 'spark_transfer' | 'onchain' | 'lnurl_pay';
  amountSats: bigint;
  feeSats: bigint;
  description?: string;
}

// --- List payments request (filters + pagination)
export interface ListPaymentsFilter {
  typeFilter?: ('send' | 'receive')[];
  statusFilter?: ('pending' | 'completed' | 'failed')[];
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
}
