'use client';

/**
 * Internal wallet state hook — mount once inside {@link MidnightWalletProvider} so Lace session
 * survives client-side navigation (each page used to call a fresh hook and looked “disconnected”).
 */

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  catchError,
  EMPTY,
  from,
  interval,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import { readUnshieldedTNightBalance } from '@/utils/tNightGate';

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

async function readWalletSnapshot(api: ConnectedAPI): Promise<{
  address: string;
  tNight: bigint;
}> {
  const { unshieldedAddress } = await api.getUnshieldedAddress();
  const tNight = await readUnshieldedTNightBalance(api);
  return { address: unshieldedAddress, tNight };
}

export type MidnightWalletState = {
  isLoading: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  unshieldedAddress: string | null;
  tNightBalance: bigint | null;
  walletFacade: null;
  connect: () => Promise<void>;
  disconnect: () => void;
  getConnectedApi: () => ConnectedAPI | null;
};

export function useMidnightWalletState(): MidnightWalletState {
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
