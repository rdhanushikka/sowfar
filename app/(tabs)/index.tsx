import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { JournalPhase, PromptAnswer } from '../../types';
import { getPrompt1, getPrompt2 } from '../../constants/prompts';
import { analyzeEntry, generateWeeklySummary } from '../../services/claude';
import { getDailyQuote } from '../../services/quote';
import { Quote } from '../../constants/quotes';
import {
  getTodayEntry,
  getCachedTodayEntry,
  upsertEntry,
  getEntriesForWeek,
  getWeeklySummary,
  upsertWeeklySummary,
  getAllEntries,
  computeStreak,
  localDateStr,
  mondayOfWeek,
} from '../../services/db';

function isSunday(): boolean {
  return new Date().getDay() === 0;
}

function getDayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function TonightScreen() {
  const [phase, setPhase] = useState<JournalPhase>('init');
  const [weeklySummary, setWeeklySummary] = useState<string | null>(null);

  const prompt1Ref = useRef(getPrompt1());
  const prompt2Ref = useRef(getPrompt2(prompt1Ref.current.question));

  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [followupQuestion, setFollowupQuestion] = useState<string | null>(null);
  const [followupAnswer, setFollowupAnswer] = useState('');
  const [freeWrite, setFreeWrite] = useState('');
  const [reframe, setReframe] = useState<string | null>(null);
  const [reframeRevealed, setReframeRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    // Instant paint from the local mirror if today's entry already exists.
    const cached = await getCachedTodayEntry();
    if (cached) {
      setReframe(cached.reframe ?? null);
      setPhase('complete');
    }

    // Revalidate against Supabase (source of truth).
    const today = await getTodayEntry();
    if (today) {
      setPhase('complete');
      setReframe(today.reframe ?? null);
      const all = await getAllEntries();
      setStreak(computeStreak(all.map(e => e.date)));
      getDailyQuote().then(setQuote).catch(() => {});
      return;
    }

    if (isSunday()) {
      const weekStart = mondayOfWeek(localDateStr());
      let summary = (await getWeeklySummary(weekStart))?.summary ?? null;

      if (!summary) {
        const entries = await getEntriesForWeek(weekStart);
        if (entries.length >= 3) {
          try {
            summary = await generateWeeklySummary(
              entries.map(e => ({ date: e.date, prompts: e.prompts, freeWrite: e.free_write }))
            );
            await upsertWeeklySummary(weekStart, summary);
          } catch {
            summary = null;
          }
        }
      }

      setWeeklySummary(summary);
      setPhase(summary ? 'weekly-summary' : 'prompt1');
    } else {
      setPhase('prompt1');
    }
  }

  function fadeTransition(toPhase: JournalPhase) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setPhase(toPhase);
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }

  async function submitPrompts() {
    fadeTransition('analyzing');

    const prompts: PromptAnswer[] = [
      { question: prompt1Ref.current.question, answer: answer1, type: prompt1Ref.current.type },
    ];
    if (!isSunday()) {
      prompts.push({ question: prompt2Ref.current.question, answer: answer2, type: prompt2Ref.current.type });
    }

    try {
      const analysis = await analyzeEntry(prompts, '');
      setFollowupQuestion(analysis.followup);
      setReframe(analysis.reframe);

      await upsertEntry({ prompts, followup: null, free_write: '', reframe: analysis.reframe });

      if (analysis.followup) {
        fadeTransition('followup');
      } else {
        fadeTransition('freewrite');
      }
    } catch {
      fadeTransition('freewrite');
    }
  }

  async function submitFollowup() {
    const entry = await getTodayEntry();
    await upsertEntry({
      ...entry,
      followup: followupQuestion ? { question: followupQuestion, answer: followupAnswer } : null,
    });
    fadeTransition('freewrite');
  }

  async function submitFreeWrite() {
    fadeTransition('saving');
    const entry = await getTodayEntry();
    await upsertEntry({ ...entry, free_write: freeWrite });

    // Refresh the streak now that today's entry is complete.
    const all = await getAllEntries();
    setStreak(computeStreak(all.map(e => e.date)));
    getDailyQuote().then(setQuote).catch(() => {});

    if (reframe) {
      fadeTransition('reframe');
    } else {
      fadeTransition('complete');
    }
  }

  function canContinuePrompt2(): boolean {
    const p2 = prompt2Ref.current;
    if (p2.type === 'yesno' || p2.type === 'mcq') return !!answer2;
    return answer2.trim().length > 0;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          {phase === 'init' && <LoadingView />}
          {phase === 'weekly-summary' && weeklySummary && (
            <WeeklySummaryView
              summary={weeklySummary}
              onContinue={() => fadeTransition('prompt1')}
            />
          )}
          {phase === 'prompt1' && (
            <PromptView
              dayLabel={getDayLabel()}
              question={prompt1Ref.current.question}
              value={answer1}
              onChange={setAnswer1}
              onContinue={() => {
                if (!isSunday()) {
                  fadeTransition('prompt2');
                } else {
                  submitPrompts();
                }
              }}
              canContinue={answer1.trim().length > 0}
              step={1}
              totalSteps={isSunday() ? 2 : 3}
            />
          )}
          {phase === 'prompt2' && (
            <Prompt2View
              dayLabel={getDayLabel()}
              prompt={prompt2Ref.current}
              value={answer2}
              onChange={setAnswer2}
              onContinue={submitPrompts}
              canContinue={canContinuePrompt2()}
              step={2}
              totalSteps={3}
            />
          )}
          {phase === 'analyzing' && <AnalyzingView />}
          {phase === 'followup' && followupQuestion && (
            <FollowupView
              question={followupQuestion}
              value={followupAnswer}
              onChange={setFollowupAnswer}
              onContinue={submitFollowup}
            />
          )}
          {phase === 'freewrite' && (
            <FreeWriteView
              value={freeWrite}
              onChange={setFreeWrite}
              onDone={submitFreeWrite}
            />
          )}
          {phase === 'saving' && <LoadingView label="Saving..." />}
          {phase === 'reframe' && reframe && (
            <ReframeView
              reframe={reframe}
              revealed={reframeRevealed}
              onReveal={() => setReframeRevealed(true)}
              onDone={() => fadeTransition('complete')}
            />
          )}
          {phase === 'complete' && <CompleteView reframe={reframe} streak={streak} quote={quote} />}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {label && <Text style={styles.loadingLabel}>{label}</Text>}
    </View>
  );
}

