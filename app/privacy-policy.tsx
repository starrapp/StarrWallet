import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from '@/components/ui';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import type { ColorTheme } from '@/theme/colors';

type LinkItem = {
  label: string;
  url: string;
};

const PRODUCT_LINKS: LinkItem[] = [
  { label: 'Wallet', url: 'https://starr.app/' },
  { label: 'Security', url: 'https://starr.app/privacy' },
  { label: 'Terms of Service', url: 'https://starr.app/terms' },
];

const COMPANY_LINKS: LinkItem[] = [
  { label: 'About', url: 'https://starr.app/about' },
  { label: 'Blog', url: 'https://github.com/starr-wallet/starr' },
  { label: 'Careers', url: 'mailto:careers@starr.app' },
];

const LEGAL_LINKS: LinkItem[] = [
  { label: 'Read full Privacy Policy', url: 'https://starr.app/privacy' },
];

async function openExternalLink(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Error', 'Unable to open this link.');
      return;
    }
    await Linking.openURL(url);
  } catch (error) {
    console.error('Failed to open external link:', error);
    Alert.alert('Error', 'Failed to open link.');
  }
}

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
    titleWrap: {
      flex: 1,
      alignItems: 'center',
    },
    content: {
      padding: spacing.lg,
      gap: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    introCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: layout.radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    section: {
      gap: spacing.sm,
    },
    sectionLabel: {
      marginLeft: spacing.xs,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.background.secondary,
      borderRadius: layout.radius.lg,
      padding: spacing.md,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.gold.glow,
    },
    rowLabel: {
      flex: 1,
    },
  });

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderLinkList = (items: LinkItem[]) =>
    items.map((item) => (
      <TouchableOpacity
        key={item.label}
        style={styles.linkRow}
        onPress={() => openExternalLink(item.url)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.label}`}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="link-outline" size={18} color={colors.gold.pure} />
        </View>
        <Text variant="titleSmall" color={colors.text.primary} style={styles.rowLabel}>
          {item.label}
        </Text>
        <Ionicons name="open-outline" size={16} color={colors.text.muted} />
      </TouchableOpacity>
    ));

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Button title="Back" variant="ghost" size="sm" onPress={() => router.back()} />
          <View style={styles.titleWrap}>
            <Text variant="titleLarge" color={colors.text.primary}>
              Privacy Policy
            </Text>
          </View>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.introCard}>
            <Text variant="titleSmall" color={colors.text.primary}>
              Your privacy matters
            </Text>
            <Text variant="bodySmall" color={colors.text.secondary}>
              Starr is a non-custodial wallet. You keep control of your keys and funds.
            </Text>
          </View>

          <View style={styles.section}>
            <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
              Product
            </Text>
            {renderLinkList(PRODUCT_LINKS)}
          </View>

          <View style={styles.section}>
            <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
              Company
            </Text>
            {renderLinkList(COMPANY_LINKS)}
          </View>

          <View style={styles.section}>
            <Text variant="labelMedium" color={colors.text.muted} style={styles.sectionLabel}>
              Legal
            </Text>
            {renderLinkList(LEGAL_LINKS)}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
