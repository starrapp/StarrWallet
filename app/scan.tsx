/**
 * QR Scanner Screen (Modal)
 */

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Scanner } from '@/components/Scanner';

export default function ScanScreen() {
  // This screen is a fullScreenModal opened on top of the Send modal. On iOS each
  // modal is its own view controller, and the provider at the app root describes
  // the root controller, not this one, so insets arrive as 0 here. A provider
  // inside the modal measures the modal itself.
  return (
    <SafeAreaProvider>
      <Scanner />
    </SafeAreaProvider>
  );
}
