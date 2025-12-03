/**
 * Scan Tab Placeholder
 * 
 * This screen is never shown - the scan button in the tab bar
 * opens the /scan modal directly.
 */

import { View } from 'react-native';
import { colors } from '@/theme';

export default function ScanTabPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: colors.background.primary }} />;
}
