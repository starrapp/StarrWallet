/**
 * QR Scanner Screen (Modal)
 */

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Scanner } from '@/components/Scanner';

export default function ScanScreen() {
  return (
    <SafeAreaProvider>
      <Scanner />
    </SafeAreaProvider>
  );
}
