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

  if (step === 'recovery') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Save your recovery code</Text>
          <Text style={styles.body}>
            If you ever forget your password, this code is the only way back into your journal.
            Save it somewhere safe — a password manager is best. We can’t recover it for you.
          </Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeText}>{recoveryCode}</Text>
          </View>

          <TouchableOpacity style={styles.secondaryPill} onPress={handleShare} activeOpacity={0.85}>
            <Text style={styles.secondaryPillText}>Save code…</Text>
          </TouchableOpacity>

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
          <Text style={styles.title}>Set a journal password</Text>
          <Text style={styles.body}>
            Your entries are encrypted with this password before they ever leave your phone.
            Not even we can read them.
          </Text>

          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              There is no way to reset it. If you forget this password (and your recovery code),
              your journal cannot be recovered. Consider saving it in a password manager.
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

  codeCard: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    borderRadius: 6,
    padding: 22,
    marginBottom: 20,
    alignItems: 'center',
  },
  codeText: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: 2, textAlign: 'center' },
  secondaryPill: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
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
