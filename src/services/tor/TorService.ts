/**
 * Tor Service
 * 
 * Manages native Tor daemon for secure .onion address connections.
 * Uses react-native-nitro-tor to run Tor daemon within the app.
 */

// Check if Tor native module is available
let RnTor: any = null;
let isTorModuleAvailable = false;

try {
  const torModule = require('react-native-nitro-tor');
  // The module might export differently - try common patterns
  RnTor = torModule.default || torModule.RnTor || torModule;
  
  // Verify the module has the expected methods
  if (RnTor && typeof RnTor.startTorIfNotRunning === 'function') {
    isTorModuleAvailable = true;
  } else {
    console.warn('[TorService] Tor module loaded but startTorIfNotRunning method not found');
    console.warn('[TorService] Available methods:', Object.keys(RnTor || {}));
    isTorModuleAvailable = false;
  }
} catch (error) {
  console.warn('[TorService] Native Tor module not available:', error);
  console.warn('[TorService] Tor support requires a development build');
}

import * as FileSystem from 'expo-file-system/legacy';
import { TOR_CONFIG, isTorConfigured } from '@/config/tor';
import { isOnionAddress } from '@/utils/tor';

interface TorStatus {
  isRunning: boolean;
  socksPort: number;
  error?: string;
}

class TorServiceImpl {
  private isRunning = false;
  private socksPort = 9050;
  private dataDir: string | null = null;
  private startupPromise: Promise<boolean> | null = null;

  /**
   * Initialize Tor service
   */
  async initialize(): Promise<void> {
    if (!isTorModuleAvailable) {
      console.warn('[TorService] Tor module not available - Tor support disabled');
      return;
    }

    if (!isTorConfigured()) {
      console.log('[TorService] Tor not configured - skipping initialization');
      return;
    }

    // Set up Tor data directory
    if (!this.dataDir) {
      const torDataDir = `${FileSystem.documentDirectory}tor/`;
      
      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(torDataDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(torDataDir, { intermediates: true });
      }
      
      this.dataDir = torDataDir;
    }

    this.socksPort = TOR_CONFIG.socksPort;

    console.log('[TorService] Initialized (not started yet)');
  }

  /**
   * Start Tor daemon
   */
  async startTor(): Promise<boolean> {
    if (!isTorModuleAvailable) {
      throw new Error('Tor module not available. Rebuild app with development build.');
    }

    if (this.isRunning) {
      console.log('[TorService] Tor already running');
      return true;
    }

    // If startup is in progress, wait for it
    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = this._startTorInternal();
    const result = await this.startupPromise;
    this.startupPromise = null;
    return result;
  }

  private async _startTorInternal(): Promise<boolean> {
    try {
      console.log('[TorService] Starting Tor daemon...');
      
      if (!isTorModuleAvailable || !RnTor) {
        throw new Error('Tor module not available. Rebuild app with development build.');
      }

      if (typeof RnTor.startTorIfNotRunning !== 'function') {
        console.error('[TorService] startTorIfNotRunning method not available');
        console.error('[TorService] Available methods:', Object.keys(RnTor));
        throw new Error('Tor module methods not available. The native module may not be properly linked.');
      }
      
      if (!this.dataDir) {
        await this.initialize();
      }

      const result = await RnTor.startTorIfNotRunning({
        data_dir: this.dataDir!,
        socks_port: this.socksPort,
        timeout_ms: 60000, // 60 second timeout
      });

      if (result.is_success) {
        this.isRunning = true;
        this.socksPort = result.socks_port || this.socksPort;
        console.log('[TorService] Tor started successfully on port', this.socksPort);
        return true;
      } else {
        const errorMsg = result.error_message || 'Unknown error';
        console.error('[TorService] Failed to start Tor:', errorMsg);
        throw new Error(`Failed to start Tor: ${errorMsg}`);
      }
    } catch (error) {
      console.error('[TorService] Tor startup error:', error);
      this.isRunning = false;
      // Don't throw - allow app to continue without Tor
      console.warn('[TorService] Continuing without Tor - features requiring Tor will be unavailable');
      return false;
    }
  }

