import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

/**
 * Compiled contract + witnesses for `update_voter_root` (admin preimage real; vote witnesses stubbed).
 */
export async function loadCompiledShadowVoteAdminContract(
  adminPreimage: Uint8Array,
): Promise<
  CompiledContract.CompiledContract<import('@shadowvote/contract').Contract, Record<string, never>, never>
> {
  if (adminPreimage.length !== 32) {
    throw new Error('adminPreimage must be 32 bytes');
  }
  const zero32 = new Uint8Array(32);
  const emptyMembershipPath = {
    leaf: zero32,
    path: Array.from({ length: 20 }, () => ({ sibling: { field: 0n }, goes_left: false })),
  };
  const preimageCopy = new Uint8Array(adminPreimage);

  const mod = await import('@shadowvote/contract');

  const pathForAssets =
    typeof window !== 'undefined'
      ? `${window.location.origin}${(process.env.NEXT_PUBLIC_SHADOWVOTE_ZK_BASE ?? '/shadowvote-zk').replace(
          /^\/?/,
          '/',
        )}`.replace(/\/$/, '')
      : (process.env.NEXT_PUBLIC_SHADOWVOTE_ZK_BASE ?? '/shadowvote-zk');

  const witnesses = {
    voterSecret: (ctx: WitnessContext<unknown, Record<string, never>>): [Record<string, never>, Uint8Array] => [
      ctx.privateState,
      zero32,
    ],
    voterMembershipPath: (
      ctx: WitnessContext<unknown, Record<string, never>>,
    ): [
      Record<string, never>,
      { leaf: Uint8Array; path: { sibling: { field: bigint }; goes_left: boolean }[] },
    ] => [ctx.privateState, emptyMembershipPath],
    adminPreimage: (ctx: WitnessContext<unknown, Record<string, never>>): [Record<string, never>, Uint8Array] => [
      ctx.privateState,
      preimageCopy,
    ],
  };

  return CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses(CompiledContract.make('shadowvote', mod.Contract), witnesses as never) as never,
    pathForAssets as never,
  ) as CompiledContract.CompiledContract<import('@shadowvote/contract').Contract, Record<string, never>, never>;
}
