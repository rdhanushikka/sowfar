import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors } from '../constants/colors';
import { unlockVault, lockVault, resetVault } from '../services/vault';
import { signOut } from '../services/supabase';
import { useVaultUi } from '../services/vaultUi';

export default function VaultUnlockScreen() {
  const { onUnlocked, onReset } = useVaultUi();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleUnlock() {
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const ok = await unlockVault(password);
      if (ok) {
        onUnlocked();
      } else {
        setError('Incorrect password.');
        setBusy(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out?', 'You can sign back in with Apple anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await lockVault();
          await signOut();
        },
      },
    ]);
  }

  function handleForgot() {
    Alert.alert(
      'Start over?',
      'Your password can’t be recovered. Starting over permanently deletes your existing journal so you can set a new password. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & start over',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await resetVault();
            onReset();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.mark}>✦</Text>
          <Text style={styles.title}>Enter your journal password</Text>
          <Text style={styles.body}>This unlocks your entries on this device.</Text>

          <TextInput
            style={styles.input}
            placeholder="Journal password"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
            autoFocus
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleUnlock}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.pill, !password && styles.pillDisabled]}
            onPress={handleUnlock}
            disabled={!password || busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.pillText}>Unlock</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgot} onPress={handleForgot}>
            <Text style={styles.forgotText}>Forgot password? Start over</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, paddingTop: 60 },
  mark: { fontSize: 40, color: Colors.primary, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 10 },
  body: { fontSize: 16, color: Colors.textSecondary, lineHeight: 24, marginBottom: 24 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 6,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 12,
  },
  error: { fontSize: 14, color: Colors.magenta, marginBottom: 12 },
  pill: {
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pillDisabled: { opacity: 0.4 },
  pillText: { fontSize: 16, fontWeight: '700', color: Colors.textOnPrimary },
  forgot: { alignItems: 'center', marginTop: 24, paddingVertical: 10 },
  forgotText: { fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },
  signOut: { alignItems: 'center', marginTop: 4, paddingVertical: 10 },
  signOutText: { fontSize: 14, color: Colors.textSecondary },
});
