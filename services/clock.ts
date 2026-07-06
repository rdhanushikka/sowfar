import AsyncStorage from '@react-native-async-storage/async-storage';

// A central clock so dev builds can simulate the passage of days.
// In production the offset is always 0 — now() is just the real date.
let dayOffset = 0;
const OFFSET_KEY = 'sowfar:devDayOffset';

export async function initClock(): Promise<void> {
  if (!__DEV__) return;
  try {
    const raw = await AsyncStorage.getItem(OFFSET_KEY);
    dayOffset = raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    dayOffset = 0;
  }
}

export function now(): Date {
  const d = new Date();
  if (__DEV__ && dayOffset) d.setDate(d.getDate() + dayOffset);
  return d;
}

export function dateStr(d: Date = now()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Dev-only controls.
export function getDayOffset(): number {
  return dayOffset;
}

export async function setDayOffset(n: number): Promise<void> {
  dayOffset = n;
  try {
    await AsyncStorage.setItem(OFFSET_KEY, String(n));
  } catch {
    // non-fatal
  }
}

export async function advanceDay(delta = 1): Promise<void> {
  await setDayOffset(dayOffset + delta);
}
