'use client';

import { TopNav } from '@/components/TopNav';
import { MidnightWalletProvider } from '@/contexts/MidnightWalletContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { globalStyles, styled } from '@/stitches.config';
import { useLayoutEffect } from 'react';

/** Clears sticky TopNav (72px) so headings never collide; generous air below the bar. */
const MainContentOffset = styled('div', {
  marginTop: '80px',
  width: '100%',
});

export function ClientRoot({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    globalStyles();
  }, []);
  return (
    <ToastProvider>
      <MidnightWalletProvider>
        <TopNav />
        <MainContentOffset>{children}</MainContentOffset>
      </MidnightWalletProvider>
    </ToastProvider>
  );
}
