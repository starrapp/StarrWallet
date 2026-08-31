/**
 * Map Screen
 *
 * Nearby Bitcoin-accepting merchants via BTC Map API v4.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui';
import { PlaceListItem, PlaceDetailSheet } from '@/components/map';
import { useColors } from '@/contexts';
import { runOsPrompt } from '@/utils/osPrompt';
import { spacing, layout } from '@/theme';
import {
  BtcMapService,
  distanceKm,
  userMessage,
} from '@/services/btcmap';
import type { BtcMapSearchedPlace } from '@/types/btcmap';
import type { ColorTheme } from '@/theme/colors';

const DEFAULT_RADIUS_KM = 15;
const RADIUS_OPTIONS = [5, 15, 30] as const;

/** Points a map pin covers on screen. */
const PIN_FOOTPRINT_PT = 30;
/**
 * Unselected pins need an explicit color. react-native-maps crashes on Android
 * when pinColor goes back to null: MarkerManager.setPinColor unboxes it into
 * Color.colorToHSV, which takes a primitive int (MarkerManager.java:224).
 */
const DEFAULT_PIN_COLOR = '#FF3B30';
/** Extra fraction of the region to keep, so a pan does not enter an empty map. */
const MARKER_MARGIN = 0.5;

/**
 * Largest radius worth requesting. The BTC Map API caps neither the radius nor
 * the row count: measured around Madrid, 500 km returns ~580 places (0.2 MB),
 * while 2000 km returns ~5600 places (2.3 MB, 3 s).
 */
const MAX_RADIUS_KM = 500;
/** Pause after the map stops before the new area is loaded. */
const PAN_DEBOUNCE_MS = 700;
/** Shorter names match most of the dataset, so the API rejects them. */
const MIN_QUERY_LENGTH = 3;
/** How close the visible radius must be to a preset for its chip to light up. */
const CHIP_TOLERANCE = 0.25;

/**
 * A region whose corner sits at `radiusKm`, the inverse of `radiusFromRegion`.
 *
 * Solving that distance for a square region gives the delta directly:
 * corner = (d / 2) * KM_PER_DEGREE * sqrt(1 + cos²lat).
 */
function regionForRadius(lat: number, lon: number, radiusKm: number): Region {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const delta = (2 * radiusKm) / (111 * Math.sqrt(1 + cosLat * cosLat));
  return {
    latitude: lat,
    longitude: lon,
    latitudeDelta: Math.max(0.02, delta),
    longitudeDelta: Math.max(0.02, delta),
  };
}

/**
 * Radius that covers the whole visible region.
 *
 * The API searches a circle, so the radius has to reach the viewport corner.
 * Half of `latitudeDelta` only reaches the edge midpoint and leaves the corners
 * empty — about √2 further on a square region. `distanceKm` is used instead of
 * a factor because a degree of longitude shrinks with latitude.
 */
function radiusFromRegion(region: Region): number {
  const cornerLat = Math.max(
    -90,
    Math.min(90, region.latitude + region.latitudeDelta / 2)
  );
  const corner = distanceKm(
    region.latitude,
    region.longitude,
    cornerLat,
    region.longitude + region.longitudeDelta / 2
  );
  return Math.min(MAX_RADIUS_KM, Math.max(1, corner));
}

/** Shown when the user's position is unknown, at the same radius as a fix. */
const FALLBACK_REGION = regionForRadius(40.7128, -74.006, DEFAULT_RADIUS_KM);

/** The circle the visible region covers. */
type VisibleArea = { lat: number; lon: number; radiusKm: number };

function viewOfRegion(region: Region): VisibleArea {
  return {
    lat: region.latitude,
    lon: region.longitude,
    radiusKm: radiusFromRegion(region),
  };
}

/** Folds a degree difference into [-180, 180). */
function wrapDegrees(degrees: number): number {
  return (((degrees % 360) + 540) % 360) - 180;
}

/**
 * A region that shows every place, or null when there are none.
 *
 * Longitude is cyclic: plain min/max on a set that straddles ±180 would put the
 * centre near Greenwich and span the globe, so each one is unwrapped onto a
 * continuous line around the first place before measuring.
 */
function regionForPlaces(places: BtcMapSearchedPlace[]): Region | null {
  if (places.length === 0) {
    return null;
  }
  const origin = places[0].lon;
  const lats = places.map((place) => place.lat);
  const lons = places.map((place) => origin + wrapDegrees(place.lon - origin));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: wrapDegrees((minLon + maxLon) / 2),
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.3),
    longitudeDelta: Math.max(0.02, (maxLon - minLon) * 1.3),
  };
}

