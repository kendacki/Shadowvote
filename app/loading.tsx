import { LoadingScreen } from '@/components/LoadingScreen';

/** Next.js route-level Suspense fallback — runs during navigation and first paint before segment resolves. */
export default function Loading() {
  return <LoadingScreen message="Loading…" variant="light" />;
}
