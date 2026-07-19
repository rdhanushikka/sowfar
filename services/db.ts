import { supabase, getUserId } from './supabase';
import { JournalEntry, WeeklySummary } from '../types';
import {
  getCachedEntry,
  cacheEntry,
  mergeCachedEntry,
  clearCachedEntry,
  getCachedEntries,
  cacheEntries,
  clearAllEntryCaches,
} from './cache';
import { now, dateStr } from './clock';
import { DEV_SAMPLES } from '../constants/devSamples';
import { getJournalKey } from './vault';
import { encryptString, decryptString } from './crypto';
import { PromptAnswer } from '../types';

async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) throw new Error('NOT_SIGNED_IN');
  return id;
}

// ── Encryption ───────────────────────────────────────────────────────────────
// Entry content is stored as a single encrypted blob in the `content` column;
// only date/user_id/metadata stay in the clear (needed for queries and streaks).

interface EntryContent {
  prompts: PromptAnswer[];
  followup: JournalEntry['followup'];
  free_write: string;
  reframe: string | null;
}

function encryptContent(c: EntryContent): string {
  return encryptString(JSON.stringify(c), getJournalKey());
}

function decryptRow(row: any): JournalEntry {
  let content: EntryContent = { prompts: [], followup: null, free_write: '', reframe: null };
  if (row?.content) {
    const dec = decryptString(row.content, getJournalKey());
    if (dec) {
      try { content = JSON.parse(dec); } catch { /* leave defaults */ }
    }
  }
  return {
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    created_at: row.created_at,
    prompts: content.prompts ?? [],
    followup: content.followup ?? null,
    free_write: content.free_write ?? '',
    reframe: content.reframe ?? null,
  };
}

export function localDateStr(): string {
  return dateStr(now());
}

export function yesterdayStr(): string {
  const d = now();
  d.setDate(d.getDate() - 1);
  return dateStr(d);
}

// An entry is editable if it's from today or yesterday (local time).
export function isEditable(dateStr: string): boolean {
  return dateStr === localDateStr() || dateStr === yesterdayStr();
}

export function mondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Instant read from the local mirror. Source of truth stays Supabase.
export async function getCachedTodayEntry(): Promise<JournalEntry | null> {
  return getCachedEntry(localDateStr());
}

export async function getTodayEntry(): Promise<JournalEntry | null> {
  const userId = await requireUserId();
  const today = localDateStr();

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error || !data) {
    // No row in DB (authoritative) — drop any stale mirror.
    await clearCachedEntry(today);
    return null;
  }
  const entry = decryptRow(data);
  await cacheEntry(entry);
  return entry;
}

export async function upsertEntry(entry: Partial<JournalEntry>): Promise<void> {
  const userId = await requireUserId();
  const today = localDateStr();

  const content = encryptContent({
    prompts: entry.prompts ?? [],
    followup: entry.followup ?? null,
    free_write: entry.free_write ?? '',
    reframe: entry.reframe ?? null,
  });

  await supabase.from('entries').upsert(
    { user_id: userId, date: today, content },
    { onConflict: 'user_id,date' }
  );
  // Mirror the write locally so the next open is instant.
  await mergeCachedEntry(today, { ...entry, user_id: userId, date: today });
}

export async function getCachedEntryByDate(date: string): Promise<JournalEntry | null> {
  return getCachedEntry(date);
}

export async function getEntryByDate(date: string): Promise<JournalEntry | null> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error || !data) {
    await clearCachedEntry(date);
    return null;
  }
  const entry = decryptRow(data);
  await cacheEntry(entry);
  return entry;
}

// Update the editable content of an entry for a given date.
export async function updateEntryByDate(
  date: string,
  fields: {
    prompts: JournalEntry['prompts'];
    followup: JournalEntry['followup'];
    free_write: string;
    reframe: string | null;
  }
): Promise<void> {
  const userId = await requireUserId();

  const content = encryptContent({
    prompts: fields.prompts,
    followup: fields.followup,
    free_write: fields.free_write,
    reframe: fields.reframe ?? null,
  });

  await supabase
    .from('entries')
    .update({ content })
    .eq('user_id', userId)
    .eq('date', date);
  // Mirror the edit locally.
  await mergeCachedEntry(date, fields);
}

export async function getCachedAllEntries(): Promise<JournalEntry[] | null> {
  return getCachedEntries();
}

export async function getAllEntries(): Promise<JournalEntry[]> {
  const userId = await requireUserId();

  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  const list = (data ?? []).map(decryptRow);
  await cacheEntries(list);
  return list;
}

// Consecutive-day streak, counting back from today (or yesterday if today's
// entry isn't done yet, so the streak stays alive until a full day is missed).
export function computeStreak(dates: string[]): number {
  const set = new Set(dates);
  const today = localDateStr();
  const yest = yesterdayStr();

  let cursor: Date;
  if (set.has(today)) cursor = new Date(today + 'T00:00:00');
  else if (set.has(yest)) cursor = new Date(yest + 'T00:00:00');
  else return 0;

  let streak = 0;
  while (true) {
    const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (set.has(ds)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function getEntriesForWeek(weekStart: string): Promise<JournalEntry[]> {
  const userId = await requireUserId();

  // Mon through Sat of that week
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 5); // Saturday

  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .lte('date', endStr)
    .order('date', { ascending: true });

  return (data ?? []).map(decryptRow);
}

export async function getWeeklySummary(weekStart: string): Promise<WeeklySummary | null> {
  const userId = await requireUserId();

  const { data } = await supabase
    .from('weekly_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();

  if (!data) return null;
  const summary = decryptString((data as any).summary, getJournalKey()) ?? '';
  return { ...(data as WeeklySummary), summary };
}

export async function upsertWeeklySummary(weekStart: string, summary: string): Promise<void> {
  const userId = await requireUserId();
  const enc = encryptString(summary, getJournalKey());

  await supabase.from('weekly_summaries').upsert(
    { user_id: userId, week_start: weekStart, summary: enc },
    { onConflict: 'user_id,week_start' }
  );
}

// ── Dev-only helpers ─────────────────────────────────────────────────────────

// Seed backdated sample entries (one per day, ending yesterday) so pattern
// detection, streaks, and the weekly summary have material to work with.
export async function devSeedEntries(): Promise<void> {
  if (!__DEV__) return;
  const userId = await requireUserId();

  const rows = DEV_SAMPLES.map((s, i) => {
    const d = now();
    d.setDate(d.getDate() - (i + 1)); // yesterday, day before, ...
    return {
      user_id: userId,
      date: dateStr(d),
      content: encryptContent({
        prompts: s.prompts,
        followup: s.followup ?? null,
        free_write: s.free_write,
        reframe: null,
      }),
    };
  });

  await supabase.from('entries').upsert(rows, { onConflict: 'user_id,date' });
  await clearAllEntryCaches();
}

export async function devClearEntries(): Promise<void> {
  if (!__DEV__) return;
  const userId = await requireUserId();
  await supabase.from('entries').delete().eq('user_id', userId);
  await supabase.from('weekly_summaries').delete().eq('user_id', userId);
  await supabase.from('seeds').delete().eq('user_id', userId);
  await clearAllEntryCaches();
}