/** The preset that matches the visible radius, or null when none is close. */
function nearestPreset(viewRadiusKm: number): number | null {
  const closest = RADIUS_OPTIONS.reduce((best, option) =>
    Math.abs(option - viewRadiusKm) < Math.abs(best - viewRadiusKm) ? option : best
  );
  const off = Math.abs(closest - viewRadiusKm) / closest;
  return off <= CHIP_TOLERANCE ? closest : null;
}

/**
 * Keeps one place per pin-sized cell of the visible region. Denser pins are
 * drawn on top of each other anyway, so nothing is lost on screen, and a zoom
 * shrinks the cells and brings the dropped places back.
 *
 * Places are already sorted by distance from the search center, so the first
 * one to claim a cell is the nearest.
 */
function thinForRegion(
  places: BtcMapSearchedPlace[],
  region: Region,
  size: { width: number; height: number },
  keepId?: number
): BtcMapSearchedPlace[] {
  const cols = Math.max(1, Math.round(size.width / PIN_FOOTPRINT_PT));
  const rows = Math.max(1, Math.round(size.height / PIN_FOOTPRINT_PT));
  const latSpan = region.latitudeDelta * (0.5 + MARKER_MARGIN);
  const lonSpan = region.longitudeDelta * (0.5 + MARKER_MARGIN);

  const cellKey = (place: BtcMapSearchedPlace) => {
    const row = Math.floor(
      ((place.lat - region.latitude) / region.latitudeDelta) * rows
    );
    const col = Math.floor(
      ((place.lon - region.longitude) / region.longitudeDelta) * cols
    );
    return `${row}:${col}`;
  };

  const taken = new Set<string>();
  const shown: BtcMapSearchedPlace[] = [];

  // The selected place must keep its pin even when a nearer one shares the cell.
  const keep = keepId == null ? undefined : places.find((it) => it.id === keepId);
  if (keep) {
    taken.add(cellKey(keep));
    shown.push(keep);
  }

  for (const place of places) {
    if (place === keep) continue;
    if (
      Math.abs(place.lat - region.latitude) > latSpan ||
      Math.abs(place.lon - region.longitude) > lonSpan
    ) {
      continue;
    }
    const cell = cellKey(place);
    if (taken.has(cell)) continue;
    taken.add(cell);
    shown.push(place);
  }

  return shown;
}

