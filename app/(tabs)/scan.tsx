/**
 * Scan Tab Placeholder
 * 
 * This screen is never shown - the scan button in the tab bar
 * opens the /scan modal directly.
 */

import { View } from 'react-native';
import { useColors } from '@/contexts';

export default function ScanTabPlaceholder() {
  const colors = useColors();
  return <View style={{ flex: 1, backgroundColor: colors.background.primary }} />;
}
