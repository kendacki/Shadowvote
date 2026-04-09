import { supabase } from '@/utils/supabase';
import { getAuthorizedVoterLeaves } from '@/lib/voterRegistry';
import { bytesEqual } from '@/utils/merkle';

function parseLeafHex(entry: string, label: string): Uint8Array | null {
  let h = entry.trim();
  if (h.startsWith('0x') || h.startsWith('0X')) h = h.slice(2);
  if (h.length !== 64 || !/^[0-9a-fA-F]+$/.test(h)) {
    console.warn(`[voterLeavesSync] skip invalid leaf (${label})`);
    return null;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const LEAF_COLUMN_CANDIDATES = ['leaf', 'voter_leaf', 'merkle_leaf'] as const;

function extractLeafFromRow(row: Record<string, unknown>, rowLabel: string): Uint8Array | null {
  for (const col of LEAF_COLUMN_CANDIDATES) {
    const v = row[col];
    if (typeof v === 'string' && v.length > 0) {
      const p = parseLeafHex(v, `${rowLabel}.${col}`);
      if (p) return p;
    }
  }
  return null;
}

/**
 * Reads voter leaves from Supabase (`voters`, `subscribers`, or tables listed in
 * NEXT_PUBLIC_SUPABASE_VOTER_LEAVES_TABLES). Expects a column `leaf`, `voter_leaf`, or `merkle_leaf`.
 */
export async function fetchDatabaseVoterLeaves(): Promise<Uint8Array[]> {
  const client = supabase;
  if (!client) return [];

  const configured =
    process.env.NEXT_PUBLIC_SUPABASE_VOTER_LEAVES_TABLES?.split(',').map((s) => s.trim()).filter(Boolean) ??
    null;
  const tables =
    configured && configured.length > 0 ? configured : (['voters', 'subscribers'] as const);

  const out: Uint8Array[] = [];
  const seen = new Set<string>();

  for (const table of tables) {
    const primaryCol = process.env.NEXT_PUBLIC_SUPABASE_VOTER_LEAF_COLUMN?.trim();
    const cols = primaryCol ? primaryCol : '*';
    const { data, error } = await client.from(table).select(cols);
    if (error) {
      console.warn(`[voterLeavesSync] table "${table}":`, error.message);
      continue;
    }
    if (!Array.isArray(data)) continue;
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as unknown as Record<string, unknown>;
      const leaf = extractLeafFromRow(row, `${table}[${i}]`);
      if (!leaf) continue;
      const key = Array.from(leaf).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(leaf);
    }
  }

  return out;
}

function mergeUniqueLeaves(leaves: Uint8Array[]): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (const L of leaves) {
    if (L.length !== 32) continue;
    if (out.some((x) => bytesEqual(x, L))) continue;
    out.push(L);
  }
  return out;
}

function parseEnvAdminFallbackLeaf(): Uint8Array | null {
  const hex = process.env.NEXT_PUBLIC_ADMIN_VOTER_LEAF_HEX?.trim().replace(/^0x/i, '');
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Union of leaves from `config/voter-registry.json`, Supabase voter/subscriber tables, the admin's
 * local voter leaf (if provided), and optional `NEXT_PUBLIC_ADMIN_VOTER_LEAF_HEX`.
 */
export async function collectLeavesForRegistrySync(adminVoterLeaf: Uint8Array | null): Promise<Uint8Array[]> {
  const local = getAuthorizedVoterLeaves();
  const remote = await fetchDatabaseVoterLeaves();
  let merged = mergeUniqueLeaves([...local, ...remote]);

  const envAdminLeaf = parseEnvAdminFallbackLeaf();
  const adminCandidates = [adminVoterLeaf, envAdminLeaf].filter((x): x is Uint8Array => x != null && x.length === 32);

  for (const leaf of adminCandidates) {
    if (!merged.some((x) => bytesEqual(x, leaf))) {
      merged = mergeUniqueLeaves([...merged, leaf]);
    }
  }

  return merged;
}
