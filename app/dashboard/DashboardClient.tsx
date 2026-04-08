'use client';

import { CreateProposalModal } from '@/components/CreateProposalModal';
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
import { useCallback, useEffect, useState } from 'react';

const Page = styled(motion.div, {
  minHeight: '100vh',
  backgroundColor: '$white',
});

const Header = styled('header', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$4',
  maxWidth: '1120px',
  margin: '0 auto',
  padding: '$6 max($5, env(safe-area-inset-left, 0px)) $6 max($5, env(safe-area-inset-right, 0px))',
  '@md': { padding: '$6 max($7, env(safe-area-inset-left, 0px)) $6 max($7, env(safe-area-inset-right, 0px))' },
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
  maxWidth: '1120px',
  margin: '0 auto',
  padding: '$5 max($5, env(safe-area-inset-left, 0px)) $9 max($5, env(safe-area-inset-right, 0px))',
  '@md': { padding: '$6 max($7, env(safe-area-inset-left, 0px)) $9 max($7, env(safe-area-inset-right, 0px))' },
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

const SpinnerWrap = styled('div', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '240px',
});

const Spinner = styled(motion.div, {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  border: '3px solid $gray200',
  borderTopColor: '$red400',
});

const DisconnectPrompt = styled(motion.div, {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '$8 $5',
  textAlign: 'center',
});

const EmptyState = styled(motion.div, {
  maxWidth: '520px',
  padding: '$8 $5',
  borderRadius: '$lg',
  border: '1px dashed $gray200',
  backgroundColor: '$gray50',
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

function formatAddress(a: string): string {
  if (a.length <= 16) return a;
  return `${a.slice(0, 10)}…${a.slice(-8)}`;
}

function formatTNight(n: bigint): string {
  const whole = n / 1_000_000n;
  const frac = (n % 1_000_000n).toString().padStart(6, '0').slice(0, 2);
  return `${whole.toString()}.${frac} tNight`;
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

export default function DashboardClient() {
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
    return (
      <Page initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <SpinnerWrap>
          <Spinner
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          />
        </SpinnerWrap>
      </Page>
    );
  }

  if (!wallet.isConnected || !wallet.unshieldedAddress) {
    return (
      <Page initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
      </Page>
    );
  }

  return (
    <Page initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <Header>
        <div>
          <Caption>ShadowVote</Caption>
          <H2>Dashboard</H2>
        </div>
        <WalletPanel>
          <Caption>Wallet</Caption>
          <Body css={{ fontSize: '$sm', color: '$black', fontWeight: '$semibold' }}>
            {formatAddress(wallet.unshieldedAddress)}
          </Body>
          <Caption>
            {wallet.tNightBalance !== null ? formatTNight(wallet.tNightBalance) : '—'}
          </Caption>
        </WalletPanel>
      </Header>

      <Main>
        <Toolbar>
          <div>
            <Body css={{ fontSize: '$sm', color: '$gray500' }}>
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

        {wallet.error && (
          <Body css={{ color: '$red400', marginBottom: '$4' }}>{wallet.error}</Body>
        )}
        {shadow.error && (
          <Body css={{ color: '$red400', marginBottom: '$4' }}>{shadow.error}</Body>
        )}
        {shadow.syncError && (
          <SyncBanner
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Body css={{ fontSize: '$sm', color: '$gray600', margin: 0 }}>
              Live sync: {shadow.syncError}
            </Body>
            <Button type="button" variant="secondary" onClick={() => shadow.clearSyncError()}>
              Dismiss
            </Button>
          </SyncBanner>
        )}

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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <H2 css={{ marginTop: 0, marginBottom: '$3', fontSize: '$xl' }}>No proposals yet</H2>
            <Body css={{ color: '$gray500', marginBottom: '$5' }}>
              Nothing is registered for this contract on-chain. Create a proposal to open the first vote, or confirm
              your contract address in the environment.
            </Body>
            <Button type="button" variant="primary" disabled={!identityReady || shadow.isVoting} onClick={() => setCreateOpen(true)}>
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
      </Main>

      <CreateProposalModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateProposal}
        isSubmitting={shadow.isVoting}
      />
    </Page>
  );
}
