'use client';

import { MidnightWalletProvider } from '@/contexts/MidnightWalletContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { SupabaseSyncProvider } from '@/hooks/useSupabaseSync';
import { globalStyles } from '@/stitches.config';
import { useLayoutEffect } from 'react';

export function ClientRoot({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    globalStyles();
  }, []);
  return (
    <ToastProvider>
      <SupabaseSyncProvider>
        <MidnightWalletProvider>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              minWidth: 0,
              width: '100%',
            }}
          >
            {children}
          </div>
        </MidnightWalletProvider>
      </SupabaseSyncProvider>
    </ToastProvider>
  );
}
