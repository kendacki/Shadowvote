'use client';

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCallback, useEffect, useState } from 'react';
import {
  assertMinGovernanceBalance,
  GOVERNANCE_MIN_TNIGHT,
  isInsufficientGovernanceError,
} from '@/utils/tNightGate';

const STORAGE_KEY = 'shadowvote.voterSecret.v1';
const SECRET_BYTES = 32;

export type VoterIdentityGateOpts = {
  isWalletConnected: boolean;
  /** From Lace balance polling; null while unknown. */
  tNightBalance: bigint | null;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]*$/.test(normalized) || normalized.length !== SECRET_BYTES * 2) {
    throw new Error('Invalid voter secret hex in storage');
  }
  const out = new Uint8Array(SECRET_BYTES);
  for (let i = 0; i < SECRET_BYTES; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function generateSecret(): Uint8Array {
  const secret = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(secret);
  return secret;
}

export type VoterIdentityState = {
  voterSecret: Uint8Array | null;
  isReady: boolean;
  /**
   * No persisted secret yet, wallet connected, and balance is below the governance minimum.
   */
  blockedByFundThreshold: boolean;
  rotateSecret: () => Promise<void>;
};

/**
 * Persistent local voter identity. New secrets are created only after a wallet session meets the
 * governance tNIGHT threshold (same as voting). Existing `localStorage` secrets are always loaded.
 */
export function useVoterIdentity(
  connectedApi: ConnectedAPI | null,
  opts: VoterIdentityGateOpts,
): VoterIdentityState {
  const [voterSecret, setVoterSecret] = useState<Uint8Array | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [blockedByFundThreshold, setBlockedByFundThreshold] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setBlockedByFundThreshold(false);
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing) {
          setVoterSecret(hexToBytes(existing));
          return;
        }

        if (!opts.isWalletConnected || !connectedApi) {
          setVoterSecret(null);
          return;
        }

        if (opts.tNightBalance === null) {
          setVoterSecret(null);
          return;
        }

        if (opts.tNightBalance < GOVERNANCE_MIN_TNIGHT) {
          setVoterSecret(null);
          setBlockedByFundThreshold(true);
          return;
        }

        await assertMinGovernanceBalance(connectedApi);
        if (cancelled) return;

        const fresh = generateSecret();
        localStorage.setItem(STORAGE_KEY, bytesToHex(fresh));
        setVoterSecret(fresh);
      } catch (e: unknown) {
        if (cancelled) return;
        if (isInsufficientGovernanceError(e)) {
          setVoterSecret(null);
          setBlockedByFundThreshold(true);
          return;
        }
        setVoterSecret(null);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [connectedApi, opts.isWalletConnected, opts.tNightBalance]);

  const rotateSecret = useCallback(async () => {
    if (!connectedApi) {
      throw new Error('Connect your wallet before rotating voter identity.');
    }
    await assertMinGovernanceBalance(connectedApi);
    const fresh = generateSecret();
    try {
      localStorage.setItem(STORAGE_KEY, bytesToHex(fresh));
    } catch {
      /* ignore */
    }
    setVoterSecret(fresh);
    setBlockedByFundThreshold(false);
  }, [connectedApi]);

  return { voterSecret, isReady, blockedByFundThreshold, rotateSecret };
}
