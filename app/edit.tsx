import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../constants/colors';
import { JournalEntry, PromptAnswer } from '../types';
import { getEntryByDate, updateEntryByDate, isEditable } from '../services/db';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function EditScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [answers, setAnswers] = useState<string[]>([]);
  const [followupAnswer, setFollowupAnswer] = useState('');
  const [freeWrite, setFreeWrite] = useState('');

  useEffect(() => {
    load();
  }, [date]);

  async function load() {
    if (!date) return;
    const e = await getEntryByDate(date);
    if (e) {
      setEntry(e);
      setAnswers(e.prompts.map(p => p.answer));
      setFollowupAnswer(e.followup?.answer ?? '');
      setFreeWrite(e.free_write);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!entry || !date) return;
    setSaving(true);

    const updatedPrompts: PromptAnswer[] = entry.prompts.map((p, i) => ({
      ...p,
      answer: answers[i] ?? p.answer,
    }));

    const updatedFollowup = entry.followup
      ? { question: entry.followup.question, answer: followupAnswer }
      : null;

    await updateEntryByDate(date, {
      prompts: updatedPrompts,
      followup: updatedFollowup,
      free_write: freeWrite,
    });

    setSaving(false);
    router.back();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!entry || !date || !isEditable(date)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.notEditable}>This entry can no longer be edited.</Text>
          <TouchableOpacity style={styles.pillBtn} onPress={() => router.back()}>
            <Text style={styles.pillBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function setAnswer(index: number, value: string) {
    setAnswers(prev => prev.map((a, i) => (i === index ? value : a)));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.topDate}>{formatDate(date)}</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {entry.prompts.map((p, i) => (
            <View key={i} style={styles.block}>
              <Text style={styles.question}>{p.question}</Text>
              {p.type === 'open' ? (
                <TextInput
                  style={styles.textArea}
                  multiline
                  value={answers[i]}
                  onChangeText={v => setAnswer(i, v)}
                  placeholder="Write here..."
                  placeholderTextColor={Colors.textSecondary}
                />
              ) : (
                <View style={styles.readonlyChip}>
                  <Text style={styles.readonlyChipText}>{answers[i]}</Text>
                  <Text style={styles.readonlyNote}>This answer can't be changed.</Text>
                </View>
              )}
            </View>
          ))}

          {entry.followup && (
            <View style={styles.block}>
              <Text style={styles.followupTag}>Follow-up</Text>
              <Text style={styles.question}>{entry.followup.question}</Text>
              <TextInput
                style={styles.textArea}
                multiline
                value={followupAnswer}
                onChangeText={setFollowupAnswer}
                placeholder="Write here..."
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          )}

          <View style={styles.block}>
            <Text style={styles.question}>Free write</Text>
            <TextInput
              style={[styles.textArea, { minHeight: 140 }]}
              multiline
              value={freeWrite}
              onChangeText={setFreeWrite}
              placeholder="..."
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <TouchableOpacity style={styles.pillBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.pillBtnText}>Save changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 20 },
  notEditable: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancel: { fontSize: 16, color: Colors.textSecondary, width: 50 },
  topDate: { fontSize: 14, fontWeight: '700', color: Colors.text },

  content: { padding: 20, paddingBottom: 60 },
  block: { marginBottom: 24 },
  question: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 26,
    marginBottom: 12,
  },
  followupTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: Colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 26,
  },
  readonlyChip: {
    backgroundColor: Colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  readonlyChipText: { fontSize: 17, color: Colors.text, marginBottom: 6 },
  readonlyNote: { fontSize: 12, color: Colors.textSecondary },

  pillBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pillBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnPrimary },
});
