import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalEntry } from '../types';
import { getAllEntries, localDateStr } from './db';

// Resurfaces a line from a past entry for the home screen: "From your journal."
// Prefers meaningful intervals (a year / a month / a week ago), falls back to a
// random older entry. The pick is stable for the day.

const KEY = 'sowfar:memory';

export interface Memory {
  date: string;   // the past entry's date
  line: string;   // one line pulled from it
}

interface StoredMemory {
  chosenDate: string; // the day this pick was made
  memory: Memory | null;
}

function shiftDate(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// First sentence of the free write, else the first substantial prompt answer.
function extractLine(e: JournalEntry): string | null {
  const fw = e.free_write?.trim();
  if (fw && fw.length >= 15) {
    const first = fw.split(/(?<=[.!?])\s+/)[0].trim();
    return first.length > 140 ? first.slice(0, 137) + '…' : first;
  }
  const answer = e.prompts.find(p => p.type === 'open' && p.answer.trim().length >= 15)?.answer.trim();
  if (!answer) return null;
  return answer.length > 140 ? answer.slice(0, 137) + '…' : answer;
}

function findNear(entries: JournalEntry[], target: string, tolerance: number): JournalEntry | null {
  for (let off = 0; off <= tolerance; off++) {
    for (const sign of off === 0 ? [0] : [-1, 1]) {
      const want = shiftDate(target, off * sign);
      const hit = entries.find(e => e.date === want);
      if (hit) return hit;
    }
  }
  return null;
}

export async function getDailyMemory(): Promise<Memory | null> {
  const today = localDateStr();

  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    const stored = JSON.parse(raw) as StoredMemory;
    if (stored.chosenDate === today) return stored.memory;
  }

  const entries = await getAllEntries();
  // Only look back beyond the editable window, so it feels like a memory.
  const past = entries.filter(e => e.date < shiftDate(today, -2));

  let pick: JournalEntry | null = null;
  if (past.length > 0) {
    pick =
      findNear(past, shiftDate(today, -365), 3) ??
      findNear(past, shiftDate(today, -30), 3) ??
      findNear(past, shiftDate(today, -7), 1) ??
      past[Math.floor(Math.random() * past.length)];
  }

  let memory: Memory | null = null;
  if (pick) {
    const line = extractLine(pick);
    if (line) memory = { date: pick.date, line };
  }

  await AsyncStorage.setItem(KEY, JSON.stringify({ chosenDate: today, memory }));
  return memory;
}
