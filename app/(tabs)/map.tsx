/**
 * Map Screen
 *
 * Nearby Bitcoin-accepting merchants via BTC Map API v4.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
const FALLBACK_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

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

function regionForRadius(lat: number, lon: number, radiusKm: number): Region {
  const latitudeDelta = Math.max(0.02, (radiusKm * 2) / 111);
  const longitudeDelta = latitudeDelta;
  return {
    latitude: lat,
    longitude: lon,
    latitudeDelta,
    longitudeDelta,
  };
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
  const mapRef = useRef<MapView>(null);

  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [userCoord, setUserCoord] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [places, setPlaces] = useState<BtcMapSearchedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BtcMapSearchedPlace | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [mapSize, setMapSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);

  // animateToRegion is dropped when the native map is not laid out yet, so the
  // first move has to wait for onMapReady.
  const mapReady = useRef(false);
  const pendingRegion = useRef<Region | null>(null);

  const moveTo = useCallback((next: Region) => {
    // The thinning region must follow our own camera moves at once.
    // onRegionChangeComplete does not fire for animateToRegion, so waiting for
    // it would keep thinning the markers against the region we just left and
    // drop every pin outside it.
    setRegion(next);
    if (mapReady.current) {
      mapRef.current?.animateToRegion(next, 400);
    } else {
      pendingRegion.current = next;
    }
  }, []);

  const handleMapReady = useCallback(() => {
    mapReady.current = true;
    const pending = pendingRegion.current;
    if (pending) {
      pendingRegion.current = null;
      mapRef.current?.animateToRegion(pending, 0);
    }
  }, []);

  const loadNearby = useCallback(
    async (lat: number, lon: number, radius: number, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await BtcMapService.searchNearby(lat, lon, radius);
        setPlaces(result.places);
        setCenter(result.center);
        moveTo(regionForRadius(lat, lon, radius));
      } catch (err) {
        setError(userMessage(err, 'Could not load nearby places'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [moveTo]
  );

  /** Shows a default city so the tab stays usable without a location. */
  const loadFallbackCity = useCallback(
    async (message: string) => {
      setCenter({ lat: FALLBACK_REGION.latitude, lon: FALLBACK_REGION.longitude });
      await loadNearby(
        FALLBACK_REGION.latitude,
        FALLBACK_REGION.longitude,
        radiusKm
      );
      // loadNearby clears the error, so this must run after it. A failure of
      // the fallback load itself is more specific, so it wins.
      setError((current) => current ?? message);
    },
    [loadNearby, radiusKm]
  );

  const locateAndLoad = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        let { status } = await Location.getForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED) {
          // runOsPrompt keeps AuthGate from reading the permission dialog as
          // the user leaving the app. Once the user denies for good, this
          // returns the denied status without showing a dialog.
          ({ status } = await runOsPrompt(() =>
            Location.requestForegroundPermissionsAsync()
          ));
        }
        setPermissionStatus(status);

        if (status !== Location.PermissionStatus.GRANTED) {
          await loadFallbackCity(
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
          await loadFallbackCity('Could not determine your location.');
          return;
        }

        setUserCoord(coord);
        await loadNearby(coord.lat, coord.lon, radiusKm);
      } catch (err) {
        console.error('[Map] Failed to get location:', err);
        setError('Could not determine your location.');
        setLoading(false);
      }
    },
    [loadNearby, loadFallbackCity, radiusKm]
  );

  const didInitialLoad = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (didInitialLoad.current) return;
      didInitialLoad.current = true;
      void locateAndLoad();
    }, [locateAndLoad])
  );

  const handleRadiusChange = useCallback(
    async (next: number) => {
      Haptics.selectionAsync();
      setRadiusKm(next);
      const origin = userCoord ?? center;
      if (!origin) return;
      await loadNearby(origin.lat, origin.lon, next, true);
    },
    [userCoord, center, loadNearby]
  );

  const handleSearch = useCallback(async () => {
    const name = query.trim();
    if (name.length > 0 && name.length < 3) {
      setError('Enter at least 3 letters to search by name.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError(null);

    try {
      const origin = userCoord ?? center;
      const results = await BtcMapService.searchPlaces({
        name: name.length >= 3 ? name : undefined,
        lat: origin?.lat,
        lon: origin?.lon,
        radiusKm: origin ? radiusKm : undefined,
      });

      const sorted = origin
        ? [...results].sort(
          (a, b) =>
            distanceKm(origin.lat, origin.lon, a.lat, a.lon) -
            distanceKm(origin.lat, origin.lon, b.lat, b.lon)
        )
        : results;

      setPlaces(sorted);

      if (sorted.length > 0) {
        moveTo({
          latitude: sorted[0].lat,
          longitude: sorted[0].lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (err) {
      setError(userMessage(err, 'Search failed'));
    } finally {
      setLoading(false);
    }
  }, [query, userCoord, center, radiusKm, moveTo]);

  const openPlace = useCallback(
    (place: BtcMapSearchedPlace) => {
      Haptics.selectionAsync();
      setSelected(place);
      setDetailVisible(true);
      moveTo({
        latitude: place.lat,
        longitude: place.lon,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    },
    [moveTo]
  );

  const mapRegion = useMemo(() => {
    if (center) return regionForRadius(center.lat, center.lon, radiusKm);
    return FALLBACK_REGION;
  }, [center, radiusKm]);

  const markers = useMemo(() => {
    if (!mapSize) return [];
    return thinForRegion(places, region ?? mapRegion, mapSize, selected?.id);
  }, [places, region, mapRegion, mapSize, selected?.id]);

  const selectedDistance =
    selected && (userCoord || center)
      ? distanceKm(
        (userCoord ?? center)!.lat,
        (userCoord ?? center)!.lon,
        selected.lat,
        selected.lon
      )
      : undefined;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={mapRegion}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setMapSize((prev) =>
            prev && prev.width === width && prev.height === height
              ? prev
              : { width, height }
          );
        }}
        onMapReady={handleMapReady}
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
                const origin = userCoord ?? center;
                if (origin) loadNearby(origin.lat, origin.lon, radiusKm, true);
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
              style={[styles.radiusChip, radiusKm === option && styles.radiusChipActive]}
              onPress={() => handleRadiusChange(option)}
            >
              <Text
                variant="labelMedium"
                color={radiusKm === option ? colors.background.primary : colors.text.secondary}
              >
                {option} km
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.locateBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              locateAndLoad();
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

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.status.warning} />
            <Text variant="bodySmall" color={colors.status.warning} style={styles.errorText}>
              {error}
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
              const origin = userCoord ?? center;
              if (origin) loadNearby(origin.lat, origin.lon, radiusKm, true);
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="map-outline" size={32} color={colors.text.muted} />
                <Text variant="bodyMedium" color={colors.text.muted} align="center">
                  No merchants found in this area. Try a larger radius or search by name.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const origin = userCoord ?? center;
              const dist = origin
                ? distanceKm(origin.lat, origin.lon, item.lat, item.lon)
                : undefined;
              return (
                <PlaceListItem
                  place={item}
                  distanceKmValue={dist}
                  selected={selected?.id === item.id}
                  onPress={() => openPlace(item)}
                />
              );
            }}
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
