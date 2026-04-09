"use client";

import { CreateProposalModal } from '@/components/CreateProposalModal';
import { EmptyState } from '@/components/EmptyState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ProposalCard } from '@/components/ProposalCard';
import { Body, Caption, H1, H2 } from '@/components/Typography';
import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { useShadowVote, type VoteTxStage } from '@/hooks/useShadowVote';
import { useVoterIdentity } from '@/hooks/useVoterIdentity';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ReactNode } from 'react';
import { formatTNight, truncateAddress } from '@/utils/formatters';

const PageShell = styled(motion.div, {
  minHeight: '100vh',
  backgroundColor: '#FFFFFF',
});

const Header = styled('header', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$4',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '$6 max($5, env(safe-area-inset-left, 0px)) $6 max($5, env(safe-area-inset-right, 0px))',
  borderBottom: '1px solid #E5E7EB',
  '@md': { padding: '$6 max($8, env(safe-area-inset-left, 0px)) $6 max($8, env(safe-area-inset-right, 0px))' },
});

const BrandRow = styled('div', {
  display: 'flex',
  alignItems: 'center',
  gap: '$4',
});

const LogoMark = styled('div', {
  position: 'relative',
  width: '48px',
  height: '48px',
  flexShrink: 0,
  borderRadius: '$md',
  border: '1px solid #E5E7EB',
  backgroundColor: '$white',
  overflow: 'hidden',
});

const WalletPanel = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '$1',
  textAlign: 'left',
  width: '100%',
  '@sm': {
    width: 'auto',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
});

const Main = styled('main', {
  maxWidth: '1200px',
  margin: '0 auto',
  padding:
    '$8 max($5, env(safe-area-inset-left, 0px)) $9 max($5, env(safe-area-inset-right, 0px))',
  '@md': {
    padding: '$8 max($8, env(safe-area-inset-left, 0px)) $9 max($8, env(safe-area-inset-right, 0px))',
  },
});

const MainMotion = styled(motion.div, {
  width: '100%',
});

