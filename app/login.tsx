import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Colors } from '../constants/colors';
import { signInWithApple, isAppleAuthAvailable } from '../services/supabase';

export default function LoginScreen() {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    isAppleAuthAvailable().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  async function handleSignIn() {
    setBusy(true);
    setError('');
    try {
      await signInWithApple();
      // Root layout's auth listener will route into the app automatically.
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError('Could not sign in. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={styles.mark}>✦</Text>
          <Text style={styles.title}>Sowfar</Text>
          <Text style={styles.tagline}>
            A few quiet minutes each night.{'\n'}Reflect, and grow — so far.
          </Text>
        </View>

        <View style={styles.bottom}>
          {busy ? (
            <ActivityIndicator color={Colors.primary} />
          ) : available && Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={100}
              style={styles.appleBtn}
              onPress={handleSignIn}
            />
          ) : (
            <Text style={styles.unavailable}>
              Sign in with Apple is required and is only available on iOS devices.
            </Text>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.disclaimer}>
            Your journal is private and synced securely to your account.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  content: { flex: 1, justifyContent: 'space-between', padding: 32, paddingBottom: 48 },
  top: { flex: 1, justifyContent: 'center' },
  mark: { fontSize: 44, color: Colors.textOnPrimary, marginBottom: 20 },
  title: { fontSize: 48, fontWeight: '900', color: Colors.textOnPrimary, letterSpacing: -1, marginBottom: 16 },
  tagline: { fontSize: 18, color: Colors.textOnPrimary, opacity: 0.9, lineHeight: 28 },

  bottom: { gap: 16 },
  appleBtn: { height: 54, width: '100%' },
  unavailable: { fontSize: 15, color: Colors.textOnPrimary, textAlign: 'center', lineHeight: 22 },
  error: { fontSize: 14, color: Colors.yellow, textAlign: 'center' },
  disclaimer: { fontSize: 13, color: Colors.textOnPrimary, opacity: 0.7, textAlign: 'center', lineHeight: 19 },
});
