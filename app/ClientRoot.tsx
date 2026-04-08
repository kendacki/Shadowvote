'use client';

import { ToastProvider } from '@/contexts/ToastContext';
import { globalStyles } from '@/stitches.config';
import { useLayoutEffect } from 'react';

export function ClientRoot({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    globalStyles();
  }, []);
  return <ToastProvider>{children}</ToastProvider>;
}
