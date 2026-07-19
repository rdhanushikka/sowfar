import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getUserId } from './supabase';
import { clearAllEntryCaches } from './cache';
import {
  generateKey,
  generateSaltB64,
  deriveKEK,
  wrapKey,
  unwrapKey,
  keyToB64,
  keyFromB64,
  generateRecoveryCode,
  normalizeCode,
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
  recovery_salt: string | null;
  wrapped_key_recovery: string | null;
}

async function getVaultRow(): Promise<VaultRow | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('vault')
    .select('salt, wrapped_key, recovery_salt, wrapped_key_recovery')
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

// First-time setup: create the journal key, lock it with the password AND with
// a generated recovery code (same key, two doors). Returns the recovery code to
// show the user once.
export async function setupVault(password: string): Promise<string> {
  const userId = await getUserId();
  if (!userId) throw new Error('NOT_SIGNED_IN');

  const key = generateKey();

  const salt = generateSaltB64();
  const kek = await deriveKEK(password, salt);
  const wrapped = wrapKey(key, kek);

  const recoveryCode = generateRecoveryCode();
  const recoverySalt = generateSaltB64();
  const recKek = await deriveKEK(normalizeCode(recoveryCode), recoverySalt);
  const recWrapped = wrapKey(key, recKek);

  await supabase.from('vault').upsert(
    {
      user_id: userId,
      salt,
      wrapped_key: wrapped,
      recovery_salt: recoverySalt,
      wrapped_key_recovery: recWrapped,
    },
    { onConflict: 'user_id' }
  );

  await cache(key);
  return recoveryCode;
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

// Unlock with the recovery code instead of the password.
export async function unlockWithRecovery(code: string): Promise<boolean> {
  const row = await getVaultRow();
  if (!row?.recovery_salt || !row?.wrapped_key_recovery) return false;

  const kek = await deriveKEK(normalizeCode(code), row.recovery_salt);
  const key = unwrapKey(row.wrapped_key_recovery, kek);
  if (!key) return false;

  await cache(key);
  return true;
}

// Set a new password for an already-unlocked journal (e.g. right after a
// recovery). Re-wraps the in-memory journal key; entries are untouched.
export async function setNewPassword(newPassword: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('NOT_SIGNED_IN');
  const key = getJournalKey();

  const salt = generateSaltB64();
  const kek = await deriveKEK(newPassword, salt);
  const wrapped = wrapKey(key, kek);

  await supabase.from('vault').update({ salt, wrapped_key: wrapped }).eq('user_id', userId);
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

// Forgotten password: there is no recovery, only a fresh start. This permanently
// deletes the (unreadable) entries and the vault so a new password can be set.
export async function resetVault(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  await supabase.from('entries').delete().eq('user_id', userId);
  await supabase.from('weekly_summaries').delete().eq('user_id', userId);
  await supabase.from('seeds').delete().eq('user_id', userId);
  await supabase.from('vault').delete().eq('user_id', userId);

  await clearAllEntryCaches();
  await AsyncStorage.multiRemove(['sowfar:insights', 'sowfar:quote', 'sowfar:reframeAck']).catch(() => {});
  await lockVault();
}
