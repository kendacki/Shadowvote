/**
 * Depth-20 voter Merkle tree helpers aligned with Compact `merkleTreePathRoot<20>` in shadowvote.compact:
 * - Leaves are 32-byte `Bytes<32>` (authorized voters’ `voterLeafHash(secret)` outputs).
 * - Bottom level: `degradeToTransient(persistentHash({ domain_sep: "mdn:lh", data: leaf }))`.
 * - Internal nodes: `transientHash([left, right])` on field elements.
 */

import type * as ocrt from '@midnight-ntwrk/onchain-runtime-v3';
import {
  CompactTypeBytes,
  CompactTypeField,
  CompactTypeVector,
  type CompactType,
  degradeToTransient,
  persistentHash,
  transientHash,
} from '@midnight-ntwrk/compact-runtime';

/** Matches `pad(32, "shadowvote:voter:leaf:v1")` in the compiled contract. */
export const VOTER_LEAF_DOMAIN = new Uint8Array([
  115, 104, 97, 100, 111, 119, 118, 111, 116, 101, 58, 118, 111, 116, 101, 114, 58, 108, 101, 97, 102, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0,
]);

/** Matches Compact leaf preimage domain for Merkle accumulation (`mdn:lh`). */
export const MERKLE_LEAF_DOMAIN = new Uint8Array([109, 100, 110, 58, 108, 104]);

const BYTES32 = new CompactTypeBytes(32);
const DOMAIN_BYTES6 = new CompactTypeBytes(6);
const VOTER_LEAF_VEC2 = new CompactTypeVector(2, BYTES32);
const FIELD_PAIR = new CompactTypeVector(2, CompactTypeField);

const LeafPreimageType: CompactType<{ domain_sep: Uint8Array; data: Uint8Array }> = {
  alignment() {
    return DOMAIN_BYTES6.alignment().concat(BYTES32.alignment());
  },
  fromValue(value: ocrt.Value) {
    return {
      domain_sep: DOMAIN_BYTES6.fromValue(value),
      data: BYTES32.fromValue(value),
    };
  },
  toValue(value: { domain_sep: Uint8Array; data: Uint8Array }) {
    return DOMAIN_BYTES6.toValue(value.domain_sep).concat(BYTES32.toValue(value.data));
  },
};

export const TREE_DEPTH = 20;
export const TREE_LEAF_COUNT = 1 << TREE_DEPTH;

export type MerklePathEntryWitness = {
  sibling: { field: bigint };
  goes_left: boolean;
};

/** Witness tuple returned by `voterMembershipPath` (excluding private state). */
export type MembershipPathWitness = {
  leaf: Uint8Array;
  path: MerklePathEntryWitness[];
};

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Same as contract `voterLeafHash(secret)` (Vector<2, Bytes<32>> persistent hash). */
export function computeVoterLeafHash(secret: Uint8Array): Uint8Array {
  if (secret.length !== 32) {
    throw new Error('computeVoterLeafHash: secret must be 32 bytes');
  }
  return persistentHash(VOTER_LEAF_VEC2, [VOTER_LEAF_DOMAIN, secret]);
}

function leaf32ToMerkleField(leaf32: Uint8Array): bigint {
  const h = persistentHash(LeafPreimageType, { domain_sep: MERKLE_LEAF_DOMAIN, data: leaf32 });
  return degradeToTransient(h);
}

function hashChildren(left: bigint, right: bigint): bigint {
  return transientHash(FIELD_PAIR, [left, right]);
}

function cloneWitness(path: MembershipPathWitness): MembershipPathWitness {
  return {
    leaf: new Uint8Array(path.leaf),
    path: path.path.map((e) => ({
      sibling: { field: e.sibling.field },
      goes_left: e.goes_left,
    })),
  };
}

/**
 * Packs `authorizedLeaves` into indices `0 .. authorizedLeaves.length - 1` and fills the remaining
 * `2^20` slots with `emptyLeaf` (default 32 zero bytes).
 *
 * @throws If the target leaf is not present in `authorizedLeaves`, or if there are more than 2^20 leaves.
 */
export function buildMerklePathWitness(
  targetLeaf: Uint8Array,
  authorizedLeaves: Uint8Array[],
  emptyLeaf: Uint8Array = new Uint8Array(32),
): MembershipPathWitness {
  if (targetLeaf.length !== 32) throw new Error('targetLeaf must be 32 bytes');
  if (authorizedLeaves.length > TREE_LEAF_COUNT) {
    throw new Error(`At most ${TREE_LEAF_COUNT} authorized leaves supported`);
  }
  let leafIndex = -1;
  for (let i = 0; i < authorizedLeaves.length; i++) {
    const L = authorizedLeaves[i];
    if (L.length !== 32) throw new Error(`authorizedLeaves[${i}] must be 32 bytes`);
    if (bytesEqual(L, targetLeaf)) {
      leafIndex = i;
      break;
    }
  }
  if (leafIndex < 0) {
    throw new Error('Target leaf is not in the authorized leaf list');
  }

  const rawLeaves: Uint8Array[] = new Array(TREE_LEAF_COUNT);
  for (let i = 0; i < TREE_LEAF_COUNT; i++) {
    rawLeaves[i] = i < authorizedLeaves.length ? authorizedLeaves[i] : emptyLeaf;
  }

  let level: bigint[] = new Array(TREE_LEAF_COUNT);
  for (let i = 0; i < TREE_LEAF_COUNT; i++) {
    level[i] = leaf32ToMerkleField(rawLeaves[i]);
  }

  const path: MerklePathEntryWitness[] = [];
  let idx = leafIndex;
  for (let d = 0; d < TREE_DEPTH; d++) {
    const siblingIdx = idx ^ 1;
    const goesLeft = (idx & 1) === 0;
    path.push({ sibling: { field: level[siblingIdx] }, goes_left: goesLeft });
    const nextLen = level.length >> 1;
    const next = new Array<bigint>(nextLen);
    for (let i = 0; i < nextLen; i++) {
      next[i] = hashChildren(level[2 * i], level[2 * i + 1]);
    }
    level = next;
    idx >>= 1;
  }
  if (level.length !== 1) throw new Error('Merkle fold incomplete');

  return cloneWitness({ leaf: new Uint8Array(targetLeaf), path });
}

/** Root field element for the same packing as {@link buildMerklePathWitness} (constructor `initialVoterRoot`). */
export function computeVoterRegistryRootField(
  authorizedLeaves: Uint8Array[],
  emptyLeaf: Uint8Array = new Uint8Array(32),
): bigint {
  if (authorizedLeaves.length > TREE_LEAF_COUNT) {
    throw new Error(`At most ${TREE_LEAF_COUNT} authorized leaves supported`);
  }
  const rawLeaves: Uint8Array[] = new Array(TREE_LEAF_COUNT);
  for (let i = 0; i < TREE_LEAF_COUNT; i++) {
    rawLeaves[i] = i < authorizedLeaves.length ? authorizedLeaves[i] : emptyLeaf;
  }
  let level: bigint[] = new Array(TREE_LEAF_COUNT);
  for (let i = 0; i < TREE_LEAF_COUNT; i++) {
    level[i] = leaf32ToMerkleField(rawLeaves[i]);
  }
  while (level.length > 1) {
    const nextLen = level.length >> 1;
    const next = new Array<bigint>(nextLen);
    for (let i = 0; i < nextLen; i++) {
      next[i] = hashChildren(level[2 * i], level[2 * i + 1]);
    }
    level = next;
  }
  return level[0];
}
