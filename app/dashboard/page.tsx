'use client';

import dynamic from 'next/dynamic';

/**
 * Thin client-only shell: heavy Midnight bindings load only in the browser.
 * Dashboard UX (identity, toasts, create-proposal modal, votes) lives in `./DashboardClient.tsx`.
 */
const DashboardClient = dynamic(() => import('./DashboardClient'), {
  ssr: false,
  loading: () => null,
});

export default function DashboardPage() {
  return <DashboardClient />;
}
