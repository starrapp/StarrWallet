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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, Card } from '@/components/ui';
import { BreezService } from '@/services/breez';
import { useWalletStore } from '@/stores/walletStore';
import { colors, spacing, layout } from '@/theme';
import type { LSPInfo } from '@/types/wallet';

export default function ChannelsScreen() {
  const { isInitialized, isInitializing } = useWalletStore();
  const [currentLSP, setCurrentLSP] = useState<LSPInfo | null>(null);
  const [availableLSPs, setAvailableLSPs] = useState<LSPInfo[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Only load data if wallet is initialized
    if (isInitialized && !isInitializing) {
      loadData();
    } else if (!isInitializing && !isInitialized) {
      // Wallet not initialized yet
      setIsLoading(false);
      setLoadError('Wallet not initialized');
    }
  }, [isInitialized, isInitializing]);

  const loadData = async () => {
    if (!isInitialized) {
      setLoadError('Wallet not initialized');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    
    try {
      const [current, available] = await Promise.all([
        BreezService.getCurrentLSP(),
        BreezService.getAvailableLSPs(),
      ]);
      setCurrentLSP(current);
      setAvailableLSPs(available);
    } catch (error) {
      console.error('Failed to load LSP data:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load LSP data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleSelectLSP = async (lsp: LSPInfo) => {
    // If already the current LSP, do nothing
    if (currentLSP?.id === lsp.id) {
      Alert.alert('Already Connected', `You are already connected to ${lsp.name}.`);
      return;
    }

    Alert.alert(
      'Switch Provider',
      `Switch to ${lsp.name}?\n\nBase Fee: ${lsp.baseFeeSats} sats\nFee Rate: ${(lsp.feeRate / 10000).toFixed(2)}%`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            try {
              setIsConnecting(lsp.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              await BreezService.selectLSP(lsp.id);
              const success = true;
              
              if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await loadData();
                Alert.alert('Connected', `Successfully connected to ${lsp.name}.`);
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Connection Failed', `Failed to connect to ${lsp.name}. Please try again.`);
              }
            } catch (error) {
              console.error('Failed to connect to LSP:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'An error occurred while switching providers.');
            } finally {
              setIsConnecting(null);
            }
          },
        },
      ]
    );
  };

  // Show loading state while wallet is initializing
  if (isInitializing || isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text variant="headlineMedium" color={colors.text.primary}>
              Channels & LSPs
            </Text>
            <Text variant="bodyMedium" color={colors.text.secondary}>
              Manage your Lightning liquidity
            </Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.gold.pure} />
            <Text variant="bodyMedium" color={colors.text.secondary} style={styles.loadingText}>
              {isInitializing ? 'Initializing wallet...' : 'Loading LSP data...'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Show error state if wallet not initialized
  if (!isInitialized || loadError) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text variant="headlineMedium" color={colors.text.primary}>
              Channels & LSPs
            </Text>
            <Text variant="bodyMedium" color={colors.text.secondary}>
              Manage your Lightning liquidity
            </Text>
          </View>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={colors.status.error} />
            <Text variant="titleMedium" color={colors.text.primary} style={styles.errorTitle}>
              {!isInitialized ? 'Wallet Not Initialized' : 'Failed to Load'}
            </Text>
            <Text variant="bodyMedium" color={colors.text.secondary} align="center" style={styles.errorText}>
              {!isInitialized 
                ? 'Please initialize your wallet first to view LSP information.'
                : loadError || 'An error occurred while loading LSP data.'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

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
              {availableLSPs.map((lsp) => {
                const isCurrentLSP = currentLSP?.id === lsp.id;
                const isConnectingThis = isConnecting === lsp.id;
                
                return (
                  <TouchableOpacity
                    key={lsp.id}
                    style={[
                      styles.lspListItem,
                      isCurrentLSP && styles.lspListItemActive,
                    ]}
                    onPress={() => handleSelectLSP(lsp)}
                    disabled={isConnecting !== null}
                  >
                    <View style={[
                      styles.lspListIcon,
                      isCurrentLSP && styles.lspListIconActive,
                    ]}>
                      {isConnectingThis ? (
                        <ActivityIndicator size="small" color={colors.gold.pure} />
                      ) : (
                        <Ionicons 
                          name={isCurrentLSP ? 'flash' : 'server'} 
                          size={20} 
                          color={isCurrentLSP ? colors.gold.pure : colors.accent.cyan} 
                        />
                      )}
                    </View>
                    <View style={styles.lspListInfo}>
                      <View style={styles.lspListHeader}>
                        <Text variant="titleSmall" color={colors.text.primary}>
                          {lsp.name}
                        </Text>
                        {isCurrentLSP && (
                          <View style={styles.currentBadge}>
                            <Text variant="labelSmall" color={colors.gold.pure}>
                              Current
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text variant="bodySmall" color={colors.text.muted}>
                        Fee: {lsp.baseFeeSats} + {(lsp.feeRate / 10000).toFixed(2)}%
                      </Text>
                    </View>
                    {!isCurrentLSP && (
                      <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
                    )}
                    {isCurrentLSP && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.gold.pure} />
                    )}
                  </TouchableOpacity>
                );
              })}
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
  lspListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lspListItemActive: {
    borderWidth: 1.5,
    borderColor: colors.gold.pure,
    backgroundColor: colors.gold.glow,
  },
  lspListIconActive: {
    backgroundColor: colors.gold.glow,
  },
  currentBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.gold.pure + '20',
    borderRadius: layout.radius.sm,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    marginTop: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    marginTop: spacing.sm,
  },
  errorText: {
    marginTop: spacing.xs,
    maxWidth: 300,
  },
});