const Toolbar = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '$4',
  marginBottom: '$6',
  '@sm': {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

const ProposalGrid = styled('div', {
  display: 'grid',
  gap: '24px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
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

const DisconnectPrompt = styled(motion.div, {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '$8 $5',
  textAlign: 'center',
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

function LoadingSkeleton() {
  return (
    <SkeletonGrid aria-busy aria-label="Loading proposals">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </SkeletonGrid>
  );
}

function applyVoteStageToast(
  toast: ReturnType<typeof useToast>,
  toastId: string,
  proposalId: number,
  stage: VoteTxStage,
) {
  switch (stage) {
    case 'preparing':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Preparing',
        message: 'Setting up providers and contract state…',
      });
      break;
    case 'proving':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Generating ZK proof',
        message: 'Proving circuit in your browser — this can take a while.',
      });
      break;
    case 'submitting':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Submitting to network',
        message: 'Balancing and relaying the transaction via Lace.',
      });
      break;
    case 'confirmed':
      toast.update(toastId, {
        variant: 'success',
        title: 'Confirmed',
        message: `Vote recorded for proposal #${proposalId}.`,
      });
      break;
    case 'failed_user_rejected':
      toast.update(toastId, {
        variant: 'error',
        title: 'Transaction cancelled',
        message: 'The wallet did not sign or submit the transaction.',
      });
      break;
    case 'failed_already_voted':
      toast.update(toastId, {
        variant: 'error',
        title: 'Already voted',
        message: `Your identity already cast a vote on proposal #${proposalId}. Nullifier is spent on-chain.`,
      });
      break;
    case 'failed_network':
      toast.update(toastId, {
        variant: 'error',
        title: 'Network error',
        message: 'Could not complete the request. Check your connection and try again.',
      });
      break;
    case 'failed':
      toast.update(toastId, {
        variant: 'error',
        title: 'Failed',
        message: 'The transaction did not complete. See the message below.',
      });
      break;
    default:
      break;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
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

  const [createOpen, setCreateOpen] = useState(false);

  const identityReady =
    Boolean(identity?.isReady) && identity?.voterSecret != null && identity.voterSecret.length === 32;

  const runVoteWithToast = useCallback(
    async (proposalId: number) => {
      const cast = shadowVote?.castVote;
      if (typeof cast !== 'function') {
        console.error('DashboardPage: castVote is not available');
        return;
      }
      const toastId = toast.loading('Preparing', 'Initializing transaction…');
      await cast(proposalId, (stage: VoteTxStage) => applyVoteStageToast(toast, toastId, proposalId, stage));
    },
    [shadowVote, toast],
  );

  const handleCreateProposal = useCallback(
    async ({ proposalId, title }: { proposalId: number; title: string }) => {
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
      try {
        await runVoteWithToast(proposalId);
        setCreateOpen(false);
      } catch {
        /* Toast already shows failure; keep modal open for retry */
      }
    },
    [runVoteWithToast],
  );

  if (wallet?.isLoading) {
    return <LoadingScreen message="Loading wallet…" variant="light" />;
  }

  if (!wallet?.isConnected || !wallet?.unshieldedAddress) {
    return (
      <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <DisconnectPrompt initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <H1 css={{ marginBottom: '$4' }}>Connect your wallet</H1>
          <Body css={{ marginBottom: '$6', fontFamily: '$poppins' }}>
            The ShadowVote dashboard needs an active Lace connection to read contract state and submit shielded
            votes. Head back to the home page and connect to Preprod.
          </Body>
          <Button type="button" variant="primary" onClick={() => router.push('/')}>
            Return home
          </Button>
        </DisconnectPrompt>
      </PageShell>
    );
  }

  let proposalBody: ReactNode;
  if (isLoading) {
    proposalBody = <LoadingSkeleton />;
  } else if (shadowError) {
    proposalBody = (
      <HookErrorPanel
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        role="alert"
      >
        <H2 css={{ marginTop: 0, marginBottom: '$3', fontSize: '$lg', color: '$red400' }}>
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
        onCreateClick={() => setCreateOpen(true)}
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

  const showToolbar = !isLoading && !shadowError && safeProposals.length > 0;

  return (
    <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <Header>
        <BrandRow>
          <LogoMark>
            <img src="/shadowvote-emblem.svg" alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
          </LogoMark>
          <div>
            <Caption>ShadowVote</Caption>
            <H1
              css={{
                margin: 0,
                fontSize: '$xl',
                fontWeight: '$semibold',
                color: '$black',
                fontFamily: '$poppins',
              }}
            >
              Governance Dashboard
            </H1>
          </div>
        </BrandRow>
        <WalletPanel>
          <Caption>Wallet</Caption>
          <Body
            title={wallet.unshieldedAddress}
            css={{
              fontSize: '$sm',
              color: '$black',
              fontWeight: '$semibold',
              fontFamily: '$poppins',
              fontVariantNumeric: 'tabular-nums',
              maxWidth: 'min(260px, 72vw)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {truncateAddress(wallet.unshieldedAddress)}
          </Body>
          <Caption>{formatTNight(wallet.tNightBalance)}</Caption>
        </WalletPanel>
      </Header>

      <Main>
        <MainMotion initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
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

          {showToolbar ? (
            <Toolbar>
              <div>
                <H2 css={{ margin: 0, marginBottom: '$2', fontSize: '$lg', color: '$black', fontFamily: '$poppins' }}>
                  Proposals
                </H2>
                <Body css={{ fontSize: '$sm', color: '$gray500', margin: 0, fontFamily: '$poppins' }}>
                  {identityReady ? 'Local voter identity is ready.' : 'Loading secure voter identity…'}
                </Body>
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={!identityReady || isVoting}
                onClick={() => setCreateOpen(true)}
              >
                New proposal
              </Button>
            </Toolbar>
          ) : null}

          {proposalBody}
        </MainMotion>
      </Main>

      <CreateProposalModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateProposal}
        isSubmitting={isVoting}
      />
    </PageShell>
  );
}
