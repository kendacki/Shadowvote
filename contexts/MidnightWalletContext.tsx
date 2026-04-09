'use client';

import { useMidnightWalletState, type MidnightWalletState } from '@/hooks/useMidnightWalletState';
import { createContext, useContext, type ReactNode } from 'react';

const MidnightWalletContext = createContext<MidnightWalletState | null>(null);

export function MidnightWalletProvider({ children }: { children: ReactNode }) {
  const value = useMidnightWalletState();
  return <MidnightWalletContext.Provider value={value}>{children}</MidnightWalletContext.Provider>;
}

export function useMidnightWallet(): MidnightWalletState {
  const ctx = useContext(MidnightWalletContext);
  if (ctx == null) {
    throw new Error('useMidnightWallet must be used within MidnightWalletProvider.');
  }
  return ctx;
}

export type { MidnightWalletState };
