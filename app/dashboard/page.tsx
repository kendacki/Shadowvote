"use client";

import { CreateProposalModal } from '@/components/CreateProposalModal';
import { EmptyState } from '@/components/EmptyState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PastProposalCard } from '@/components/PastProposalCard';
import { ProposalCard } from '@/components/ProposalCard';
import { Body, H2 } from '@/components/Typography';
import { Button } from '@/components/Button';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { useShadowVote } from '@/hooks/useShadowVote';
import { useVoterIdentity } from '@/hooks/useVoterIdentity';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ReactNode } from 'react';
const PageShell = styled(motion.div, {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  width: '100%',
});

/** Standard flow — spacing clears sticky TopNav; safe-area for notched devices. */
const DashboardContainer = styled('div', {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  paddingTop: '$8',
  paddingBottom: '$8',
  paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
  boxSizing: 'border-box',
});

const Hero = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$4',
  marginBottom: '$8',
});

const TitleBlock = styled('div', {
  flex: '1 1 auto',
  minWidth: 'min(100%, 240px)',
});

const PageTitle = styled('h1', {
  margin: 0,
  marginBottom: '$2',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: 'clamp($xl, 4vw, $3xl)',
  lineHeight: 1.15,
  letterSpacing: '-0.02em',
  color: '$black',
});

const Subline = styled('p', {
  margin: 0,
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$sm',
  color: '$gray500',
  lineHeight: 1.5,
});

const ProposalGrid = styled('div', {
  display: 'grid',
  gap: '24px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
});

const SectionHeading = styled('h2', {
  margin: 0,
  marginBottom: '$5',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$xl',
  lineHeight: 1.25,
  letterSpacing: '-0.02em',
  color: '$black',
});

const PastSection = styled('section', {
  marginTop: '60px',
});

const PastHeading = styled('h2', {
  margin: 0,
  marginBottom: '$6',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$xl',
  lineHeight: 1.25,
  letterSpacing: '-0.02em',
  color: '$black',
});

const PastGrid = styled('div', {
  display: 'grid',
  gap: '24px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
});

const SkeletonGrid = styled('div', {
  display: 'grid',
  gap: '24px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
});

const SkeletonCard = styled('div', {
  height: '200px',
  borderRadius: '12px',
  border: '1px solid #E5E7EB',
  backgroundColor: '$gray100',
});

const SyncBanner = styled(motion.div, {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$3',
  padding: '$4 $5',
  marginBottom: '$5',
  borderRadius: '$md',
  border: '1px solid #E5E7EB',
  backgroundColor: '$gray50',
});

const HookErrorPanel = styled(motion.div, {
  maxWidth: '640px',
  margin: '0 auto',
  padding: '$6 $5',
  borderRadius: '$lg',
  border: '1px solid $red400',
  backgroundColor: 'rgba(239, 68, 68, 0.06)',
});

const DisconnectPanel = styled(motion.div, {
  maxWidth: '520px',
  margin: '0 auto',
  textAlign: 'center',
});

