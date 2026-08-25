/**
 * Map Material icon names from BTC Map to Ionicons.
 */

import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICON_MAP: Record<string, IoniconName> = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  lunch_dining: 'restaurant',
  local_bar: 'wine',
  local_cafe: 'cafe',
  lodging: 'bed',
  hotel: 'bed',
  store: 'storefront',
  storefront: 'storefront',
  shopping_bag: 'bag-handle',
  shopping_cart: 'cart',
  atm: 'cash',
  local_atm: 'cash',
  content_cut: 'cut',
  fitness_center: 'barbell',
  local_grocery_store: 'basket',
  bakery_dining: 'nutrition',
  ice_cream: 'ice-cream',
  local_pizza: 'pizza',
  local_gas_station: 'car',
  directions_bike: 'bicycle',
  directions_car: 'car',
  museum: 'business',
  theater_comedy: 'ticket',
  confirmation_number: 'ticket',
  medical_services: 'medkit',
  local_pharmacy: 'medkit',
  school: 'school',
  menu_book: 'book',
  smoking_rooms: 'flame',
  pets: 'paw',
  spa: 'flower',
  hardware: 'construct',
  handyman: 'construct',
  computer: 'desktop',
  devices: 'phone-portrait',
  wifi: 'wifi',
  place: 'location',
};

export function placeIconName(icon?: string): IoniconName {
  if (!icon) return 'location';
  return ICON_MAP[icon] ?? 'location';
}
