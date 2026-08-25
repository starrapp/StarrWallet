/**
 * Place list row for BTC Map merchants.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import { formatDistance, isBoosted } from '@/services/btcmap';
import { placeIconName } from '@/utils/btcmapIcons';
import type { BtcMapSearchedPlace } from '@/types/btcmap';
import type { ColorTheme } from '@/theme/colors';

interface PlaceListItemProps {
  place: BtcMapSearchedPlace;
  distanceKmValue?: number;
  selected?: boolean;
  onPress: () => void;
}

export function PlaceListItem({
  place,
  distanceKmValue,
  selected = false,
  onPress,
}: PlaceListItemProps) {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const boosted = isBoosted(place);

  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, boosted && styles.iconBoosted]}>
        <Ionicons
          name={placeIconName(place.icon)}
          size={22}
          color={boosted ? colors.background.primary : colors.gold.pure}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text variant="labelLarge" numberOfLines={1} style={styles.name}>
            {place.name || 'Unnamed place'}
          </Text>
          {distanceKmValue != null && (
            <Text variant="bodySmall" color={colors.text.muted}>
              {formatDistance(distanceKmValue)}
            </Text>
          )}
        </View>

        {!!place.address && (
          <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
            {place.address}
          </Text>
        )}

        {boosted && (
          <View style={styles.tags}>
            <View style={[styles.tag, styles.boostTag]}>
              <Text variant="labelSmall" color={colors.background.primary}>
                Boosted
              </Text>
            </View>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
    </TouchableOpacity>
  );
}

const getStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: layout.radius.lg,
      backgroundColor: colors.background.secondary,
    },
    rowSelected: {
      borderWidth: 1,
      borderColor: colors.gold.pure,
      backgroundColor: colors.overlay.gold,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.overlay.gold,
    },
    iconBoosted: {
      backgroundColor: colors.gold.pure,
    },
    content: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    name: {
      flex: 1,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xxs,
      marginTop: spacing.xxs,
    },
    tag: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: layout.radius.sm,
      backgroundColor: colors.overlay.gold,
    },
    boostTag: {
      backgroundColor: colors.gold.pure,
    },
  });
