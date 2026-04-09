import { computeVoterLeafHash } from '../utils/merkle';

function leafHexForEnv(leaf: Uint8Array): string {
  return `0x${Array.from(leaf, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function leavesContainLeaf(leaves: Uint8Array[], leaf: Uint8Array): boolean {
  return leaves.some(
    (L) => L.length === leaf.length && L.every((b, i) => b === leaf[i]),
  );
}

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

/**
 * Same leaves as {@link getAuthorizedVoterLeaves}, but in **development** ensures the voter
 * derived from `voterSecret` is included so local ZK paths match without editing `.env`.
 * Logs `CURRENT VOTER LEAF:` (hex) for copying into `NEXT_PUBLIC_VOTER_REGISTRY_LEAVES_HEX`.
 */
export function getAuthorizedVoterLeavesWithDevBypass(voterSecret: Uint8Array | null): Uint8Array[] {
  const leaves = [...getAuthorizedVoterLeaves()];
  if (!voterSecret || voterSecret.length !== 32) {
    return leaves;
  }
  const currentUserLeaf = computeVoterLeafHash(voterSecret);
  console.log('CURRENT VOTER LEAF:', leafHexForEnv(currentUserLeaf));
  if (process.env.NODE_ENV === 'development' && !leavesContainLeaf(leaves, currentUserLeaf)) {
    console.warn(
      '[ShadowVote] Dev bypass: appending CURRENT VOTER LEAF to registry leaves (not for production).',
    );
    leaves.push(currentUserLeaf);
  }
  return leaves;
}
