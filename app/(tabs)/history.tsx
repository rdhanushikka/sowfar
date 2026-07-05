import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { JournalEntry } from '../../types';
import { getAllEntries, isEditable } from '../../services/db';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    const all = await getAllEntries();
    setEntries(all);
    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Past entries</Text>

        {entries.length === 0 && (
          <Text style={styles.empty}>No entries yet. Start tonight.</Text>
        )}

        {entries.map(entry => (
          <TouchableOpacity
            key={entry.date}
            style={styles.card}
            onPress={() => setExpanded(expanded === entry.date ? null : entry.date)}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatDate(entry.date)}</Text>
              <Text style={styles.cardChevron}>{expanded === entry.date ? '↑' : '↓'}</Text>
            </View>

            {entry.prompts[0] && (
              <Text style={styles.cardPreview} numberOfLines={expanded === entry.date ? undefined : 2}>
                {entry.prompts[0].answer}
              </Text>
            )}

            {expanded === entry.date && (
              <View style={styles.expandedContent}>
                {entry.prompts.map((p, i) => (
                  <View key={i} style={styles.promptBlock}>
                    <Text style={styles.promptQ}>{p.question}</Text>
                    <Text style={styles.promptA}>{p.answer}</Text>
                  </View>
                ))}

                {entry.followup && (
                  <View style={[styles.promptBlock, styles.followupBlock]}>
                    <Text style={styles.followupTag}>Follow-up</Text>
                    <Text style={styles.promptQ}>{entry.followup.question}</Text>
                    <Text style={styles.promptA}>{entry.followup.answer}</Text>
                  </View>
                )}

                {!!entry.free_write && (
                  <View style={styles.promptBlock}>
                    <Text style={styles.promptQ}>Free write</Text>
                    <Text style={styles.promptA}>{entry.free_write}</Text>
                  </View>
                )}

                {entry.reframe && (
                  <View style={styles.reframeBlock}>
                    <Text style={styles.reframeText}>{entry.reframe}</Text>
                  </View>
                )}

                {isEditable(entry.date) && (
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => router.push({ pathname: '/edit', params: { date: entry.date } })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editBtnText}>Edit entry</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 60 },

  header: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  empty: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 60 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    padding: 18,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardDate: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  cardChevron: { fontSize: 14, color: Colors.textSecondary },
  cardPreview: { fontSize: 16, color: Colors.text, lineHeight: 24 },

  expandedContent: { marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16, gap: 16 },
  promptBlock: { gap: 6 },
  promptQ: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase' },
  promptA: { fontSize: 16, color: Colors.text, lineHeight: 24 },

  followupBlock: {
    backgroundColor: Colors.pink,
    borderRadius: 6,
    padding: 14,
  },
  followupTag: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  reframeBlock: {
    backgroundColor: Colors.green,
    borderRadius: 6,
    padding: 14,
  },
  reframeText: { fontSize: 15, color: Colors.text, fontWeight: '600', lineHeight: 22 },

  editBtn: {
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  editBtnText: { fontSize: 15, fontWeight: '700', color: Colors.text },
});
