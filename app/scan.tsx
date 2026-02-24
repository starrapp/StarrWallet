/**
 * QR Scanner Screen
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Text, Button } from '@/components/ui';
import { useColors } from '@/contexts';
import { spacing, layout } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

export default function ScanScreen() {
  const router = useRouter();
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        centerContent: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        },
        permissionContent: {
          alignItems: 'center',
          gap: spacing.lg,
          padding: spacing.xl,
        },
        overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
        topSection: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
        closeButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        torchButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        torchActive: { backgroundColor: colors.gold.glow },
        scanAreaContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        scanArea: {
          width: SCAN_AREA_SIZE,
          height: SCAN_AREA_SIZE,
          position: 'relative',
        },
        corner: {
          position: 'absolute',
          width: 40,
          height: 40,
          borderColor: colors.gold.pure,
        },
        cornerTL: {
          top: 0,
          left: 0,
          borderTopWidth: 4,
          borderLeftWidth: 4,
          borderTopLeftRadius: layout.radius.md,
        },
        cornerTR: {
          top: 0,
          right: 0,
          borderTopWidth: 4,
          borderRightWidth: 4,
          borderTopRightRadius: layout.radius.md,
        },
        cornerBL: {
          bottom: 0,
          left: 0,
          borderBottomWidth: 4,
          borderLeftWidth: 4,
          borderBottomLeftRadius: layout.radius.md,
        },
        cornerBR: {
          bottom: 0,
          right: 0,
          borderBottomWidth: 4,
          borderRightWidth: 4,
          borderBottomRightRadius: layout.radius.md,
        },
        bottomSection: {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          padding: spacing.xl,
          paddingBottom: spacing.xxxl,
          alignItems: 'center',
          gap: spacing.lg,
        },
        hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        pasteButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.gold.glow,
          borderRadius: layout.radius.full,
          borderWidth: 1,
          borderColor: colors.gold.pure,
        },
        rescanButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
        },
      }),
    [colors]
  );

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Check if it's a Lightning invoice
    const lowerData = data.toLowerCase();
    if (lowerData.startsWith('lightning:') || lowerData.startsWith('lnbc') || lowerData.startsWith('lntb')) {
      // Clean up the invoice
      const invoice = lowerData.replace('lightning:', '');
      router.replace({
        pathname: '/send',
        params: { invoice },
      });
    } else if (lowerData.startsWith('bitcoin:')) {
      // Bitcoin URI (optional lightning= in query)
      const queryString = data.split('?')[1];
      if (queryString) {
        const params = new URLSearchParams(queryString);
        const lightning = params.get('lightning');
        if (lightning) {
          router.replace({
            pathname: '/send',
            params: { invoice: lightning },
          });
          return;
        }
      }
      router.replace({
        pathname: '/send',
        params: { invoice: data },
      });
    } else {
      // Assume it's an invoice
      router.replace({
        pathname: '/send',
        params: { invoice: data },
      });
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.replace({
          pathname: '/send',
          params: { invoice: text },
        });
      } else {
        Alert.alert('Clipboard Empty', 'No text found in clipboard');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to read from clipboard');
    }
  };

  // Permission not determined yet
  if (!permission) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.centerContent}>
          <Text variant="bodyMedium" color={colors.text.secondary}>
            Checking camera permission...
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.centerContent}>
          <View style={styles.permissionContent}>
            <Ionicons name="camera-outline" size={64} color={colors.text.muted} />
            <Text variant="titleLarge" color={colors.text.primary} align="center">
              Camera Access Required
            </Text>
            <Text variant="bodyMedium" color={colors.text.secondary} align="center">
              We need camera access to scan QR codes for Lightning payments
            </Text>
            <Button
              title="Grant Permission"
              variant="primary"
              onPress={requestPermission}
            />
            <Button
              title="Go Back"
              variant="ghost"
              onPress={handleClose}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top section */}
        <SafeAreaView style={styles.topSection}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <Text variant="titleLarge" color={colors.text.primary}>
              Scan QR Code
            </Text>
            <TouchableOpacity
              style={[styles.torchButton, torch && styles.torchActive]}
              onPress={() => setTorch(!torch)}
            >
              <Ionicons
                name={torch ? 'flash' : 'flash-outline'}
                size={24}
                color={torch ? colors.gold.pure : colors.text.primary}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Scan area */}
        <View style={styles.scanAreaContainer}>
          <View style={styles.scanArea}>
            {/* Corner decorations */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        {/* Bottom section */}
        <View style={styles.bottomSection}>
          <View style={styles.hint}>
            <Ionicons name="flash" size={20} color={colors.gold.pure} />
            <Text variant="bodyMedium" color={colors.text.primary} align="center">
              Point your camera at a Lightning invoice QR code
            </Text>
          </View>

          <TouchableOpacity
            style={styles.pasteButton}
            onPress={handlePasteFromClipboard}
          >
            <Ionicons name="clipboard" size={20} color={colors.gold.pure} />
            <Text variant="titleSmall" color={colors.gold.pure}>
              Paste from Clipboard
            </Text>
          </TouchableOpacity>

          {scanned && (
            <TouchableOpacity
              style={styles.rescanButton}
              onPress={() => setScanned(false)}
            >
              <Ionicons name="refresh" size={20} color={colors.text.primary} />
              <Text variant="titleSmall" color={colors.text.primary}>
                Scan Again
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

