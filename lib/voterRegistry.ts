import voterRegistryJson from '../config/voter-registry.json';

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

type VoterRegistryFile = {
  leaves: string[];
  _readme?: string;
};

function parsedRegistry(): VoterRegistryFile {
  const j = voterRegistryJson as unknown as VoterRegistryFile;
  if (!j || !Array.isArray(j.leaves)) {
    throw new Error('config/voter-registry.json must contain a "leaves" string array');
  }
  return j;
}

/**
 * Ordered authorized voter **leaf** hashes (`voterLeafHash(secret)`), packed into Merkle indices `0..n-1`.
 *
 * **Single source of truth:** `config/voter-registry.json` — same file is used by `npm run deploy` and the app.
 * Replace `leaves[0]` with your Lace voter leaf (64 hex chars from the browser console: `CURRENT VOTER LEAF`), then redeploy.
 */
export function getAuthorizedVoterLeaves(): Uint8Array[] {
  const { leaves } = parsedRegistry();
  return leaves.map((part, i) => parseHex32(part, `config/voter-registry.json leaves[${i}]`));
}
