import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsive } from '@/hooks';
import { layout } from '@/theme';

interface ContentColumnProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
}

export function ContentColumn({ children, style, maxWidth }: ContentColumnProps) {
  const { maxContentWidth } = useResponsive();

  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: maxWidth ?? maxContentWidth,
          alignSelf: 'center',
          paddingHorizontal: layout.screenPadding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

