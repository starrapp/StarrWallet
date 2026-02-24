/**
 * Onboarding Layout
 */

import { Stack } from 'expo-router';
import { useColors } from '@/contexts';

export default function OnboardingLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="import" />
      <Stack.Screen name="backup" />
      <Stack.Screen name="security" />
    </Stack>
  );
}

