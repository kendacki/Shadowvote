import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as Rx from 'rxjs';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import type { FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import { getAuthorizedVoterLeaves } from '../lib/voterRegistry.js';
import { computeVoterRegistryRootField } from '../utils/merkle.js';
import { createWallet, createProviders, loadCompiledContract } from './utils.js';

async function main(): Promise<void> {
  console.log('\nShadowVote — deployment\n');

  const seedHex = process.env.MIDNIGHT_SEED_HEX;
  if (!seedHex) {
    throw new Error('Missing MIDNIGHT_SEED_HEX in environment');
  }

  const walletCtx = await createWallet(seedHex);

  console.log('Syncing wallet...');
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(Rx.filter((s): s is FacadeState => s.isSynced)),
  );

  console.log(`Address: ${walletCtx.unshieldedKeystore.getBech32Address()}`);
  console.log(`Balance: ${state.unshielded.balances[unshieldedToken().raw] ?? 0n} tNight`);

  console.log('Loading contract from build output...');
  const contractPath = path.join(process.cwd(), 'build', 'contract', 'index.js');
  const mod = await import(pathToFileURL(contractPath).href);

  const cleanCompiledContract = await loadCompiledContract();
  (cleanCompiledContract as { contractClass?: unknown }).contractClass = mod.Contract;

  const correctWitnesses = {
    voterSecret: (context: { state: unknown }) => [context.state, new Uint8Array(32).fill(0)],
    voterMembershipPath: (context: { state: unknown }) => [
      context.state,
      {
        leaf: new Uint8Array(32).fill(0),
        path: Array.from({ length: 20 }, () => ({ sibling: { field: 0n }, goes_left: false })),
      },
    ],
  };

  const baseProviders = await createProviders(walletCtx);

  const deploymentProviders = {
    ...baseProviders,
    ...correctWitnesses,
    witnesses: correctWitnesses,
  };

  const authorizedLeaves = getAuthorizedVoterLeaves();
  const voterRootField = computeVoterRegistryRootField(authorizedLeaves);
  console.log(
    `Merkle voter registry: ${authorizedLeaves.length} packed leaf(es); constructor voterRoot.field = ${voterRootField}`,
  );
  console.log('Registry: config/voter-registry.json (deploy and app use the same Merkle leaves).');

  console.log('Deploying contract (ZK proofs)...');

  try {
    const deployed = await deployContract(deploymentProviders as never, {
      compiledContract: cleanCompiledContract,
      privateStateId: 'shadowvote-state',
      initialPrivateState: {},
      args: [{ field: voterRootField }],
    } as never);

    console.log('\n--- Deployment succeeded ---');
    console.log(`Contract address: ${deployed.deployTxData.public.contractAddress}`);
    console.log('----------------------------\n');

    fs.writeFileSync(
      path.join(process.cwd(), 'deployment.json'),
      JSON.stringify(
        {
          address: deployed.deployTxData.public.contractAddress,
          network: 'preprod',
          deployedAt: new Date().toISOString(),
          voterRootField: voterRootField.toString(),
          voterRegistryLeafCount: authorizedLeaves.length,
        },
        null,
        2,
      ),
    );
  } catch (e: unknown) {
    console.error('\nDeployment failed:');
    console.error(e instanceof Error ? e.message : e);
  } finally {
    await walletCtx.wallet.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
