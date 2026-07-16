import * as SecureStore from 'expo-secure-store';
import { supabase, getUserId } from './supabase';
import {
  generateKey,
  generateSaltB64,
  deriveKEK,
  wrapKey,
  unwrapKey,
  keyToB64,
  keyFromB64,
} from './crypto';

// Manages the per-user journal key: the secret that encrypts entries. The key
// is wrapped with a password-derived key and stored server-side, so Supabase
// (and the developer) only ever hold an unusable blob. The unwrapped key lives
// in memory for the session and is cached in the device Keychain for convenience.

const CACHE_KEY = 'sowfar:journalKey';
let journalKey: Uint8Array | null = null;

interface VaultRow {
  salt: string;
  wrapped_key: string;
}

async function getVaultRow(): Promise<VaultRow | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('vault')
    .select('salt, wrapped_key')
    .eq('user_id', userId)
    .single();
  return (data as VaultRow) ?? null;
}

export async function hasVault(): Promise<boolean> {
  return (await getVaultRow()) !== null;
}

// Load the cached key from the Keychain into memory (call at startup).
export async function loadCachedKey(): Promise<boolean> {
  if (journalKey) return true;
  try {
    const b64 = await SecureStore.getItemAsync(CACHE_KEY);
    if (b64) {
      journalKey = keyFromB64(b64);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function isUnlocked(): boolean {
  return journalKey !== null;
}

export function getJournalKey(): Uint8Array {
  if (!journalKey) throw new Error('LOCKED');
  return journalKey;
}

async function cache(key: Uint8Array): Promise<void> {
  journalKey = key;
  try {
    await SecureStore.setItemAsync(CACHE_KEY, keyToB64(key));
  } catch {
    // non-fatal; key still held in memory
  }
}

// First-time setup: create the journal key and lock it with the password.
export async function setupVault(password: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('NOT_SIGNED_IN');

  const key = generateKey();
  const salt = generateSaltB64();
  const kek = await deriveKEK(password, salt);
  const wrapped = wrapKey(key, kek);

  await supabase.from('vault').upsert(
    { user_id: userId, salt, wrapped_key: wrapped },
    { onConflict: 'user_id' }
  );

  await cache(key);
}

// Returns true if the password unlocked the vault, false if it was wrong.
export async function unlockVault(password: string): Promise<boolean> {
  const row = await getVaultRow();
  if (!row) return false;

  const kek = await deriveKEK(password, row.salt);
  const key = unwrapKey(row.wrapped_key, kek);
  if (!key) return false; // wrong password

  await cache(key);
  return true;
}

export async function changePassword(oldPw: string, newPw: string): Promise<boolean> {
  const row = await getVaultRow();
  if (!row) return false;

  const oldKek = await deriveKEK(oldPw, row.salt);
  const key = unwrapKey(row.wrapped_key, oldKek);
  if (!key) return false;

  const userId = await getUserId();
  const salt = generateSaltB64();
  const newKek = await deriveKEK(newPw, salt);
  const wrapped = wrapKey(key, newKek);

  await supabase.from('vault').update({ salt, wrapped_key: wrapped }).eq('user_id', userId!);
  await cache(key);
  return true;
}

// Clear the key from memory and the Keychain (used on sign out).
export async function lockVault(): Promise<void> {
  journalKey = null;
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY);
  } catch {
    // ignore
  }
}
