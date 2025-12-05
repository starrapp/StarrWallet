/**
 * Tor/Onion Address Utilities
 * 
 * Utilities for handling Tor .onion addresses in React Native.
 * Uses native Tor module (react-native-nitro-tor) for secure connections.
 */

/**
 * Check if a URL is a Tor .onion address
 */
export function isOnionAddress(url: string): boolean {
  return /\.onion(?::\d+)?/.test(url);
}

/**
 * Extract the .onion host from a URL
 */
export function extractOnionHost(url: string): string | null {
  const match = url.match(/([a-z0-9]{56}\.onion)(?::(\d+))?/i);
  return match ? match[1] : null;
}

import { TorService } from '@/services/tor';

/**
 * Check if Tor proxy is available and running
 */
export function isTorProxyAvailable(): boolean {
  return TorService.isTorRunning();
}

/**
 * Get Tor proxy configuration
 * 
 * Returns SOCKS5 proxy settings if Tor is running
 */
export function getTorProxyConfig(): { host: string; port: number } | null {
  if (!TorService.isTorRunning()) {
    return null;
  }

  // Tor runs locally, so host is always localhost
  return {
    host: '127.0.0.1',
    port: TorService.getSocksPort(),
  };
}

/**
 * Prepare a request for Tor routing if needed
 * 
 * Returns information about whether Tor is required and available
 */
export function prepareTorRequest(url: string): {
  url: string;
  requiresTor: boolean;
  proxy?: { host: string; port: number };
  torAvailable: boolean;
} {
  const isOnion = isOnionAddress(url);
  const proxy = getTorProxyConfig();
  const torAvailable = TorService.isAvailable();
  
  return {
    url,
    requiresTor: isOnion,
    proxy: isOnion && proxy ? proxy : undefined,
    torAvailable,
  };
}

