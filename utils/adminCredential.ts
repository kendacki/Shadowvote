/**
 * Matches `adminCredentialHash(preimage)` in `contracts/shadowvote.compact`
 * (`persistentHash` on `Vector<2, Bytes<32>>` with domain pad + preimage).
 */

import { CompactTypeBytes, CompactTypeVector, persistentHash } from '@midnight-ntwrk/compact-runtime';

/** `pad(32, "shadowvote:admin:cred:v1")` — keep in sync with the Compact contract. */
export const ADMIN_CREDENTIAL_DOMAIN_PAD = new Uint8Array([
  115, 104, 97, 100, 111, 119, 118, 111, 116, 101, 58, 97, 100, 109, 105, 110, 58, 99, 114, 101, 100, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0,
]);

const BYTES32 = new CompactTypeBytes(32);
const VEC2_BYTES32 = new CompactTypeVector(2, BYTES32);

export function computeAdminCredential(preimage: Uint8Array): Uint8Array {
  if (preimage.length !== 32) {
    throw new Error('computeAdminCredential: preimage must be 32 bytes');
  }
  return persistentHash(VEC2_BYTES32, [ADMIN_CREDENTIAL_DOMAIN_PAD, preimage]);
}
