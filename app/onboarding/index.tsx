/**
 * Onboarding Welcome Screen
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentColumn } from '@/components';
import { Button, Text } from '@/components/ui';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import { useResponsive } from '@/hooks';

export default function OnboardingWelcome() {
  const router = useRouter();
  const colors = useColors();
  const { isCompactWidth, height } = useResponsive();
  const isCompactScreen = isCompactWidth || height < 760;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        gradient: { flex: 1 },
        safeArea: { flex: 1, padding: spacing.lg },
        heroSection: {
          minHeight: isCompactScreen ? 170 : 220,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          marginBottom: isCompactScreen ? spacing.sm : spacing.md,
        },
        starsContainer: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
        starDecor: { position: 'absolute' },
        logoContainer: { marginBottom: isCompactScreen ? spacing.md : spacing.lg },
        logoGradient: {
          width: isCompactScreen ? 96 : 120,
          height: isCompactScreen ? 96 : 120,
          borderRadius: isCompactScreen ? 48 : 60,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.gold.pure,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
          elevation: 10,
        },
        featuresSection: { gap: spacing.md, marginBottom: spacing.xl },
        featureItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          backgroundColor: colors.overlay.light,
          borderRadius: layout.radius.lg,
        },
        featureIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.gold.glow,
          alignItems: 'center',
          justifyContent: 'center',
        },
        featureText: { flex: 1, gap: spacing.xxs },
        appNameContainer: { alignItems: 'center', gap: spacing.xxs },
        actionsSection: { gap: spacing.md },
        footer: { marginTop: spacing.lg, paddingBottom: spacing.md },
      }),
    [colors, isCompactScreen]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary, colors.background.primary]}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <ContentColumn style={{ flex: 1 }} maxWidth={680}>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              {/* Animated stars background */}
              <View style={styles.starsContainer}>
                {[...Array(12)].map((_, i) => (
                  <Ionicons
                    key={i}
                    name="star"
                    size={8 + Math.random() * 8}
                    color={colors.gold.pure}
                    style={[
                      styles.starDecor,
                      {
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        opacity: 0.2 + Math.random() * 0.5,
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Logo */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={[colors.gold.bright, colors.gold.pure]}
                  style={styles.logoGradient}
                >
                  <Ionicons name="star" size={isCompactScreen ? 52 : 64} color={colors.background.primary} />
                </LinearGradient>
              </View>

              {/* App name */}
              <View style={styles.appNameContainer}>
                <Text variant={isCompactScreen ? 'displaySmall' : 'displayMedium'} color={colors.text.primary} align="center" numberOfLines={1}>
                Starr
                </Text>
                <Text variant={isCompactScreen ? 'titleMedium' : 'titleLarge'} color={colors.gold.pure} align="center" numberOfLines={1}>
                Lightning Wallet
                </Text>
              </View>
            </View>

            {/* Features */}
            <View style={styles.featuresSection}>
              <View style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Ionicons name="flash" size={24} color={colors.gold.pure} />
                </View>
                <View style={styles.featureText}>
                  <Text variant="titleSmall" color={colors.text.primary} numberOfLines={1}>Instant Payments</Text>
                  <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={2}>Send and receive Bitcoin in seconds</Text>
                </View>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Ionicons name="key" size={24} color={colors.gold.pure} />
                </View>
                <View style={styles.featureText}>
                  <Text variant="titleSmall" color={colors.text.primary} numberOfLines={1}>Non-Custodial</Text>
                  <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={2}>You control your keys, your coins</Text>
                </View>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Ionicons name="shield-checkmark" size={24} color={colors.gold.pure} />
                </View>
                <View style={styles.featureText}>
                  <Text variant="titleSmall" color={colors.text.primary} numberOfLines={1}>Biometric Security</Text>
                  <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={2}>Protected by native device authentication</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsSection}>
              <Button
                title="Create New Wallet"
                onPress={() => router.push('/onboarding/create')}
                variant="primary"
                size="lg"
              />
              <Button
                title="Import Existing Wallet"
                onPress={() => router.push('/onboarding/import')}
                variant="secondary"
                size="lg"
              />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text variant="bodySmall" color={colors.text.muted} align="center">
              By continuing, you agree to our Terms of Service
              </Text>
            </View>
          </ContentColumn>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

