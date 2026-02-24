/**
 * Tab Layout
 * 
 * Main navigation tabs for the wallet.
 */

import { useMemo } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/contexts';
import { layout, spacing } from '@/theme';

export default function TabLayout() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabBar: {
          position: 'absolute',
          height: layout.tabBarHeight,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: spacing.xs,
          paddingBottom: spacing.lg,
        },
        tabBarBackground: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.background.primary + 'E6',
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
        },
        tabLabel: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: spacing.xxs,
        },
        scanButtonContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        scanButton: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.gold.pure,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -20,
          shadowColor: colors.gold.pure,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
      }),
    [colors]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.gold.pure,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: '',
          tabBarButton: (props) => (
            <Pressable
              {...props}
              style={styles.scanButtonContainer}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/scan');
              }}
            >
              <View style={styles.scanButton}>
                <Ionicons name="scan" size={28} color={colors.background.primary} />
              </View>
            </Pressable>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // Prevent default tab navigation
            e.preventDefault();
            // Navigate to scan modal
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/scan');
          },
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: 'Channels',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="git-network" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
