import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as util from 'node:util';
import * as Rx from 'rxjs';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import type { FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import {
  CONFIG,
  createWallet,
  createProviders,
  createDeployWitnessStubs,
  loadCompiledContract,
} from './utils.js';

/** TCP check — proof server often exits with a generic SDK message if this is down. */
function assertProofServerListening(proofUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(proofUrl);
  } catch {
    return Promise.reject(new Error(`Invalid PROOF_SERVER_URL: ${proofUrl}`));
  }
  const host = u.hostname;
  const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const socket = net.createConnection({ host, port }, () => {
      if (settled) return;
      settled = true;
      clearTimeout(to);
      socket.end();
      resolve();
    });
    const to = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error('connection timed out'));
    }, 10_000);
    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(to);
      reject(err);
    });
  }).catch((err: NodeJS.ErrnoException) => {
    const code = err.code ?? err.message;
    throw new Error(
      `Proof server not accepting TCP connections at ${proofUrl} (${code}).\n` +
        `Start Docker, then from the project root run:\n` +
        `  npm run start-proof-server\n` +
        `Ensure PROOF_SERVER_URL in .env matches (default http://127.0.0.1:6300).`,
    );
  });
}

function logDeployError(e: unknown): void {
  if (e instanceof Error) {
    console.error(e.message);
    if (e.stack) console.error(e.stack);
    if (e.cause !== undefined) {
      console.error('Caused by:');
      logDeployError(e.cause);
      return;
    }
  }
  try {
    console.error(util.inspect(e, { depth: 6, colors: false }));
  } catch {
    console.error(String(e));
  }
}

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

/** Open DAO source has no Merkle path witness; a stale `build/` still expects `voterMembershipPath`. */
function assertBuildMatchesCompact(contractJs: string): void {
  if (contractJs.includes('voterMembershipPath')) {
    throw new Error(
      'build/contract is OUT OF DATE (still the old Merkle contract).\n' +
        'Run this from the project root (with compactc on PATH), then deploy again:\n' +
        '  npm run compile:contract\n' +
        '  npm run zk:public\n',
    );
  }
}

async function main(): Promise<void> {
  console.log('\nShadowVote — deployment (Open DAO)\n');

  const seedHex = process.env.MIDNIGHT_SEED_HEX;
  if (!seedHex) {
    throw new Error('Missing MIDNIGHT_SEED_HEX in environment');
  }

  const walletCtx = await createWallet(seedHex);

  try {
    console.log('Syncing wallet...');
    const state = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(Rx.filter((s): s is FacadeState => s.isSynced)),
    );

    console.log(`Address: ${walletCtx.unshieldedKeystore.getBech32Address()}`);
    console.log(`Balance: ${state.unshielded.balances[unshieldedToken().raw] ?? 0n} tNight`);

    console.log('Loading contract from build output...');
    const contractPath = path.join(process.cwd(), 'build', 'contract', 'index.js');
    assertBuildMatchesCompact(fs.readFileSync(contractPath, 'utf8'));
    const mod = await import(pathToFileURL(contractPath).href);

    const cleanCompiledContract = await loadCompiledContract();
    (cleanCompiledContract as { contractClass?: unknown }).contractClass = mod.Contract;

    const baseProviders = await createProviders(walletCtx);

    const stubWitnesses = createDeployWitnessStubs();
    const correctWitnesses: Record<string, (context: { state: unknown }) => unknown> = {
      voterSecret: (context) => stubWitnesses.voterSecret(context as never),
    };

    const deploymentProviders = {
      ...baseProviders,
      ...correctWitnesses,
      witnesses: correctWitnesses,
    };

    console.log('Deploying contract (ZK proofs)...');
    await assertProofServerListening(CONFIG.proofServer);

    const ctorArity = shadowvoteCtorParamCountFromBuild();
    const sourceArity = shadowvoteConstructorArgCountFromSource();
    if (ctorArity !== sourceArity) {
      throw new Error(
        `contracts/shadowvote.compact has ${String(sourceArity)} constructor parameter(s) but build/contract expects ${String(
          ctorArity,
        )}.\nRun: npm run compile:contract\nThen: npm run zk:public`,
      );
    }

    const deployArgs: unknown[] = [];

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
      model: 'open-dao',
    };

    fs.writeFileSync(path.join(process.cwd(), 'deployment.json'), JSON.stringify(deploymentRecord, null, 2));
  } finally {
    await walletCtx.wallet.stop();
  }
}

function looksLikeIndexerOpaqueFailure(err: unknown): boolean {
  const from = (e: unknown): string =>
    e instanceof Error ? `${e.message} ${e.stack ?? ''}` : String(e);
  let cur: unknown = err;
  for (let i = 0; i < 6 && cur != null; i++) {
    if (from(cur).includes('An unknown error occurred')) return true;
    cur = cur instanceof Error ? cur.cause : null;
  }
  return false;
}

main().catch((err) => {
  console.error('\nDeployment failed:');
  logDeployError(err);
  if (looksLikeIndexerOpaqueFailure(err)) {
    console.error(
      '\nThis usually means the wallet’s indexer HTTP client got a response without a status line (Preprod flake, proxy, or firewall).\n' +
        'Retry in a few minutes; confirm MIDNIGHT_INDEXER_HTTPS / MIDNIGHT_INDEXER_WSS match Preprod. RPC WebSocket "Normal Closure" lines are often harmless.\n',
    );
  }
  process.exit(1);
});
