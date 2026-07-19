import { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setupNotifications } from '../services/notifications';
import { supabase } from '../services/supabase';
import { initClock } from '../services/clock';
import { hasVault, isUnlocked, loadCachedKey } from '../services/vault';
import { VaultUiContext } from '../services/vaultUi';
import { Colors } from '../constants/colors';
import type { Session } from '@supabase/supabase-js';

type VaultStatus = 'unknown' | 'setup' | 'unlock' | 'ready';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>('unknown');
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initClock().finally(() => {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setAuthReady(true);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Decide whether the journal needs setup, unlock, or is already open.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!session) {
        setVaultStatus('unknown');
        return;
      }
      if (isUnlocked() || (await loadCachedKey())) {
        if (!cancelled) setVaultStatus('ready');
        return;
      }
      const exists = await hasVault();
      if (!cancelled) setVaultStatus(exists ? 'unlock' : 'setup');
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (session) setupNotifications().catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!authReady) return;
    const group = segments[0];

    if (!session) {
      if (group !== 'login') router.replace('/login');
      return;
    }
    const onAuthScreen = group === 'login' || group === 'vault-setup' || group === 'vault-unlock';
    if (vaultStatus === 'setup' && group !== 'vault-setup') router.replace('/vault-setup');
    else if (vaultStatus === 'unlock' && group !== 'vault-unlock') router.replace('/vault-unlock');
    // Once ready, only pull the user out of auth screens — leave app routes
    // (tabs, edit modal, future screens) alone.
    else if (vaultStatus === 'ready' && onAuthScreen) router.replace('/(tabs)');
  }, [authReady, session, vaultStatus, segments]);

  const onUnlocked = useCallback(() => setVaultStatus('ready'), []);
  const onReset = useCallback(() => setVaultStatus('setup'), []);

  if (!authReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <VaultUiContext.Provider value={{ onUnlocked, onReset }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="vault-setup" />
          <Stack.Screen name="vault-unlock" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
        </Stack>
      </VaultUiContext.Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
});
