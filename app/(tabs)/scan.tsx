/**
 * QR Scanner Screen (Tab)
 */

import { Scanner } from '@/components/Scanner';
import { layout } from '@/theme';

export default function ScanTabScreen() {
  return <Scanner bottomInset={layout.tabBarHeight} />;
}
