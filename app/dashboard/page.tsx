'use client';

import { LoadingScreen } from '@/components/LoadingScreen';
import dynamic from 'next/dynamic';

/**
 * Heavy Midnight bindings load only in the browser. A branded fallback replaces a blank first paint.
 */
const DashboardClient = dynamic(() => import('./DashboardClient'), {
  ssr: false,
  loading: () => <LoadingScreen message="Loading dashboard…" variant="light" />,
});

export default function DashboardPage() {
  return <DashboardClient />;
}