function LoadingSkeleton() {
  return (
    <SkeletonGrid aria-busy aria-label="Loading proposals">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </SkeletonGrid>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const wallet = useMidnightWallet();
  const api = wallet?.getConnectedApi?.() ?? null;
  const identity = useVoterIdentity();
  const shadowVote = useShadowVote(api, identity?.voterSecret ?? null);

  const proposals = shadowVote?.proposals;
  const isLoading = shadowVote?.isLoadingProposals ?? false;
  const shadowError = shadowVote?.error ?? null;
  const isVoting = shadowVote?.isVoting ?? false;
  const syncError = shadowVote?.syncError ?? null;
  const clearShadowError = shadowVote?.clearError ?? (() => {});
  const clearSyncError = shadowVote?.clearSyncError ?? (() => {});

  const safeProposals = Array.isArray(proposals) ? proposals : [];
  const allPastProposals = shadowVote?.allPastProposals ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);

  const identityReady =
    Boolean(identity?.isReady) && identity?.voterSecret != null && identity.voterSecret.length === 32;

  const registerPending = shadowVote?.registerPendingProposal;
  const recordPast = shadowVote?.recordUserPastProposalFromModal;

  const handleCreateProposal = useCallback(
    ({ proposalId, title }: { proposalId: number; title: string }) => {
      if (title) {
        try {
          const raw = localStorage.getItem('shadowvote.proposalTitles.v1');
          const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
          map[String(proposalId)] = title;
          localStorage.setItem('shadowvote.proposalTitles.v1', JSON.stringify(map));
        } catch {
          /* ignore */
        }
      }
      registerPending?.(proposalId);
      recordPast?.(proposalId, title);
      setIsModalOpen(false);
    },
    [registerPending, recordPast],
  );

  if (wallet?.isLoading) {
    return (
      <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <LoadingScreen message="Loading wallet…" variant="light" />
        <CreateProposalModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateProposal}
          isSubmitting={isVoting}
        />
      </PageShell>
    );
  }

  if (!wallet?.isConnected || !wallet?.unshieldedAddress) {
    return (
      <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <DashboardContainer>
          <DisconnectPanel initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <PageTitle css={{ marginBottom: '$4' }}>Connect your wallet</PageTitle>
            <Body css={{ marginBottom: '$6', fontFamily: '$poppins' }}>
              Use <strong>Connect wallet</strong> in the navigation bar (Lace on Preprod), or go <strong>home</strong>{' '}
              and use <strong>Connect</strong> → <strong>Open app</strong>.
            </Body>
            <Button type="button" variant="primary" onClick={() => router.push('/')}>
              Return home
            </Button>
          </DisconnectPanel>
        </DashboardContainer>
      </PageShell>
    );
  }

  let proposalBody: ReactNode;
  if (isLoading && safeProposals.length === 0) {
    proposalBody = <LoadingSkeleton />;
  } else if (shadowError) {
    proposalBody = (
      <HookErrorPanel
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        role="alert"
      >
        <H2 css={{ marginTop: 0, marginBottom: '$3', fontSize: '$lg', color: '$red400', fontFamily: '$poppins' }}>
          Could not load proposals
        </H2>
        <Body css={{ color: '$gray600', marginBottom: '$5', fontFamily: '$poppins' }}>{String(shadowError)}</Body>
        <Button type="button" variant="secondary" onClick={() => clearShadowError()}>
          Dismiss
        </Button>
      </HookErrorPanel>
    );
  } else if (safeProposals.length === 0) {
    proposalBody = (
      <EmptyState
        onOpenModal={() => setIsModalOpen(true)}
        disabled={!identityReady || isVoting}
      />
    );
  } else {
    proposalBody = (
      <ProposalGrid>
        {safeProposals.map((p, i) => (
          <ProposalCard key={p.id} proposalId={p.id} tally={p.tally} index={i} />
        ))}
      </ProposalGrid>
    );
  }

  return (
    <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardContainer>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Hero>
            <TitleBlock>
              <PageTitle>Governance Dashboard</PageTitle>
              <Subline>
                {identityReady
                  ? 'Voter identity ready below — create or open a proposal.'
                  : 'Preparing secure voter identity…'}
              </Subline>
            </TitleBlock>
            <Button
              type="button"
              variant="primary"
              disabled={!identityReady || isVoting}
              onClick={() => setIsModalOpen(true)}
            >
              New Proposal
            </Button>
          </Hero>

          {wallet?.error ? (
            <Body css={{ color: '$red400', marginBottom: '$4', fontFamily: '$poppins' }}>{wallet.error}</Body>
          ) : null}

          {syncError ? (
            <SyncBanner
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Body css={{ fontSize: '$sm', color: '$gray600', margin: 0, fontFamily: '$poppins' }}>
                Live sync: {syncError}
              </Body>
              <Button type="button" variant="secondary" onClick={() => clearSyncError()}>
                Dismiss
              </Button>
            </SyncBanner>
          ) : null}

          <SectionHeading>Active Proposals</SectionHeading>
          {proposalBody}

          <PastSection aria-labelledby="dashboard-past-proposals-heading">
            <PastHeading id="dashboard-past-proposals-heading">Past Proposals</PastHeading>
            <PastGrid>
              {allPastProposals.map((p, i) => (
                <PastProposalCard key={p.id} proposal={p} index={i} />
              ))}
            </PastGrid>
          </PastSection>
        </motion.div>
      </DashboardContainer>

      <CreateProposalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProposal}
        isSubmitting={isVoting}
      />
    </PageShell>
  );
}
