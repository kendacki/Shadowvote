'use client';

import { TopNav } from '@/components/TopNav';

/** White nav + wallet chrome only for app routes; marketing `/` stays dark-only. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
