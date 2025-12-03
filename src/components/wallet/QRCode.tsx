/**
 * QR Code Components
 * 
 * For displaying and scanning Lightning invoices.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card } from '@/components/ui';
import { colors, spacing, layout } from '@/theme';

interface QRDisplayProps {
  value: string;
  size?: number;
  label?: string;
  onCopy?: () => void;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({
  value,
  size = 240,
  label,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    onCopy?.();
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: value,
        title: 'Lightning Invoice',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const truncateValue = (val: string): string => {
    if (val.length <= 24) return val;
    return `${val.slice(0, 12)}...${val.slice(-12)}`;
  };

  return (
    <View style={styles.container}>
      {/* QR Code */}
      <View style={styles.qrContainer}>
        <View style={styles.qrBackground}>
          <QRCodeSVG
            value={value}
            size={size}
            color={colors.background.primary}
            backgroundColor={colors.text.primary}
            ecl="M"
          />
        </View>
        
        {/* Decorative corner accents */}
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
      </View>

      {/* Label */}
      {label && (
        <Text variant="labelMedium" color={colors.text.secondary} align="center">
          {label}
        </Text>
      )}

      {/* Value display */}
      <TouchableOpacity onPress={handleCopy} style={styles.valueContainer}>
        <Text variant="address" color={colors.text.secondary} align="center">
          {truncateValue(value)}
        </Text>
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={16}
          color={copied ? colors.status.success : colors.text.muted}
        />
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy'}
            size={20}
            color={copied ? colors.status.success : colors.gold.pure}
          />
          <Text variant="labelMedium" color={copied ? colors.status.success : colors.gold.pure}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={colors.gold.pure} />
          <Text variant="labelMedium" color={colors.gold.pure}>
            Share
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Compact QR for transaction details
interface QRCompactProps {
  value: string;
  size?: number;
}

export const QRCompact: React.FC<QRCompactProps> = ({
  value,
  size = 80,
}) => {
  return (
    <View style={styles.compactContainer}>
      <QRCodeSVG
        value={value}
        size={size}
        color={colors.background.primary}
        backgroundColor={colors.text.primary}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  qrContainer: {
    position: 'relative',
    padding: spacing.md,
  },
  qrBackground: {
    padding: spacing.md,
    backgroundColor: colors.text.primary,
    borderRadius: layout.radius.lg,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.gold.pure,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: layout.radius.sm,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: layout.radius.sm,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: layout.radius.sm,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: layout.radius.sm,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: layout.radius.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.subtle,
  },
  compactContainer: {
    padding: spacing.xs,
    backgroundColor: colors.text.primary,
    borderRadius: layout.radius.sm,
  },
});