export default function MapScreen() {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  /**
   * The user's own position, used for the `away` distances only. The viewport
   * drives loading; measuring from it would read 0 m for whatever the camera
   * has just centred on.
   */
  const [userCoord, setUserCoord] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [places, setPlaces] = useState<BtcMapSearchedPlace[]>([]);
  /**
   * Bumped by the actions that mean "load again": Go and pull-to-refresh. A
   * counter, because pressing Go twice or retrying a failed load changes
   * nothing else the loader watches.
   */
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Load failures. Owned by the loader alone. */
  const [error, setError] = useState<string | null>(null);
  /**
   * Why the map is not on the user. Kept apart from `error` so the loader,
   * which clears its own error on every request, cannot wipe it.
   */
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** The applied filter. Only `Go` moves `query` into it. */
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selected, setSelected] = useState<BtcMapSearchedPlace | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [mapSize, setMapSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  /**
   * The visible region: the one source of truth for what to load. Who moved the
   * camera does not matter, because loading never moves it. Null until the
   * first position is known, and the map is not rendered before that.
   */
  const [region, setRegion] = useState<Region | null>(null);

  const mapRef = useRef<MapView>(null);
  const didLocate = useRef(false);
  /**
   * Ticket of the newest loader run. Only that run may write state, so an
   * answer that arrives after the view moved on — or a request left hanging
   * until its timeout — changes nothing, indicators included.
   */
  const runSeq = useRef(0);
  /** The query whose hits still have to be framed. Armed by `Go`, used once. */
  const fitQuery = useRef<string | null>(null);

  /**
   * Drops a pending fit, bound to the *start* of a camera movement.
   *
   * Between `Go` and its answer this screen never moves the camera itself —
   * `Go` only changes the filter — so a movement starting in that window is the
   * user taking over: a drag, or a tap on a chip, a pin or the locate button.
   * Dropping the fit is right for all of them, which is why this needs no guess
   * at whether a movement was theirs or ours. Binding it to the *end* of a
   * movement would be too late to keep an answer that lands mid-drag from
   * yanking the map away from the finger.
   */
  const cancelFit = useCallback(() => {
    fitQuery.current = null;
  }, []);

  /** The only way this screen moves the camera. Loading never calls it. */
  const moveTo = useCallback((next: Region) => {
    setRegion(next);
    mapRef.current?.animateToRegion(next, 400);
  }, []);

  /** The visible area, the input to everything below. */
  const view = useMemo(() => (region ? viewOfRegion(region) : null), [region]);

  /**
   * Loads the places for the visible region — the only place that fetches.
   *
   * The requested circle is the one drawn around the viewport, with no extra
   * margin, so `places` is what the area holds rather than a cache to filter.
   * A pause between gestures costs one request, which is cheaper than keeping a
   * wider circle and the bookkeeping that a cache needs. The circle does reach
   * past the visible rectangle at its corners, so a name search frames its hits
   * once — see `cancelFit` — or a place could be listed with no pin on screen.
   *
   * `runSeq` decides who may write: a stale answer, including one from a
   * request left hanging until its timeout, is ignored.
   */
  useEffect(() => {
    if (!view) return;
    const run = ++runSeq.current;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await BtcMapService.searchNearby(
          view.lat,
          view.lon,
          view.radiusKm,
          submittedQuery || undefined
        );
        if (run !== runSeq.current) return;
        setPlaces(result.places);
        // The search circle reaches past the visible rectangle at its corners,
        // so without this a hit could be listed with no pin anywhere on screen.
        if (submittedQuery && fitQuery.current === submittedQuery) {
          fitQuery.current = null;
          const fitted = regionForPlaces(result.places);
          if (fitted) moveTo(fitted);
        }
      } catch (err) {
        if (run !== runSeq.current) return;
        setError(userMessage(err, 'Could not load places'));
      } finally {
        if (run === runSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, PAN_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [view, submittedQuery, revision, moveTo]);

  /**
   * Points the camera at the user. Always sets a region, even on failure, or the
   * map would never render.
   */
  const locate = useCallback(async () => {
    setLocationNotice(null);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        // runOsPrompt keeps AuthGate from reading the permission dialog as the
        // user leaving the app. Once the user denies for good, this returns the
        // denied status without showing a dialog.
        ({ status } = await runOsPrompt(() =>
          Location.requestForegroundPermissionsAsync()
        ));
      }
      setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) {
        moveTo(FALLBACK_REGION);
        setLocationNotice(
          'Location permission is needed to find nearby merchants.'
        );
        return;
      }

      let coord: { lat: number; lon: number } | null = null;
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coord = { lat: position.coords.latitude, lon: position.coords.longitude };
      } catch (err) {
        // A fresh fix is not always available: a simulator with no location
        // set, or a device that has not seen GPS or Wi-Fi yet.
        console.warn('[Map] Current position unavailable, trying last known:', err);
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          coord = { lat: last.coords.latitude, lon: last.coords.longitude };
        }
      }

      if (!coord) {
        moveTo(FALLBACK_REGION);
        setLocationNotice('Could not determine your location.');
        return;
      }

      setUserCoord(coord);
      moveTo(regionForRadius(coord.lat, coord.lon, DEFAULT_RADIUS_KM));
    } catch (err) {
      console.error('[Map] Failed to get location:', err);
      moveTo(FALLBACK_REGION);
      setLocationNotice('Could not determine your location.');
    }
  }, [moveTo]);

  useFocusEffect(
    useCallback(() => {
      if (didLocate.current) return;
      didLocate.current = true;
      void locate();
    }, [locate])
  );

  const handleSearch = useCallback(() => {
    const name = query.trim();
    // `queryHint` already says why, and it is derived from the field, so a
    // stored message cannot outlive the text it talks about.
    if (name.length > 0 && name.length < MIN_QUERY_LENGTH) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fitQuery.current = name.length >= MIN_QUERY_LENGTH ? name : null;
    setSubmittedQuery(name);
    setRevision((it) => it + 1);
  }, [query]);

  const openPlace = useCallback(
    (place: BtcMapSearchedPlace) => {
      Haptics.selectionAsync();
      setSelected(place);
      setDetailVisible(true);
      if (!region) return;
      // Centres without zooming. Zooming in would shrink the circle the loader
      // then requests, gutting the very list the row was tapped from. Reusing
      // the current deltas also keeps the aspect ratio the map already reports,
      // so it has nothing to correct.
      moveTo({ ...region, latitude: place.lat, longitude: place.lon });
    },
    [moveTo, region]
  );

  const activePreset = view ? nearestPreset(view.radiusKm) : null;
  const typed = query.trim();
  const queryHint =
    typed.length > 0 && typed.length < MIN_QUERY_LENGTH
      ? `Enter at least ${MIN_QUERY_LENGTH} letters to search by name.`
      : null;

  const markers = useMemo(() => {
    if (!mapSize || !region) return [];
    // Search hits keep every pin. Thinning exists for the hundreds of places an
    // unfiltered area returns; a search returns few, and dropping one would hide
    // a place the user is looking for.
    if (submittedQuery) return places;
    return thinForRegion(places, region, mapSize, selected?.id);
  }, [places, region, mapSize, selected?.id, submittedQuery]);

  /** Undefined without a fix: a made-up origin would read as a real distance. */
  const distanceFromUser = (place: { lat: number; lon: number }) =>
    userCoord
      ? distanceKm(userCoord.lat, userCoord.lon, place.lat, place.lon)
      : undefined;

  const selectedDistance = selected ? distanceFromUser(selected) : undefined;

  return (
    <View style={styles.container}>
      {region ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          // The map mounts only once a region is known, so this is the first
          // camera and every later move is an animation. Both platforms apply
          // initialRegion once (AIRMap.mm `_initialRegionSet`,
          // MapView.java `initialRegionSet`), so the changing prop is inert.
          initialRegion={region}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setMapSize((prev) =>
              prev && prev.width === width && prev.height === height
                ? prev
                : { width, height }
            );
          }}
          onRegionChangeStart={cancelFit}
          onRegionChangeComplete={setRegion}
          showsUserLocation={permissionStatus === Location.PermissionStatus.GRANTED}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {markers.map((place) => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lon }}
              title={place.name}
              description={place.address}
              tracksViewChanges={false}
              pinColor={
                selected?.id === place.id ? colors.gold.pure : DEFAULT_PIN_COLOR
              }
              onPress={() => openPlace(place)}
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.map} />
      )}

      <SafeAreaView edges={['top']} style={styles.overlay}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search merchants"
            placeholderTextColor={colors.text.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setSubmittedQuery('');
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSearch} hitSlop={8}>
            <Text variant="labelMedium" color={colors.gold.pure}>
              Go
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.radiusChip,
                activePreset === option && styles.radiusChipActive,
              ]}
              onPress={() => {
                if (!view) return;
                Haptics.selectionAsync();
                moveTo(regionForRadius(view.lat, view.lon, option));
              }}
            >
              <Text
                variant="labelMedium"
                color={
                  activePreset === option
                    ? colors.background.primary
                    : colors.text.secondary
                }
              >
                {option} km
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.locateBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void locate();
            }}
          >
            <Ionicons name="navigate" size={16} color={colors.gold.pure} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text variant="titleMedium">Nearby</Text>
          <Text variant="bodySmall" color={colors.text.muted}>
            {loading ? 'Loading…' : `${places.length} places · BTC Map`}
          </Text>
        </View>

        {(queryHint ?? error ?? locationNotice) && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.status.warning} />
            <Text variant="bodySmall" color={colors.status.warning} style={styles.errorText}>
              {queryHint ?? error ?? locationNotice}
            </Text>
          </View>
        )}

        {loading && places.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.gold.pure} />
            <Text variant="bodyMedium" color={colors.text.muted}>
              Finding Bitcoin merchants…
            </Text>
          </View>
        ) : (
          <FlatList
            data={places}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setRevision((it) => it + 1);
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="map-outline" size={32} color={colors.text.muted} />
                <Text variant="bodyMedium" color={colors.text.muted} align="center">
                  No merchants found in this area. Try a larger radius or search by name.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <PlaceListItem
                place={item}
                distanceKmValue={distanceFromUser(item)}
                selected={selected?.id === item.id}
                onPress={() => openPlace(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          />
        )}
      </View>

      <PlaceDetailSheet
        place={selected}
        distanceKmValue={selectedDistance}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
      />
    </View>
  );
}

const getStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    map: {
      flex: 1,
      minHeight: '42%',
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background.secondary,
      borderRadius: layout.radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    searchInput: {
      flex: 1,
      color: colors.text.primary,
      fontSize: 15,
      paddingVertical: spacing.xs,
    },
    radiusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    radiusChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: layout.radius.full,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    radiusChipActive: {
      backgroundColor: colors.gold.pure,
      borderColor: colors.gold.pure,
    },
    locateBtn: {
      marginLeft: 'auto',
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    sheet: {
      height: '46%',
      backgroundColor: colors.background.primary,
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
      paddingBottom: layout.tabBarHeight,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      padding: spacing.sm,
      borderRadius: layout.radius.md,
      backgroundColor: colors.overlay.medium,
    },
    errorText: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
  });
