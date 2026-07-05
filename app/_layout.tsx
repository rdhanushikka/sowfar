import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setupNotifications } from '../services/notifications';
import { ensureSignedIn } from '../services/supabase';

export default function RootLayout() {
  useEffect(() => {
    ensureSignedIn().catch(() => {});
    setupNotifications().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
