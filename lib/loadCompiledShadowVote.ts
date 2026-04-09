import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { MembershipPathWitness } from '../utils/merkle';

/**
 * Loads the Compact build and attaches vote witnesses using the persistent **voter secret**
 * and a **precomputed** depth-20 Merkle membership path for `voterMembershipPath`.
 *
 * Witness tuples follow `[context.privateState, value]`.
 *
 * @param voterSecret - 32-byte secret (copied internally; caller may retain the original).
 * @param membershipPath - Must match on-chain `voterRoot` under `merkleTreePathRoot` and satisfy
 *   `path.leaf == voterLeafHash(voterSecret)`.
 */
export async function loadCompiledShadowVoteContract(
  voterSecret: Uint8Array,
  membershipPath: MembershipPathWitness,
): Promise<
  CompiledContract.CompiledContract<import('@shadowvote/contract').Contract, Record<string, never>, never>
> {
  if (voterSecret.length !== 32) {
    throw new Error('voterSecret must be 32 bytes');
  }
  if (membershipPath.path.length !== 20) {
    throw new Error('membershipPath.path must contain 20 Merkle levels');
  }
  const secretCopy = new Uint8Array(voterSecret);
  const pathSnapshot: MembershipPathWitness = {
    leaf: new Uint8Array(membershipPath.leaf),
    path: membershipPath.path.map((e) => ({
      sibling: { field: e.sibling.field },
      goes_left: e.goes_left,
    })),
  };

  const mod = await import('@shadowvote/contract');

  const pathForAssets =
    typeof window !== 'undefined'
      ? `${window.location.origin}${(process.env.NEXT_PUBLIC_SHADOWVOTE_ZK_BASE ?? '/shadowvote-zk').replace(
          /^\/?/,
          '/',
        )}`.replace(/\/$/, '')
      : (process.env.NEXT_PUBLIC_SHADOWVOTE_ZK_BASE ?? '/shadowvote-zk');

  const zero32 = new Uint8Array(32);
  const witnesses: {
    voterSecret: (
      ctx: WitnessContext<unknown, Record<string, never>>,
    ) => [Record<string, never>, Uint8Array];
    voterMembershipPath: (
      ctx: WitnessContext<unknown, Record<string, never>>,
    ) => [
      Record<string, never>,
      { leaf: Uint8Array; path: { sibling: { field: bigint }; goes_left: boolean }[] },
    ];
    adminPreimage?: (
      ctx: WitnessContext<unknown, Record<string, never>>,
    ) => [Record<string, never>, Uint8Array];
  } = {
    voterSecret: (ctx) => [ctx.privateState, secretCopy],
    voterMembershipPath: (ctx) => [ctx.privateState, pathSnapshot],
    adminPreimage: (ctx) => [ctx.privateState, zero32],
  };

  return CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses(CompiledContract.make('shadowvote', mod.Contract), witnesses as never) as never,
    pathForAssets as never,
  ) as CompiledContract.CompiledContract<import('@shadowvote/contract').Contract, Record<string, never>, never>;
}
