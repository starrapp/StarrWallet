import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { breakpoints, contentMaxWidth } from '@/theme';

export type LayoutMode = 'phone' | 'tablet' | 'split';

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isLandscape = width > height;
    const isCompactWidth = width < breakpoints.compact;
    const isTabletWidth = width >= breakpoints.medium;
    const isSplitWidth = width >= breakpoints.expanded;

    let maxContentWidth = contentMaxWidth.compact;
    if (isSplitWidth) {
      maxContentWidth = contentMaxWidth.expanded;
    } else if (isTabletWidth) {
      maxContentWidth = contentMaxWidth.medium;
    }

    const layoutMode: LayoutMode = isSplitWidth ? 'split' : isTabletWidth ? 'tablet' : 'phone';

    return {
      width,
      height,
      isLandscape,
      isCompactWidth,
      isTabletWidth,
      isSplitWidth,
      maxContentWidth,
      layoutMode,
    };
  }, [height, width]);
}

