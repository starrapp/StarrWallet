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
import { spacing, layout } from '@/theme';
import {
  BtcMapService,
  BtcMapServiceError,
  distanceKm,
} from '@/services/btcmap';
import type { BtcMapPlace } from '@/types/btcmap';
import type { ColorTheme } from '@/theme/colors';

const DEFAULT_RADIUS_KM = 15;
const RADIUS_OPTIONS = [5, 15, 30] as const;
const FALLBACK_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

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
  const [places, setPlaces] = useState<BtcMapPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BtcMapPlace | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const loadNearby = useCallback(
    async (lat: number, lon: number, radius: number, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await BtcMapService.searchNearby(lat, lon, radius);
        setPlaces(result.places);
        setCenter(result.center);
        mapRef.current?.animateToRegion(regionForRadius(lat, lon, radius), 400);
      } catch (err) {
        const message =
          err instanceof BtcMapServiceError
            ? err.message
            : 'Could not load nearby places';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const requestLocationAndLoad = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) {
        setError('Location permission is needed to find nearby merchants.');
        setLoading(false);
        // Still show a default city map so the tab is usable.
        setCenter({ lat: FALLBACK_REGION.latitude, lon: FALLBACK_REGION.longitude });
        await loadNearby(
          FALLBACK_REGION.latitude,
          FALLBACK_REGION.longitude,
          radiusKm
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      setUserCoord({ lat, lon });
      await loadNearby(lat, lon, radiusKm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
      setLoading(false);
    }
  }, [loadNearby, radiusKm]);

  const didInitialLoad = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (didInitialLoad.current) return;
      didInitialLoad.current = true;
      void requestLocationAndLoad();
    }, [requestLocationAndLoad])
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
        mapRef.current?.animateToRegion(
          {
            latitude: sorted[0].lat,
            longitude: sorted[0].lon,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          400
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, userCoord, center, radiusKm]);

  const openPlace = useCallback((place: BtcMapPlace) => {
    Haptics.selectionAsync();
    setSelected(place);
    setDetailVisible(true);
    mapRef.current?.animateToRegion(
      {
        latitude: place.lat,
        longitude: place.lon,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350
    );
  }, []);

  const mapRegion = useMemo(() => {
    if (center) return regionForRadius(center.lat, center.lon, radiusKm);
    return FALLBACK_REGION;
  }, [center, radiusKm]);

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
        showsUserLocation={permissionStatus === Location.PermissionStatus.GRANTED}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lon }}
            title={place.name}
            description={place.address}
            pinColor={selected?.id === place.id ? colors.gold.pure : undefined}
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
              requestLocationAndLoad();
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
