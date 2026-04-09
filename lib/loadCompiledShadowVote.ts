import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

/**
 * Loads the Compact build and attaches the `voterSecret` witness (for nullifier derivation).
 */
export async function loadCompiledShadowVoteContract(
  voterSecret: Uint8Array,
): Promise<
  CompiledContract.CompiledContract<import('@shadowvote/contract').Contract, Record<string, never>, never>
> {
  if (voterSecret.length !== 32) {
    throw new Error('voterSecret must be 32 bytes');
  }
  const secretCopy = new Uint8Array(voterSecret);

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
      secretCopy,
    ],
  };

  return CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses(CompiledContract.make('shadowvote', mod.Contract), witnesses as never) as never,
    pathForAssets as never,
  ) as CompiledContract.CompiledContract<import('@shadowvote/contract').Contract, Record<string, never>, never>;
}
