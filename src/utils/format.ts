/**
 * Formatting utilities for the wallet
 */

/**
 * Format satoshis with thousands separator
 */
export const formatSats = (sats: number): string => {
  return sats.toLocaleString('en-US');
};

/**
 * Format satoshis to BTC string
 */
export const satsToBtc = (sats: number): string => {
  const btc = sats / 100_000_000;
  return btc.toFixed(8);
};

/**
 * Parse BTC to satoshis
 */
export const btcToSats = (btc: number): number => {
  return Math.round(btc * 100_000_000);
};

/**
 * Truncate a string with ellipsis in the middle
 */
export const truncateMiddle = (str: string, startChars = 8, endChars = 8): string => {
  if (str.length <= startChars + endChars) return str;
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
};

/**
 * Format a Lightning invoice for display
 */
export const formatInvoice = (invoice: string): string => {
  return truncateMiddle(invoice, 10, 10);
};

/**
 * Format a public key or node ID
 */
export const formatPubkey = (pubkey: string): string => {
  return truncateMiddle(pubkey, 8, 8);
};

/**
 * Format a payment hash
 */
export const formatPaymentHash = (hash: string): string => {
  return truncateMiddle(hash, 6, 6);
};

/**
 * Format millisats to sats with proper rounding
 */
export const msatToSat = (msat: number): number => {
  return Math.floor(msat / 1000);
};

/**
 * Format sats to millisats
 */
export const satToMsat = (sat: number): number => {
  return sat * 1000;
};

/**
 * Format a fee rate (parts per million) to percentage
 */
export const ppmToPercent = (ppm: number): string => {
  return (ppm / 10000).toFixed(2) + '%';
};

/**
 * Format bytes to human readable size
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

