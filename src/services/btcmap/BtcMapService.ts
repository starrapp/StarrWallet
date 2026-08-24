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
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new BtcMapServiceError(
        `BTC Map request failed (${response.status})`,
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof BtcMapServiceError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BtcMapServiceError('BTC Map request timed out');
    }
    throw new BtcMapServiceError(
      error instanceof Error ? error.message : 'BTC Map request failed'
    );
  } finally {
    clearTimeout(timeout);
  }
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
   * Nearby merchants sorted by distance from the search center.
   */
  static async searchNearby(
    lat: number,
    lon: number,
    radiusKm: number = DEFAULT_RADIUS_KM
  ): Promise<NearbyPlacesResult> {
    const places = await this.searchPlaces({ lat, lon, radiusKm });
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
