/**
 * Configuration Service
 * 
 * Manages runtime configuration for LDK and LND services.
 * Settings are stored in AsyncStorage and can be updated without rebuilding.
 * Environment variables take precedence, but user-configured values override them.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CONFIG_KEYS = {
  LDK_REST_URL: 'starr_config_ldk_rest_url',
  LDK_API_KEY: 'starr_config_ldk_api_key',
  LND_ENABLED: 'starr_config_lnd_enabled',
  LND_REST_URL: 'starr_config_lnd_rest_url',
  LND_MACAROON: 'starr_config_lnd_macaroon',
  LND_CERT: 'starr_config_lnd_cert',
  LND_CONNECT_URL: 'starr_config_lnd_connect_url',
  PREFERRED_SERVICE: 'starr_config_preferred_service', // 'ldk' | 'lnd' | 'auto'
} as const;

export interface LDKConfig {
  restUrl: string;
  apiKey?: string;
}

export interface LNDConfig {
  enabled: boolean;
  restUrl: string;
  macaroon: string;
  cert?: string;
  connectUrl?: string;
}

export type PreferredService = 'ldk' | 'lnd' | 'auto';

class ConfigServiceImpl {
  /**
   * Get LDK configuration from storage
   */
  async getLDKConfig(): Promise<LDKConfig | null> {
    try {
      const restUrl = await AsyncStorage.getItem(CONFIG_KEYS.LDK_REST_URL);
      const apiKey = await AsyncStorage.getItem(CONFIG_KEYS.LDK_API_KEY);
      
      if (!restUrl || restUrl.trim() === '') {
        return null;
      }
      
      return {
        restUrl: restUrl.trim(),
        apiKey: apiKey || undefined,
      };
    } catch (error) {
      console.error('[ConfigService] Error getting LDK config:', error);
      return null;
    }
  }

  /**
   * Save LDK configuration
   */
  async setLDKConfig(config: LDKConfig): Promise<void> {
    try {
      if (config.restUrl && config.restUrl.trim() !== '') {
        await AsyncStorage.setItem(CONFIG_KEYS.LDK_REST_URL, config.restUrl.trim());
        if (config.apiKey) {
          await AsyncStorage.setItem(CONFIG_KEYS.LDK_API_KEY, config.apiKey);
        } else {
          await AsyncStorage.removeItem(CONFIG_KEYS.LDK_API_KEY);
        }
      } else {
        // Clear LDK config if URL is empty
        await AsyncStorage.removeItem(CONFIG_KEYS.LDK_REST_URL);
        await AsyncStorage.removeItem(CONFIG_KEYS.LDK_API_KEY);
      }
    } catch (error) {
      console.error('[ConfigService] Error saving LDK config:', error);
      throw error;
    }
  }

  /**
   * Get LND configuration from storage
   */
  async getLNDConfig(): Promise<LNDConfig | null> {
    try {
      const enabled = await AsyncStorage.getItem(CONFIG_KEYS.LND_ENABLED);
      const restUrl = await AsyncStorage.getItem(CONFIG_KEYS.LND_REST_URL);
      const macaroon = await AsyncStorage.getItem(CONFIG_KEYS.LND_MACAROON);
      const cert = await AsyncStorage.getItem(CONFIG_KEYS.LND_CERT);
      const connectUrl = await AsyncStorage.getItem(CONFIG_KEYS.LND_CONNECT_URL);
      
      if (enabled !== 'true') {
        return null;
      }
      
      // If we have a connect URL, that's sufficient
      if (connectUrl && connectUrl.trim() !== '') {
        return {
          enabled: true,
          restUrl: '',
          macaroon: '',
          connectUrl: connectUrl.trim(),
        };
      }
      
      // Otherwise need REST URL and macaroon
      if (!restUrl || !macaroon || restUrl.trim() === '' || macaroon.trim() === '') {
        return null;
      }
      
      return {
        enabled: true,
        restUrl: restUrl.trim(),
        macaroon: macaroon.trim(),
        cert: cert || undefined,
      };
    } catch (error) {
      console.error('[ConfigService] Error getting LND config:', error);
      return null;
    }
  }

  /**
   * Save LND configuration
   */
  async setLNDConfig(config: Partial<LNDConfig>): Promise<void> {
    try {
      if (config.enabled === false) {
        // Clear all LND config
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_ENABLED);
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_REST_URL);
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_MACAROON);
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_CERT);
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_CONNECT_URL);
        return;
      }
      
      await AsyncStorage.setItem(CONFIG_KEYS.LND_ENABLED, 'true');
      
      if (config.connectUrl && config.connectUrl.trim() !== '') {
        // Use LND Connect URL (clears individual fields)
        await AsyncStorage.setItem(CONFIG_KEYS.LND_CONNECT_URL, config.connectUrl.trim());
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_REST_URL);
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_MACAROON);
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_CERT);
      } else if (config.restUrl && config.macaroon) {
        // Use individual fields (clears connect URL)
        await AsyncStorage.setItem(CONFIG_KEYS.LND_REST_URL, config.restUrl.trim());
        await AsyncStorage.setItem(CONFIG_KEYS.LND_MACAROON, config.macaroon.trim());
        await AsyncStorage.removeItem(CONFIG_KEYS.LND_CONNECT_URL);
        
        if (config.cert) {
          await AsyncStorage.setItem(CONFIG_KEYS.LND_CERT, config.cert);
        } else {
          await AsyncStorage.removeItem(CONFIG_KEYS.LND_CERT);
        }
      }
    } catch (error) {
      console.error('[ConfigService] Error saving LND config:', error);
      throw error;
    }
  }

  /**
   * Get preferred service
   */
  async getPreferredService(): Promise<PreferredService> {
    try {
      const service = await AsyncStorage.getItem(CONFIG_KEYS.PREFERRED_SERVICE);
      if (service === 'ldk' || service === 'lnd' || service === 'auto') {
        return service;
      }
      return 'auto';
    } catch (error) {
      console.error('[ConfigService] Error getting preferred service:', error);
      return 'auto';
    }
  }

  /**
   * Set preferred service
   */
  async setPreferredService(service: PreferredService): Promise<void> {
    try {
      await AsyncStorage.setItem(CONFIG_KEYS.PREFERRED_SERVICE, service);
    } catch (error) {
      console.error('[ConfigService] Error saving preferred service:', error);
      throw error;
    }
  }

  /**
   * Clear all configuration
   */
  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(CONFIG_KEYS.LDK_REST_URL),
        AsyncStorage.removeItem(CONFIG_KEYS.LDK_API_KEY),
        AsyncStorage.removeItem(CONFIG_KEYS.LND_ENABLED),
        AsyncStorage.removeItem(CONFIG_KEYS.LND_REST_URL),
        AsyncStorage.removeItem(CONFIG_KEYS.LND_MACAROON),
        AsyncStorage.removeItem(CONFIG_KEYS.LND_CERT),
        AsyncStorage.removeItem(CONFIG_KEYS.LND_CONNECT_URL),
        AsyncStorage.removeItem(CONFIG_KEYS.PREFERRED_SERVICE),
      ]);
    } catch (error) {
      console.error('[ConfigService] Error clearing config:', error);
      throw error;
    }
  }
}

export const ConfigService = new ConfigServiceImpl();
