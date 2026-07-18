import React, { useState } from 'react';
import {
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
import {
  unlockVault,
  lockVault,
  resetVault,
  unlockWithRecovery,
  setNewPassword,
} from '../services/vault';
import { signOut } from '../services/supabase';
import { useVaultUi } from '../services/vaultUi';

type Mode = 'password' | 'recovery' | 'newpassword';

export default function VaultUnlockScreen() {
  const { onUnlocked, onReset } = useVaultUi();
  const [mode, setMode] = useState<Mode>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleUnlock() {
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const ok = await unlockVault(password);
      if (ok) onUnlocked();
      else { setError('Incorrect password.'); setBusy(false); }
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  async function handleRecover() {
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      const ok = await unlockWithRecovery(code);
      if (ok) { setError(''); setMode('newpassword'); }
      else setError('That recovery code didn’t work.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetNew() {
    if (newPw.length < 6) { setError('Use at least 6 characters.'); return; }
    if (newPw !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    setError('');
    try {
      await setNewPassword(newPw);
      onUnlocked();
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
        onPress: async () => { await lockVault(); await signOut(); },
      },
    ]);
  }

  function handleForgot() {
    Alert.alert(
      'Start over?',
      'This permanently deletes your existing journal so you can set a new password. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & start over',
          style: 'destructive',
          onPress: async () => { setBusy(true); await resetVault(); onReset(); },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.mark}>✦</Text>

          {mode === 'password' && (
            <>
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
                {busy ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.pillText}>Unlock</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.link} onPress={() => { setError(''); setMode('recovery'); }}>
                <Text style={styles.linkText}>Use recovery code</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'recovery' && (
            <>
              <Text style={styles.title}>Enter your recovery code</Text>
              <Text style={styles.body}>The code you saved when you first set up your journal.</Text>
              <TextInput
                style={styles.input}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                value={code}
                onChangeText={setCode}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={[styles.pill, !code.trim() && styles.pillDisabled]}
                onPress={handleRecover}
                disabled={!code.trim() || busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.pillText}>Recover</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.link} onPress={() => { setError(''); setMode('password'); }}>
                <Text style={styles.linkText}>Back to password</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'newpassword' && (
            <>
              <Text style={styles.title}>Set a new password</Text>
              <Text style={styles.body}>Recovered. Choose a new journal password for this device.</Text>
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
                autoFocus
                value={newPw}
                onChangeText={setNewPw}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={styles.pill}
                onPress={handleSetNew}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.pillText}>Set password</Text>}
              </TouchableOpacity>
            </>
          )}

          {mode === 'password' && (
            <>
              <TouchableOpacity style={styles.forgot} onPress={handleForgot}>
                <Text style={styles.forgotText}>Forgot everything? Start over</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </>
          )}
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
  link: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  linkText: { fontSize: 15, color: Colors.primary, fontWeight: '700' },
  forgot: { alignItems: 'center', marginTop: 36, paddingVertical: 10 },
  forgotText: { fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },
  signOut: { alignItems: 'center', marginTop: 4, paddingVertical: 10 },
  signOutText: { fontSize: 14, color: Colors.textSecondary },
});
