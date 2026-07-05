import AsyncStorage from '@react-native-async-storage/async-storage';
import { QUOTES, Quote } from '../constants/quotes';
import { getAllEntries, localDateStr } from './db';
import { pickQuoteIndex } from './claude';

const KEY = 'sowfar:quote';
const REFRESH_DAYS = 3;

interface StoredQuote {
  index: number;
  chosenDate: string;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86_400_000);
}

// Returns the current quote, choosing a fresh one at most once every 3 days.
// When there are enough entries, Claude matches a quote to recent themes;
// otherwise it falls back to a random pick.
export async function getDailyQuote(): Promise<Quote> {
  const today = localDateStr();

  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    const stored = JSON.parse(raw) as StoredQuote;
    if (daysBetween(stored.chosenDate, today) < REFRESH_DAYS && QUOTES[stored.index]) {
      return QUOTES[stored.index];
    }
  }

  let index = Math.floor(Math.random() * QUOTES.length);
  try {
    const entries = await getAllEntries();
    if (entries.length >= 3) {
      const recent = entries.slice(0, 6).map(e => ({
        prompts: e.prompts,
        freeWrite: e.free_write,
      }));
      const picked = await pickQuoteIndex(recent, QUOTES);
      if (Number.isInteger(picked) && picked >= 0 && picked < QUOTES.length) {
        index = picked;
      }
    }
  } catch {
    // keep the random fallback
  }

  await AsyncStorage.setItem(KEY, JSON.stringify({ index, chosenDate: today }));
  return QUOTES[index];
}
