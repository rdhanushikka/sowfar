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
} from 'react-native';
import { Colors } from '../constants/colors';
import { setupVault } from '../services/vault';
import { useVaultUi } from '../services/vaultUi';

export default function VaultSetupScreen() {
  const { onUnlocked } = useVaultUi();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valid = password.length >= 6 && password === confirm;

  async function handleCreate() {
    if (!valid) {
      setError(password.length < 6 ? 'Use at least 6 characters.' : "Passwords don't match.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setupVault(password);
      onUnlocked();
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set a journal password</Text>
          <Text style={styles.body}>
            Your entries are encrypted with this password before they ever leave your phone.
            Not even we can read them.
          </Text>

          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              There is no way to reset it. If you forget this password, your journal cannot be
              recovered. Consider saving it in a password manager.
            </Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Journal password"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
            autoFocus
            value={password}
            onChangeText={setPassword}
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
            style={[styles.pill, !valid && styles.pillDisabled]}
            onPress={handleCreate}
            disabled={!valid || busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.pillText}>Create password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 12 },
  body: { fontSize: 16, color: Colors.textSecondary, lineHeight: 24, marginBottom: 20 },
  warnCard: { backgroundColor: Colors.yellow, borderRadius: 6, padding: 16, marginBottom: 24 },
  warnText: { fontSize: 14, color: Colors.text, lineHeight: 21, fontWeight: '500' },
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
});
