/**
 * Button Component
 * 
 * Primary action button with multiple variants and loading states.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { layout, spacing, typography } from '@/theme';
import { useColors } from '@/contexts';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
}) => {
  // Use the hook to get current theme colors
  const themeColors = useColors();

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const getHeight = (): number => {
    switch (size) {
      case 'sm': return layout.buttonHeight.sm;
      case 'lg': return layout.buttonHeight.lg;
      default: return layout.buttonHeight.md;
    }
  };

  const getBackgroundColor = (): string => {
    if (disabled) return themeColors.background.elevated;
    
    switch (variant) {
      case 'primary':
        return themeColors.gold.pure;
      case 'secondary':
        return 'transparent';
      case 'ghost':
        return 'transparent';
      case 'danger':
        return themeColors.status.error;
      default:
        return themeColors.gold.pure;
    }
  };

  const getBorderColor = (): string | undefined => {
    if (variant === 'secondary') return themeColors.gold.pure;
    return undefined;
  };

  const getBorderWidth = (): number => {
    if (variant === 'secondary') return 2;
    return 0;
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = size === 'sm' ? typography.labelLarge : typography.titleMedium;
    
    if (disabled) return { ...baseStyle, color: themeColors.text.muted };

    switch (variant) {
      case 'primary':
        return { ...baseStyle, color: '#FFFFFF' }; // Always white on primary
      case 'secondary':
        return { ...baseStyle, color: themeColors.gold.pure };
      case 'ghost':
        return { ...baseStyle, color: themeColors.text.primary };
      case 'danger':
        return { ...baseStyle, color: '#FFFFFF' };
      default:
        return { ...baseStyle, color: '#FFFFFF' };
    }
  };

  const containerStyle: ViewStyle = {
    height: getHeight(),
    borderRadius: layout.radius.full, // Modern pill shape
    backgroundColor: getBackgroundColor(),
    borderColor: getBorderColor(),
    borderWidth: getBorderWidth(),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator color={getTextStyle().color} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, getTextStyle()]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
