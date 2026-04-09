import { supabase } from '@/utils/supabase';
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
 * Deterministic order: `wallet_address` ascending (add optional `created_at` in Supabase for registration order).
 */
export async function fetchLeavesFromRegisteredVotersTable(): Promise<Uint8Array[]> {
  const client = supabase;
  if (!client) {
    throw new Error('Supabase is not configured (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }

  const { data, error } = await client
    .from('registered_voters')
    .select('voter_leaf, wallet_address')
    .order('wallet_address', { ascending: true });
  if (error) {
    throw new Error(`registered_voters: ${error.message}`);
  }
  if (!data || !Array.isArray(data)) {
    return [];
  }

  const out: Uint8Array[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as unknown as Record<string, unknown>;
    const raw = row.voter_leaf;
    if (typeof raw !== 'string') continue;
    const leaf = parseLeafHex(raw, `registered_voters[${i}].voter_leaf`);
    if (!leaf) continue;
    const key = Array.from(leaf).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(leaf);
  }

  return out;
}

/**
 * Whether `registered_voters` contains a row for this Lace unshielded address.
 */
export async function isWalletRegisteredForEpoch(unshieldedAddress: string): Promise<boolean> {
  const client = supabase;
  if (!client || !unshieldedAddress.trim()) return false;
  const addr = unshieldedAddress.trim();
  const { data, error } = await client
    .from('registered_voters')
    .select('wallet_address')
    .eq('wallet_address', addr)
    .limit(1);
  if (error) {
    console.warn('[voterLeavesSync] isWalletRegisteredForEpoch:', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Admin root sync: Merkle leaves from `registered_voters` (ordered), plus admin leaf(es) not yet in the list.
 */
export async function collectLeavesForRegisteredVotersRootSync(
  adminVoterLeaf: Uint8Array | null,
): Promise<Uint8Array[]> {
  const ordered = await fetchLeavesFromRegisteredVotersTable();
  const merged = [...ordered];

  const envAdminLeaf = parseEnvAdminFallbackLeaf();
  const adminCandidates = [adminVoterLeaf, envAdminLeaf].filter(
    (x): x is Uint8Array => x != null && x.length === 32,
  );

  for (const leaf of adminCandidates) {
    if (!merged.some((x) => bytesEqual(x, leaf))) {
      merged.push(leaf);
    }
  }

  return mergeUniqueLeaves(merged);
}
