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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, layout, typography } from '@/theme';

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

  const getTextStyle = (): TextStyle => {
    const baseStyle = size === 'sm' ? typography.labelLarge : typography.titleMedium;
    
    switch (variant) {
      case 'primary':
        return { ...baseStyle, color: colors.background.primary };
      case 'secondary':
        return { ...baseStyle, color: colors.gold.pure };
      case 'ghost':
        return { ...baseStyle, color: colors.text.primary };
      case 'danger':
        return { ...baseStyle, color: colors.text.primary };
      default:
        return { ...baseStyle, color: colors.background.primary };
    }
  };

  const containerStyle: ViewStyle = {
    height: getHeight(),
    borderRadius: layout.radius.lg,
    opacity: disabled ? 0.5 : 1,
  };

  // Primary button with gradient
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[styles.container, style]}
      >
        <LinearGradient
          colors={[colors.gold.bright, colors.gold.pure, colors.gold.muted]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, containerStyle]}
        >
          {loading ? (
            <ActivityIndicator color={colors.background.primary} />
          ) : (
            <>
              {icon}
              <Text style={[styles.text, getTextStyle()]}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Secondary button with border
  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        style={[
          styles.container,
          styles.secondary,
          containerStyle,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.gold.pure} />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, getTextStyle()]}>{title}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  // Ghost button
  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.6}
        style={[
          styles.container,
          styles.ghost,
          containerStyle,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.text.primary} />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, getTextStyle()]}>{title}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  // Danger button
  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.container,
        styles.danger,
        containerStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text.primary} />
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
  container: {
    width: '100%',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderColor: colors.gold.pure,
    backgroundColor: 'transparent',
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    backgroundColor: colors.overlay.light,
  },
  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    backgroundColor: colors.status.error,
  },
  text: {
    fontWeight: '600',
  },
});

