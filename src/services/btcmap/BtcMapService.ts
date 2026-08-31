/**
 * BTC Map API v4 client
 *
 * Public read-only REST API for Bitcoin-accepting merchants.
 * @see https://api.btcmap.org/
 */

import type {
  BtcMapPlaceDetails,
  BtcMapSearchParams,
  BtcMapSearchedPlace,
  NearbyPlacesResult,
  PaymentMethod,
} from '@/types/btcmap';

const BASE_URL = 'https://api.btcmap.org/v4';

const PLACE_FIELDS = [
  'id',
  'lat',
  'lon',
  'name',
  'icon',
  'address',
  'opening_hours',
  'comments',
  'verified_at',
  'osm_id',
  'osm_url',
  'phone',
  'website',
  'email',
  'boosted_until',
  'required_app_url',
  'description',
  'image',
  'payment_provider',
  'osm:payment:bitcoin',
  'osm:payment:lightning',
  'osm:payment:lightning_contactless',
  'osm:currency:XBT',
].join(',');

const DEFAULT_RADIUS_KM = 10;
const REQUEST_TIMEOUT_MS = 15_000;

export class BtcMapServiceError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'BtcMapServiceError';
  }
}

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const controller = new AbortController();
  // The abort cannot be recognised from the thrown error: the native fetch
  // reports it as a FetchError carrying Swift text, not as an AbortError.
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new BtcMapServiceError(
        `BTC Map is unavailable (${response.status})`,
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof BtcMapServiceError) {
      throw error;
    }
    console.warn('[BtcMap] Request failed:', url.toString(), error);
    throw new BtcMapServiceError(
      timedOut ? 'BTC Map is not responding. Try again.' : 'Could not reach BTC Map.'
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Text that is safe to show in the UI. Only messages built here are meant for
 * users; a raw error can carry a native stack trace.
 */
export function userMessage(error: unknown, fallback: string): string {
  return error instanceof BtcMapServiceError ? error.message : fallback;
}

/**
 * Haversine distance in kilometers between two WGS84 coordinates.
 */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/** Only `/places/{id}` returns the `osm:*` tags this reads. */
export function getPaymentMethods(place: BtcMapPlaceDetails): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  const onchain =
    place['osm:payment:bitcoin'] === 'yes' || place['osm:currency:XBT'] === 'yes';
  const lightning = place['osm:payment:lightning'] === 'yes';
  const contactless = place['osm:payment:lightning_contactless'] === 'yes';

  if (onchain) methods.push('onchain');
  if (lightning) methods.push('lightning');
  if (contactless) methods.push('lightning_contactless');
  return methods;
}

/**
 * http(s) URL for a community-supplied website value, or null when unusable.
 *
 * OSM values are not guaranteed to be URLs and BTC Map does not filter schemes,
 * so anything else is dropped instead of handed to Linking.openURL: a planted
 * listing could otherwise deep-link this wallet or launch another app.
 */
export function websiteUrl(value?: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(raw)?.[1]?.toLowerCase();
  if (scheme) {
    return scheme === 'http' || scheme === 'https' ? raw : null;
  }
  // Bare hosts are common in the dataset and are otherwise not openable. The
  // class excludes the separators only, so non-ASCII domains still pass while
  // e-mail addresses and social handles do not.
  return /^[^\s/?#@:]+\.[^\s/?#@:]+([/?#]\S*)?$/.test(raw)
    ? `https://${raw}`
    : null;
}

/**
 * `tel:` URI for a community-supplied phone value, or null when unusable.
 *
 * Listings carry several numbers, extensions, full-width plus signs and
 * non-breaking spaces. Cutting at the first character that cannot be part of a
 * number keeps the first one and also drops USSD/MMI codes.
 */
export function telUri(value?: string): string | null {
  // Listings carry bidi marks and stray quotes, sometimes mid-string. Those are
  // removed, but `*` and `#` are not, so USSD/MMI codes still fail to match.
  const cleaned = (value ?? '')
    .replace('\uFF0B', '+')
    .replace(/['"\u200e\u200f\u202a-\u202e]/g, '');
  const first = /^[\s(]*\+?[\s(]*\d[\d\s().+-]*/.exec(cleaned)?.[0];
  if (!first) return null;

  const digits = first.replace(/\D/g, '');
  if (digits.length < 3) return null;
  return `tel:${/^[\s(]*\+/.test(first) ? '+' : ''}${digits}`;
}

export function isBoosted(
  place: { boosted_until?: string },
  now = new Date()
): boolean {
  if (!place.boosted_until) return false;
  return new Date(place.boosted_until).getTime() > now.getTime();
}

export class BtcMapService {
  /**
   * Search places by area, name, and/or OSM tag.
   * The payload is fixed, so `fields` is not sent; we only drop malformed rows.
   */
  static async searchPlaces(
    params: BtcMapSearchParams
  ): Promise<BtcMapSearchedPlace[]> {
    const query: Record<string, string> = {};

    if (params.lat != null && params.lon != null && params.radiusKm != null) {
      query.lat = String(params.lat);
      query.lon = String(params.lon);
      query.radius_km = String(params.radiusKm);
    }

    if (params.name && params.name.trim().length >= 3) {
      query.name = params.name.trim();
    }

    if (params.tagName && params.tagValue) {
      query.tag_name = params.tagName;
      query.tag_value = params.tagValue;
    }

    if (Object.keys(query).length === 0) {
      throw new BtcMapServiceError(
        'Search requires a location+radius, name (3+ chars), or tag filter'
      );
    }

    const places = await fetchJson<BtcMapSearchedPlace[]>(
      '/places/search/',
      query
    );
    return places.filter(
      (place) =>
        typeof place.id === 'number' &&
        typeof place.lat === 'number' &&
        typeof place.lon === 'number'
    );
  }

  /**
   * Nearby merchants sorted by distance from the search center, optionally
   * narrowed to a name.
   */
  static async searchNearby(
    lat: number,
    lon: number,
    radiusKm: number = DEFAULT_RADIUS_KM,
    name?: string
  ): Promise<NearbyPlacesResult> {
    const places = await this.searchPlaces({ lat, lon, radiusKm, name });
    const sorted = [...places].sort(
      (a, b) => distanceKm(lat, lon, a.lat, a.lon) - distanceKm(lat, lon, b.lat, b.lon)
    );
    return { places: sorted, center: { lat, lon }, radiusKm };
  }

  /**
   * Fetch a single place with payment method tags and contact fields.
   */
  static async getPlace(id: number | string): Promise<BtcMapPlaceDetails> {
    return fetchJson<BtcMapPlaceDetails>(`/places/${encodeURIComponent(String(id))}`, {
      fields: PLACE_FIELDS,
    });
  }
}
