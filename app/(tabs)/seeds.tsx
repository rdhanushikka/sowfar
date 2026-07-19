import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Seed } from '../../types';
import {
  getSeeds,
  plantSeed,
  bloomSeed,
  releaseSeed,
  seedStage,
  MAX_ACTIVE_SEEDS,
} from '../../services/seeds';
import { localDateStr } from '../../services/db';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function stageIcon(seed: Seed): IconName {
  const stage = seedStage(seed);
  if (stage === 'leafing') return 'leaf';
  if (stage === 'sprout') return 'leaf-outline';
  return 'ellipse-outline';
}

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr + 'T00:00:00').getTime();
  const now = new Date(localDateStr() + 'T00:00:00').getTime();
  const days = Math.max(0, Math.round((now - then) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export default function SeedsScreen() {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Planting flow
  const [planting, setPlanting] = useState(false);
  const [text, setText] = useState('');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    try {
      const all = await getSeeds();
      setSeeds(all);
    } catch {
      // vault locked or offline — leave as-is
    }
    setLoading(false);
  }

  const active = seeds.filter(s => s.status === 'active');
  const bloomed = seeds.filter(s => s.status === 'bloomed');

  async function handlePlant() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await plantSeed(text, why);
      setText('');
      setWhy('');
      setPlanting(false);
      await load();
    } catch {
      Alert.alert('Could not plant', 'Please try again.');
    }
    setBusy(false);
  }

  function confirmBloom(seed: Seed) {
    Alert.alert(
      'It bloomed?',
      `"${seed.text}" — mark this as realized and move it to your shelf?`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'It bloomed',
          onPress: async () => {
            await bloomSeed(seed);
            setExpanded(null);
            await load();
          },
        },
      ]
    );
  }

  function confirmRelease(seed: Seed) {
    Alert.alert(
      'Return to soil?',
      'Not every seed is for this season. Releasing it makes room for something new — no shame in that.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            await releaseSeed(seed);
            setExpanded(null);
            await load();
          },
        },
      ]
    );
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>Seeds</Text>
          <Text style={styles.sub}>Plant what you want to grow. Tend it by living.</Text>

          {/* Active garden */}
          {active.length === 0 && !planting && (
            <View style={styles.emptyCard}>
              <Ionicons name="leaf-outline" size={28} color={Colors.primary} />
              <Text style={styles.emptyText}>
                Nothing planted yet. A seed is one intention — something you want to grow toward.
              </Text>
            </View>
          )}

          {active.map(seed => {
            const isOpen = expanded === seed.id;
            return (
              <TouchableOpacity
                key={seed.id}
                style={styles.seedCard}
                onPress={() => setExpanded(isOpen ? null : seed.id)}
                activeOpacity={0.85}
              >
                <View style={styles.seedRow}>
                  <View style={styles.stageBadge}>
                    <Ionicons name={stageIcon(seed)} size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.seedText}>{seed.text}</Text>
                    <Text style={styles.seedMeta}>
                      planted {timeAgo(seed.planted_date)}
                      {seed.moments.length > 0 && ` · ${seed.moments.length} ${seed.moments.length === 1 ? 'moment' : 'moments'}`}
                    </Text>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
                </View>

                {isOpen && (
                  <View style={styles.seedDetail}>
                    {seed.why ? <Text style={styles.seedWhy}>“{seed.why}”</Text> : null}

                    {seed.moments.length === 0 ? (
                      <Text style={styles.noMoments}>No moments yet — they'll gather as life shows evidence.</Text>
                    ) : (
                      seed.moments.map((m, i) => (
                        <View key={i} style={styles.momentRow}>
                          <View style={styles.momentDot} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.momentNote}>{m.note}</Text>
                            <Text style={styles.momentDate}>{timeAgo(m.date)}</Text>
                          </View>
                        </View>
                      ))
                    )}

                    <View style={styles.seedActions}>
                      <TouchableOpacity style={styles.bloomBtn} onPress={() => confirmBloom(seed)} activeOpacity={0.85}>
                        <Ionicons name="flower-outline" size={16} color={Colors.textOnPrimary} />
                        <Text style={styles.bloomBtnText}>It bloomed</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.releaseBtn} onPress={() => confirmRelease(seed)} activeOpacity={0.7}>
                        <Text style={styles.releaseBtnText}>Return to soil</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Plant */}
          {planting ? (
            <View style={styles.plantCard}>
              <Text style={styles.plantQuestion}>What do you want to grow?</Text>
              <TextInput
                style={styles.plantInput}
                placeholder="a calmer morning… the courage to speak up… the move…"
                placeholderTextColor={Colors.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
              />
              <TextInput
                style={styles.plantWhy}
                placeholder="Why this? (optional, for your future self)"
                placeholderTextColor={Colors.textSecondary}
                value={why}
                onChangeText={setWhy}
                multiline
              />
              <View style={styles.plantActions}>
                <TouchableOpacity onPress={() => setPlanting(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.plantBtn, !text.trim() && { opacity: 0.4 }]}
                  onPress={handlePlant}
                  disabled={!text.trim() || busy}
                  activeOpacity={0.85}
                >
                  {busy ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.plantBtnText}>Plant</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : active.length < MAX_ACTIVE_SEEDS ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setPlanting(true)} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color={Colors.text} />
              <Text style={styles.addBtnText}>Plant a seed</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.fullNote}>
              Your garden is full — three seeds keeps each one meaningful. Release one to plant another.
            </Text>
          )}

          {/* Bloomed shelf */}
          {bloomed.length > 0 && (
            <>
              <Text style={styles.shelfLabel}>BLOOMED</Text>
              {bloomed.map(seed => (
                <View key={seed.id} style={styles.bloomedCard}>
                  <Ionicons name="flower" size={18} color={Colors.magenta} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bloomedText}>{seed.text}</Text>
                    <Text style={styles.seedMeta}>bloomed {timeAgo(seed.ended_date ?? seed.planted_date)}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 60 },

  header: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 15, color: Colors.textSecondary, marginBottom: 24 },

  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  emptyText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, textAlign: 'center' },

  seedCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 12,
  },
  seedRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stageBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.green + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seedText: { fontSize: 16, fontWeight: '600', color: Colors.text, lineHeight: 22 },
  seedMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },

  seedDetail: { marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16 },
  seedWhy: { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 20, marginBottom: 14 },
  noMoments: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 14 },
  momentRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  momentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7 },
  momentNote: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  momentDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  seedActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  bloomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  bloomBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textOnPrimary },
  releaseBtn: { paddingVertical: 10 },
  releaseBtnText: { fontSize: 13, color: Colors.textSecondary, textDecorationLine: 'underline' },

  plantCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 16,
  },
  plantQuestion: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  plantInput: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 23,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  plantWhy: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    minHeight: 40,
    textAlignVertical: 'top',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    marginBottom: 12,
  },
  plantActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 14, color: Colors.textSecondary },
  plantBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  plantBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textOnPrimary },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  fullNote: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 16, paddingHorizontal: 4 },

  shelfLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 12,
  },
  bloomedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.pink + '44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  bloomedText: { fontSize: 15, fontWeight: '600', color: Colors.text },
});