function WeeklySummaryView({ summary, onContinue }: { summary: string; onContinue: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.smallLabel}>Your week</Text>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>{summary}</Text>
      </View>
      <PillButton label="Continue to tonight" onPress={onContinue} />
    </ScrollView>
  );
}

function PromptView({
  dayLabel,
  question,
  value,
  onChange,
  onContinue,
  canContinue,
  step,
  totalSteps,
}: {
  dayLabel: string;
  question: string;
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  canContinue: boolean;
  step: number;
  totalSteps: number;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.dateLabel}>{dayLabel}</Text>
      <Text style={styles.stepDots}>{Array.from({ length: totalSteps }, (_, i) => i < step ? '●' : '○').join(' ')}</Text>
      <Text style={styles.promptText}>{question}</Text>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder="Write here..."
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChange}
        autoFocus
      />
      <PillButton label="Continue" onPress={onContinue} disabled={!canContinue} />
    </ScrollView>
  );
}

function Prompt2View({
  dayLabel,
  prompt,
  value,
  onChange,
  onContinue,
  canContinue,
  step,
  totalSteps,
}: {
  dayLabel: string;
  prompt: ReturnType<typeof getPrompt2>;
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  canContinue: boolean;
  step: number;
  totalSteps: number;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.dateLabel}>{dayLabel}</Text>
      <Text style={styles.stepDots}>{Array.from({ length: totalSteps }, (_, i) => i < step ? '●' : '○').join(' ')}</Text>
      <Text style={styles.promptText}>{prompt.question}</Text>

      {prompt.type === 'open' && (
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Write here..."
          placeholderTextColor={Colors.textSecondary}
          value={value}
          onChangeText={onChange}
          autoFocus
        />
      )}

      {prompt.type === 'yesno' && (
        <View style={styles.yesNoRow}>
          <TouchableOpacity
            style={[styles.yesNoBtn, value === 'Yes' && styles.yesNoBtnSelected]}
            onPress={() => onChange('Yes')}
          >
            <Text style={[styles.yesNoText, value === 'Yes' && styles.yesNoTextSelected]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.yesNoBtn, value === 'No' && styles.yesNoBtnSelected]}
            onPress={() => onChange('No')}
          >
            <Text style={[styles.yesNoText, value === 'No' && styles.yesNoTextSelected]}>No</Text>
          </TouchableOpacity>
        </View>
      )}

      {prompt.type === 'mcq' && (
        <View style={styles.mcqList}>
          {(prompt.options ?? []).map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.mcqOption, value === opt && styles.mcqOptionSelected]}
              onPress={() => onChange(opt)}
            >
              <Text style={[styles.mcqOptionText, value === opt && styles.mcqOptionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <PillButton label="Continue" onPress={onContinue} disabled={!canContinue} />
    </ScrollView>
  );
}

function AnalyzingView() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="small" color={Colors.primary} />
      <Text style={styles.analyzingText}>Just a moment...</Text>
    </View>
  );
}

function FollowupView({
  question,
  value,
  onChange,
  onContinue,
}: {
  question: string;
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.followupCard}>
        <Text style={styles.followupLabel}>One more thing</Text>
        <Text style={styles.promptText}>{question}</Text>
      </View>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder="Write here..."
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChange}
        autoFocus
      />
      <PillButton label="Continue" onPress={onContinue} disabled={value.trim().length === 0} />
      <TouchableOpacity onPress={onContinue} style={styles.skipBtn}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function FreeWriteView({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.promptText}>Anything else on your mind tonight?</Text>
      <Text style={styles.freeWriteHint}>Optional — just write, no pressure.</Text>
      <TextInput
        style={[styles.textArea, styles.freeWriteArea]}
        multiline
        placeholder="..."
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChange}
        autoFocus
      />
      <PillButton label="I'm done" onPress={onDone} />
    </ScrollView>
  );
}

