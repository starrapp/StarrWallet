/**
 * Balance Hook
 *
 * Convenient hook for accessing and formatting balance data.
 */

import { useMemo } from 'react';
import { useWalletStore } from '@/stores/walletStore';
import { formatSats, satsToBtc } from '@/utils/format';

interface UseBalanceReturn {
  // Raw values
  lightning: bigint;
  onchain: bigint;
  total: bigint;

  // Formatted values
  lightningFormatted: string;
  onchainFormatted: string;
  totalFormatted: string;
  totalBtc: string;

  // State
  isLoading: boolean;
  lastUpdated: Date | null;

  // Actions
  refresh: () => Promise<void>;
}

export const useBalance = (): UseBalanceReturn => {
  const { balance, isLoadingBalance, refreshBalance } = useWalletStore();

  const computed = useMemo(() => {
    const lightning = balance?.lightning ?? 0n;
    const onchain = balance?.onchain ?? 0n;
    const total = lightning + onchain;

    return {
      lightning,
      onchain,
      total,
      lightningFormatted: formatSats(lightning),
      onchainFormatted: formatSats(onchain),
      totalFormatted: formatSats(total),
      totalBtc: satsToBtc(total),
    };
  }, [balance]);

  return {
    ...computed,
    isLoading: isLoadingBalance,
    lastUpdated: balance?.lastUpdated ?? null,
    refresh: refreshBalance,
  };
};
