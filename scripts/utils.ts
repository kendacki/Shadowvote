/**
 * Wallet, indexer, proof, and ZK config wiring for ShadowVote.
 * FULL PROVIDER SUITE: Required for shielded contract deployment.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  DEFAULT_CONFIG,
  levelPrivateStateProvider,
} from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';

// @ts-expect-error Required for wallet sync in Node
globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, '..');
export const zkConfigPath = path.join(projectRoot, 'build');

setNetworkId((process.env.MIDNIGHT_NETWORK_ID ?? 'preprod').trim());

export const CONFIG = {
  indexer: process.env.MIDNIGHT_INDEXER_HTTPS ?? 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: process.env.MIDNIGHT_INDEXER_WSS ?? 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: process.env.MIDNIGHT_NODE_RPC ?? 'https://rpc.preprod.midnight.network',
  proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
};

/**
 * Deploy-time witness stub for Open DAO ShadowVote (only `voterSecret` is private input).
 */
export function createDeployWitnessStubs() {
  const zero32 = new Uint8Array(32);
  return {
    voterSecret: (ctx: WitnessContext<unknown, unknown>): [unknown, Uint8Array] => [
      ctx.privateState,
      zero32,
    ],
  };
}

export async function loadCompiledContract() {
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  const mod = await import(pathToFileURL(contractPath).href);
  return CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses(
      CompiledContract.make('shadowvote', mod.Contract),
      createDeployWitnessStubs() as never,
    ) as never,
    zkConfigPath as never,
  ) as import('@midnight-ntwrk/compact-js').CompiledContract.CompiledContract<never, never, never>;
}

export function deriveKeys(seedHex: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seedHex, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  return result.keys;
}

export async function createWallet(seedHex: string) {
  const keys = deriveKeys(seedHex);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());
  const cfg = {
    networkId: getNetworkId(),
    indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
    provingServerUrl: new URL(CONFIG.proofServer),
    relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
  };

  const wallet = await WalletFacade.init({
    configuration: cfg as never,
    shielded: async () => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: async () => UnshieldedWallet({
        networkId: cfg.networkId,
        indexerClientConnection: cfg.indexerClientConnection,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(),
      }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: async () => DustWallet({ ...cfg, costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 } })
        .startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });

  await wallet.start(shieldedSecretKeys, dustSecretKey);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

export function signTransactionIntents(
  tx: { intents?: Map<number, unknown> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >('signature', proofMarker, 'pre-binding', (intent as { serialize(): Uint8Array }).serialize());
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: unknown, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: unknown, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
}

export async function createProviders(walletCtx: Awaited<ReturnType<typeof createWallet>>) {
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s): s is FacadeState => s.isSynced)));
  
  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx as never),
    balanceTx: async (tx: any, ttl?: Date) => {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
      );
      const signFn = (p: Uint8Array) => walletCtx.unshieldedKeystore.signData(p);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }
      return walletCtx.wallet.finalizeRecipe(recipe);
    }
  };

  const zkConfigProvider = new NodeZkConfigProvider<'vote'>(zkConfigPath);
  
  return {
    privateStateProvider: levelPrivateStateProvider({
      ...DEFAULT_CONFIG,
      privateStateStoreName: 'shadowvote-ps',
      midnightDbName: 'shadowvote-db',
      privateStoragePasswordProvider: async () => 'shadowvote-local-dev-password-min-16chars',
      accountId: String(walletCtx.unshieldedKeystore.getBech32Address()), 
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider, // Duplicate for SDK compatibility
  };
}