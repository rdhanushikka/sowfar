import React, { useState, useCallback, useRef, useMemo } from 'react';
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
import { getAllEntries, getCachedAllEntries, isEditable, localDateStr } from '../../services/db';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface StripDay {
  date: string;      // YYYY-MM-DD
  dayNum: number;
  weekday: string;   // M, T, W...
  isToday: boolean;
  monthLabel: string | null; // set on the 1st of a month for a tiny label
}

// Days for the horizontal strip: from the earliest entry (or 30 days back,
// whichever is older) through today, oldest → newest so today sits at the right.
function buildStripDays(entryDates: Set<string>): StripDay[] {
  const today = localDateStr();
  let start = new Date(today + 'T00:00:00');
  start.setDate(start.getDate() - 30);

  const earliest = [...entryDates].sort()[0];
  if (earliest && earliest < dateOf(start)) start = new Date(earliest + 'T00:00:00');

  const days: StripDay[] = [];
  const cursor = new Date(start);
  const end = new Date(today + 'T00:00:00');
  while (cursor <= end) {
    const ds = dateOf(cursor);
    days.push({
      date: ds,
      dayNum: cursor.getDate(),
      weekday: cursor.toLocaleDateString('en-US', { weekday: 'narrow' }),
      isToday: ds === today,
      monthLabel:
        cursor.getDate() === 1 || days.length === 0
          ? cursor.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
          : null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function dateOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const stripRef = useRef<ScrollView>(null);

  const entryDates = useMemo(() => new Set(entries.map(e => e.date)), [entries]);
  const stripDays = useMemo(() => buildStripDays(entryDates), [entryDates]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    // Paint instantly from the local mirror if we have one.
    const cached = await getCachedAllEntries();
    if (cached) {
      setEntries(cached);
      setLoading(false);
    }

    // Revalidate against Supabase.
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

        {/* Scrollable day strip — today at the right, scroll left for the past */}
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.strip}
          contentContainerStyle={styles.stripContent}
          onContentSizeChange={() => stripRef.current?.scrollToEnd({ animated: false })}
        >
          {stripDays.map(day => {
            const hasEntry = entryDates.has(day.date);
            const selected = expanded === day.date;
            return (
              <View key={day.date} style={styles.stripCol}>
                <Text style={styles.stripMonth}>{day.monthLabel ?? ' '}</Text>
                <TouchableOpacity
                  style={[
                    styles.stripDay,
                    day.isToday && styles.stripToday,
                    selected && styles.stripSelected,
                  ]}
                  onPress={() => hasEntry && setExpanded(selected ? null : day.date)}
                  activeOpacity={hasEntry ? 0.7 : 1}
                >
                  <Text style={styles.stripWeekday}>{day.weekday}</Text>
                  <Text style={[styles.stripNum, selected && styles.stripNumSelected]}>{day.dayNum}</Text>
                  <View style={[styles.stripDot, hasEntry ? styles.stripDotOn : null]} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

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
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  strip: { marginBottom: 20, marginHorizontal: -20 },
  stripContent: { paddingHorizontal: 20, gap: 6 },
  stripCol: { alignItems: 'center' },
  stripMonth: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5, height: 12 },
  stripDay: {
    width: 44,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 3,
  },
  stripToday: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  stripSelected: { backgroundColor: Colors.primary },
  stripWeekday: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  stripNum: { fontSize: 15, fontWeight: '700', color: Colors.text },
  stripNumSelected: { color: Colors.textOnPrimary },
  stripDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'transparent' },
  stripDotOn: { backgroundColor: Colors.magenta },
  empty: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 60 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
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
    borderRadius: 16,
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
    borderRadius: 16,
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
