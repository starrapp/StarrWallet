/**
 * LND Connect URL Parser
 * 
 * Parses LND Connect URLs in the format:
 * lndconnect://host:port?macaroon=...&cert=...
 * 
 * Used by Start9, Umbrel, and other LND management tools.
 */

export interface ParsedLNDConnect {
  restUrl: string;
  macaroon: string;
  cert?: string;
}

/**
 * Parse an LND Connect URL
 * 
 * @param url - LND Connect URL (e.g., lndconnect://host:port?macaroon=...&cert=...)
 * @returns Parsed connection details
 */
export function parseLndConnectUrl(url: string): ParsedLNDConnect {
  // Remove lndconnect:// prefix
  const cleanUrl = url.replace(/^lndconnect:\/\//, '');
  
  // Split host:port and query params
  const [hostPort, queryString] = cleanUrl.split('?');
  
  if (!hostPort) {
    throw new Error('Invalid LND Connect URL: missing host:port');
  }
  
  // Parse query parameters
  const params = new URLSearchParams(queryString || '');
  const macaroon = params.get('macaroon') || '';
  const cert = params.get('cert') || undefined;
  
  if (!macaroon) {
    throw new Error('Invalid LND Connect URL: missing macaroon');
  }
  
  // Determine protocol (default to https)
  const protocol = hostPort.startsWith('http') ? '' : 'https://';
  const restUrl = `${protocol}${hostPort}`;
  
  return {
    restUrl,
    macaroon,
    cert,
  };
}

/**
 * Build an LND Connect URL from connection details
 */
export function buildLndConnectUrl(
  host: string,
  port: number,
  macaroon: string,
  cert?: string
): string {
  const params = new URLSearchParams();
  params.set('macaroon', macaroon);
  if (cert) {
    params.set('cert', cert);
  }
  
  return `lndconnect://${host}:${port}?${params.toString()}`;
}

