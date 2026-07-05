import { supabase, getUserId } from './supabase';
import { JournalEntry, WeeklySummary } from '../types';

async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) throw new Error('NOT_SIGNED_IN');
  return id;
}

export function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

export async function getTodayEntry(): Promise<JournalEntry | null> {
  const userId = await requireUserId();
  const today = localDateStr();

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error || !data) return null;
  return data as JournalEntry;
}

export async function upsertEntry(entry: Partial<JournalEntry>): Promise<void> {
  const userId = await requireUserId();
  const today = localDateStr();

  await supabase.from('entries').upsert(
    { ...entry, user_id: userId, date: today },
    { onConflict: 'user_id,date' }
  );
}

export async function getEntryByDate(date: string): Promise<JournalEntry | null> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error || !data) return null;
  return data as JournalEntry;
}

// Update the editable text fields of an entry for a given date.
export async function updateEntryByDate(
  date: string,
  fields: { prompts: JournalEntry['prompts']; followup: JournalEntry['followup']; free_write: string }
): Promise<void> {
  const userId = await requireUserId();

  await supabase
    .from('entries')
    .update(fields)
    .eq('user_id', userId)
    .eq('date', date);
}

export async function getAllEntries(): Promise<JournalEntry[]> {
  const userId = await requireUserId();

  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  return (data ?? []) as JournalEntry[];
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

  return (data ?? []) as JournalEntry[];
}

export async function getWeeklySummary(weekStart: string): Promise<WeeklySummary | null> {
  const userId = await requireUserId();

  const { data } = await supabase
    .from('weekly_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();

  return data as WeeklySummary | null;
}

export async function upsertWeeklySummary(weekStart: string, summary: string): Promise<void> {
  const userId = await requireUserId();

  await supabase.from('weekly_summaries').upsert(
    { user_id: userId, week_start: weekStart, summary },
    { onConflict: 'user_id,week_start' }
  );
}
