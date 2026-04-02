import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/components/ui';
import { useColors } from '@/contexts';
import { spacing } from '@/theme';
import type { ColorTheme } from '@/theme/colors';

const createStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.subtle,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
    },
  });

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Button title="Back" variant="ghost" size="sm" onPress={() => router.back()} />
          <Text variant="titleLarge" color={colors.text.primary}>
            Notifications
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={56} color={colors.text.muted} />
          <Text variant="titleMedium" color={colors.text.primary} align="center">
            No notifications yet
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary} align="center">
            Incoming and outgoing payment notifications will appear here.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
