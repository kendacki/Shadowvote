/**
 * ShadowVote nullifier derivation — must match `computeNullifier` in shadowvote.compact
 * (`persistentHash` on Vector<3, Bytes<32>> with domain pad, secret, proposal id as bytes).
 */

import {
  CompactTypeBytes,
  CompactTypeVector,
  convertFieldToBytes,
  persistentHash,
} from '@midnight-ntwrk/compact-runtime';

/** `pad(32, "shadowvote:nullifier:v1")` from the compiled contract. */
export const NULLIFIER_DOMAIN_PAD = new Uint8Array([
  115, 104, 97, 100, 111, 119, 118, 111, 116, 101, 58, 110, 117, 108, 108, 105, 102, 105, 101, 114, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0,
  0,
]);

const BYTES32 = new CompactTypeBytes(32);
const VECTOR3_BYTES32 = new CompactTypeVector(3, BYTES32);

/** Lowercase hex, length 64 for 32-byte values (for Set lookup). */
export function bytes32ToLowerHex(bytes: Uint8Array): string {
  if (bytes.length !== 32) {
    throw new Error(`bytes32ToLowerHex: expected 32 bytes, got ${bytes.length}`);
  }
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Local nullifier for `(voterSecret, proposalId)` — same as on-chain `nullifiers` entries after a vote.
 */
export function computeVoteNullifier(voterSecret: Uint8Array, proposalId: number | bigint): Uint8Array {
  if (voterSecret.length !== 32) {
    throw new Error('computeVoteNullifier: voterSecret must be 32 bytes');
  }
  const pid = typeof proposalId === 'bigint' ? proposalId : BigInt(proposalId);
  if (pid < 0n || pid > 0xffffffffn) {
    throw new Error('computeVoteNullifier: proposalId must fit Uint<32>');
  }
  const proposalBytes = convertFieldToBytes(32, pid, 'shadowvote.compact line 49 char 5');
  return persistentHash(VECTOR3_BYTES32, [NULLIFIER_DOMAIN_PAD, voterSecret, proposalBytes]);
}

/** Classify wallet / proof failures for UX (toasts). */
export function classifyVoteFailure(e: unknown): 'user_rejected' | 'already_voted' | 'network' | 'unknown' {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (
    lower.includes('rejected') ||
    lower.includes('user denied') ||
    (lower.includes('denied') && lower.includes('transaction')) ||
    lower.includes('cancelled') ||
    lower.includes('canceled')
  ) {
    return 'user_rejected';
  }
  if (
    (lower.includes('nullifier') && lower.includes('spent')) ||
    lower.includes('already spent') ||
    msg.includes('ShadowVote: nullifier already spent')
  ) {
    return 'already_voted';
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout')
  ) {
    return 'network';
  }
  return 'unknown';
}
