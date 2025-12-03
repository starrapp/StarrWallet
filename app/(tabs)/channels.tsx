/**
 * Channels Screen
 * 
 * View and manage Lightning channels.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card } from '@/components/ui';
import { LSPManager } from '@/services/lsp';
import { colors, spacing, layout } from '@/theme';
import type { LSPInfo } from '@/types/wallet';

export default function ChannelsScreen() {
  const [currentLSP, setCurrentLSP] = useState<LSPInfo | null>(null);
  const [availableLSPs, setAvailableLSPs] = useState<LSPInfo[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [current, available] = await Promise.all([
        LSPManager.getCurrentLSP(),
        LSPManager.getAvailableLSPs(),
      ]);
      setCurrentLSP(current);
      setAvailableLSPs(available);
    } catch (error) {
      console.error('Failed to load LSP data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" color={colors.text.primary}>
            Channels & LSPs
          </Text>
          <Text variant="bodyMedium" color={colors.text.secondary}>
            Manage your Lightning liquidity
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.gold.pure}
            />
          }
        >
          {/* Current LSP */}
          <View style={styles.section}>
            <Text variant="titleMedium" color={colors.text.primary} style={styles.sectionTitle}>
              Current Provider
            </Text>
            
            {currentLSP ? (
              <Card variant="default" style={styles.lspCard}>
                <View style={styles.lspHeader}>
                  <View style={styles.lspIcon}>
                    <Ionicons name="flash" size={24} color={colors.gold.pure} />
                  </View>
                  <View style={styles.lspInfo}>
                    <Text variant="titleSmall" color={colors.text.primary}>
                      {currentLSP.name}
                    </Text>
                    <Text variant="bodySmall" color={colors.text.secondary}>
                      Connected
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text variant="labelSmall" color={colors.status.success}>
                      Active
                    </Text>
                  </View>
                </View>
                
                <View style={styles.lspStats}>
                  <View style={styles.statItem}>
                    <Text variant="labelSmall" color={colors.text.muted}>
                      Base Fee
                    </Text>
                    <Text variant="titleSmall" color={colors.text.primary}>
                      {currentLSP.baseFeeSats} sats
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text variant="labelSmall" color={colors.text.muted}>
                      Fee Rate
                    </Text>
                    <Text variant="titleSmall" color={colors.text.primary}>
                      {(currentLSP.feeRate / 10000).toFixed(2)}%
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text variant="labelSmall" color={colors.text.muted}>
                      Max Channel
                    </Text>
                    <Text variant="titleSmall" color={colors.text.primary}>
                      {(currentLSP.maxChannelSize / 1000000).toFixed(1)}M
                    </Text>
                  </View>
                </View>
              </Card>
            ) : (
              <Card variant="outlined" style={styles.emptyCard}>
                <Ionicons name="cloud-offline" size={48} color={colors.text.muted} />
                <Text variant="bodyMedium" color={colors.text.secondary} align="center">
                  No LSP connected
                </Text>
              </Card>
            )}
          </View>

          {/* Available LSPs */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" color={colors.text.primary}>
                Available Providers
              </Text>
              <Text variant="labelSmall" color={colors.text.muted}>
                {availableLSPs.length} available
              </Text>
            </View>

            <View style={styles.lspList}>
              {availableLSPs.map((lsp) => (
                <TouchableOpacity
                  key={lsp.id}
                  style={styles.lspListItem}
                  onPress={() => {/* Select LSP */}}
                >
                  <View style={styles.lspListIcon}>
                    <Ionicons name="server" size={20} color={colors.accent.cyan} />
                  </View>
                  <View style={styles.lspListInfo}>
                    <Text variant="titleSmall" color={colors.text.primary}>
                      {lsp.name}
                    </Text>
                    <Text variant="bodySmall" color={colors.text.muted}>
                      Fee: {lsp.baseFeeSats} + {(lsp.feeRate / 10000).toFixed(2)}%
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Info */}
          <Card variant="outlined" style={styles.infoCard}>
            <View style={styles.infoContent}>
              <Ionicons name="information-circle" size={24} color={colors.accent.cyan} />
              <View style={styles.infoText}>
                <Text variant="titleSmall" color={colors.text.primary}>
                  About LSPs
                </Text>
                <Text variant="bodySmall" color={colors.text.secondary}>
                  Lightning Service Providers manage your payment channels automatically. 
                  Starr connects to multiple LSPs for reliability and the best fees.
                </Text>
              </View>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xxs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: layout.tabBarHeight + spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lspCard: {
    padding: spacing.md,
  },
  lspHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lspIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lspInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.status.success + '20',
    borderRadius: layout.radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  lspStats: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: colors.border.subtle,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  lspList: {
    gap: spacing.sm,
  },
  lspListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.lg,
    gap: spacing.md,
  },
  lspListIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.cyan + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lspListInfo: {
    flex: 1,
  },
  infoCard: {
    padding: spacing.md,
  },
  infoContent: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    gap: spacing.xs,
  },
});

