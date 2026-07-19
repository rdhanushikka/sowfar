import { supabase, getUserId } from './supabase';
import { Seed, SeedMoment } from '../types';
import { getJournalKey } from './vault';
import { encryptString, decryptString } from './crypto';
import { localDateStr } from './db';

// Seeds: intentions the user plants and tends. Stored end-to-end encrypted —
// each row's content column holds the whole seed as ciphertext; only the row id
// and user_id are in the clear.

export const MAX_ACTIVE_SEEDS = 3;
const CHECKIN_INTERVAL_DAYS = 7;

async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) throw new Error('NOT_SIGNED_IN');
  return id;
}

type SeedContent = Omit<Seed, 'id'>;

function decryptSeedRow(row: any): Seed | null {
  const dec = decryptString(row.content, getJournalKey());
  if (!dec) return null;
  try {
    return { id: row.id, ...(JSON.parse(dec) as SeedContent) };
  } catch {
    return null;
  }
}

export async function getSeeds(): Promise<Seed[]> {
  const userId = await requireUserId();
  const { data } = await supabase
    .from('seeds')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  return (data ?? [])
    .map(decryptSeedRow)
    .filter((s): s is Seed => s !== null);
}

export async function getActiveSeeds(): Promise<Seed[]> {
  return (await getSeeds()).filter(s => s.status === 'active');
}

export async function plantSeed(text: string, why?: string): Promise<Seed> {
  const userId = await requireUserId();

  const active = await getActiveSeeds();
  if (active.length >= MAX_ACTIVE_SEEDS) throw new Error('GARDEN_FULL');

  const content: SeedContent = {
    text: text.trim(),
    why: why?.trim() || undefined,
    planted_date: localDateStr(),
    status: 'active',
    ended_date: null,
    last_checkin: null,
    moments: [],
  };

  const { data, error } = await supabase
    .from('seeds')
    .insert({ user_id: userId, content: encryptString(JSON.stringify(content), getJournalKey()) })
    .select('id')
    .single();

  if (error || !data) throw new Error('PLANT_FAILED');
  return { id: data.id, ...content };
}

async function saveSeed(seed: Seed): Promise<void> {
  const userId = await requireUserId();
  const { id, ...content } = seed;
  await supabase
    .from('seeds')
    .update({ content: encryptString(JSON.stringify(content), getJournalKey()) })
    .eq('user_id', userId)
    .eq('id', id);
}

export async function addMoment(seed: Seed, note: string, source: SeedMoment['source']): Promise<Seed> {
  const updated: Seed = {
    ...seed,
    moments: [...seed.moments, { date: localDateStr(), note, source }],
  };
  await saveSeed(updated);
  return updated;
}

// Check-in: always stamps the date; only real movement becomes a moment.
export async function recordCheckin(seed: Seed, movedForward: boolean, note?: string): Promise<Seed> {
  const updated: Seed = {
    ...seed,
    last_checkin: localDateStr(),
    moments: movedForward
      ? [...seed.moments, { date: localDateStr(), note: note?.trim() || 'You noticed a little movement.', source: 'checkin' as const }]
      : seed.moments,
  };
  await saveSeed(updated);
  return updated;
}

export async function bloomSeed(seed: Seed): Promise<void> {
  await saveSeed({ ...seed, status: 'bloomed', ended_date: localDateStr() });
}

export async function releaseSeed(seed: Seed): Promise<void> {
  await saveSeed({ ...seed, status: 'released', ended_date: localDateStr() });
}

// The stalest active seed that hasn't been checked in on for a while, if any.
export function seedDueForCheckin(seeds: Seed[]): Seed | null {
  const today = new Date(localDateStr() + 'T00:00:00').getTime();
  const due = seeds
    .filter(s => s.status === 'active')
    .map(s => {
      const ref = s.last_checkin ?? s.planted_date;
      const days = Math.round((today - new Date(ref + 'T00:00:00').getTime()) / 86_400_000);
      return { seed: s, days };
    })
    .filter(x => x.days >= CHECKIN_INTERVAL_DAYS)
    .sort((a, b) => b.days - a.days);

  return due[0]?.seed ?? null;
}

// Growth stage from collected moments (bloom is user-declared, not automatic).
export function seedStage(seed: Seed): 'seed' | 'sprout' | 'leafing' {
  const n = seed.moments.length;
  if (n >= 4) return 'leafing';
  if (n >= 1) return 'sprout';
  return 'seed';
}
