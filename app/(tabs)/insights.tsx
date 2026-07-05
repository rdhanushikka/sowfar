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
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Alert } from 'react-native';
import { getAllEntries, getCachedAllEntries, computeStreak } from '../../services/db';
import { generateInsights } from '../../services/claude';
import { signOut } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIN_ENTRIES = 30;
const CACHE_KEY = 'sowfar:insights';

export default function InsightsScreen() {
  const [entryCount, setEntryCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    // Instant paint from the local mirror.
    const cached = await getCachedAllEntries();
    if (cached) {
      setEntryCount(cached.length);
      setStreak(computeStreak(cached.map(e => e.date)));
      setLoading(false);
    }

    const entries = await getAllEntries();
    setEntryCount(entries.length);
    setStreak(computeStreak(entries.map(e => e.date)));

    if (entries.length >= MIN_ENTRIES) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setPatterns(JSON.parse(cached));
      }
    }

    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const entries = await getAllEntries();
      const text = await generateInsights(
        entries.map(e => ({ date: e.date, prompts: e.prompts, freeWrite: e.free_write }))
      );
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { patterns: string[] };
        setPatterns(parsed.patterns);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed.patterns));
      }
    } catch {
      // silent
    }
    setGenerating(false);
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

  const locked = entryCount < MIN_ENTRIES;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>You</Text>

        <View style={styles.streakCard}>
          <Ionicons
            name={streak > 0 ? 'flame' : 'leaf-outline'}
            size={34}
            color={streak > 0 ? Colors.magenta : Colors.textSecondary}
          />
          <View>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
          {streak === 0 && (
            <Text style={styles.streakHint}>Write tonight to start your streak.</Text>
          )}
        </View>

        {locked ? (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Patterns unlock at {MIN_ENTRIES} entries</Text>
            <Text style={styles.lockedSub}>
              You have {entryCount} so far.{' '}
              {MIN_ENTRIES - entryCount} more to go.
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(entryCount / MIN_ENTRIES) * 100}%` }]} />
            </View>
          </View>
        ) : (
          <>
            {patterns.length === 0 ? (
              <View style={styles.generateCard}>
                <Text style={styles.generateTitle}>You have {entryCount} entries.</Text>
                <Text style={styles.generateSub}>Ready to see what patterns show up in your reflections?</Text>
                <TouchableOpacity style={styles.pillBtn} onPress={handleGenerate} disabled={generating} activeOpacity={0.8}>
                  {generating
                    ? <ActivityIndicator color={Colors.textOnPrimary} />
                    : <Text style={styles.pillBtnText}>See my patterns</Text>
                  }
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>What I notice about you</Text>
                {patterns.map((p, i) => (
                  <View key={i} style={[styles.patternCard, i % 2 === 0 ? styles.patternCard1 : styles.patternCard2]}>
                    <Text style={styles.patternText}>{p}</Text>
                  </View>
                ))}
                <TouchableOpacity onPress={handleGenerate} disabled={generating} style={styles.refreshBtn}>
                  <Text style={styles.refreshText}>{generating ? 'Refreshing...' : 'Refresh insights'}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function handleSignOut() {
  Alert.alert(
    'Sign out?',
    'Your journal stays safe and will be here when you sign back in with Apple.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]
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

  lockedCard: {
    backgroundColor: Colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    padding: 24,
  },
  lockedTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  lockedSub: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  generateCard: {
    backgroundColor: Colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    padding: 24,
  },
  generateTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  generateSub: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24 },

  pillBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pillBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnPrimary },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  patternCard: {
    borderRadius: 6,
    padding: 20,
    marginBottom: 12,
  },
  patternCard1: { backgroundColor: Colors.yellow },
  patternCard2: { backgroundColor: Colors.pink },
  patternText: { fontSize: 16, color: Colors.text, lineHeight: 26 },

  refreshBtn: { alignItems: 'center', marginTop: 16 },
  refreshText: { fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },

  signOutBtn: { alignItems: 'center', marginTop: 48, paddingVertical: 12 },
  signOutText: { fontSize: 14, color: Colors.textSecondary },

  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 6,
    padding: 20,
    marginBottom: 24,
  },
  streakNumber: { fontSize: 32, fontWeight: '900', color: Colors.text, lineHeight: 36 },
  streakLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  streakHint: { flex: 1, fontSize: 13, color: Colors.textSecondary, textAlign: 'right' },
});
