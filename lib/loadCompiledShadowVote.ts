import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

/**
 * Merkle-era `build/contract` requires `voterMembershipPath`; Open DAO only has `voterSecret`.
 * Detect mismatch before ZK/prove with a confusing CompactError.
 */
/** Uses `any` so generated Compact `Contract` constructors (generic Witnesses) are assignable. */
function assertOpenDaoContractClass(Contract: new (witnesses: any) => any): void {
  const voterSecretStub = (): [Record<string, never>, Uint8Array] => [{}, new Uint8Array(32)];
  try {
    new Contract({ voterSecret: voterSecretStub });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('voterMembershipPath')) {
      throw new Error(
        'CACHE MISMATCH ERROR: Next.js is serving the old Merkle contract. Please run: rm -rf .next && npm run compile:contract' +
          ' && npm run zk:public (then npm run dev). On Windows PowerShell use: Remove-Item -Recurse -Force .next',
      );
    }
    throw e;
  }
}

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
  assertOpenDaoContractClass(mod.Contract);

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
