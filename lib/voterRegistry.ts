import { computeVoterLeafHash } from '../utils/merkle';

function parseHex32(entry: string, label: string): Uint8Array {
  let h = entry.trim();
  if (h.startsWith('0x') || h.startsWith('0X')) h = h.slice(2);
  if (h.length !== 64) {
    throw new Error(`${label}: expected 64 hex chars (32 bytes), got ${h.length}`);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Ordered authorized voter **leaf** hashes (`voterLeafHash(secret)`), packed into Merkle indices `0..n-1`.
 *
 * Configure with comma-separated `0x…` 32-byte values (same list for deploy and app):
 * - **`VOTER_REGISTRY_LEAVES_HEX`** — preferred for `npm run deploy` (Node / `.env`).
 * - **`NEXT_PUBLIC_VOTER_REGISTRY_LEAVES_HEX`** — used by the browser; deploy also reads this if the former is unset.
 *
 * If unset, defaults to a single dev leaf: `computeVoterLeafHash(new Uint8Array(32))` (must match constructor `voterRoot`).
 */
export function getAuthorizedVoterLeaves(): Uint8Array[] {
  const raw =
    process.env.VOTER_REGISTRY_LEAVES_HEX?.trim() ?? process.env.NEXT_PUBLIC_VOTER_REGISTRY_LEAVES_HEX?.trim();
  if (!raw) {
    return [computeVoterLeafHash(new Uint8Array(32))];
  }
  return raw.split(',').map((part, i) =>
    parseHex32(part, `VOTER_REGISTRY_LEAVES_HEX / NEXT_PUBLIC_VOTER_REGISTRY_LEAVES_HEX[${i}]`),
  );
}
