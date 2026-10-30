import crypto from 'node:crypto';

/**
 * RFC 9562 UUIDv7 — 48-bit unix-ms timestamp, then random bits.
 * The live service uses time-ordered UUIDs of exactly this shape for
 * `script_id` / `user_map_id`, e.g. 01a18307-1527-7454-9557-e96cac0d2448.
 */
export function uuidv7(timestamp = Date.now()) {
  const bytes = crypto.randomBytes(16);
  const ms = BigInt(timestamp);
  bytes.writeUIntBE(Number(ms & 0xffffffffffffn), 0, 6);
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INTERNAL_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Internal user-map identifier, shaped like `CRPJR2C0U:9YGC8UV9RCJ`
 * (two 9-character Crockford-style base32 groups separated by a colon).
 */
export function internalMapId() {
  const group = () =>
    Array.from(crypto.randomBytes(9), (b) => INTERNAL_ALPHABET[b % INTERNAL_ALPHABET.length]).join('');
  return `${group()}:${group()}`;
}

export function sessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function shareToken() {
  return crypto.randomBytes(12).toString('base64url');
}
