import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { createProofProvider, type PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { ContractProviders } from '@midnight-ntwrk/midnight-js-contracts';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import type { MidnightProviders, UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import {
  MidnightBech32m,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { Buffer } from 'buffer';
import { HttpZkConfigProvider } from '@/lib/httpZkConfigProvider';

const NETWORK_ID = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK_ID ?? 'preprod';

function zkAssetsBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SHADOWVOTE_ZK_BASE?.trim();
  if (env?.startsWith('http')) return env.replace(/\/$/, '');
  const path = env && env.length > 0 ? env : '/shadowvote-zk';
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`.replace(/\/$/, '');
}

/**
 * HTTPS pages cannot fetch http:// provers (mixed content). Localhost from Vercel is never reachable.
 */
function assertProverUrlWorksInBrowser(proverUrl: string): void {
  if (typeof window === 'undefined') return;
  let u: URL;
  try {
    u = new URL(proverUrl);
  } catch {
    throw new Error(`Invalid prover URL: ${proverUrl}`);
  }
  const pageHttps = window.location.protocol === 'https:';
  if (pageHttps && u.protocol === 'http:') {
    const loopback = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    throw new Error(
      loopback
        ? 'Proof server is HTTP on localhost — it is not reachable from this HTTPS site (and not from other devices). ' +
            'Set NEXT_PUBLIC_MIDNIGHT_PROVER_SERVER_URI in Vercel to a public HTTPS Midnight prover, ' +
            'or test voting from http://localhost:3000 with Docker proof-server on your machine.'
        : 'Proof server URL uses HTTP but this page is HTTPS; the browser blocks that request (mixed content). ' +
            'Use an HTTPS prover in NEXT_PUBLIC_MIDNIGHT_PROVER_SERVER_URI.',
    );
  }
}

function requirePrivateStatePassword(): string {
  const p = process.env.NEXT_PUBLIC_MIDNIGHT_PRIVATE_STATE_PASSWORD?.trim();
  if (!p || p.length < 16) {
    throw new Error(
      'Set NEXT_PUBLIC_MIDNIGHT_PRIVATE_STATE_PASSWORD (min 16 characters) for local private state storage.',
    );
  }
  return p;
}

let shieldedKeysCache: { coinHex: string; encHex: string } | null = null;

const HEX32 = /^(?:0x)?([0-9a-fA-F]{64})$/;

/**
 * Lace may return shielded keys as bech32m or as raw 32-byte hex. Bech32 decoding hex fails with
 * `Unknown letter: "b"` (hex charset is not a bech32 alphabet).
 */
function shieldedCoinPublicKeyToHex(value: string): string {
  const trimmed = value.trim();
  const hexM = HEX32.exec(trimmed);
  if (hexM) {
    return ShieldedCoinPublicKey.fromHexString(hexM[1]!).toHexString();
  }
  return ShieldedCoinPublicKey.codec.decode(NETWORK_ID, MidnightBech32m.parse(trimmed)).toHexString();
}

/**
 * Indexer + WS only — no wallet proving hooks. Use for live proposal sync when the connector
 * omits {@link ConnectedAPI.getProvingProvider} (some Lace builds).
 */
export async function createShadowVotePublicDataProvider(
  api: ConnectedAPI,
): Promise<{ publicDataProvider: PublicDataProvider }> {
  const cfg = await api.getConfiguration();
  return {
    publicDataProvider: indexerPublicDataProvider(
      cfg.indexerUri,
      cfg.indexerWsUri,
      typeof globalThis.WebSocket === 'function'
        ? (globalThis.WebSocket as unknown as Parameters<typeof indexerPublicDataProvider>[2])
        : undefined,
    ),
  };
}

function shieldedEncryptionPublicKeyToHex(value: string): string {
  const trimmed = value.trim();
  const hexM = HEX32.exec(trimmed);
  if (hexM) {
    return ShieldedEncryptionPublicKey.fromHexString(hexM[1]!).toHexString();
  }
  return ShieldedEncryptionPublicKey.codec.decode(NETWORK_ID, MidnightBech32m.parse(trimmed)).toHexString();
}

async function getShieldedKeyMaterial(api: ConnectedAPI): Promise<{ coinHex: string; encHex: string }> {
  if (shieldedKeysCache) return shieldedKeysCache;
  await api.hintUsage?.([
    'getConfiguration',
    'getShieldedAddresses',
    'getUnshieldedAddress',
    'getProvingProvider',
    'balanceUnsealedTransaction',
    'submitTransaction',
  ]);
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await api.getShieldedAddresses();
  const coinHex = shieldedCoinPublicKeyToHex(shieldedCoinPublicKey);
  const encHex = shieldedEncryptionPublicKeyToHex(shieldedEncryptionPublicKey);
  shieldedKeysCache = { coinHex, encHex };
  return shieldedKeysCache;
}

function createLaceWalletAndMidnight(
  api: ConnectedAPI,
  coinHex: string,
  encHex: string,
): {
  walletProvider: MidnightProviders['walletProvider'];
  midnightProvider: MidnightProviders['midnightProvider'];
} {
  const walletProvider = {
    getCoinPublicKey: () => coinHex,
    getEncryptionPublicKey: () => encHex,
    balanceTx: async (tx: UnboundTransaction, _ttl?: Date): Promise<FinalizedTransaction> => {
      const ledger = await import('@midnight-ntwrk/ledger-v8');
      const serialized = Buffer.from(tx.serialize()).toString('hex');
      const { tx: balancedHex } = await api.balanceUnsealedTransaction(serialized, { payFees: true });
      return ledger.Transaction.deserialize(
        'signature',
        'proof',
        'binding',
        Uint8Array.from(Buffer.from(balancedHex, 'hex')),
      ) as FinalizedTransaction;
    },
  } as MidnightProviders['walletProvider'];

  const midnightProvider: MidnightProviders['midnightProvider'] = {
    submitTx: async (tx: FinalizedTransaction) => {
      const hex = Buffer.from(tx.serialize()).toString('hex');
      await api.submitTransaction(hex);
      return tx.identifiers()[0];
    },
  };

  return { walletProvider, midnightProvider };
}

export type ShadowVoteCircuitId = 'vote';

/**
 * Builds full {@link ContractProviders} for ShadowVote using wallet services from Lace.
 */
export async function createShadowVoteProviders(
  api: ConnectedAPI,
): Promise<ContractProviders<import('@midnight-ntwrk/compact-js/effect/Contract').Contract.Any, ShadowVoteCircuitId>> {
  if (typeof window === 'undefined') {
    throw new Error('createShadowVoteProviders is browser-only (Lace + IndexedDB private state).');
  }

  const { DEFAULT_CONFIG, levelPrivateStateProvider } = await import(
    '@midnight-ntwrk/midnight-js-level-private-state-provider'
  );

  shieldedKeysCache = null;
  const cfg = await api.getConfiguration();
  const publicDataProvider = indexerPublicDataProvider(
    cfg.indexerUri,
    cfg.indexerWsUri,
    typeof globalThis.WebSocket === 'function'
      ? (globalThis.WebSocket as unknown as Parameters<typeof indexerPublicDataProvider>[2])
      : undefined,
  );

  const zkBase = zkAssetsBaseUrl();
  const zkConfigProvider = new HttpZkConfigProvider<ShadowVoteCircuitId>(zkBase);

  const { coinHex, encHex } = await getShieldedKeyMaterial(api);
  const { walletProvider, midnightProvider } = createLaceWalletAndMidnight(api, coinHex, encHex);

  const proofProvider =
    typeof api.getProvingProvider === 'function'
      ? createProofProvider(await api.getProvingProvider(zkConfigProvider.asKeyMaterialProvider()))
      : (() => {
          /** Prefer env so production can override Lace getConfiguration() pointing at localhost. */
          const proverUrl =
            (process.env.NEXT_PUBLIC_MIDNIGHT_PROVER_SERVER_URI?.trim() ?? '').replace(/\/$/, '') ||
            cfg.proverServerUri?.replace(/\/$/, '') ||
            '';
          if (!proverUrl) {
            throw new Error(
              'Wallet does not expose getProvingProvider. Set NEXT_PUBLIC_MIDNIGHT_PROVER_SERVER_URI to your Midnight proof server URL to submit votes.',
            );
          }
          assertProverUrlWorksInBrowser(proverUrl);
          return httpClientProofProvider(proverUrl, zkConfigProvider);
        })();

  const { unshieldedAddress: accountBech32 } = await api.getUnshieldedAddress();

  const privateStateProvider = levelPrivateStateProvider({
    ...DEFAULT_CONFIG,
    privateStateStoreName: 'shadowvote-ps',
    midnightDbName: 'shadowvote-db',
    privateStoragePasswordProvider: async () => requirePrivateStatePassword(),
    accountId: accountBech32,
  });

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
}