  /**
   * Stop Tor daemon
   */
  async stopTor(): Promise<void> {
    if (!isTorModuleAvailable) {
      return;
    }

    if (!this.isRunning) {
      return;
    }

    try {
      console.log('[TorService] Stopping Tor daemon...');
      await RnTor.stopTor();
      this.isRunning = false;
      console.log('[TorService] Tor stopped');
    } catch (error) {
      console.error('[TorService] Error stopping Tor:', error);
      // Still mark as not running even if stop fails
      this.isRunning = false;
    }
  }

  /**
   * Check if Tor is running
   */
  isTorRunning(): boolean {
    return this.isRunning && isTorModuleAvailable;
  }

  /**
   * Get SOCKS5 proxy port
   */
  getSocksPort(): number {
    return this.socksPort;
  }

  /**
   * Get Tor status
   */
  getStatus(): TorStatus {
    return {
      isRunning: this.isRunning,
      socksPort: this.socksPort,
    };
  }

  /**
   * Make HTTP request through Tor
   */
  async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.isRunning) {
      throw new Error('Tor is not running. Start Tor before making requests.');
    }

    if (!isOnionAddress(url) && !TOR_CONFIG.enabled) {
      // If not an onion address and Tor not required, use regular fetch
      return fetch(url, options);
    }

    // For .onion addresses, we need to route through Tor SOCKS5 proxy
    // react-native-nitro-tor provides httpGet/httpPost methods
    try {
      const method = options.method || 'GET';
      const headers = options.headers || {};
      const body = options.body as string | undefined;

      let result: any;

      if (method === 'GET' || !method) {
        result = await RnTor.httpGet({
          url,
          headers: this._formatHeaders(headers),
        });
      } else if (method === 'POST') {
        result = await RnTor.httpPost({
          url,
          headers: this._formatHeaders(headers),
          body: body || '',
        });
      } else {
        // For other methods (PUT, DELETE, etc.), try POST as fallback
        // Note: react-native-nitro-tor may not support all HTTP methods
        console.warn(`[TorService] HTTP method ${method} not directly supported, using POST`);
        result = await RnTor.httpPost({
          url,
          headers: this._formatHeaders(headers),
          body: body || '',
        });
      }

      // Convert Tor response to fetch-like Response
      return this._createResponseFromTor(result);
    } catch (error) {
      console.error('[TorService] Tor request failed:', error);
      throw error;
    }
  }

  /**
   * Format headers for Tor request
   */
  private _formatHeaders(headers: HeadersInit): string {
    if (typeof headers === 'string') {
      return headers;
    }

    if (headers instanceof Headers) {
      const headerArray: string[] = [];
      headers.forEach((value, key) => {
        headerArray.push(`${key}: ${value}`);
      });
      return headerArray.join('\n');
    }

    if (Array.isArray(headers)) {
      return headers.map(([key, value]) => `${key}: ${value}`).join('\n');
    }

    // Object
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  /**
   * Create Response-like object from Tor result
   */
  private _createResponseFromTor(torResult: any): Response {
    // Create a mock Response object
    // Note: This is a simplified implementation
    const status = torResult.status_code || 200;
    const body = torResult.body || '';
    const error = torResult.error;

    if (error) {
      throw new Error(`Tor request failed: ${error}`);
    }

    // Return a Response-like object
    // In a real implementation, you might want to use a polyfill or create a proper Response
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: this._getStatusText(status),
      headers: new Headers(),
      json: async () => JSON.parse(body),
      text: async () => body,
      blob: async () => new Blob([body]),
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    } as Response;
  }

  private _getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
    };
    return statusTexts[status] || 'Unknown';
  }

  /**
   * Check if Tor module is available
   */
  isAvailable(): boolean {
    return isTorModuleAvailable;
  }

  /**
   * Shutdown Tor service
   */
  async shutdown(): Promise<void> {
    await this.stopTor();
    this.dataDir = null;
    console.log('[TorService] Shutdown complete');
  }
}

// Singleton instance
export const TorService = new TorServiceImpl();

