'use client';

import { LoadingScreen } from '@/components/LoadingScreen';
import dynamic from 'next/dynamic';
import { notFound, useParams } from 'next/navigation';

const ProposalDetailClient = dynamic(() => import('./ProposalDetailClient'), {
  ssr: false,
  loading: () => <LoadingScreen message="Loading proposal…" variant="light" />,
});

export default function ProposalDetailPage() {
  const params = useParams();
  const raw = params?.id;
  if (typeof raw !== 'string') notFound();
  const proposalId = Number.parseInt(raw, 10);
  if (!Number.isFinite(proposalId) || proposalId < 0 || String(proposalId) !== raw) {
    notFound();
  }
  return <ProposalDetailClient proposalId={proposalId} />;
}