function ReframeView({
  reframe,
  revealed,
  onReveal,
  onDone,
}: {
  reframe: string;
  revealed: boolean;
  onReveal: () => void;
  onDone: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.completeEmoji}>✦</Text>
      <Text style={styles.completeTitle}>Entry saved.</Text>

      {!revealed ? (
        <TouchableOpacity style={styles.reframeTease} onPress={onReveal}>
          <Text style={styles.reframeTeaseText}>A different way to see this →</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.reframeCard}>
          <Text style={styles.reframeText}>{reframe}</Text>
        </View>
      )}

      <PillButton label="Done" onPress={onDone} style={{ marginTop: 32 }} />
    </ScrollView>
  );
}

function CompleteView({
  reframe,
  streak,
  quote,
}: {
  reframe: string | null;
  streak: number;
  quote: Quote | null;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.completeEmoji}>✦</Text>
      <Text style={styles.completeTitle}>See you tomorrow.</Text>
      <Text style={styles.completeSubtitle}>Tonight's entry is saved.</Text>

      {quote && (
        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>“{quote.text}”</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
        </View>
      )}

      {streak > 0 && (
        <View style={styles.streakPill}>
          <Ionicons name="flame" size={18} color={Colors.magenta} />
          <Text style={styles.streakPillText}>
            {streak} {streak === 1 ? 'day' : 'days'} in a row
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.editTonightBtn}
        onPress={() => router.push({ pathname: '/edit', params: { date: localDateStr() } })}
        activeOpacity={0.8}
      >
        <Text style={styles.editTonightText}>Edit tonight's entry</Text>
      </TouchableOpacity>
    </View>
  );
}

function PillButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[styles.pillBtn, disabled && styles.pillBtnDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.pillBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  scrollContent: { padding: 24, paddingBottom: 60 },

  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  stepDots: {
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 4,
    marginBottom: 28,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  promptText: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 36,
    marginBottom: 24,
    letterSpacing: -0.3,
  },

  textArea: {
    backgroundColor: Colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
    lineHeight: 26,
  },
  freeWriteArea: { minHeight: 160 },
  freeWriteHint: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, marginTop: -16 },

  yesNoRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  yesNoBtn: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  yesNoBtnSelected: { backgroundColor: Colors.text, borderColor: Colors.text },
  yesNoText: { fontSize: 18, fontWeight: '700', color: Colors.text },
  yesNoTextSelected: { color: Colors.background },

  mcqList: { gap: 10, marginBottom: 24 },
  mcqOption: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Colors.card,
  },
  mcqOptionSelected: { backgroundColor: Colors.text, borderColor: Colors.text },
  mcqOptionText: { fontSize: 17, fontWeight: '600', color: Colors.text },
  mcqOptionTextSelected: { color: Colors.background },

  pillBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pillBtnDisabled: { opacity: 0.4 },
  pillBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnPrimary, letterSpacing: 0.3 },

  summaryCard: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    padding: 22,
    marginBottom: 28,
  },
  summaryText: { fontSize: 17, color: Colors.textOnPrimary, lineHeight: 28 },

  followupCard: {
    backgroundColor: Colors.pink,
    borderRadius: 6,
    padding: 20,
    marginBottom: 20,
  },
  followupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.text,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  skipBtn: { alignItems: 'center', marginTop: 14 },
  skipText: { fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },

  analyzingText: { fontSize: 15, color: Colors.textSecondary, marginTop: 14 },
  loadingLabel: { fontSize: 15, color: Colors.textSecondary, marginTop: 14 },

  completeEmoji: { fontSize: 40, color: Colors.primary, marginBottom: 16 },
  completeTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 8, letterSpacing: -0.5 },
  completeSubtitle: { fontSize: 16, color: Colors.textSecondary },
  quoteCard: {
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 22,
    marginTop: 28,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  quoteText: { fontSize: 18, color: Colors.text, lineHeight: 28, fontWeight: '500' },
  quoteAuthor: { fontSize: 13, color: Colors.textSecondary, marginTop: 12, fontWeight: '600' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  streakPillText: { fontSize: 16, fontWeight: '800', color: Colors.text },
  editTonightBtn: {
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 28,
  },
  editTonightText: { fontSize: 15, fontWeight: '700', color: Colors.text },

  reframeTease: {
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 6,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 24,
    borderStyle: 'dashed',
  },
  reframeTeaseText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  reframeCard: {
    backgroundColor: Colors.green,
    borderRadius: 6,
    padding: 22,
    marginTop: 24,
  },
  reframeText: { fontSize: 18, color: Colors.text, fontWeight: '600', lineHeight: 28 },
});
