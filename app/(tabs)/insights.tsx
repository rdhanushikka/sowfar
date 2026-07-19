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
import {
  getAllEntries,
  getCachedAllEntries,
  computeStreak,
  devSeedEntries,
  devClearEntries,
} from '../../services/db';
import { signOut } from '../../services/supabase';
import { lockVault } from '../../services/vault';
import { advanceDay, getDayOffset } from '../../services/clock';
import { PATTERN_MIN_ENTRIES, getCachedPatterns, refreshPatterns } from '../../services/insights';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIN_ENTRIES = PATTERN_MIN_ENTRIES;
const CACHE_KEY = 'sowfar:insights';

export default function InsightsScreen() {
  const [entryCount, setEntryCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

    // Show any patterns already generated in the background.
    const cachedPatterns = await getCachedPatterns();
    if (cachedPatterns) setPatterns(cachedPatterns);

    const entries = await getAllEntries();
    setEntryCount(entries.length);
    setStreak(computeStreak(entries.map(e => e.date)));

    setLoading(false);

    // Eligible but nothing cached yet: generate silently in the background.
    // The section simply appears once it's ready — never a user-facing load.
    if (!cachedPatterns && entries.length >= MIN_ENTRIES) {
      refreshPatterns()
        .then(p => { if (p) setPatterns(p); })
        .catch(() => {});
    }
  }

  // Dev: run an action, clear derived caches, and reload.
  async function runDev(action: () => Promise<void>) {
    await action();
    await AsyncStorage.multiRemove([CACHE_KEY, 'sowfar:quote']);
    setPatterns([]);
    await load();
  }

  // Silent refresh: swap content in place when the new patterns arrive.
  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    const result = await refreshPatterns(true);
    if (result) setPatterns(result);
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
              // Patterns generate silently in the background; nothing to tap,
              // nothing to wait on — the section appears when it's ready.
              <View style={styles.quietCard}>
                <Text style={styles.quietCardText}>
                  Your patterns are taking shape. They'll appear here soon.
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.patternsToggle, collapsed && styles.patternsToggleCollapsed]}
                  onPress={() => setCollapsed(c => !c)}
                  activeOpacity={0.7}
                >
                  <View style={styles.patternsToggleTextWrap}>
                    <Text style={styles.patternsToggleTitle}>What I notice about you</Text>
                    <Text style={styles.patternsToggleHint}>
                      {collapsed ? `Tap to see ${patterns.length} patterns` : 'Tap to hide'}
                    </Text>
                  </View>
                  <View style={styles.patternsChevron}>
                    <Ionicons
                      name={collapsed ? 'chevron-down' : 'chevron-up'}
                      size={20}
                      color={Colors.primary}
                    />
                  </View>
                </TouchableOpacity>

                {!collapsed && (
                  <>
                    {patterns.map((p, i) => (
                      <View key={i} style={[styles.patternCard, i % 2 === 0 ? styles.patternCard1 : styles.patternCard2]}>
                        <Text style={styles.patternText}>{p}</Text>
                      </View>
                    ))}
                    <TouchableOpacity onPress={handleGenerate} disabled={generating} style={styles.refreshBtn}>
                      <Text style={styles.refreshText}>Refresh insights</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </>
        )}

        {__DEV__ && (
          <View style={styles.devPanel}>
            <Text style={styles.devTitle}>DEV TOOLS</Text>
            <Text style={styles.devInfo}>Day offset: {getDayOffset()}</Text>
            <View style={styles.devRow}>
              <TouchableOpacity style={styles.devBtn} onPress={() => runDev(() => advanceDay(1))}>
                <Text style={styles.devBtnText}>Advance day +1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.devBtn} onPress={() => runDev(() => advanceDay(-1))}>
                <Text style={styles.devBtnText}>Day -1</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.devRow}>
              <TouchableOpacity style={styles.devBtn} onPress={() => runDev(devSeedEntries)}>
                <Text style={styles.devBtnText}>Seed sample entries</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.devBtn, styles.devBtnDanger]} onPress={() => runDev(devClearEntries)}>
                <Text style={styles.devBtnText}>Clear all</Text>
              </TouchableOpacity>
            </View>
          </View>
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
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await lockVault();
          await signOut();
        },
      },
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    padding: 24,
  },
  lockedTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  lockedSub: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  quietCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  quietCardText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },

  patternsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  patternsToggleCollapsed: { borderStyle: 'dashed' },
  patternsToggleTextWrap: { flex: 1 },
  patternsToggleTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  patternsToggleHint: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  patternsChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  patternCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  patternCard1: { backgroundColor: Colors.yellow },
  patternCard2: { backgroundColor: Colors.pink },
  patternText: { fontSize: 16, color: Colors.text, lineHeight: 26 },

  refreshBtn: { alignItems: 'center', marginTop: 16 },
  refreshText: { fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },

  signOutBtn: { alignItems: 'center', marginTop: 24, paddingVertical: 12 },
  signOutText: { fontSize: 14, color: Colors.textSecondary },

  devPanel: {
    marginTop: 48,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: '#faf8f5',
    gap: 10,
  },
  devTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: Colors.textSecondary },
  devInfo: { fontSize: 13, color: Colors.textSecondary },
  devRow: { flexDirection: 'row', gap: 10 },
  devBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  devBtnDanger: { borderColor: Colors.magenta },
  devBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text },

  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  streakNumber: { fontSize: 32, fontWeight: '900', color: Colors.text, lineHeight: 36 },
  streakLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  streakHint: { flex: 1, fontSize: 13, color: Colors.textSecondary, textAlign: 'right' },
});
