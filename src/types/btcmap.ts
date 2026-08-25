/**
 * BTC Map place types (API v4)
 *
 * The API returns two different place shapes and they are not interchangeable:
 * - `/places/search/` returns a fixed struct. It has no `osm:*` tags and
 *   ignores a `fields` parameter.
 * - `/places/{id}` builds its response from `fields` and is the only endpoint
 *   that can return `osm:*` tags.
 *
 * @see https://github.com/teambtcmap/btcmap-api/blob/master/docs/rest/v4/places.md
 */

/** Fixed payload of `GET /places/search/`. */
export interface BtcMapSearchedPlace {
  id: number;
  lat: number;
  lon: number;
  icon: string;
  name: string;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  address?: string;
  opening_hours?: string;
  comments?: number;
  osm_id?: string;
  phone?: string;
  website?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  line?: string;
  email?: string;
  boosted_until?: string;
  required_app_url?: string;
  description?: string;
  image?: string;
  payment_provider?: string;
  localized_name?: Record<string, string>;
}

/** `GET /places/{id}`, limited to the fields BtcMapService requests. */
export interface BtcMapPlaceDetails {
  id: number;
  lat?: number;
  lon?: number;
  name?: string;
  icon?: string;
  address?: string;
  opening_hours?: string;
  comments?: number;
  verified_at?: string;
  osm_id?: string;
  osm_url?: string;
  phone?: string;
  website?: string;
  email?: string;
  boosted_until?: string;
  required_app_url?: string;
  description?: string;
  image?: string;
  payment_provider?: string;
  'osm:payment:bitcoin'?: string;
  'osm:payment:lightning'?: string;
  'osm:payment:lightning_contactless'?: string;
  'osm:currency:XBT'?: string;
}

export interface BtcMapSearchParams {
  lat?: number;
  lon?: number;
  radiusKm?: number;
  name?: string;
  tagName?: string;
  tagValue?: string;
}

export interface NearbyPlacesResult {
  places: BtcMapSearchedPlace[];
  center: { lat: number; lon: number };
  radiusKm: number;
}

export type PaymentMethod =
  | 'onchain'
  | 'lightning'
  | 'lightning_contactless';
