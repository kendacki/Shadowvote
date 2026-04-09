'use client';

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
import { useCallback, useState } from 'react';
import { formatTNight, truncateAddress } from '@/utils/formatters';

const PageShell = styled(motion.div, {
  minHeight: '100vh',
  backgroundColor: '$white',
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
  '@md': { padding: '$6 max($8, env(safe-area-inset-left, 0px)) $6 max($8, env(safe-area-inset-right, 0px))' },
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

const Grid = styled(motion.div, {
  display: 'grid',
  gap: '$5',
  gridTemplateColumns: '1fr',
  '@md': { gridTemplateColumns: 'repeat(2, 1fr)' },
  '@lg': { gridTemplateColumns: 'repeat(3, 1fr)' },
});

const SkeletonGrid = styled('div', {
  display: 'grid',
  gap: '$5',
  gridTemplateColumns: '1fr',
  '@md': { gridTemplateColumns: 'repeat(2, 1fr)' },
  '@lg': { gridTemplateColumns: 'repeat(3, 1fr)' },
});

const SkeletonCard = styled(motion.div, {
  height: '200px',
  borderRadius: '$lg',
  background: 'linear-gradient(90deg, $gray100 0%, $gray200 50%, $gray100 100%)',
  backgroundSize: '200% 100%',
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
  border: '1px solid $gray200',
  backgroundColor: '$gray100',
});

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
  const api = wallet.getConnectedApi();
  const identity = useVoterIdentity();
  const shadow = useShadowVote(api, identity.voterSecret);

  const [createOpen, setCreateOpen] = useState(false);

  const identityReady = identity.isReady && identity.voterSecret !== null && identity.voterSecret.length === 32;

  const runVoteWithToast = useCallback(
    async (proposalId: number) => {
      const toastId = toast.loading('Preparing', 'Initializing transaction…');
      await shadow.castVote(proposalId, (stage) => applyVoteStageToast(toast, toastId, proposalId, stage));
    },
    [shadow, toast],
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

  if (wallet.isLoading) {
    return <LoadingScreen message="Loading wallet…" variant="light" />;
  }

  if (!wallet.isConnected || !wallet.unshieldedAddress) {
    return (
      <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <DisconnectPrompt initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <H1 css={{ marginBottom: '$4' }}>Connect your wallet</H1>
          <Body css={{ marginBottom: '$6' }}>
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

  return (
    <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <Header>
        <div>
          <Caption>ShadowVote</Caption>
          <H1 css={{ margin: 0, fontSize: '$xl', fontWeight: '$semibold', color: '$black' }}>
            Governance Dashboard
          </H1>
        </div>
        <WalletPanel>
          <Caption>Wallet</Caption>
          <Body
            title={wallet.unshieldedAddress}
            css={{
              fontSize: '$sm',
              color: '$black',
              fontWeight: '$semibold',
              fontFamily: 'ui-monospace, "Cascadia Mono", monospace',
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
        <Toolbar>
          <div>
            <H2 css={{ margin: 0, marginBottom: '$2', fontSize: '$lg', color: '$black' }}>Proposals</H2>
            <Body css={{ fontSize: '$sm', color: '$gray500', margin: 0 }}>
              {identityReady ? 'Local voter identity is ready.' : 'Loading secure voter identity…'}
            </Body>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={!identityReady || shadow.isVoting}
            onClick={() => setCreateOpen(true)}
          >
            New proposal
          </Button>
        </Toolbar>

        {wallet.error ? <Body css={{ color: '$red400', marginBottom: '$4' }}>{wallet.error}</Body> : null}
        {shadow.error ? <Body css={{ color: '$red400', marginBottom: '$4' }}>{shadow.error}</Body> : null}

        {shadow.syncError ? (
          <SyncBanner
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Body css={{ fontSize: '$sm', color: '$gray600', margin: 0 }}>Live sync: {shadow.syncError}</Body>
            <Button type="button" variant="secondary" onClick={() => shadow.clearSyncError()}>
              Dismiss
            </Button>
          </SyncBanner>
        ) : null}

        <MainMotion initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.05 }}>
          {shadow.isLoadingProposals ? (
            <SkeletonGrid>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard
                  key={i}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.08 }}
                />
              ))}
            </SkeletonGrid>
          ) : shadow.proposals.length === 0 ? (
            <EmptyState
              title="No proposals yet"
              description={
                <>
                  Nothing is registered for this contract on-chain yet. Create the first proposal to open a vote, or
                  confirm your contract address in the environment.
                </>
              }
            >
              <Button
                type="button"
                variant="primary"
                disabled={!identityReady || shadow.isVoting}
                onClick={() => setCreateOpen(true)}
              >
                New proposal
              </Button>
            </EmptyState>
          ) : (
            <Grid>
              {shadow.proposals.map((p, i) => (
                <ProposalCard
                  key={p.id}
                  index={i}
                  proposalId={p.id}
                  tally={p.tally}
                  isVoting={shadow.isVoting}
                  hasVoted={identityReady && shadow.checkHasVoted(String(p.id))}
                  disabled={!identityReady}
                  onVote={() => void runVoteWithToast(p.id)}
                />
              ))}
            </Grid>
          )}
        </MainMotion>
      </Main>

      <CreateProposalModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateProposal}
        isSubmitting={shadow.isVoting}
      />
    </PageShell>
  );
}
