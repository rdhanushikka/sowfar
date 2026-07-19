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
  Share,
} from 'react-native';
import { Colors } from '../constants/colors';
import { setupVault } from '../services/vault';
import { useVaultUi } from '../services/vaultUi';

export default function VaultSetupScreen() {
  const { onUnlocked } = useVaultUi();
  const [step, setStep] = useState<'create' | 'recovery'>('create');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
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
      const code = await setupVault(password);
      setRecoveryCode(code);
      setStep('recovery');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    try {
      await Share.share({ message: `My Sowfar recovery code: ${recoveryCode}` });
      setSaved(true);
    } catch {
      // user cancelled share
    }
  }

  async function handleCopy() {
    try {
      // Lazy require: on builds made before expo-clipboard was added, the
      // native module is missing — fall back gracefully instead of crashing.
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Older build without the clipboard module — Share still works.
    }
  }

  if (step === 'recovery') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Save your recovery code</Text>
          <Text style={styles.body}>
            If you ever forget your password, this code is the only way back into your journal —
            we can’t recover it for you.
          </Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeText}>{recoveryCode}</Text>
          </View>

          <View style={styles.codeActions}>
            <TouchableOpacity style={[styles.secondaryPill, { flex: 1 }]} onPress={handleCopy} activeOpacity={0.85}>
              <Text style={styles.secondaryPillText}>{copied ? 'Copied ✓' : 'Copy code'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryPill, { flex: 1 }]} onPress={handleShare} activeOpacity={0.85}>
              <Text style={styles.secondaryPillText}>Save code…</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.tip}>
            Tip: save it as a note in Apple Passwords or your password manager, so it’s encrypted and never lost.
          </Text>

          <TouchableOpacity style={styles.checkRow} onPress={() => setSaved(s => !s)} activeOpacity={0.7}>
            <View style={[styles.checkbox, saved && styles.checkboxOn]}>
              {saved && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>I’ve saved my recovery code somewhere safe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, !saved && styles.pillDisabled]}
            onPress={onUnlocked}
            disabled={!saved}
            activeOpacity={0.85}
          >
            <Text style={styles.pillText}>Enter my journal</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.mark}>✦</Text>
          <Text style={styles.title}>One password, just for your journal</Text>
          <Text style={styles.body}>
            Everything you write is locked with it before it ever leaves your phone —
            not even we can read your entries.
          </Text>

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

          <Text style={styles.caution}>
            Only you hold this password, so keep it somewhere safe — a password manager is perfect.
          </Text>

          <TouchableOpacity
            style={[styles.pill, !valid && styles.pillDisabled]}
            onPress={handleCreate}
            disabled={!valid || busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.pillText}>Continue</Text>
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
  mark: { fontSize: 34, color: Colors.primary, marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text, letterSpacing: -0.4, marginBottom: 12 },
  body: { fontSize: 16, color: Colors.textSecondary, lineHeight: 24, marginBottom: 24 },
  caution: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 16, marginTop: 4 },
  tip: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 24, marginTop: -12, paddingHorizontal: 4 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 16,
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

  codeCard: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
    alignItems: 'center',
  },
  codeText: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: 2, textAlign: 'center' },
  codeActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  secondaryPill: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryPillText: { fontSize: 16, fontWeight: '700', color: Colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { color: Colors.textOnPrimary, fontSize: 15, fontWeight: '800' },
  checkLabel: { flex: 1, fontSize: 15, color: Colors.text, lineHeight: 21 },
});
