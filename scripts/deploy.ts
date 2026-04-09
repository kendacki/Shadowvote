import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as Rx from 'rxjs';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import type { FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import { getAuthorizedVoterLeaves } from '../lib/voterRegistry.js';
import { computeAdminCredential } from '../utils/adminCredential.js';
import { computeVoterRegistryRootField } from '../utils/merkle.js';
import { createWallet, createProviders, createDeployWitnessStubs, loadCompiledContract } from './utils.js';

function shadowvoteConstructorArgCountFromSource(): number {
  const src = fs.readFileSync(path.join(process.cwd(), 'contracts', 'shadowvote.compact'), 'utf8');
  const m = src.match(/constructor\s*\(([^)]*)\)\s*\{/);
  if (!m) return 1;
  const inner = m[1]!.trim();
  if (!inner) return 0;
  return inner.split(',').map((s) => s.trim()).filter(Boolean).length;
}

/** Matches `initialState` arity in `build/contract/index.js` (= constructorContext + ctor args). */
function shadowvoteCtorParamCountFromBuild(): number {
  const p = path.join(process.cwd(), 'build', 'contract', 'index.js');
  if (!fs.existsSync(p)) {
    throw new Error('Missing build/contract/index.js — run npm run compile:contract first.');
  }
  const txt = fs.readFileSync(p, 'utf8');
  const m = txt.match(/initialState\(\.\.\.args_0\)\s*\{\s*if\s*\(args_0\.length !== (\d+)\)/);
  if (!m) {
    throw new Error('Could not parse constructor arity from build/contract/index.js');
  }
  return Number(m[1]) - 1;
}

function resolveAdminPreimage(seedHex: string): Uint8Array {
  const envHex = process.env.SHADOWVOTE_ADMIN_PREIMAGE_HEX?.trim();
  if (envHex) {
    const normalized = envHex.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
      throw new Error('SHADOWVOTE_ADMIN_PREIMAGE_HEX must be exactly 64 hex characters');
    }
    return new Uint8Array(Buffer.from(normalized, 'hex'));
  }
  return new Uint8Array(crypto.createHash('sha256').update(Buffer.from(seedHex, 'hex')).digest());
}

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

  const stubWitnesses = createDeployWitnessStubs();
  const correctWitnesses: Record<string, (context: { state: unknown }) => unknown> = {
    voterSecret: (context) => stubWitnesses.voterSecret(context as never),
    voterMembershipPath: (context) => stubWitnesses.voterMembershipPath(context as never),
  };
  if ('adminPreimage' in stubWitnesses) {
    correctWitnesses.adminPreimage = (context) =>
      stubWitnesses.adminPreimage!(context as never);
  }

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

  const ctorArity = shadowvoteCtorParamCountFromBuild();
  const sourceArity = shadowvoteConstructorArgCountFromSource();
  if (ctorArity !== sourceArity) {
    console.warn(
      `[deploy] contracts/shadowvote.compact declares ${String(sourceArity)} constructor parameter(s) but build/contract reflects ${String(
        ctorArity,
      )}. Re-run npm run compile:contract so deploy matches the Compact source.`,
    );
  }

  const deployArgs =
    ctorArity >= 2
      ? (() => {
          const adminPre = resolveAdminPreimage(seedHex);
          const cred = computeAdminCredential(adminPre);
          console.log(
            'Admin credential committed on-chain. Use the same admin preimage when calling update_voter_root (SHADOWVOTE_ADMIN_PREIMAGE_HEX or seed-derived default printed in deployment.json).',
          );
          return [{ field: voterRootField }, cred];
        })()
      : [{ field: voterRootField }];

  try {
    const deployed = await deployContract(deploymentProviders as never, {
      compiledContract: cleanCompiledContract,
      privateStateId: 'shadowvote-state',
      initialPrivateState: {},
      args: deployArgs as never,
    } as never);

    console.log('\n--- Deployment succeeded ---');
    console.log(`Contract address: ${deployed.deployTxData.public.contractAddress}`);
    console.log('----------------------------\n');

    const deploymentRecord: Record<string, string | number> = {
      address: deployed.deployTxData.public.contractAddress,
      network: 'preprod',
      deployedAt: new Date().toISOString(),
      voterRootField: voterRootField.toString(),
      voterRegistryLeafCount: authorizedLeaves.length,
    };
    if (ctorArity >= 2) {
      const p = resolveAdminPreimage(seedHex);
      deploymentRecord.adminCredentialHex = Buffer.from(computeAdminCredential(p)).toString('hex');
      deploymentRecord.adminPreimageSource = process.env.SHADOWVOTE_ADMIN_PREIMAGE_HEX ? 'env' : 'sha256(seed)';
    }

    fs.writeFileSync(path.join(process.cwd(), 'deployment.json'), JSON.stringify(deploymentRecord, null, 2));
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
