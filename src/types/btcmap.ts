/**
 * BTC Map place types (API v4)
 * @see https://github.com/teambtcmap/btcmap-api/blob/master/docs/rest/v4/places.md
 */

export interface BtcMapPlace {
  id: number;
  lat: number;
  lon: number;
  name?: string;
  icon?: string;
  address?: string;
  opening_hours?: string;
  comments?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  verified_at?: string;
  osm_id?: string;
  osm_url?: string;
  phone?: string;
  website?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  telegram?: string;
  email?: string;
  boosted_until?: string;
  required_app_url?: string;
  description?: string;
  image?: string;
  payment_provider?: string;
  /** OSM payment tags requested via fields=osm:... */
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
  places: BtcMapPlace[];
  center: { lat: number; lon: number };
  radiusKm: number;
}

export type PaymentMethod =
  | 'onchain'
  | 'lightning'
  | 'lightning_contactless';
