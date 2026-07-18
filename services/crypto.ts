import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import { scrypt } from 'scrypt-js';
import * as Crypto from 'expo-crypto';

// Low-level cryptography. Authenticated symmetric encryption via NaCl secretbox
// (XSalsa20-Poly1305). All randomness comes from expo-crypto so we never rely on
// tweetnacl's internal PRNG in the React Native runtime.

const NONCE = nacl.secretbox.nonceLength; // 24
const KEYLEN = nacl.secretbox.keyLength;  // 32

export function randomBytes(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

export function generateKey(): Uint8Array {
  return randomBytes(KEYLEN);
}

export function generateSaltB64(): string {
  return util.encodeBase64(randomBytes(16));
}

// Seal raw bytes → base64 string of (nonce || ciphertext).
export function sealBytes(data: Uint8Array, key: Uint8Array): string {
  const nonce = randomBytes(NONCE);
  const box = nacl.secretbox(data, nonce, key);
  const combined = new Uint8Array(nonce.length + box.length);
  combined.set(nonce, 0);
  combined.set(box, nonce.length);
  return util.encodeBase64(combined);
}

export function openBytes(blobB64: string, key: Uint8Array): Uint8Array | null {
  try {
    const combined = util.decodeBase64(blobB64);
    const nonce = combined.slice(0, NONCE);
    const box = combined.slice(NONCE);
    return nacl.secretbox.open(box, nonce, key);
  } catch {
    return null;
  }
}

export function encryptString(plaintext: string, key: Uint8Array): string {
  return sealBytes(util.decodeUTF8(plaintext), key);
}

export function decryptString(blobB64: string, key: Uint8Array): string | null {
  const bytes = openBytes(blobB64, key);
  return bytes ? util.encodeUTF8(bytes) : null;
}

// Derive a key-encryption key from the journal password (slow on purpose).
export async function deriveKEK(password: string, saltB64: string): Promise<Uint8Array> {
  const salt = util.decodeBase64(saltB64);
  const pw = util.decodeUTF8(password.normalize('NFKC'));
  const N = 16384, r = 8, p = 1;
  const dk = await scrypt(pw, salt, N, r, p, KEYLEN);
  return new Uint8Array(dk);
}

// Wrap/unwrap the journal key with the password-derived KEK.
export function wrapKey(journalKey: Uint8Array, kek: Uint8Array): string {
  return sealBytes(journalKey, kek);
}

export function unwrapKey(wrappedB64: string, kek: Uint8Array): Uint8Array | null {
  return openBytes(wrappedB64, kek);
}

export const keyToB64 = (k: Uint8Array): string => util.encodeBase64(k);
export const keyFromB64 = (s: string): Uint8Array => util.decodeBase64(s);

// ── Recovery code ────────────────────────────────────────────────────────────
// Crockford base32 (no I, L, O, U) so the code is easy to read and type.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = ((value << 8) | b) >>> 0;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= bits === 0 ? 0 : (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

// 120 bits of entropy, shown as 6 groups of 4: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
export function generateRecoveryCode(): string {
  const raw = encodeBase32(randomBytes(15));
  return (raw.match(/.{1,4}/g) ?? []).join('-');
}

// Normalize user-typed codes: strip separators, uppercase, fix common misreads.
export function normalizeCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}
