import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllEntries } from './db';
import { generateInsights } from './claude';

// Patterns unlock sooner in dev so the feature is testable.
export const PATTERN_MIN_ENTRIES = __DEV__ ? 5 : 14;
const CACHE_KEY = 'sowfar:insights';

export async function getCachedPatterns(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

// Regenerate patterns from all entries and cache them. Returns null (and leaves
// the cache untouched) if there aren't enough entries yet or the call fails.
export async function refreshPatterns(): Promise<string[] | null> {
  try {
    const entries = await getAllEntries();
    if (entries.length < PATTERN_MIN_ENTRIES) return null;

    const text = await generateInsights(
      entries.map(e => ({ date: e.date, prompts: e.prompts, freeWrite: e.free_write }))
    );
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as { patterns: string[] };
    if (!Array.isArray(parsed.patterns)) return null;

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed.patterns));
    return parsed.patterns;
  } catch {
    return null;
  }
}
