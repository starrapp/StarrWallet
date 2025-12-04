/**
 * Breez SDK Test Screen
 * 
 * Comprehensive testing of all Breez SDK functions and API key validation.
 * This screen helps verify the SDK is properly configured and working.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, Card, Button } from '@/components/ui';
import { BreezService } from '@/services/breez';
import { BREEZ_CONFIG, isBreezConfigured } from '@/config/breez';
import { KeychainService } from '@/services/keychain';
import { colors, spacing, layout } from '@/theme';

type TestStatus = 'pending' | 'running' | 'success' | 'error';

interface TestResult {
  name: string;
  status: TestStatus;
  message: string;
  data?: any;
  error?: string;
}

export default function TestBreezScreen() {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testInvoice, setTestInvoice] = useState('');
  const [testBolt11, setTestBolt11] = useState('');

  useEffect(() => {
    checkInitialization();
  }, []);

  const checkInitialization = async () => {
    // Check if wallet is initialized
    const walletInitialized = await KeychainService.isWalletInitialized();
    setIsInitialized(walletInitialized);
  };

  const addTestResult = (result: TestResult) => {
    setTestResults((prev) => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const updateTestResult = (name: string, updates: Partial<TestResult>) => {
    setTestResults((prev) =>
      prev.map((r) => (r.name === name ? { ...r, ...updates } : r))
    );
  };

  const runTest = async (name: string, testFn: () => Promise<any>) => {
    updateTestResult(name, { status: 'running', message: 'Running...' });
    
    try {
      const result = await testFn();
      updateTestResult(name, {
        status: 'success',
        message: 'Success',
        data: result,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      updateTestResult(name, {
        status: 'error',
        message: 'Failed',
        error: errorMessage,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    }
  };

  const testApiKeyConfig = async () => {
    const isConfigured = isBreezConfigured();
    const apiKeyLength = BREEZ_CONFIG.API_KEY.length;
    const apiKeyPreview = apiKeyLength > 0 
      ? `${BREEZ_CONFIG.API_KEY.substring(0, 8)}...${BREEZ_CONFIG.API_KEY.substring(apiKeyLength - 4)}`
      : 'Not set';

    addTestResult({
      name: 'API Key Configuration',
      status: isConfigured ? 'success' : 'error',
      message: isConfigured ? 'API key is configured' : 'API key is missing',
      data: {
        configured: isConfigured,
        keyLength: apiKeyLength,
        keyPreview: apiKeyPreview,
        network: BREEZ_CONFIG.NETWORK,
      },
    });
  };

  const testMockMode = async () => {
    const isMock = BreezService.isMockMode();
    addTestResult({
      name: 'Mock Mode Check',
      status: 'success',
      message: isMock ? 'Running in mock mode (native module not available)' : 'Native module available',
      data: { isMockMode: isMock },
    });
  };

  const testInitialization = async () => {
    if (!isInitialized) {
      throw new Error('Wallet not initialized. Please create or import a wallet first.');
    }

    const mnemonic = await KeychainService.getMnemonicForBackup(false);
    
    await runTest('Initialize Breez SDK', async () => {
      await BreezService.initialize(mnemonic, {
        workingDir: BREEZ_CONFIG.WORKING_DIR,
        network: BREEZ_CONFIG.NETWORK,
      });
      return { initialized: true };
    });
  };

  const testGetBalance = async () => {
    await runTest('Get Balance', async () => {
      const balance = await BreezService.getBalance();
      return balance;
    });
  };

  const testGetNodeInfo = async () => {
    await runTest('Get Node Info', async () => {
      const nodeInfo = await BreezService.getNodeInfo();
      return nodeInfo;
    });
  };

  const testCreateInvoice = async () => {
    await runTest('Create Invoice', async () => {
      const invoice = await BreezService.createInvoice(1000, 'Test invoice from Starr', 3600);
      setTestInvoice(invoice.bolt11);
      return invoice;
    });
  };

  const testParseInvoice = async () => {
    if (!testInvoice && !testBolt11) {
      Alert.alert('No Invoice', 'Please create an invoice first or paste a BOLT11 invoice.');
      return;
    }

    const bolt11 = testBolt11 || testInvoice;
    
    await runTest('Parse Invoice', async () => {
      const parsed = await BreezService.parseInvoice(bolt11);
      return parsed;
    });
  };

  const testGetPayments = async () => {
    await runTest('Get Payments (All)', async () => {
      const payments = await BreezService.getPayments('all', 10);
      return { count: payments.length, payments };
    });
  };

  const testGetCurrentLSP = async () => {
    await runTest('Get Current LSP', async () => {
      const lsp = await BreezService.getCurrentLSP();
      return lsp;
    });
  };

  const testGetAvailableLSPs = async () => {
    await runTest('Get Available LSPs', async () => {
      const lsps = await BreezService.getAvailableLSPs();
      return { count: lsps.length, lsps };
    });
  };

  const testSyncNode = async () => {
    await runTest('Sync Node', async () => {
      await BreezService.syncNode();
      return { synced: true };
    });
  };

  const testTriggerBackup = async () => {
    await runTest('Trigger Backup', async () => {
      await BreezService.triggerBackup();
      return { triggered: true };
    });
  };

  const testGetBackupStatus = async () => {
    await runTest('Get Backup Status', async () => {
      const status = await BreezService.getBackupStatus();
      return status;
    });
  };

  const testSelectLSP = async () => {
    // First get current LSP to test selection
    const currentLSP = await BreezService.getCurrentLSP();
    if (!currentLSP) {
      throw new Error('No LSP available to test selection');
    }

    await runTest('Select LSP', async () => {
      await BreezService.selectLSP(currentLSP.id);
      return { lspId: currentLSP.id };
    });
  };

  const testShutdown = async () => {
    await runTest('Shutdown Breez SDK', async () => {
      await BreezService.shutdown();
      return { shutdown: true };
    });
  };

  const runAllTests = async () => {
    if (isRunning) return;

    setIsRunning(true);
    clearResults();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Basic checks
      await testApiKeyConfig();
      await testMockMode();

      // Only run SDK tests if wallet is initialized
      if (!isInitialized) {
        addTestResult({
          name: 'Wallet Initialization',
          status: 'error',
          message: 'Wallet not initialized. Please create or import a wallet first.',
        });
        return;
      }

      // SDK initialization
      await testInitialization();

      // Core functions
      await testGetBalance();
      await testGetNodeInfo();
      await testGetCurrentLSP();
      await testGetAvailableLSPs();
      
      // Invoice functions
      await testCreateInvoice();
      if (testInvoice) {
        await testParseInvoice();
      }

      // Payment functions
      await testGetPayments();

      // Network functions
      await testSyncNode();

      // Backup functions
      await testTriggerBackup();
      await testGetBackupStatus();

      // LSP functions
      await testSelectLSP();

      Alert.alert('Tests Complete', 'All tests have been executed. Check results below.');
    } catch (error) {
      console.error('Test suite error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'running':
        return <ActivityIndicator size="small" color={colors.accent.cyan} />;
      case 'success':
        return <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />;
      case 'error':
        return <Ionicons name="close-circle" size={20} color={colors.status.error} />;
      default:
        return <Ionicons name="ellipse-outline" size={20} color={colors.text.muted} />;
    }
  };

  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case 'running':
        return colors.accent.cyan;
      case 'success':
        return colors.status.success;
      case 'error':
        return colors.status.error;
      default:
        return colors.text.muted;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text variant="headlineMedium" color={colors.text.primary}>
            Breez SDK Tests
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary}>
            Test all Breez SDK functions and API key
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Configuration Info */}
        <Card variant="outlined" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={colors.accent.cyan} />
            <View style={styles.infoContent}>
              <Text variant="labelSmall" color={colors.text.muted}>
                API Key Configured
              </Text>
              <Text variant="bodySmall" color={colors.text.primary}>
                {isBreezConfigured() ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="server" size={20} color={colors.accent.cyan} />
            <View style={styles.infoContent}>
              <Text variant="labelSmall" color={colors.text.muted}>
                Network
              </Text>
              <Text variant="bodySmall" color={colors.text.primary}>
                {BREEZ_CONFIG.NETWORK}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cube" size={20} color={colors.accent.cyan} />
            <View style={styles.infoContent}>
              <Text variant="labelSmall" color={colors.text.muted}>
                Mock Mode
              </Text>
              <Text variant="bodySmall" color={colors.text.primary}>
                {BreezService.isMockMode() ? 'Yes (Native module not available)' : 'No'}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="wallet" size={20} color={colors.accent.cyan} />
            <View style={styles.infoContent}>
              <Text variant="labelSmall" color={colors.text.muted}>
                Wallet Initialized
              </Text>
              <Text variant="bodySmall" color={colors.text.primary}>
                {isInitialized ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Test Invoice Input */}
        <Card variant="outlined" style={styles.inputCard}>
          <Text variant="labelMedium" color={colors.text.primary} style={styles.inputLabel}>
            Test BOLT11 Invoice (for parsing)
          </Text>
          <TextInput
            style={styles.input}
            value={testBolt11}
            onChangeText={setTestBolt11}
            placeholder="lnbc..."
            placeholderTextColor={colors.text.muted}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title={isRunning ? 'Running Tests...' : 'Run All Tests'}
            onPress={runAllTests}
            variant="primary"
            size="lg"
            disabled={isRunning}
            icon={isRunning ? <ActivityIndicator size="small" color={colors.text.inverse} /> : undefined}
          />
          <Button
            title="Clear Results"
            onPress={clearResults}
            variant="ghost"
            size="md"
            disabled={isRunning || testResults.length === 0}
          />
        </View>

        {/* Test Results */}
        {testResults.length > 0 && (
          <View style={styles.resultsSection}>
            <Text variant="titleMedium" color={colors.text.primary} style={styles.sectionTitle}>
              Test Results ({testResults.length})
            </Text>
            {testResults.map((result, index) => (
              <Card
                key={index}
                variant="outlined"
                style={[
                  styles.resultCard,
                  { borderColor: getStatusColor(result.status) + '40' },
                ]}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.resultTitleRow}>
                    {getStatusIcon(result.status)}
                    <Text variant="titleSmall" color={colors.text.primary} style={styles.resultTitle}>
                      {result.name}
                    </Text>
                  </View>
                  <Text
                    variant="labelSmall"
                    color={getStatusColor(result.status)}
                    style={styles.resultStatus}
                  >
                    {result.status.toUpperCase()}
                  </Text>
                </View>
                <Text variant="bodySmall" color={colors.text.secondary} style={styles.resultMessage}>
                  {result.message}
                </Text>
                {result.error && (
                  <View style={styles.errorContainer}>
                    <Text variant="bodySmall" color={colors.status.error}>
                      Error: {result.error}
                    </Text>
                  </View>
                )}
                {result.data && (
                  <View style={styles.dataContainer}>
                    <Text variant="labelSmall" color={colors.text.muted} style={styles.dataLabel}>
                      Data:
                    </Text>
                    <Text variant="bodySmall" color={colors.text.secondary} style={styles.dataText}>
                      {JSON.stringify(result.data, null, 2)}
                    </Text>
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}

        {/* Individual Test Buttons */}
        {isInitialized && (
          <View style={styles.individualTests}>
            <Text variant="titleMedium" color={colors.text.primary} style={styles.sectionTitle}>
              Individual Tests
            </Text>
            <View style={styles.testButtons}>
              <Button
                title="Get Balance"
                onPress={testGetBalance}
                variant="secondary"
                size="sm"
                disabled={isRunning}
              />
              <Button
                title="Get Node Info"
                onPress={testGetNodeInfo}
                variant="secondary"
                size="sm"
                disabled={isRunning}
              />
              <Button
                title="Create Invoice"
                onPress={testCreateInvoice}
                variant="secondary"
                size="sm"
                disabled={isRunning}
              />
              <Button
                title="Parse Invoice"
                onPress={testParseInvoice}
                variant="secondary"
                size="sm"
                disabled={isRunning}
              />
              <Button
                title="Get Payments"
                onPress={testGetPayments}
                variant="secondary"
                size="sm"
                disabled={isRunning}
              />
              <Button
                title="Get LSP"
                onPress={testGetCurrentLSP}
                variant="secondary"
                size="sm"
                disabled={isRunning}
              />
              <Button
                title="Sync Node"
                onPress={testSyncNode}
                variant="secondary"
                size="sm"
                disabled={isRunning}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    gap: spacing.xxs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  infoCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoContent: {
    flex: 1,
    gap: spacing.xxs,
  },
  inputCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: layout.radius.md,
    padding: spacing.sm,
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: 'monospace',
    minHeight: 60,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  resultsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  resultCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  resultTitle: {
    flex: 1,
  },
  resultStatus: {
    fontWeight: '600',
  },
  resultMessage: {
    marginBottom: spacing.xs,
  },
  errorContainer: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.status.error + '15',
    borderRadius: layout.radius.sm,
  },
  dataContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: layout.radius.sm,
  },
  dataLabel: {
    marginBottom: spacing.xs,
  },
  dataText: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  individualTests: {
    marginTop: spacing.lg,
  },
  testButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

