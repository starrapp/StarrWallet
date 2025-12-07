/**
 * Card Component
 * 
 * Container component with consistent styling.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { layout, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  style,
}) => {
  const colors = useColors();

  const getPadding = (): number => {
    switch (padding) {
      case 'none': return 0;
      case 'sm': return spacing.sm;
      case 'lg': return spacing.lg;
      default: return spacing.md;
    }
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.background.secondary,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 2,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.subtle,
        };
      default:
        return {
          backgroundColor: colors.background.secondary,
        };
    }
  };

  return (
    <View
      style={[
        styles.container,
        getVariantStyle(),
        { padding: getPadding() },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: layout.radius.xl, // More rounded corners for modern look
    overflow: 'hidden',
  },
});
