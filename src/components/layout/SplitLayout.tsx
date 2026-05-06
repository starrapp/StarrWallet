import React from 'react';
import { View } from 'react-native';
import { useResponsive } from '@/hooks';
import { spacing } from '@/theme';

interface SplitLayoutProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  primaryWidth?: number;
}

export function SplitLayout({ primary, secondary, primaryWidth = 380 }: SplitLayoutProps) {
  const { isSplitWidth } = useResponsive();

  if (!isSplitWidth) {
    return <>{primary}</>;
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: spacing.md }}>
      <View style={{ width: primaryWidth }}>{primary}</View>
      <View style={{ flex: 1 }}>{secondary}</View>
    </View>
  );
}

