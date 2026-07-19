import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllEntries, localDateStr } from './db';
import { generateInsights } from './claude';

// Patterns unlock sooner in dev so the feature is testable.
export const PATTERN_MIN_ENTRIES = __DEV__ ? 5 : 14;
const CACHE_KEY = 'sowfar:insights';
const REFRESH_DAYS = 7;

interface StoredPatterns {
  patterns: string[];
  generatedDate: string;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86_400_000);
}

async function readStored(): Promise<StoredPatterns | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Back-compat: older cache stored a bare array.
    if (Array.isArray(parsed)) return { patterns: parsed, generatedDate: '1970-01-01' };
    return parsed as StoredPatterns;
  } catch {
    return null;
  }
}

export async function getCachedPatterns(): Promise<string[] | null> {
  return (await readStored())?.patterns ?? null;
}

async function isStale(): Promise<boolean> {
  const stored = await readStored();
  if (!stored?.generatedDate) return true;
  return daysBetween(stored.generatedDate, localDateStr()) >= REFRESH_DAYS;
}

// Patterns look at a recent window, not all time — "who you are lately."
const WINDOW_DAYS = 30;

function windowStartStr(): string {
  const d = new Date(localDateStr() + 'T00:00:00');
  d.setDate(d.getDate() - WINDOW_DAYS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Regenerate patterns and cache them. The background caller passes force=false,
// so it only spends an API call when the cached patterns are a week old (or
// missing). The manual "refresh" button passes force=true.
export async function refreshPatterns(force = false): Promise<string[] | null> {
  try {
    if (!force && !(await isStale())) {
      return getCachedPatterns();
    }

    const all = await getAllEntries();
    if (all.length < PATTERN_MIN_ENTRIES) return null;

    // Last 30 days only (also keeps the prompt bounded as history grows).
    const start = windowStartStr();
    const entries = all.filter(e => e.date >= start);
    if (entries.length < 3) return null;

    const text = await generateInsights(
      entries.map(e => ({ date: e.date, prompts: e.prompts, freeWrite: e.free_write }))
    );
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as { patterns: string[] };
    if (!Array.isArray(parsed.patterns)) return null;

    const stored: StoredPatterns = { patterns: parsed.patterns, generatedDate: localDateStr() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    return parsed.patterns;
  } catch {
    return null;
  }
}
