import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalEntry } from '../types';

// Read cache for recent entries. Supabase is always the source of truth;
// this is a mirror of the last known DB state, updated on every read and write.
const PREFIX = 'sowfar:entry:';

export async function getCachedEntry(date: string): Promise<JournalEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + date);
    return raw ? (JSON.parse(raw) as JournalEntry) : null;
  } catch {
    return null;
  }
}

export async function cacheEntry(entry: JournalEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + entry.date, JSON.stringify(entry));
  } catch {
    // cache failures are non-fatal
  }
}

// Merge partial fields over whatever is cached for a date, then persist.
// Used on writes so the cache reflects the update without an extra DB read.
export async function mergeCachedEntry(
  date: string,
  fields: Partial<JournalEntry>
): Promise<void> {
  const existing = (await getCachedEntry(date)) ?? ({ date } as JournalEntry);
  await cacheEntry({ ...existing, ...fields, date });
}

export async function clearCachedEntry(date: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + date);
  } catch {
    // non-fatal
  }
}

// Mirror of the full entries list (for the Past tab's first paint).
const LIST_KEY = 'sowfar:entries:all';

export async function getCachedEntries(): Promise<JournalEntry[] | null> {
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY);
    return raw ? (JSON.parse(raw) as JournalEntry[]) : null;
  } catch {
    return null;
  }
}

export async function cacheEntries(list: JournalEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    // non-fatal
  }
}

// Wipe every mirrored entry and the list (used by dev reset/seed).
export async function clearAllEntryCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter(k => k.startsWith(PREFIX) || k === LIST_KEY);
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    // non-fatal
  }
}
