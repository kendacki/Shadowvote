'use client';

/**
 * Browser wallet integration for Midnight Preprod.
 *
 * `WalletFacade` from `@midnight-ntwrk/wallet-sdk-facade` requires local Zswap/Dust secret keys
 * (`ShieldedWallet(...).startWithSecretKeys(...)`, etc.). Browser extensions (e.g. Lace) do not
 * expose those keys to dApps — connection is through the DApp Connector API (`window.midnight.*.connect`).
 *
 * This hook therefore:
 * - Connects via **Lace / DApp connector** (`ConnectedAPI`) for address + balances.
 * - Uses **RxJS** (`interval` + `switchMap`) to poll balances so the UI updates without manual refresh.
 *
 * For **headless** flows (Node deploy scripts), use `WalletFacade.init` with HD seed — see `scripts/utils.ts`.
 *
 * Witness tuples for contract calls remain: `[context.privateState, value]` when you wire `midnight-js` proofs.
 */

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  catchError,
  EMPTY,
  from,
  interval,
  of,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';

const NETWORK_ID = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK_ID ?? 'preprod';
const POLL_MS = 4000;

function getLaceConnector(): { connect: (networkId: string) => Promise<ConnectedAPI> } | null {
  if (typeof window === 'undefined') return null;
  const mid = window.midnight as Record<string, { connect?: (n: string) => Promise<ConnectedAPI> }> | undefined;
  if (!mid) return null;
  const lace = mid.lace ?? mid.Lace;
  if (lace?.connect) return lace as { connect: (n: string) => Promise<ConnectedAPI> };
  const first = Object.values(mid).find((w) => typeof w?.connect === 'function');
  return first ? (first as { connect: (n: string) => Promise<ConnectedAPI> }) : null;
}

/** Avoid importing `ledger-v8` in client code — it pulls WASM and breaks Next/webpack. */
function sumUnshieldedBalances(balances: Record<string, bigint>): bigint {
  const preferred = process.env.NEXT_PUBLIC_NIGHT_TOKEN_KEY;
  if (preferred && balances[preferred] !== undefined) return balances[preferred];
  return Object.values(balances).reduce((a, b) => a + b, 0n);
}

async function readWalletSnapshot(api: ConnectedAPI): Promise<{
  address: string;
  tNight: bigint;
}> {
  const [{ unshieldedAddress }, balances] = await Promise.all([
    api.getUnshieldedAddress(),
    api.getUnshieldedBalances(),
  ]);
  const tNight = sumUnshieldedBalances(balances);
  return { address: unshieldedAddress, tNight };
}

export type MidnightWalletState = {
  isLoading: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  unshieldedAddress: string | null;
  tNightBalance: bigint | null;
  /** Null in browser — use ConnectedAPI. Populated only in headless WalletFacade flows. */
  walletFacade: null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Active Lace session after `connect()`, if any. */
  getConnectedApi: () => ConnectedAPI | null;
};

export function useMidnightWallet(): MidnightWalletState {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unshieldedAddress, setUnshieldedAddress] = useState<string | null>(null);
  const [tNightBalance, setTNightBalance] = useState<bigint | null>(null);

  const apiRef = useRef<ConnectedAPI | null>(null);
  const pollSub = useRef<Subscription | null>(null);

  const stopPolling = useCallback(() => {
    pollSub.current?.unsubscribe();
    pollSub.current = null;
  }, []);

  const disconnect = useCallback(() => {
    stopPolling();
    apiRef.current = null;
    setIsConnected(false);
    setUnshieldedAddress(null);
    setTNightBalance(null);
    setError(null);
  }, [stopPolling]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const connector = getLaceConnector();
      if (!connector) {
        throw new Error(
          'No Midnight wallet found. Install Lace (or compatible) and refresh — window.midnight should expose connect().',
        );
      }
      const api = await connector.connect(NETWORK_ID);
      apiRef.current = api;
      await api.hintUsage?.(['getUnshieldedAddress', 'getUnshieldedBalances']);
      const snap = await readWalletSnapshot(api);
      setUnshieldedAddress(snap.address);
      setTNightBalance(snap.tNight);
      setIsConnected(true);

      stopPolling();
      pollSub.current = interval(POLL_MS)
        .pipe(
          startWith(0),
          switchMap(() =>
            apiRef.current
              ? from(readWalletSnapshot(apiRef.current)).pipe(
                  catchError((e: unknown) => {
                    setError(e instanceof Error ? e.message : 'Balance sync failed');
                    return EMPTY;
                  }),
                )
              : EMPTY,
          ),
        )
        .subscribe({
          next: (snap) => {
            setUnshieldedAddress(snap.address);
            setTNightBalance(snap.tNight);
            setError(null);
          },
        });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Connection failed');
      disconnect();
    } finally {
      setIsConnecting(false);
    }
  }, [disconnect, stopPolling]);

  useEffect(() => {
    const t = window.setTimeout(() => setIsBootstrapping(false), 700);
    return () => {
      window.clearTimeout(t);
      stopPolling();
    };
  }, [stopPolling]);

  const isLoading = isBootstrapping;

  const getConnectedApi = useCallback(() => apiRef.current, []);

  return {
    isLoading,
    isConnecting,
    isConnected,
    error,
    unshieldedAddress,
    tNightBalance,
    walletFacade: null,
    connect,
    disconnect,
    getConnectedApi,
  };
}
