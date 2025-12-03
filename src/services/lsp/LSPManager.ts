/**
 * LSP Manager
 * 
 * Manages multiple Lightning Service Providers for redundancy.
 * 
 * Key features:
 * - Automatic LSP failover
 * - Health monitoring
 * - Fee comparison
 * - Capacity management
 * 
 * Following the recommendation to integrate multiple LSPs
 * to reduce single points of failure.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BreezService } from '../breez';
import type { LSPInfo } from '@/types/wallet';

const LSP_KEYS = {
  PREFERRED: 'starr_lsp_preferred',
  HISTORY: 'starr_lsp_history',
  HEALTH: 'starr_lsp_health',
} as const;

interface LSPHealth {
  id: string;
  lastCheck: Date;
  isHealthy: boolean;
  latencyMs: number;
  successRate: number;
  failCount: number;
}

interface LSPSelectionCriteria {
  preferLowestFee?: boolean;
  preferHighestCapacity?: boolean;
  preferFastest?: boolean;
  excludeIds?: string[];
}

class LSPManagerImpl {
  private lspHealth: Map<string, LSPHealth> = new Map();
  private currentLSP: LSPInfo | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize LSP manager
   */
  async initialize(): Promise<void> {
    // Load health data from storage
    const healthJson = await AsyncStorage.getItem(LSP_KEYS.HEALTH);
    if (healthJson) {
      const healthData: Record<string, LSPHealth> = JSON.parse(healthJson);
      Object.entries(healthData).forEach(([id, health]) => {
        this.lspHealth.set(id, {
          ...health,
          lastCheck: new Date(health.lastCheck),
        });
      });
    }

    // Start health monitoring
    this.startHealthMonitoring();

    console.log('[LSPManager] Initialized');
  }

  /**
   * Get all available LSPs with health info
   */
  async getAvailableLSPs(): Promise<(LSPInfo & { health?: LSPHealth })[]> {
    const lsps = await BreezService.getAvailableLSPs();
    
    return lsps.map((lsp) => ({
      ...lsp,
      health: this.lspHealth.get(lsp.id),
    }));
  }

  /**
   * Get currently connected LSP
   */
  async getCurrentLSP(): Promise<LSPInfo | null> {
    if (this.currentLSP) {
      return this.currentLSP;
    }
    
    this.currentLSP = await BreezService.getCurrentLSP();
    return this.currentLSP;
  }

  /**
   * Select the best LSP based on criteria
   */
  async selectBestLSP(criteria: LSPSelectionCriteria = {}): Promise<LSPInfo | null> {
    const lsps = await this.getAvailableLSPs();
    
    // Filter out unhealthy and excluded LSPs
    let candidates = lsps.filter((lsp) => {
      if (criteria.excludeIds?.includes(lsp.id)) return false;
      const health = this.lspHealth.get(lsp.id);
      return !health || health.isHealthy;
    });

    if (candidates.length === 0) {
      console.warn('[LSPManager] No healthy LSPs available');
      return null;
    }

    // Sort by criteria
    if (criteria.preferLowestFee) {
      candidates.sort((a, b) => {
        const feeA = a.baseFeeSats + (a.feeRate * 1000000); // Approximate for 1M sats
        const feeB = b.baseFeeSats + (b.feeRate * 1000000);
        return feeA - feeB;
      });
    } else if (criteria.preferHighestCapacity) {
      candidates.sort((a, b) => b.maxChannelSize - a.maxChannelSize);
    } else if (criteria.preferFastest) {
      candidates.sort((a, b) => {
        const healthA = this.lspHealth.get(a.id);
        const healthB = this.lspHealth.get(b.id);
        const latencyA = healthA?.latencyMs ?? Infinity;
        const latencyB = healthB?.latencyMs ?? Infinity;
        return latencyA - latencyB;
      });
    }

    return candidates[0];
  }

  /**
   * Connect to a specific LSP
   */
  async connectToLSP(lspId: string): Promise<boolean> {
    try {
      await BreezService.selectLSP(lspId);
      this.currentLSP = await BreezService.getCurrentLSP();
      
      // Save as preferred
      await AsyncStorage.setItem(LSP_KEYS.PREFERRED, lspId);
      
      console.log('[LSPManager] Connected to LSP:', lspId);
      return true;
    } catch (error) {
      console.error('[LSPManager] Failed to connect to LSP:', error);
      
      // Update health status
      const health = this.lspHealth.get(lspId) || {
        id: lspId,
        lastCheck: new Date(),
        isHealthy: true,
        latencyMs: 0,
        successRate: 1,
        failCount: 0,
      };
      health.failCount++;
      health.successRate = Math.max(0, health.successRate - 0.1);
      health.isHealthy = health.successRate > 0.5;
      this.lspHealth.set(lspId, health);
      
      return false;
    }
  }

  /**
   * Attempt automatic LSP failover
   */
  async failover(): Promise<boolean> {
    console.log('[LSPManager] Initiating failover');
    
    const currentId = this.currentLSP?.id;
    const newLSP = await this.selectBestLSP({
      excludeIds: currentId ? [currentId] : [],
      preferFastest: true,
    });

    if (!newLSP) {
      console.error('[LSPManager] No alternative LSP available');
      return false;
    }

    return this.connectToLSP(newLSP.id);
  }

  /**
   * Check health of all LSPs
   */
  async checkAllHealth(): Promise<void> {
    const lsps = await BreezService.getAvailableLSPs();

    for (const lsp of lsps) {
      await this.checkLSPHealth(lsp);
    }

    // Persist health data
    await this.persistHealthData();
  }

  /**
   * Check health of a single LSP
   */
  private async checkLSPHealth(lsp: LSPInfo): Promise<LSPHealth> {
    const startTime = Date.now();
    
    let health = this.lspHealth.get(lsp.id) || {
      id: lsp.id,
      lastCheck: new Date(),
      isHealthy: true,
      latencyMs: 0,
      successRate: 1,
      failCount: 0,
    };

    try {
      // Simple connectivity check - in production, you'd do actual probing
      // For now, we just update the timestamp
      const latency = Date.now() - startTime;
      
      health = {
        ...health,
        lastCheck: new Date(),
        latencyMs: latency,
        isHealthy: true,
      };
    } catch {
      health = {
        ...health,
        lastCheck: new Date(),
        isHealthy: false,
        failCount: health.failCount + 1,
        successRate: Math.max(0, health.successRate - 0.2),
      };
    }

    this.lspHealth.set(lsp.id, health);
    return health;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Check health every 5 minutes
    this.healthCheckInterval = setInterval(
      () => {
        this.checkAllHealth().catch(console.error);
      },
      5 * 60 * 1000
    );
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Persist health data to storage
   */
  private async persistHealthData(): Promise<void> {
    const healthData: Record<string, LSPHealth> = {};
    this.lspHealth.forEach((health, id) => {
      healthData[id] = health;
    });
    
    await AsyncStorage.setItem(LSP_KEYS.HEALTH, JSON.stringify(healthData));
  }

  /**
   * Get fee estimate for a payment amount
   */
  async estimateFees(amountSats: number): Promise<{ lspId: string; feeSats: number }[]> {
    const lsps = await this.getAvailableLSPs();
    
    return lsps
      .filter((lsp) => lsp.health?.isHealthy !== false)
      .map((lsp) => ({
        lspId: lsp.id,
        feeSats: lsp.baseFeeSats + Math.ceil((amountSats * lsp.feeRate) / 1000000),
      }))
      .sort((a, b) => a.feeSats - b.feeSats);
  }

  /**
   * Get LSP recommendation for a specific payment
   */
  async recommendLSPForPayment(amountSats: number): Promise<LSPInfo | null> {
    const fees = await this.estimateFees(amountSats);
    
    if (fees.length === 0) return null;

    // Get the cheapest healthy LSP
    const cheapestId = fees[0].lspId;
    const lsps = await this.getAvailableLSPs();
    
    return lsps.find((lsp) => lsp.id === cheapestId) || null;
  }
}

// Singleton instance
export const LSPManager = new LSPManagerImpl();

