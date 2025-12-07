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
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, Card, Input, Button } from '@/components/ui';
import { LSPManager } from '@/services/lsp';
import { ConfigService, type PreferredService } from '@/services/config';
import { LDKService } from '@/services/ldk';
import { LNDService } from '@/services/lnd';
import { useWalletStore } from '@/stores/walletStore';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';
import { isLDKConfigured } from '@/config/ldk';
import { isLNDConfigured } from '@/config/lnd';
import type { LSPInfo } from '@/types/wallet';

export default function ChannelsScreen() {
  const colors = useColors();
  const { isInitialized, isInitializing } = useWalletStore();
  const [currentLSP, setCurrentLSP] = useState<LSPInfo | null>(null);
  const [availableLSPs, setAvailableLSPs] = useState<LSPInfo[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Lightning service configuration state
  const [ldkConfigured, setLdkConfigured] = useState(false);
  const [lndConfigured, setLndConfigured] = useState(false);
  const [preferredService, setPreferredService] = useState<PreferredService>('auto');
  const [activeService, setActiveService] = useState<'ldk' | 'lnd' | 'none'>('none');
  const [showLDKModal, setShowLDKModal] = useState(false);
  const [showLNDModal, setShowLNDModal] = useState(false);
  
  // LDK form state
  const [ldkRestUrl, setLdkRestUrl] = useState('');
  const [ldkApiKey, setLdkApiKey] = useState('');
  
  // LND form state
  const [lndEnabled, setLndEnabled] = useState(false);
  const [lndRestUrl, setLndRestUrl] = useState('');
  const [lndMacaroon, setLndMacaroon] = useState('');
  const [lndCert, setLndCert] = useState('');
  const [lndConnectUrl, setLndConnectUrl] = useState('');
  const [lndConfigMode, setLndConfigMode] = useState<'connect' | 'manual'>('connect');

  useEffect(() => {
    // Only load data if wallet is initialized
    if (isInitialized && !isInitializing) {
      loadData();
      loadServiceConfig();
    } else if (!isInitializing && !isInitialized) {
      // Wallet not initialized yet
      setIsLoading(false);
      setLoadError('Wallet not initialized');
    }
  }, [isInitialized, isInitializing]);
  
  const loadServiceConfig = async () => {
    try {
      const [ldkConfig, lndConfig, preferred] = await Promise.all([
        isLDKConfigured(),
        isLNDConfigured(),
        ConfigService.getPreferredService(),
      ]);
      
      setLdkConfigured(ldkConfig);
      setLndConfigured(lndConfig);
      setPreferredService(preferred);
      
      // Determine active service
      if (preferred === 'ldk' && ldkConfig) {
        setActiveService('ldk');
      } else if (preferred === 'lnd' && lndConfig) {
        setActiveService('lnd');
      } else if (ldkConfig) {
        setActiveService('ldk');
      } else if (lndConfig) {
        setActiveService('lnd');
      } else {
        setActiveService('none');
      }
      
      // Load form values
      const savedLDK = await ConfigService.getLDKConfig();
      if (savedLDK) {
        setLdkRestUrl(savedLDK.restUrl);
        setLdkApiKey(savedLDK.apiKey || '');
      }
      
      const savedLND = await ConfigService.getLNDConfig();
      if (savedLND) {
        setLndEnabled(savedLND.enabled);
        if (savedLND.connectUrl) {
          setLndConfigMode('connect');
          setLndConnectUrl(savedLND.connectUrl);
        } else {
          setLndConfigMode('manual');
          setLndRestUrl(savedLND.restUrl);
          setLndMacaroon(savedLND.macaroon);
          setLndCert(savedLND.cert || '');
        }
      }
    } catch (error) {
      console.error('Failed to load service config:', error);
    }
  };

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
        LSPManager.getCurrentLSP(),
        LSPManager.getAvailableLSPs(),
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

  const handleSaveLDK = async () => {
    if (!ldkRestUrl.trim()) {
      Alert.alert('Invalid Configuration', 'Please enter a REST API URL.');
      return;
    }
    
    try {
      await ConfigService.setLDKConfig({
        restUrl: ldkRestUrl.trim(),
        apiKey: ldkApiKey.trim() || undefined,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Configuration Saved', 'LDK configuration has been saved. Please restart the app for changes to take effect.');
      setShowLDKModal(false);
      await loadServiceConfig();
    } catch (error) {
      console.error('Failed to save LDK config:', error);
      Alert.alert('Error', 'Failed to save configuration. Please try again.');
    }
  };
  
  const handleClearLDK = async () => {
    Alert.alert(
      'Clear LDK Configuration',
      'Are you sure you want to clear the LDK configuration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await ConfigService.setLDKConfig({ restUrl: '', apiKey: '' });
              setLdkRestUrl('');
              setLdkApiKey('');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Configuration Cleared', 'LDK configuration has been cleared.');
              setShowLDKModal(false);
              await loadServiceConfig();
            } catch (error) {
              console.error('Failed to clear LDK config:', error);
              Alert.alert('Error', 'Failed to clear configuration.');
            }
          },
        },
      ]
    );
  };
  
  const handleSaveLND = async () => {
    if (!lndEnabled) {
      try {
        await ConfigService.setLNDConfig({ enabled: false });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Configuration Saved', 'LND has been disabled.');
        setShowLNDModal(false);
        await loadServiceConfig();
      } catch (error) {
        console.error('Failed to save LND config:', error);
        Alert.alert('Error', 'Failed to save configuration.');
      }
      return;
    }
    
    if (lndConfigMode === 'connect') {
      if (!lndConnectUrl.trim()) {
        Alert.alert('Invalid Configuration', 'Please enter an LND Connect URL.');
        return;
      }
      
      try {
        await ConfigService.setLNDConfig({
          enabled: true,
          connectUrl: lndConnectUrl.trim(),
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Configuration Saved', 'LND configuration has been saved. Please restart the app for changes to take effect.');
        setShowLNDModal(false);
        await loadServiceConfig();
      } catch (error) {
        console.error('Failed to save LND config:', error);
        Alert.alert('Error', 'Failed to save configuration. Please try again.');
      }
    } else {
      if (!lndRestUrl.trim() || !lndMacaroon.trim()) {
        Alert.alert('Invalid Configuration', 'Please enter both REST API URL and Macaroon.');
        return;
      }
      
      try {
        await ConfigService.setLNDConfig({
          enabled: true,
          restUrl: lndRestUrl.trim(),
          macaroon: lndMacaroon.trim(),
          cert: lndCert.trim() || undefined,
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Configuration Saved', 'LND configuration has been saved. Please restart the app for changes to take effect.');
        setShowLNDModal(false);
        await loadServiceConfig();
      } catch (error) {
        console.error('Failed to save LND config:', error);
        Alert.alert('Error', 'Failed to save configuration. Please try again.');
      }
    }
  };
  
  const handleClearLND = async () => {
    Alert.alert(
      'Clear LND Configuration',
      'Are you sure you want to clear the LND configuration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await ConfigService.setLNDConfig({ enabled: false });
              setLndEnabled(false);
              setLndRestUrl('');
              setLndMacaroon('');
              setLndCert('');
              setLndConnectUrl('');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Configuration Cleared', 'LND configuration has been cleared.');
              setShowLNDModal(false);
              await loadServiceConfig();
            } catch (error) {
              console.error('Failed to clear LND config:', error);
              Alert.alert('Error', 'Failed to clear configuration.');
            }
          },
        },
      ]
    );
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
              
              const success = await LSPManager.connectToLSP(lsp.id);
              
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
          {/* Lightning Service Configuration */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" color={colors.text.primary}>
                Lightning Service
              </Text>
              <View style={styles.serviceStatus}>
                <View style={[
                  styles.serviceStatusDot,
                  activeService !== 'none' ? styles.serviceStatusDotActive : styles.serviceStatusDotInactive
                ]} />
                <Text variant="labelSmall" color={colors.text.muted}>
                  {activeService === 'ldk' ? 'LDK Active' : activeService === 'lnd' ? 'LND Active' : 'Not Configured'}
                </Text>
              </View>
            </View>
            
            <Card variant="default" style={styles.configCard}>
              <TouchableOpacity
                style={styles.configItem}
                onPress={() => setShowLDKModal(true)}
              >
                <View style={styles.configItemLeft}>
                  <Ionicons 
                    name={ldkConfigured ? 'checkmark-circle' : 'ellipse-outline'} 
                    size={24} 
                    color={ldkConfigured ? colors.status.success : colors.text.muted} 
                  />
                  <View style={styles.configItemInfo}>
                    <Text variant="titleSmall" color={colors.text.primary}>
                      LDK Node
                    </Text>
                    <Text variant="bodySmall" color={colors.text.secondary}>
                      {ldkConfigured ? 'Configured' : 'Not configured'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </TouchableOpacity>
              
              <View style={styles.configDivider} />
              
              <TouchableOpacity
                style={styles.configItem}
                onPress={() => setShowLNDModal(true)}
              >
                <View style={styles.configItemLeft}>
                  <Ionicons 
                    name={lndConfigured ? 'checkmark-circle' : 'ellipse-outline'} 
                    size={24} 
                    color={lndConfigured ? colors.status.success : colors.text.muted} 
                  />
                  <View style={styles.configItemInfo}>
                    <Text variant="titleSmall" color={colors.text.primary}>
                      LND Node
                    </Text>
                    <Text variant="bodySmall" color={colors.text.secondary}>
                      {lndConfigured ? 'Configured' : 'Not configured'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </Card>
          </View>

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
      
      {/* LDK Configuration Modal */}
      <Modal
        visible={showLDKModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLDKModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text variant="headlineSmall" color={colors.text.primary}>
              Configure LDK Node
            </Text>
            <TouchableOpacity onPress={() => setShowLDKModal(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Card variant="outlined" style={styles.modalCard}>
              <Text variant="bodySmall" color={colors.text.secondary} style={styles.modalDescription}>
                Connect to an LDK Node running as a REST API service. Enter the base URL of your LDK Node instance.
              </Text>
            </Card>
            
            <View style={styles.formGroup}>
              <Text variant="labelMedium" color={colors.text.primary} style={styles.label}>
                REST API URL *
              </Text>
              <Input
                placeholder="http://localhost:3000"
                value={ldkRestUrl}
                onChangeText={setLdkRestUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text variant="labelMedium" color={colors.text.primary} style={styles.label}>
                API Key (Optional)
              </Text>
              <Input
                placeholder="Leave empty if no authentication required"
                value={ldkApiKey}
                onChangeText={setLdkApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>
            
            <Button
              title="Save Configuration"
              onPress={handleSaveLDK}
              style={styles.saveButton}
            />
            
            {ldkConfigured && (
              <Button
                title="Clear Configuration"
                variant="outlined"
                onPress={handleClearLDK}
                style={styles.clearButton}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      
      {/* LND Configuration Modal */}
      <Modal
        visible={showLNDModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLNDModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text variant="headlineSmall" color={colors.text.primary}>
              Configure LND Node
            </Text>
            <TouchableOpacity onPress={() => setShowLNDModal(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Card variant="outlined" style={styles.modalCard}>
              <Text variant="bodySmall" color={colors.text.secondary} style={styles.modalDescription}>
                Connect to your LND node. You can use an LND Connect URL (from Start9/Umbrel) or enter credentials manually.
              </Text>
            </Card>
            
            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text variant="labelMedium" color={colors.text.primary}>
                  Enable LND
                </Text>
                <Switch
                  value={lndEnabled}
                  onValueChange={setLndEnabled}
                  trackColor={{ false: colors.border.subtle, true: colors.accent.cyan }}
                  thumbColor={lndEnabled ? colors.accent.cyan : colors.text.muted}
                />
              </View>
            </View>
            
            {lndEnabled && (
              <>
                <View style={styles.formGroup}>
                  <View style={styles.configModeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.configModeButton,
                        lndConfigMode === 'connect' && styles.configModeButtonActive
                      ]}
                      onPress={() => setLndConfigMode('connect')}
                    >
                      <Text variant="labelMedium" color={lndConfigMode === 'connect' ? colors.text.primary : colors.text.secondary}>
                        LND Connect URL
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.configModeButton,
                        lndConfigMode === 'manual' && styles.configModeButtonActive
                      ]}
                      onPress={() => setLndConfigMode('manual')}
                    >
                      <Text variant="labelMedium" color={lndConfigMode === 'manual' ? colors.text.primary : colors.text.secondary}>
                        Manual
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {lndConfigMode === 'connect' ? (
                  <View style={styles.formGroup}>
                    <Text variant="labelMedium" color={colors.text.primary} style={styles.label}>
                      LND Connect URL *
                    </Text>
                    <Input
                      placeholder="lndconnect://host:port?macaroon=...&cert=..."
                      value={lndConnectUrl}
                      onChangeText={setLndConnectUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      multiline
                      style={styles.textArea}
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.formGroup}>
                      <Text variant="labelMedium" color={colors.text.primary} style={styles.label}>
                        REST API URL *
                      </Text>
                      <Input
                        placeholder="https://your-lnd-node:8080"
                        value={lndRestUrl}
                        onChangeText={setLndRestUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                    </View>
                    
                    <View style={styles.formGroup}>
                      <Text variant="labelMedium" color={colors.text.primary} style={styles.label}>
                        Macaroon (Hex) *
                      </Text>
                      <Input
                        placeholder="Hex-encoded macaroon"
                        value={lndMacaroon}
                        onChangeText={setLndMacaroon}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry
                        multiline
                        style={styles.textArea}
                      />
                    </View>
                    
                    <View style={styles.formGroup}>
                      <Text variant="labelMedium" color={colors.text.primary} style={styles.label}>
                        Certificate (Base64, Optional)
                      </Text>
                      <Input
                        placeholder="Base64-encoded certificate for self-signed certs"
                        value={lndCert}
                        onChangeText={setLndCert}
                        autoCapitalize="none"
                        autoCorrect={false}
                        multiline
                        style={styles.textArea}
                      />
                    </View>
                  </>
                )}
                
                <Button
                  title="Save Configuration"
                  onPress={handleSaveLND}
                  style={styles.saveButton}
                />
              </>
            )}
            
            {lndConfigured && (
              <Button
                title="Clear Configuration"
                variant="outlined"
                onPress={handleClearLND}
                style={styles.clearButton}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  configCard: {
    padding: spacing.md,
  },
  configItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  configItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  configItemInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  configDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.sm,
  },
  serviceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  serviceStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serviceStatusDotActive: {
    backgroundColor: colors.status.success,
  },
  serviceStatusDotInactive: {
    backgroundColor: colors.text.muted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  modalCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  modalDescription: {
    marginTop: spacing.xs,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.xs,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: spacing.md,
  },
  clearButton: {
    marginTop: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configModeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.md,
    padding: spacing.xxs,
    gap: spacing.xxs,
  },
  configModeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: layout.radius.sm,
    alignItems: 'center',
  },
  configModeButtonActive: {
    backgroundColor: colors.background.primary,
  },
});

