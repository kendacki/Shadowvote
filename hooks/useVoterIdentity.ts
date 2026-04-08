'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'shadowvote.voterSecret.v1';
const SECRET_BYTES = 32;

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
  /** 32-byte secret for `voterSecret` witness; `null` before client hydration. */
  voterSecret: Uint8Array | null;
  /** True after localStorage has been read or a new secret persisted. */
  isReady: boolean;
  /** Regenerate secret (overwrites storage). */
  rotateSecret: () => void;
};

/**
 * Persistent local voter identity: one 32-byte secret stored as hex in `localStorage`.
 * Suitable for injection into Compact witness tuples `[context.privateState, voterSecret]`.
 */
export function useVoterIdentity(): VoterIdentityState {
  const [voterSecret, setVoterSecret] = useState<Uint8Array | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        setVoterSecret(hexToBytes(existing));
      } else {
        const fresh = generateSecret();
        localStorage.setItem(STORAGE_KEY, bytesToHex(fresh));
        setVoterSecret(fresh);
      }
    } catch {
      const fresh = generateSecret();
      try {
        localStorage.setItem(STORAGE_KEY, bytesToHex(fresh));
      } catch {
        /* private mode / quota */
      }
      setVoterSecret(fresh);
    } finally {
      setIsReady(true);
    }
  }, []);

  const rotateSecret = useCallback(() => {
    const fresh = generateSecret();
    try {
      localStorage.setItem(STORAGE_KEY, bytesToHex(fresh));
    } catch {
      /* ignore */
    }
    setVoterSecret(fresh);
  }, []);

  return { voterSecret, isReady, rotateSecret };
}
