/**
 * Formatting utilities for the wallet
 */
import type { BitcoinUnit } from '@/types/wallet';

/**
 * Format satoshis with thousands separator
 */
export const formatSats = (sats: bigint): string => {
  return sats.toLocaleString('en-US');
};

export interface FormattedAmount {
  value: string;
  unit: string;
}

export const formatAmount = (sats: bigint, unit: BitcoinUnit): FormattedAmount => {
  if (unit === 'BTC') {
    return { value: satsToBtc(sats), unit: 'BTC' };
  }
  return { value: formatSats(sats), unit: 'sats' };
};

export const formatAmountStr = (sats: bigint, unit: BitcoinUnit): string => {
  const f = formatAmount(sats, unit);
  return `${f.value} ${f.unit}`;
};

export const formatSignedAmount = (
  sats: bigint,
  sign: '+' | '-',
  unit: BitcoinUnit
): FormattedAmount => {
  const formatted = formatAmount(sats, unit);
  return {
    ...formatted,
    value: `${sign}${formatted.value}`,
  };
};

export const formatSignedAmountStr = (
  sats: bigint,
  sign: '+' | '-',
  unit: BitcoinUnit
): string => {
  const f = formatAmount(sats, unit);
  return `${sign}${f.value} ${f.unit}`;
};

/**
 * Format satoshis to BTC decimal string (always positive, sign handled by caller)
 */
export const satsToBtc = (sats: bigint): string => {
  const whole = sats / 100_000_000n;
  const frac = (sats % 100_000_000n).toString().padStart(8, '0');
  return `${whole.toString()}.${frac}`;
};

/**
 * Convert millisats to sats with ceiling rounding
 */
export const msatToSatCeil = (msat: bigint): bigint => {
  return (msat + 999n) / 1000n;
};

/**
 * Convert sats to fiat string using BTC price
 */
export const formatFiat = (sats: bigint, btcPrice: number, fiatCurrency: string): string => {
  const btcValue = Number(sats) / 100_000_000;
  const fiatValue = btcValue * btcPrice;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: fiatCurrency,
  }).format(fiatValue);
};
