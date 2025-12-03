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
  lightning: number;
  onchain: number;
  total: number;
  pendingIncoming: number;
  pendingOutgoing: number;
  
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
    const lightning = balance?.lightning ?? 0;
    const onchain = balance?.onchain ?? 0;
    const total = lightning + onchain;
    const pendingIncoming = balance?.pendingIncoming ?? 0;
    const pendingOutgoing = balance?.pendingOutgoing ?? 0;

    return {
      lightning,
      onchain,
      total,
      pendingIncoming,
      pendingOutgoing,
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

