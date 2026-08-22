/**
 * Bottom sheet detail for a BTC Map place.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, Button } from '@/components/ui';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import {
  BtcMapService,
  formatDistance,
  getPaymentMethods,
  isBoosted,
} from '@/services/btcmap';
import { placeIconName } from '@/utils/btcmapIcons';
import type { BtcMapPlace } from '@/types/btcmap';
import type { ColorTheme } from '@/theme/colors';

interface PlaceDetailSheetProps {
  place: BtcMapPlace | null;
  distanceKmValue?: number;
  visible: boolean;
  onClose: () => void;
}

function openExternalMaps(place: BtcMapPlace) {
  const label = encodeURIComponent(place.name || 'Bitcoin merchant');
  const { lat, lon } = place;
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lon}&q=${label}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  Linking.openURL(url);
}

export function PlaceDetailSheet({
  place,
  distanceKmValue,
  visible,
  onClose,
}: PlaceDetailSheetProps) {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [enriched, setEnriched] = useState<BtcMapPlace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeId = place?.id;

  useEffect(() => {
    if (!visible || placeId == null) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      setEnriched(null);
      try {
        const full = await BtcMapService.getPlace(placeId);
        if (!cancelled) setEnriched(full);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load details');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, placeId]);

  if (!place) return null;

  const shown = enriched?.id === place.id ? enriched : place;
  const methods = getPaymentMethods(shown);
  const boosted = isBoosted(shown);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.iconWrap, boosted && styles.iconBoosted]}>
              <Ionicons
                name={placeIconName(shown.icon)}
                size={28}
                color={boosted ? colors.background.primary : colors.gold.pure}
              />
            </View>
            <View style={styles.headerText}>
              <Text variant="headlineSmall" numberOfLines={2}>
                {shown.name || 'Unnamed place'}
              </Text>
              {distanceKmValue != null && (
                <Text variant="bodySmall" color={colors.text.muted}>
                  {formatDistance(distanceKmValue)} away
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.gold.pure} />
              <Text variant="bodySmall" color={colors.text.muted}>
                Loading details…
              </Text>
            </View>
          )}

          {error && (
            <Text variant="bodySmall" color={colors.status.warning} style={styles.error}>
              {error}
            </Text>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.tags}>
              {(methods.length === 0
                ? (['bitcoin'] as const)
                : methods
              ).map((method) => (
                <View key={method} style={styles.tag}>
                  <Text variant="labelMedium" color={colors.gold.pure}>
                    {method === 'bitcoin'
                      ? 'Bitcoin'
                      : method === 'onchain'
                        ? 'On-chain'
                        : method === 'lightning'
                          ? 'Lightning'
                          : 'Contactless LN'}
                  </Text>
                </View>
              ))}
              {boosted && (
                <View style={[styles.tag, styles.boostTag]}>
                  <Text variant="labelMedium" color={colors.background.primary}>
                    Boosted
                  </Text>
                </View>
              )}
            </View>

            {!!shown.address && (
              <DetailRow icon="location-outline" label={shown.address} colors={colors} />
            )}
            {!!shown.opening_hours && (
              <DetailRow icon="time-outline" label={shown.opening_hours} colors={colors} />
            )}
            {!!shown.phone && (
              <DetailRow
                icon="call-outline"
                label={shown.phone}
                colors={colors}
                onPress={() => Linking.openURL(`tel:${shown.phone}`)}
              />
            )}
            {!!shown.website && (
              <DetailRow
                icon="globe-outline"
                label={shown.website.replace(/^https?:\/\//, '')}
                colors={colors}
                onPress={() => Linking.openURL(shown.website!)}
              />
            )}
            {!!shown.verified_at && (
              <DetailRow
                icon="shield-checkmark-outline"
                label={`Verified ${shown.verified_at.slice(0, 10)}`}
                colors={colors}
              />
            )}
            {!!shown.description && (
              <Text variant="bodyMedium" color={colors.text.secondary} style={styles.description}>
                {shown.description}
              </Text>
            )}
            {!!shown.required_app_url && (
              <Text variant="bodySmall" color={colors.status.warning} style={styles.description}>
                This location may require a companion app to pay.
              </Text>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              title="Directions"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                openExternalMaps(shown);
              }}
              style={styles.actionBtn}
            />
            <Button
              title="BTC Map"
              variant="secondary"
              onPress={() => {
                Linking.openURL(`https://btcmap.org/map?lat=${shown.lat}&long=${shown.lon}#18/${shown.lat}/${shown.lon}`);
              }}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  icon,
  label,
  colors,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  colors: ColorTheme;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Ionicons name={icon} size={18} color={colors.gold.pure} />
      <Text variant="bodyMedium" color={colors.text.secondary} style={{ flex: 1 }}>
        {label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
      {content}
    </View>
  );
}

const getStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay.heavy,
    },
    dismissArea: {
      flex: 1,
    },
    sheet: {
      maxHeight: '78%',
      backgroundColor: colors.background.secondary,
      borderTopLeftRadius: layout.radius.xl,
      borderTopRightRadius: layout.radius.xl,
      paddingBottom: spacing.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border.medium,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.overlay.gold,
    },
    iconBoosted: {
      backgroundColor: colors.gold.pure,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    closeBtn: {
      padding: spacing.xs,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    error: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      paddingBottom: spacing.md,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    tag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: layout.radius.sm,
      backgroundColor: colors.overlay.gold,
    },
    boostTag: {
      backgroundColor: colors.gold.pure,
    },
    description: {
      marginTop: spacing.xxs,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    actionBtn: {
      flex: 1,
    },
  });
